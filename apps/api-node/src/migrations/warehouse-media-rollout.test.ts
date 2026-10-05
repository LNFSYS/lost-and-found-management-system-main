import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { PrivateMediaStorage } from "../shared/application/media-storage.port.js";
import { decryptMediaArchive, digest, encryptMediaArchive, legacyMediaPath, migrateWarehouseMedia, type LegacyWarehouseMedia, type MediaRolloutEntry } from "./warehouse-media-rollout.js";

const owner = "11111111-1111-4111-8111-111111111111";
const image = "22222222-2222-4222-8222-222222222222";
const target = "33333333-3333-4333-8333-333333333333";
const row: LegacyWarehouseMedia = { table: "warehouse_private_proofs", id: image, ownerId: owner, storageRef: `private://warehouse-proof/${owner}/${image}.png`, format: "png", bytes: 6, intakeId: null };

function fixture() {
  const journal: MediaRolloutEntry[] = [];
  const removed: string[] = [];
  let replacements = 0;
  const storage: PrivateMediaStorage = {
    save: async (ownerId, id, format) => ({ secureUrl: `cloudinary://warehouse-proof/${ownerId}/${id}.${format}`, publicId: id }),
    resolve: async () => ({ body: Buffer.from("canonical"), contentType: "image/png" }),
    remove: async ref => { removed.push(ref); }
  };
  const options = { rows: [row], source: async () => Buffer.from("source"), storage, independentStorage: { ...storage },
    repository: { replace: async () => { replacements++; return true; }, referenceInUse: async () => false },
    journal: async (entry: MediaRolloutEntry) => { journal.push({ ...entry }); }, id: () => target };
  return { options, journal, removed, replacements: () => replacements };
}

test("warehouse archive is authenticated and contains no plaintext proof", () => {
  const key = randomBytes(32);
  const value = { private: "recipient-proof", source: "bytes" };
  const bytes = encryptMediaArchive(value, key);
  assert.equal(bytes.includes(Buffer.from("recipient-proof")), false);
  assert.deepEqual(decryptMediaArchive(bytes, key), value);
  assert.throws(() => decryptMediaArchive(bytes, randomBytes(32)));
  bytes[bytes.length - 1] ^= 1;
  assert.throws(() => decryptMediaArchive(bytes, key));
});

test("warehouse rollout journals before upload/write and records normalized delivery separately", async () => {
  const f = fixture();
  const save = f.options.storage.save;
  f.options.storage.save = async (...args) => { assert.equal(f.journal[0].state, "PLANNED"); return save(...args); };
  f.options.repository.replace = async () => { assert.equal(f.journal.at(-1)?.state, "VERIFIED"); return true; };
  const [result] = await migrateWarehouseMedia(f.options);
  assert.equal(result.state, "COMMITTED");
  assert.equal(result.sourceSha256, digest("source"));
  assert.equal(result.deliverySha256, digest("canonical"));
  assert.deepEqual(f.journal.map(e => e.state), ["PLANNED", "VERIFIED", "COMMITTED"]);
  assert.deepEqual(f.removed, []);
  assert.equal(row.storageRef.startsWith("private://"), true);
});

test("warehouse rollout never removes an asset when database commit outcome is unknown", async () => {
  const f = fixture();
  f.options.rows = [row, { ...row, id: target }];
  f.options.repository.replace = async () => { throw new Error("COMMIT response lost"); };
  const results = await migrateWarehouseMedia(f.options);
  assert.equal(results.length, 1);
  assert.equal(results[0].state, "REVIEW_REQUIRED");
  assert.equal(results[0].reason, "DATABASE_OR_CLEANUP_OUTCOME_REQUIRES_REVIEW");
  assert.deepEqual(f.removed, []);
});

test("warehouse rollout conflict removes only an unreferenced newly uploaded asset", async () => {
  const f = fixture();
  f.options.repository.replace = async () => false;
  const [result] = await migrateWarehouseMedia(f.options);
  assert.equal(result.state, "CONFLICT");
  assert.deepEqual(f.removed, [result.newRef]);
  assert.notEqual(f.removed[0], row.storageRef);
});

test("warehouse rollout conflict retains a new asset already referenced by a row", async () => {
  const f = fixture();
  f.options.repository.replace = async () => false;
  f.options.repository.referenceInUse = async () => true;
  assert.equal((await migrateWarehouseMedia(f.options))[0].state, "CONFLICT");
  assert.deepEqual(f.removed, []);
});

test("warehouse rollout mismatched provider delivery cannot update the database", async () => {
  const f = fixture();
  f.options.independentStorage.resolve = async () => ({ body: Buffer.from("different"), contentType: "image/png" });
  assert.equal((await migrateWarehouseMedia(f.options))[0].state, "REVIEW_REQUIRED");
  assert.equal(f.replacements(), 0);
});

test("warehouse rollout provider failure cannot update the database or fall back locally", async () => {
  const f = fixture();
  f.options.storage.save = async () => { throw new Error("Timeout"); };
  assert.equal((await migrateWarehouseMedia(f.options))[0].reason, "UPLOAD_OUTCOME_REQUIRES_REVIEW");
  assert.equal(f.replacements(), 0);
  assert.deepEqual(f.removed, []);
});

test("warehouse rollout rejects changed source bytes and traversal before upload", async () => {
  const f = fixture();
  f.options.source = async () => Buffer.from("different-size");
  await assert.rejects(migrateWarehouseMedia(f.options), /size changed/);
  assert.equal(f.journal.length, 0);
  for (const ref of ["private://warehouse-proof/../secret.jpg", "private://post-media/x/y.jpg", "private://warehouse-proof/%2e%2e/x.jpg"]) assert.throws(() => legacyMediaPath(ref));
});
