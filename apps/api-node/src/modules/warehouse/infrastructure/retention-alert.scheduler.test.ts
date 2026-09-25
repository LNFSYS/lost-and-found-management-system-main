import assert from "node:assert/strict";
import test from "node:test";
import type { NotificationRepository } from "../../notifications/application/index.js";
import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { createRetentionAlertScheduler } from "./retention-alert.scheduler.js";

test("overdue scan reaches authorised staff without exposing item details in notification text", async () => {
  const queries: string[] = [];
  const db = { execute: async (sql: string) => {
    queries.push(sql);
    if (sql.includes("config_entries")) return [[{ config_value: "5" }], []];
    if (sql.includes("FROM warehouse_items")) return [[{
      id: "item-1", item_name: "Private medical device", storage_code: "SECRET-A1",
      retention_deadline: "2026-01-01T00:00:00.000Z", status: "STORED", legal_hold_count: 0,
      days_overdue: 10
    }], []];
    if (sql.includes("user_roles")) return [[{ id: "staff-1" }], []];
    throw new Error(`Unexpected query: ${sql}`);
  } } as unknown as SqlExecutor;
  const sent: Array<{ body?: string | null; dedupeKey?: string | null }> = [];
  const notifications = { create: async (input: { body?: string | null; dedupeKey?: string | null }) => {
    sent.push(input); return { id: "notification-1" };
  } } as unknown as NotificationRepository;
  const scheduler = createRetentionAlertScheduler({ db, notificationRepository: notifications, id: () => "unused" });
  assert.deepEqual(await scheduler.scanAndAlertOverdue(), { scannedCount: 1, alertedCount: 1 });
  assert.ok(queries.some((sql) => sql.includes("JOIN user_roles")));
  assert.equal(sent.length, 1);
  assert.ok(sent[0]?.dedupeKey?.includes("item-1"));
  assert.doesNotMatch(sent[0]?.body ?? "", /Private medical device|SECRET-A1/);
});
