import { v2 as cloudinary } from "cloudinary";
import assert from "node:assert/strict";
import test from "node:test";
import type { PrivateMediaStorage } from "../application/media-storage.port.js";
import { createCloudinaryPrivateMediaStorage } from "./cloudinary-private-media-storage.js";

test("provider existing response requires protected delivery and never invents upload success", async () => {
  const owner = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
  let available = true, reads = 0;
  const client = { config() {}, url: () => "https://signed.example/opaque", uploader: {
    upload_stream: (options: any, callback: any) => ({ end() { assert.equal(options.overwrite, false); callback(null, { existing: true }); } })
  } } as unknown as typeof cloudinary;
  const storage = createCloudinaryPrivateMediaStorage({ config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, namespace: "warehouse-proof", client,
    fetcher: async () => { reads++; return { ok: available, status: available ? 200 : 503, arrayBuffer: async () => new ArrayBuffer(4) } as Response; } });
  assert.equal((await storage.save(owner, id, "jpg", Buffer.alloc(4))).publicId, `lnfs/warehouse-proof/${owner}/${id}`);
  available = false;
  await assert.rejects(storage.save(owner, id, "jpg", Buffer.alloc(4)));
  assert.equal(reads, 2);
});

for (const namespace of ["post-media", "claim-evidence", "warehouse-proof"] as const) test(`Cloudinary ${namespace} uploads, signs downloads and removes authenticated assets across instances`, async () => {
  const calls: { upload?: unknown; destroy?: unknown; url?: unknown; } = {};
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const mediaId = "22222222-2222-4222-8222-222222222222";
  const fakeClient = {
    config() { },
    uploader: {
      upload_stream(options: unknown, callback: (error: null, result: unknown) => void) {
        calls.upload = options;
        return { end() { callback(null, { public_id: `lnfs/${namespace}/${ownerId}/${mediaId}` }); } };
      },
      async destroy(publicId: string, options: unknown) {
        calls.destroy = { publicId, options };
        return { result: "ok" };
      }
    },
    url(publicId: string, options: unknown) {
      calls.url = { publicId, options };
      return "https://signed.example/media.jpg";
    }
  } as unknown as typeof cloudinary;
  const storage = createCloudinaryPrivateMediaStorage({
    config: { cloudName: "test", apiKey: "test", apiSecret: "test" },
    namespace,
    client: fakeClient,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer } as Response)
  });

  const uploaded = await storage.save(ownerId, mediaId, "jpg", Buffer.from([1, 2, 3]));
  const anotherInstance = createCloudinaryPrivateMediaStorage({
    config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, namespace, client: fakeClient,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer } as Response)
  });
  const downloaded = await anotherInstance.resolve(uploaded.secureUrl, "jpg");
  await anotherInstance.remove(uploaded.secureUrl);

  assert.equal(uploaded.secureUrl, `cloudinary://${namespace}/${ownerId}/${mediaId}.jpg`);
  assert.equal(uploaded.publicId, `lnfs/${namespace}/${ownerId}/${mediaId}`);
  assert.deepEqual(downloaded.body, Buffer.from([1, 2, 3]));
  assert.equal(downloaded.contentType, "image/jpeg");
  assert.equal((calls.upload as { type: string; }).type, "authenticated");
  assert.equal((calls.url as { options: { sign_url: boolean; type: string; }; }).options.sign_url, true);
  assert.equal((calls.url as { options: { sign_url: boolean; type: string; }; }).options.type, "authenticated");
  assert.equal((calls.destroy as { options: { type: string; }; }).options.type, "authenticated");
});

test("durable warehouse mode rejects local writes but still reads and removes legacy local proof", async () => {
  let writes = 0;
  let removed = false;
  const fallback: PrivateMediaStorage = {
    save: async () => { writes += 1; return { secureUrl: "private://legacy", publicId: "legacy" }; },
    resolve: async () => ({ body: Buffer.from("legacy"), contentType: "image/jpeg" }),
    remove: async () => { removed = true; }
  };
  const storage = createCloudinaryPrivateMediaStorage({ config: { cloudName: null, apiKey: null, apiSecret: null }, namespace: "warehouse-proof", allowLocalWrites: false, fallback });
  await assert.rejects(storage.save("owner", "media", "jpg", Buffer.from("new")), (error: unknown) => (error as { code: string }).code === "unavailable");
  assert.equal(writes, 0);
  assert.equal((await storage.resolve("private://legacy")).body.toString(), "legacy");
  await storage.remove("private://legacy");
  assert.equal(removed, true);
});

