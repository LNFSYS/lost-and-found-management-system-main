import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { warehouseRepository } from "./warehouse.repository.js";

function transactionConnection(execute: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>) {
  return { execute } as unknown as PoolConnection;
}

test("warehouse item state reads use a row lock before transition", async () => {
  const queries: string[] = [];
  const connection = transactionConnection(async (sql) => {
    queries.push(sql.replace(/\s+/g, " ").trim());
    return [[{
      id: "item-id",
      post_id: null,
      handover_point_id: "handover-id",
      status: "RECEIVED",
      condition_notes: "Good",
      storage_code: null
    }], []];
  });

  const item = await warehouseRepository.lockItemForUpdate("item-id", connection);

  assert.equal(item?.status, "RECEIVED");
  assert.match(queries[0], /FOR UPDATE$/);
});

test("warehouse create and storage log can be written through the same transaction connection", async () => {
  const events: Array<{ sql: string; values?: unknown[] }> = [];
  const connection = transactionConnection(async (sql, values) => {
    events.push({ sql: sql.replace(/\s+/g, " ").trim(), values });
    return [[], []];
  });

  await warehouseRepository.createItem({
    id: "item-id",
    handoverPointId: "handover-id",
    itemName: "Wallet",
    conditionNotes: "Light scratches",
    receivedAt: new Date("2026-08-23T10:00:00.000Z"),
    retentionDeadline: new Date("2026-10-22T10:00:00.000Z"),
    createdBy: "staff-id"
  }, connection);
  await warehouseRepository.createStorageLog({
    id: "log-id",
    warehouseItemId: "item-id",
    handoverPointId: "handover-id",
    actorId: "staff-id",
    action: "RECEIVED",
    fromStatus: null,
    toStatus: "RECEIVED",
    conditionNotes: "Light scratches"
  }, connection);

  assert.match(events[0].sql, /INSERT INTO warehouse_items/);
  assert.match(events[1].sql, /INSERT INTO storage_logs/);
  assert.match(events[1].sql, /warehouse_item_id/);
  assert.deepEqual(events[1].values?.slice(0, 8), ["log-id", "item-id", null, "handover-id", "staff-id", "RECEIVED", null, "RECEIVED"]);
});
