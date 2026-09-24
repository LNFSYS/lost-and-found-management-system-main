import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationEmailRepository } from "./notification-email.repository.js";
import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

test("digest coalescing keeps event categories separate", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const executor = {
    execute: async (sql: string, values?: unknown) => {
      const params = Array.isArray(values) ? values : [];
      calls.push({ sql, params });
      return [[], []] as never;
    }
  } as unknown as SqlExecutor;
  const repository = createNotificationEmailRepository(executor);
  await repository.claimCoalesced({
    item: {
      id: "outbox-claim", notificationId: "notification-claim", recipientUserId: "user-a", eventType: "CLAIM",
      entityType: "CLAIM", entityId: "claim-a", roomId: null, deliveryMode: "DIGEST", idempotencyKey: "digest-claim", attemptCount: 1
    },
    leaseToken: "lease-a",
    leaseSeconds: 60
  });
  const update = calls.find((call) => call.sql.includes("delivery_mode = 'DIGEST'"));
  assert.ok(update);
  assert.match(update.sql, /recipient_user_id = \? AND event_type = \?/);
  assert.deepEqual(update.params, ["lease-a", 60, "user-a", "CLAIM"]);
});
