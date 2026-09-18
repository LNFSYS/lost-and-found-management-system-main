import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import { claimRepository } from "../../../test/persistence-fixtures.js";

test("direct claims lock an active post and persist an open conversation", async () => {
  const statements: Array<{ sql: string; values?: unknown[] }> = [];
  const postId = "11111111-1111-4111-8111-111111111111";
  const ownerId = "22222222-2222-4222-8222-222222222222";
  const queryable = {
    execute: async (sql: string, values?: unknown[]) => {
      statements.push({ sql: sql.replace(/\s+/g, " ").trim(), values });
      if (sql.includes("FROM posts")) return [[{ id: postId, owner_id: ownerId, type: "FOUND" }], []];
      return [{ affectedRows: 1 }, []];
    }
  } as unknown as Pick<PoolConnection, "execute">;

  const post = await claimRepository.findClaimablePostForUpdate(postId, queryable as never);
  await claimRepository.createClaim({
    id: "33333333-3333-4333-8333-333333333333",
    lostPostId: undefined,
    foundPostId: postId,
    claimantId: "44444444-4444-4444-8444-444444444444",
    status: "CONVERSATION_OPEN",
    finderDecision: "ACCEPTED"
  }, queryable as never);

  assert.deepEqual(post, { id: postId, ownerId, type: "FOUND" });
  assert.doesNotMatch(statements[0].sql, /type = 'FOUND'/);
  assert.match(statements[0].sql, /status IN \('OPEN', 'MATCHED'\)/);
  assert.match(statements[0].sql, /FOR UPDATE/);
  assert.match(statements[1].sql, /status, finder_decision/);
  assert.equal(statements[1].values?.[1], null);
});

test("chat message persistence uses a server-side idempotency key", async () => {
  const statements: string[] = [];
  const clientMessageId = "11111111-1111-4111-8111-111111111111";
  const queryable = {
    execute: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith("SELECT next_sequence")) return [[{ sequence: 7 }], []];
      if (sql.includes("WHERE m.room_id = ? AND m.sender_id = ?")) return [[], []];
      if (sql.startsWith("UPDATE") || sql.startsWith("INSERT")) return [{ affectedRows: 1 }, []];
      return [[{
        id: "22222222-2222-4222-8222-222222222222",
        room_id: "33333333-3333-4333-8333-333333333333",
        sender_id: "44444444-4444-4444-8444-444444444444",
        client_message_id: clientMessageId,
        content: "Xin chào",
        media_url: null,
        message_type: "TEXT",
        is_read: 0,
        read_at: null,
        created_at: "2026-09-06T00:00:00.000Z",
        sender_name: "User"
      }], []];
    }
  } as unknown as Pick<PoolConnection, "execute">;

  const message = await claimRepository.createMessage({
    roomId: "33333333-3333-4333-8333-333333333333",
    senderId: "44444444-4444-4444-8444-444444444444",
    content: "Xin chào",
    clientMessageId
  }, queryable);

  assert.equal(message?.clientMessageId, clientMessageId);
  assert.match(statements[0], /next_sequence.*FOR UPDATE/);
  assert.match(statements[2], /next_sequence = next_sequence \+ 1/);
  assert.match(statements[3], /room_id, sequence, sender_id/);
  assert.match(statements[3], /ON DUPLICATE KEY UPDATE/);
});
