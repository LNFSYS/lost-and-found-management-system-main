import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionContext } from "../application/transaction.js";
import { createTransactionRunner, sqlExecutor } from "./transaction-context.js";

test("opaque transaction context shares one connection and expires after success or failure", async () => {
  const connection = { execute: async () => [[], []] } as unknown as PoolConnection;
  const run = createTransactionRunner(work => work(connection));
  const retained: TransactionContext[] = [];
  for (const shouldFail of [false, true]) {
    const work = run(async context => {
      retained.push(context);
      assert.equal("execute" in context, false);
      assert.equal(sqlExecutor(context), connection);
      assert.equal(sqlExecutor(context), sqlExecutor(context));
      if (shouldFail) throw new Error("rollback");
      return "committed";
    });
    if (shouldFail) await assert.rejects(work, /rollback/);
    else assert.equal(await work, "committed");
  }
  assert.notEqual(retained[0], retained[1]);
  for (const context of retained) assert.throws(() => sqlExecutor(context), /inactive/);
  assert.throws(() => sqlExecutor({} as TransactionContext), /inactive/);
});

test("overlapping transaction contexts do not reuse each other's connection", async () => {
  const connections = [0, 1].map(() => ({ execute: async () => [[], []] }) as unknown as PoolConnection);
  let index = 0;
  const run = createTransactionRunner(work => work(connections[index++]));
  const pending: Array<() => void> = [];
  const results = connections.map(expected => run(async context => {
    await new Promise<void>(resolve => { pending.push(resolve); });
    assert.equal(sqlExecutor(context), expected);
  }));
  pending.forEach(resolve => resolve());
  await Promise.all(results);
});
