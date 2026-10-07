import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import { databasePoolOptions, runInTransaction } from "./db.js";
import { transactionWasRolledBack } from "../../application/transaction.js";

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

test("only an acknowledged rollback before COMMIT permits compensation", async () => {
  const business = new Error("business failure");
  await assert.rejects(runInTransaction(fakeConnection([]), async () => { throw business; }));
  assert.equal(transactionWasRolledBack(business), true);
  const lostAck = new Error("COMMIT acknowledgement lost");
  const connection = fakeConnection([]);
  connection.commit = async () => { throw lostAck; };
  await assert.rejects(runInTransaction(connection, async () => "persisted"));
  assert.equal(transactionWasRolledBack(lostAck), false);
});

test("multiple statements are disabled for the application pool and explicit for migrations", () => {
  assert.equal(databasePoolOptions(false).multipleStatements, false);
  assert.equal(databasePoolOptions(true).multipleStatements, true);
});

test("preserves a connection reset when rollback cannot run on the closed connection", async () => {
  let rollbackCalled = false;
  let destroyed = false;
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {
      rollbackCalled = true;
      throw new Error("Can't add new command when connection is in closed state");
    },
    destroy() {
      destroyed = true;
    }
  } as unknown as PoolConnection;
  const originalError = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });

  await assert.rejects(
    runInTransaction(connection, async () => { throw originalError; }),
    (error) => error === originalError
  );
  assert.equal(rollbackCalled, false);
  assert.equal(destroyed, true);
});

test("does not hide a business error when rollback itself fails", async () => {
  const originalError = new Error("business failure");
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() { throw new Error("rollback failure"); },
    destroy() {}
  } as unknown as PoolConnection;

  await assert.rejects(
    runInTransaction(connection, async () => { throw originalError; }),
    (error) => error === originalError
  );
});
