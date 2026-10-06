import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { isolatedJourney, withActorJourney } from "../test/actor-journey-fixture.js";
import { createMediaUploads } from "../shared/infrastructure/media-uploads.js";
import { sqlExecutor } from "../shared/infrastructure/transaction-context.js";
import type { MediaUploads } from "../shared/application/media-upload.js";
import type { PrivateMediaStorage } from "../shared/application/media-storage.port.js";
import { createWarehouseUseCases } from "../modules/warehouse/application/warehouse.use-cases.js";
import type { WarehouseRepository } from "../modules/warehouse/application/warehouse.repository.port.js";

test("isolated uploads: real commits, acknowledgements, cross-instance retry and cleanup", isolatedJourney, async t => {
  await withActorJourney(async f => {
    const assets = new Set<string>(), removed: string[] = [];
    let uploads = 0;
    const storage: PrivateMediaStorage = {
      save: async (_owner, id) => { uploads++; assets.add(id); return { secureUrl: id, publicId: id }; },
      resolve: async ref => { assert.ok(assets.has(ref)); return { body: f.image.buffer, contentType: "image/jpeg" }; },
      remove: async ref => { removed.push(ref); assets.delete(ref); }
    };
    const coordinator = createMediaUploads(f.pool, { warn() {} });
    const compose = (repository: WarehouseRepository = f.p.warehouseRepository, uploadCoordinator: MediaUploads = coordinator) => createWarehouseUseCases({
      warehouseRepository: repository, custodyRequestRepository: f.p.custodyRequestRepository, proofStorage: storage,
      uploads: uploadCoordinator, logger: { warn() {} }, withTransaction: f.p.transaction, id: randomUUID });
    const warehouse = compose();
    const intakeKey = randomUUID();
    const intake = await warehouse.uploadIntakeImage({ intakeKey }, f.image, f.ids.staff);
    const item = await warehouse.createItem({ intakeKey, intakeImageIds: [intake.id], receivedQuantity: 1, accessories: "None", physicalReviewConfirmed: true,
      itemName: "Outcome fixture", handoverPointId: f.point, conditionNotes: "Good" }, f.ids.staff);
    const committedThenRejected: MediaUploads = { run: (scope, bytes, work) => coordinator.run(scope, bytes, operation => work({ ...operation,
      transaction: async callback => { await operation.transaction!(callback); throw Object.assign(new Error("COMMIT ack lost"), { code: "ECONNRESET" }); } })) };
    await t.test("COMMIT persisted then runner rejected; authoritative rows keep both warehouse assets", async () => {
      const service = compose(f.p.warehouseRepository, committedThenRejected);
      const key = randomUUID();
      const photo = await service.uploadIntakeImage({ intakeKey: key }, f.image, f.ids.staff);
      const proof = await service.uploadProof(item.id, f.image, f.ids.staff);
      assert.ok(await f.p.warehouseRepository.findIntakeImage(photo.id));
      assert.ok(await f.p.warehouseRepository.findProof(proof.id, undefined));
      assert.ok(assets.has(photo.id) && assets.has(proof.id)); assert.equal(removed.length, 0);
    });
    await t.test("INSERT is persisted before its acknowledgement is lost, including a destroyed connection", async () => {
      const repository: WarehouseRepository = { ...f.p.warehouseRepository, createIntakeImage: async (input, db) => {
        await f.p.warehouseRepository.createIntakeImage(input, db);
        await sqlExecutor(db).execute("COMMIT");
        throw Object.assign(new Error("INSERT acknowledgement lost"), { code: "ECONNRESET" });
      } };
      const result = await compose(repository).uploadIntakeImage({ intakeKey: randomUUID() }, f.image, f.ids.staff);
      assert.ok(await f.p.warehouseRepository.findIntakeImage(result.id)); assert.ok(assets.has(result.id));
      assert.equal(removed.length, 0);
    });
    await t.test("failed authoritative reconciliation retains its operation; another instance replays it", async () => {
      let failRead = false;
      const repository: WarehouseRepository = { ...f.p.warehouseRepository,
        findIntakeImage: async id => { if (failRead) throw new Error("reconciliation unavailable"); return f.p.warehouseRepository.findIntakeImage(id); } };
      const ambiguous: MediaUploads = { run: (scope, bytes, work) => coordinator.run(scope, bytes, operation => work({ ...operation,
        transaction: async callback => { await operation.transaction!(callback); failRead = true; throw new Error("unknown acknowledgement"); } })) };
      const key = randomUUID(), before = uploads;
      await assert.rejects(compose(repository, ambiguous).uploadIntakeImage({ intakeKey: key }, f.image, f.ids.staff), /unknown acknowledgement/);
      failRead = false;
      const result = await compose(f.p.warehouseRepository, createMediaUploads(f.pool, { warn() {} })).uploadIntakeImage({ intakeKey: key }, f.image, f.ids.staff);
      assert.ok(assets.has(result.id)); assert.equal(uploads, before + 1); assert.equal(removed.length, 0);
      const [rows] = await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM warehouse_intake_images WHERE intake_id=?", [key]);
      assert.equal(Number(rows[0]!.count), 1);
    });
    await t.test("separate coordinators serialize the complete provider and DB operation on the same named-lock session", async () => {
      const key = randomUUID();
      let started!: () => void, finish!: () => void;
      const uploading = new Promise<void>(resolve => { started = resolve; });
      const waiting = new Promise<void>(resolve => { finish = resolve; });
      const slowStorage: PrivateMediaStorage = { ...storage, save: async (...args) => { started(); await waiting; return storage.save(...args); } };
      const service = createWarehouseUseCases({ warehouseRepository: f.p.warehouseRepository, custodyRequestRepository: f.p.custodyRequestRepository,
        proofStorage: slowStorage, uploads: coordinator, withTransaction: f.p.transaction, id: randomUUID });
      const before = uploads;
      const first = service.uploadIntakeImage({ intakeKey: key }, f.image, f.ids.staff);
      await uploading;
      let settled = false;
      const second = compose(f.p.warehouseRepository, createMediaUploads(f.pool, { warn() {} })).uploadIntakeImage({ intakeKey: key }, f.image, f.ids.staff)
        .finally(() => { settled = true; });
      await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(settled, false); finish();
      const results = await Promise.all([first, second]);
      assert.equal(results[0]!.id, results[1]!.id); assert.equal(uploads, before + 1);
    });
    await t.test("acknowledged rollback removes only its unreferenced asset", async () => {
      const key = randomUUID();
      for (let index = 0; index < 5; index++) await warehouse.uploadIntakeImage({ intakeKey: key },
        { ...f.image, buffer: Buffer.concat([f.image.buffer, Buffer.from([index])]), size: 5 }, f.ids.staff);
      const before = removed.length;
      await assert.rejects(warehouse.uploadIntakeImage({ intakeKey: key }, { ...f.image, buffer: Buffer.concat([f.image.buffer, Buffer.from([9])]), size: 5 }, f.ids.staff));
      assert.equal(removed.length, before + 1); assert.equal(assets.has(removed.at(-1)!), false);
      const [rows] = await f.pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS count FROM warehouse_intake_images WHERE intake_id=?", [key]);
      assert.equal(Number(rows[0]!.count), 5);
    });
    await t.test("attached intake and return proof survive simultaneous draft cleanup", async () => {
      const proof = await warehouse.uploadProof(item.id, f.image, f.ids.staff);
      await f.p.transaction(db => f.p.warehouseRepository.attachProof(proof.id, db));
      await f.pool.execute("UPDATE warehouse_intake_sessions SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 80 HOUR) WHERE id=?", [intakeKey]);
      await f.pool.execute("UPDATE warehouse_private_proofs SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 80 HOUR) WHERE id=?", [proof.id]);
      await Promise.all([warehouse.runMaintenance(), compose(f.p.warehouseRepository, createMediaUploads(f.pool, { warn() {} })).runMaintenance()]);
      assert.ok(assets.has(intake.id) && assets.has(proof.id));
      assert.ok(await f.p.warehouseRepository.findIntakeImage(intake.id)); assert.ok(await f.p.warehouseRepository.findProof(proof.id, undefined));
    });
    await t.test("concurrent account disable cannot report an avatar replacement that never updated its pointer", async () => {
      await f.pool.execute("UPDATE users SET status='DISABLED', avatar_cloudinary_public_id='lnfs/avatars/retained' WHERE id=?", [f.ids.outsider]);
      const updated = await f.p.transaction(db => f.p.userRepository.updateAvatar(f.ids.outsider, { publicId: "lnfs/avatars/new", assetId: null,
        version: 1, format: "jpg", resourceType: "image", size: 4 }, db));
      assert.equal(updated, null);
      const [rows] = await f.pool.execute<RowDataPacket[]>("SELECT avatar_cloudinary_public_id FROM users WHERE id=?", [f.ids.outsider]);
      assert.equal(rows[0]!.avatar_cloudinary_public_id, "lnfs/avatars/retained");
    });
  });
});
