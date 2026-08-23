import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRetentionDeadline,
  canTransitionWarehouseStatus,
  retentionConfigKeyForCategory
} from "./warehouse.service.js";

test("calculates retention deadline from the received timestamp in UTC", () => {
  assert.equal(
    calculateRetentionDeadline(new Date("2026-08-23T10:15:00.000Z"), 60).toISOString(),
    "2026-10-22T10:15:00.000Z"
  );
});

test("selects specialized warehouse retention policies from category names", () => {
  assert.equal(retentionConfigKeyForCategory({ name: "The sinh vien", parentName: "Giay to" }), "warehouse.retention_days_document");
  assert.equal(retentionConfigKeyForCategory({ name: "Dien thoai", parentName: "Thiet bi dien tu" }), "warehouse.retention_days_electronic");
  assert.equal(retentionConfigKeyForCategory({ name: "Do an dong hop", parentName: "Thuc pham" }), "warehouse.retention_days_perishable");
  assert.equal(retentionConfigKeyForCategory({ name: "Balo", parentName: "Tui xach" }), "warehouse.retention_days_default");
});

test("keeps warehouse terminal states closed and allows receive-store-return workflow", () => {
  assert.equal(canTransitionWarehouseStatus("RECEIVED", "STORED"), true);
  assert.equal(canTransitionWarehouseStatus("STORED", "RETURNED"), true);
  assert.equal(canTransitionWarehouseStatus("RETURNED", "STORED"), false);
  assert.equal(canTransitionWarehouseStatus("DISPOSED", "RETURNED"), false);
});
