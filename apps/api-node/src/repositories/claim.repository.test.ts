import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { claimRepository } from "./claim.repository.js";

test("chat message persistence uses a server-side idempotency key", async () => {
  const statements: string[] = [];
  const clientMessageId = "11111111-1111-4111-8111-111111111111";
  const queryable = {
    execute: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith("INSERT")) return [{ affectedRows: 1 }, []];
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
  assert.match(statements[0], /client_message_id/);
  assert.match(statements[0], /ON DUPLICATE KEY UPDATE/);
});

test("chat message persistence fills required legacy columns after a no-default error", async () => {
  const statements: string[] = [];
  const queryable = {
    execute: async (sql: string) => {
      statements.push(sql);
      if (sql.startsWith("INSERT INTO chat_messages (id, room_id, sender_id, client_message_id")) {
        const error = new Error("Field 'media_public_id' doesn't have a default value") as Error & { code: string; errno: number };
        error.code = "ER_NO_DEFAULT_FOR_FIELD";
        error.errno = 1364;
        throw error;
      }
      if (sql.startsWith("SHOW COLUMNS FROM chat_messages")) return [[
        { Field: "id", Null: "NO", Default: null, Extra: "" },
        { Field: "room_id", Null: "NO", Default: null, Extra: "" },
        { Field: "sender_id", Null: "NO", Default: null, Extra: "" },
        { Field: "media_public_id", Null: "NO", Default: null, Extra: "" },
        { Field: "content", Null: "YES", Default: null, Extra: "" },
        { Field: "message_type", Null: "NO", Default: "TEXT", Extra: "" },
        { Field: "created_at", Null: "NO", Default: "CURRENT_TIMESTAMP", Extra: "" }
      ], []];
      if (sql.startsWith("INSERT INTO chat_messages")) return [{ affectedRows: 1 }, []];
      return [[{
        id: "22222222-2222-4222-8222-222222222222",
        room_id: "33333333-3333-4333-8333-333333333333",
        sender_id: "44444444-4444-4444-8444-444444444444",
        client_message_id: "retry-key-2026",
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
    clientMessageId: "retry-key-2026"
  }, queryable);

  assert.equal(message?.content, "Xin chào");
  assert.ok(statements.some((statement) => statement.startsWith("SHOW COLUMNS FROM chat_messages")));
});
