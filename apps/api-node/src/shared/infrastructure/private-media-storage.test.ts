import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createPrivateMediaStorage } from "./private-media-storage.js";

test("local retry reuses identical bytes without overwriting a conflicting reference", async () => {
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-upload-retry-"));
  const owner = "11111111-1111-4111-8111-111111111111", id = "22222222-2222-4222-8222-222222222222";
  const storage = createPrivateMediaStorage({ uploadDir, namespace: "warehouse-proof", invalidPathMessage: "Invalid", notFoundMessage: "Missing" });
  try {
    const bytes = Buffer.from("original");
    const saved = await storage.save(owner, id, "jpg", bytes);
    const otherInstance = createPrivateMediaStorage({ uploadDir, namespace: "warehouse-proof", invalidPathMessage: "Invalid", notFoundMessage: "Missing" });
    assert.deepEqual(await otherInstance.save(owner, id, "jpg", bytes), saved);
    await assert.rejects(otherInstance.save(owner, id, "jpg", Buffer.from("different")));
    assert.deepEqual((await storage.resolve(saved.secureUrl)).body, bytes);
  } finally { await rm(uploadDir, { recursive: true, force: true }); }
});
