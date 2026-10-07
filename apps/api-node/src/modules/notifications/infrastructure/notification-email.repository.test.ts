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

test("expired PROCESSING emails are quarantined, never reclaimed or revived by stale workers", async () => {
  const calls: string[] = [];
  const executor = { execute: async (sql: string) => { calls.push(sql); return [sql.includes("SELECT") ? [] : { affectedRows: 0 }, []] as never; } } as unknown as SqlExecutor;
  const repository = createNotificationEmailRepository(executor);
  assert.deepEqual(await repository.claimDue({ limit: 1, leaseToken: "new", leaseSeconds: 60 }), []);
  assert.match(calls[0], /SMTP_LEASE_EXPIRED_UNCERTAIN/);
  assert.match(calls[0], /status = 'CANCELLED'/);
  assert.doesNotMatch(calls[1], /OR .*PROCESSING/);
  assert.equal(await repository.renewLease("old", 60), false);
  await repository.markSent("old");
  await repository.releaseLeaseForRetry({ leaseToken: "old", dueAt: new Date(), errorCode: "EAUTH" });
  for (const sql of calls.slice(2)) {
    assert.match(sql, /lease_token = \?/);
    assert.match(sql, /lease_expires_at > UTC_TIMESTAMP\(\)/);
  }
});

test("matching email access requires the exact pair, active owned post and no dismissal", async () => {
  let query = "";
  const repository = createNotificationEmailRepository({ execute: async (sql: string) => { query = sql; return [[], []] as never; } } as unknown as SqlExecutor);
  await repository.listLease("lease");
  assert.match(query, /o.event_type = 'MATCH'/);
  assert.match(query, /n.dedupe_key = CONCAT\('matching:', mr.id, ':', o.recipient_user_id\)/);
  assert.match(query, /mr.total_score >= 0.6/);
  assert.match(query, /lost_post.user_id = o.recipient_user_id/);
  assert.match(query, /found_post.user_id = o.recipient_user_id/);
  assert.match(query, /lost_post.status IN \('OPEN','MATCHED'\)/);
  assert.match(query, /found_post.status IN \('OPEN','MATCHED'\)/);
  assert.match(query, /NOT EXISTS\(SELECT 1 FROM match_suggestion_dismissals/);
});
