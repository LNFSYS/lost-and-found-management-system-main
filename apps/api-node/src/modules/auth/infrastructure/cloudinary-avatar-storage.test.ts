import { v2 as cloudinary } from "cloudinary";
import assert from "node:assert/strict";
import test from "node:test";
import { createCloudinaryAvatarStorage } from "./cloudinary-avatar-storage.js";

test("deterministic avatar retry fetches existing metadata instead of overwriting or returning incomplete success", async () => {
  let available = true;
  const client = { config() {}, uploader: {
    upload_stream: (options: any, callback: any) => ({ end() {
      assert.equal(options.overwrite, false); assert.equal(options.unique_filename, false); assert.equal(options.public_id, "stable-id");
      callback(null, { existing: true });
    } })
  }, api: { resource: async (id: string, options: any) => {
    assert.equal(id, "lnfs/avatars/stable-id"); assert.equal(options.type, "authenticated");
    if (!available) throw new Error("private provider diagnostic");
    return { public_id: id, version: 1, format: "jpg", bytes: 4 };
  } } } as unknown as typeof cloudinary;
  const storage = createCloudinaryAvatarStorage({ config: { cloudName: "test", apiKey: "test", apiSecret: "test" }, client });
  assert.equal((await storage.upload({ buffer: Buffer.alloc(4), format: "jpg", publicId: "stable-id" })).publicId, "lnfs/avatars/stable-id");
  available = false;
  await assert.rejects(storage.upload({ buffer: Buffer.alloc(4), format: "jpg", publicId: "stable-id" }), error => !String(error).includes("private provider diagnostic"));
});

test("Cloudinary avatar storage uploads, signs downloads and destroys authenticated assets", async () => {
  const calls: { upload?: unknown; destroy?: unknown; url?: unknown; } = {};
  const fakeClient = {
    config() { },
    uploader: {
      upload_stream(options: unknown, callback: (error: null, result: unknown) => void) {
        calls.upload = options;
        return { end() { callback(null, { public_id: "lnfs/avatars/test", asset_id: "asset-1", version: 12, format: "jpg", bytes: 4 }); } };
      },
      async destroy(publicId: string, options: unknown) { calls.destroy = { publicId, options }; return { result: "ok" }; }
    },
    url(publicId: string, options: unknown) { calls.url = { publicId, options }; return "https://signed.example/avatar.jpg"; }
  } as unknown as typeof cloudinary;
  const storage = createCloudinaryAvatarStorage({
    config: { cloudName: "test", apiKey: "test", apiSecret: "test" },
    client: fakeClient,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer } as Response)
  });

  const uploaded = await storage.upload({ buffer: Buffer.from([1, 2, 3, 4]), format: "jpg" });
  const downloaded = await storage.download({ publicId: uploaded.publicId, version: uploaded.version, format: uploaded.format });
  await storage.destroy(uploaded.publicId);

  assert.equal(uploaded.publicId, "lnfs/avatars/test");
  assert.deepEqual(downloaded.body, Buffer.from([1, 2, 3]));
  assert.equal((calls.upload as { folder: string; }).folder, "lnfs/avatars");
  assert.equal((calls.upload as { type: string; }).type, "authenticated");
  assert.equal((calls.url as { options: { sign_url: boolean; }; }).options.sign_url, true);
  assert.equal((calls.destroy as { options: { type: string; }; }).options.type, "authenticated");
});
