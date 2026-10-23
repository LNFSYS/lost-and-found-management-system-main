import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { createIllustrationRepository } from "./illustration.repository.js";
import { createTransactionRunner } from "../../../shared/infrastructure/transaction-context.js";

test("SQL reservations serialize on owner before quota check and never accept a fifth attempt", async () => {
  const queries: string[] = [];
  const connection = { execute: async (sql: string) => {
    queries.push(sql.replace(/\s+/g, " "));
    if (sql.startsWith("SELECT id, attempts_used")) return [[{ id: "draft", attempts_used: 4 }], []];
    return [[], []];
  } } as unknown as PoolConnection;
  const repository = createIllustrationRepository(connection);
  const transaction = createTransactionRunner(async work => work(connection));
  await assert.rejects(transaction(db => repository.reserve("owner", { title: "Wallet", description: "Black leather wallet", categoryId: "category", requestId: "request" }, "hash", { draft: "draft", attempt: "attempt" }, db)), { code: "conflict" });
  assert.match(queries[0], /SELECT id FROM users WHERE id = \? FOR UPDATE/);
  assert.ok(queries.some(sql => /active_owner_id = \? FOR UPDATE/.test(sql)));
  assert.ok(!queries.some(sql => sql.startsWith("INSERT")));
});
test("SQL image reads are owner scoped and expired pending work cannot be completed", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const connection = { execute: async (sql: string, values: unknown[]) => {
    queries.push({ sql, values });
    return sql.startsWith("UPDATE") ? [{ affectedRows: 0 }, []] : [[], []];
  } } as unknown as PoolConnection;
  const repository = createIllustrationRepository(connection);
  assert.equal(await repository.findAttempt("outsider", "image"), null);
  assert.match(queries[0].sql, /a.user_id = \? AND a.id = \?/);
  assert.deepEqual(queries[0].values, ["outsider", "image"]);
  assert.equal(await repository.finish("image", "READY", { storageRef: "private://asset", publicId: "asset", format: "jpg", bytes: 3 }), false);
  assert.match(queries[1].sql, /status='PENDING' AND created_at > DATE_SUB/);
});