test("Cloudinary upload failure never falls back to an instance-local warehouse file", async () => {
  let fallbackWrites = 0;
  const storage = createCloudinaryPrivateMediaStorage({ config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, namespace: "warehouse-proof",
    client: { config() {}, uploader: { upload_stream(_options: unknown, callback: (error: Error) => void) { return { end() { callback(new Error("Cloud unavailable")); } }; } } } as unknown as typeof cloudinary,
    fallback: { save: async () => { fallbackWrites += 1; throw new Error("Must not write"); }, resolve: async () => { throw new Error("Unused"); }, remove: async () => {} }
  });
  await assert.rejects(storage.save("owner", "media", "jpg", Buffer.from("new")), (error: unknown) => (error as { code: string }).code === "upstream_failure");
  assert.equal(fallbackWrites, 0);
});

test("Cloudinary private media storage uses the local fallback when credentials are absent", async () => {
  let saved = false;
  const fallback = {
    async save() {
      saved = true;
      return { secureUrl: "/uploads/post-media/owner/media.jpg", publicId: "post-media/owner/media" };
    },
    async resolve() { return { body: Buffer.from([1]), contentType: "image/jpeg" }; },
    async remove() { }
  } satisfies PrivateMediaStorage;
  const storage = createCloudinaryPrivateMediaStorage({
    config: { cloudName: null, apiKey: null, apiSecret: null },
    namespace: "post-media",
    fallback
  });

  const result = await storage.save("owner", "media", "jpg", Buffer.from([1]));

  assert.equal(saved, true);
  assert.equal(result.secureUrl, "/uploads/post-media/owner/media.jpg");
});

test("private delivery network failure is retryable, does not read local fallback, and does not log signed URLs", async (t) => {
  const warnings: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => { warnings.push(args); });
  let fallbackReads = 0;
  const storage = createCloudinaryPrivateMediaStorage({
    config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, namespace: "warehouse-proof",
    client: { config() {}, url: () => "https://signed.example/private?secret=never-log" } as unknown as typeof cloudinary,
    fallback: { save: async () => { throw new Error("Unused"); }, resolve: async () => { fallbackReads++; throw new Error("Must not read local"); }, remove: async () => {} },
    fetcher: async (_url, init) => {
      assert.ok(init?.signal);
      throw new TypeError("fetch failed", { cause: Object.assign(new Error("reset"), { code: "ECONNRESET" }) });
    }
  });

  await assert.rejects(storage.resolve("cloudinary://warehouse-proof/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg"),
    (error: unknown) => (error as { code: string }).code === "upstream_failure");
  assert.equal(fallbackReads, 0);
  assert.equal(warnings.length, 1);
  assert.equal((warnings[0][1] as { causeCode: string }).causeCode, "ECONNRESET");
  assert.doesNotMatch(JSON.stringify(warnings), /signed\.example|never-log/);
});

test("private delivery distinguishes timeout, missing image, provider errors, and failed response body", async (t) => {
  t.mock.method(console, "warn", () => {});
  const reference = "cloudinary://warehouse-proof/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg";
  const createStorage = (fetcher: (input: string, init?: RequestInit) => Promise<Response>) => createCloudinaryPrivateMediaStorage({
    config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, namespace: "warehouse-proof",
    client: { config() {}, url: () => "https://signed.example/private" } as unknown as typeof cloudinary,
    fetcher
  });
  for (const [fetcher, expected] of [
    [async () => { throw new DOMException("timed out", "TimeoutError"); }, "upstream_timeout"],
    [async () => ({ ok: false, status: 404 }) as Response, "not_found"],
    [async () => ({ ok: false, status: 503 }) as Response, "upstream_failure"],
    [async () => ({ ok: false, status: 403 }) as Response, "upstream_failure"],
    [async () => ({ ok: true, arrayBuffer: async () => { throw new TypeError("body interrupted"); } }) as unknown as Response, "upstream_failure"]
  ] as const) {
    await assert.rejects(createStorage(fetcher).resolve(reference),
      (error: unknown) => (error as { code: string }).code === expected);
  }
});
