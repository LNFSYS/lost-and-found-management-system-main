import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { withActorJourney, isolatedJourney } from "../test/actor-journey-fixture.js";
import { createWarehouseMediaRolloutRepository } from "../migrations/warehouse-media-rollout.js";

test("isolated warehouse media rollout preserves metadata and serializes with cleanup", isolatedJourney, async t => {
  await withActorJourney(async f => {
    const evidence = await f.evidence();
    const item = await f.services.warehouseService.createItem({ ...evidence, itemName: "Media fixture", handoverPointId: f.point, categoryId: f.categoryId, conditionNotes: "Good" }, f.ids.staff);
    const proof = randomUUID();
    await f.pool.execute("INSERT INTO warehouse_private_proofs (id,warehouse_item_id,uploaded_by,storage_ref,format,byte_size) VALUES (?,?,?,?,'jpg',4)",
      [proof, item.id, f.ids.staff, `private://warehouse-proof/${f.ids.staff}/${proof}.jpg`]);
    const repository = createWarehouseMediaRolloutRepository(f.pool);
    const rows = await repository.inventory();
    assert.equal(rows.length, 2);
    await t.test("updates only storage_ref, rejects replay and stale metadata", async () => {
      const row = rows.find(row => row.table === "warehouse_intake_images")!;
      const [before] = await f.pool.query<RowDataPacket[]>("SELECT * FROM warehouse_intake_images WHERE id=?", [row.id]);
      assert.equal(await repository.replace({ ...row, bytes: 999 }, "cloudinary://wrong"), false);
      const reference = `cloudinary://warehouse-proof/${f.ids.staff}/${randomUUID()}.jpg`;
      assert.equal(await repository.replace(row, reference), true);
      assert.equal(await repository.replace(row, reference), false);
      const [after] = await f.pool.query<RowDataPacket[]>("SELECT * FROM warehouse_intake_images WHERE id=?", [row.id]);
      assert.deepEqual(after[0], { ...before[0], storage_ref: reference });
      assert.equal(await repository.referenceInUse(reference), true);
      assert.equal(await repository.replace({ ...row, storageRef: reference }, row.storageRef), true);
      const [rolledBack] = await f.pool.query<RowDataPacket[]>("SELECT * FROM warehouse_intake_images WHERE id=?", [row.id]);
      assert.deepEqual(rolledBack[0], before[0]);
      assert.equal(await repository.replace(row, reference), true);
      assert.equal((await repository.inventory()).length, 1);
    });
    await t.test("cleanup holding proof lock wins without restoring a deleted row", async () => {
      const row = rows.find(row => row.id === proof)!;
      const connection = await f.pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query("SELECT id FROM warehouse_private_proofs WHERE id=? FOR UPDATE", [proof]);
        let settled = false;
        const replace = repository.replace(row, `cloudinary://warehouse-proof/${f.ids.staff}/${randomUUID()}.jpg`).finally(() => { settled = true; });
        await new Promise(resolve => setTimeout(resolve, 40));
        assert.equal(settled, false);
        await connection.query("DELETE FROM warehouse_private_proofs WHERE id=?", [proof]);
        await connection.commit();
        assert.equal(await replace, false);
        assert.equal((await repository.inventory()).length, 0);
      } finally { await connection.rollback(); connection.release(); }
    });
  });
});
