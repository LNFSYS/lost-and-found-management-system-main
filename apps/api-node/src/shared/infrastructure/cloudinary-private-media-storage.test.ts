import { v2 as cloudinary } from "cloudinary";
import assert from "node:assert/strict";
import test from "node:test";
import type { PrivateMediaStorage } from "../application/media-storage.port.js";
import { createCloudinaryPrivateMediaStorage } from "./cloudinary-private-media-storage.js";

test("Cloudinary private media storage uploads, signs downloads and removes authenticated assets", async () => {
  const calls: { upload?: unknown; destroy?: unknown; url?: unknown; } = {};
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const mediaId = "22222222-2222-4222-8222-222222222222";
  const fakeClient = {
    config() { },
    uploader: {
      upload_stream(options: unknown, callback: (error: null, result: unknown) => void) {
        calls.upload = options;
        return { end() { callback(null, { public_id: `lnfs/post-media/${ownerId}/${mediaId}` }); } };
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
    namespace: "post-media",
    client: fakeClient,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer } as Response)
  });

  const uploaded = await storage.save(ownerId, mediaId, "jpg", Buffer.from([1, 2, 3]));
  const downloaded = await storage.resolve(uploaded.secureUrl, "jpg");
  await storage.remove(uploaded.secureUrl);

  assert.equal(uploaded.secureUrl, `cloudinary://post-media/${ownerId}/${mediaId}.jpg`);
  assert.equal(uploaded.publicId, `lnfs/post-media/${ownerId}/${mediaId}`);
  assert.deepEqual(downloaded.body, Buffer.from([1, 2, 3]));
  assert.equal(downloaded.contentType, "image/jpeg");
  assert.equal((calls.upload as { type: string; }).type, "authenticated");
  assert.equal((calls.url as { options: { sign_url: boolean; type: string; }; }).options.sign_url, true);
  assert.equal((calls.url as { options: { sign_url: boolean; type: string; }; }).options.type, "authenticated");
  assert.equal((calls.destroy as { options: { type: string; }; }).options.type, "authenticated");
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
