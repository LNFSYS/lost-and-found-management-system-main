import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { runInTransaction } from "../config/db.js";
import { matchingRepository } from "./matching.repository.js";
import { postRepository } from "./post.repository.js";

function transactionConnection(execute: (sql: string, values?: unknown[]) => Promise<[unknown, unknown]>, events: string[]) {
  return {
    execute,
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); }
  } as unknown as PoolConnection;
}

test("media slot checks lock the parent post before counting existing media", async () => {
  const queries: string[] = [];
  const connection = transactionConnection(async (sql) => {
    queries.push(sql.replace(/\s+/g, " ").trim());
    if (sql.includes("FROM posts")) return [[{ id: "post-id", status: "OPEN" }], []];
    if (sql.includes("COUNT(*)")) return [[{ total: 4 }], []];
    return [[], []];
  }, []);

  const locked = await postRepository.lockOwnedPostForMedia("post-id", "owner-id", connection);
  const count = await postRepository.countMedia("post-id", connection);

  assert.deepEqual(locked, { id: "post-id", status: "OPEN" });
  assert.equal(count, 4);
  assert.match(queries[0], /FOR UPDATE$/);
  assert.match(queries[1], /COUNT\(\*\)/);
});

test("analysis-tag failure rolls back the post insert transaction", async () => {
  const events: string[] = [];
  const connection = transactionConnection(async (sql) => {
    if (sql.includes("INSERT INTO posts")) { events.push("post-insert"); return [[], []]; }
    if (sql.includes("DELETE FROM ai_tags")) { events.push("tag-cleanup"); return [[], []]; }
    if (sql.includes("INSERT INTO ai_tags")) throw new Error("tag persistence failed");
    return [[], []];
  }, events);

  await assert.rejects(runInTransaction(connection, async (transaction) => {
    await postRepository.createPost({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      type: "LOST",
      visibilityMode: "PUBLIC",
      title: "Ví màu đen",
      titleNormalized: "vi mau den",
      description: "Ví da màu đen",
      descriptionNormalized: "vi da mau den",
      categoryId: "33333333-3333-4333-8333-333333333333",
      contactInfo: "student@example.com",
      lostFoundAt: new Date("2026-08-01T10:00:00.000Z"),
      expiresAt: new Date("2026-09-01T10:00:00.000Z")
    }, transaction);
    await matchingRepository.replaceAnalysisTags("11111111-1111-4111-8111-111111111111", {
      visualAttributes: ["black leather"],
      visibleText: [],
      confidence: 0.8
    }, transaction);
  }), /tag persistence failed/);

  assert.deepEqual(events, ["begin", "post-insert", "tag-cleanup", "rollback"]);
});

test("reads the created post through the same transaction before commit", async () => {
  const events: string[] = [];
  const connection = transactionConnection(async (sql) => {
    if (sql.includes("INSERT INTO posts")) { events.push("post-insert"); return [[], []]; }
    if (sql.includes("FROM posts p") && sql.includes("LIMIT 1")) { events.push("post-read"); return [[], []]; }
    return [[], []];
  }, events);

  await runInTransaction(connection, async (transaction) => {
    await postRepository.createPost({
      id: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      type: "LOST",
      visibilityMode: "PUBLIC",
      title: "Ví màu đen",
      titleNormalized: "vi mau den",
      description: "Ví da màu đen",
      descriptionNormalized: "vi da mau den",
      categoryId: "33333333-3333-4333-8333-333333333333",
      contactInfo: "student@example.com",
      lostFoundAt: new Date("2026-08-01T10:00:00.000Z"),
      expiresAt: new Date("2026-09-01T10:00:00.000Z")
    }, transaction);
    assert.equal(await postRepository.findOwnedById(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      transaction
    ), null);
  });

  assert.deepEqual(events, ["begin", "post-insert", "post-read", "commit"]);
});
