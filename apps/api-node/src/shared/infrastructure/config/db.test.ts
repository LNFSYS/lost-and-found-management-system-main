import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolOptions, runInTransaction } from "./db.js";

function fakeConnection(events: string[]) {
  return {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); }
  } as unknown as PoolConnection;
}

test("runInTransaction commits successful work", async () => {
  const events: string[] = [];
  const result = await runInTransaction(fakeConnection(events), async () => {
    events.push("work");
    return "done";
  });
  assert.equal(result, "done");
  assert.deepEqual(events, ["begin", "work", "commit"]);
});

test("runInTransaction rolls back failed work", async () => {
  const events: string[] = [];
  await assert.rejects(runInTransaction(fakeConnection(events), async () => {
    events.push("post-insert");
    throw new Error("analysis-tag insert failed");
  }), /analysis-tag insert failed/);
  assert.deepEqual(events, ["begin", "post-insert", "rollback"]);
});

test("multiple statements are disabled for the application pool and explicit for migrations", () => {
  assert.equal(databasePoolOptions(false).multipleStatements, false);
  assert.equal(databasePoolOptions(true).multipleStatements, true);
});
