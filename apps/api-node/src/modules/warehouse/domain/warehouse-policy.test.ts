import assert from "node:assert/strict";
import test from "node:test";
import { calculateRetentionDeadline, retentionConfigKeyForCategory, canTransitionWarehouseStatus, type WarehouseStatus } from "./warehouse-policy.js";

test("keys use document retention and common substrings do not imply perishables", () => {
  assert.equal(retentionConfigKeyForCategory({ name: "Chìa khóa", parentName: null }), "warehouse.retention_days_document");
  assert.equal(retentionConfigKeyForCategory({ name: "Bình nước", parentName: "Đồ dùng" }), "warehouse.retention_days_default");
  assert.equal(retentionConfigKeyForCategory({ name: "Nước uống", parentName: null }), "warehouse.retention_days_perishable");
  assert.throws(() => calculateRetentionDeadline(new Date("invalid"), 60));
  assert.throws(() => calculateRetentionDeadline(new Date(), 0));
});

test("only retained physical items can become RETURNED, including unprocessed EXPIRED items", () => {
  for (const status of ["RECEIVED", "STORED", "CLAIMED", "EXPIRED"] as WarehouseStatus[]) assert.equal(canTransitionWarehouseStatus(status, "RETURNED"), true);
  for (const status of ["PENDING_APPROVAL", "DISPOSED", "DONATED", "TRANSFERRED"] as WarehouseStatus[]) assert.equal(canTransitionWarehouseStatus(status, "RETURNED"), false);
});
