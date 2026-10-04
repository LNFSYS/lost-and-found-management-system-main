import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import { warehouseRepository } from "../../../test/persistence-fixtures.js";
import { createTransactionRunner } from "../../../shared/infrastructure/transaction-context.js";

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
  const events: Array<{ sql: string; values?: unknown[]; }> = [];
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

test("Staff verification appends its own audit and never overwrites the Finder decision", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const connection = transactionConnection(async (sql, values) => { queries.push({ sql, values }); return [[], []]; });
  await createTransactionRunner(work => work(connection))(db => warehouseRepository.recordStaffVerification({ id: "event", itemId: "item", claimId: "claim", recipientId: "owner", actorId: "staff", fromStatus: "NEED_MORE_INFO", reason: "Checked concealed feature" }, db));
  assert.match(queries[0].sql, /UPDATE claims SET status = 'ACCEPTED'/);
  assert.doesNotMatch(queries[0].sql, /finder_decision/);
  assert.match(queries[1].sql, /INSERT INTO claim_audit_events/);
  assert.match(queries[1].sql, /STAFF_CUSTODY_VERIFIED/);
  assert.equal(JSON.parse(String(queries[1].values?.[4])).warehouseItemId, "item");
});
