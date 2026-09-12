import type { PoolConnection } from "mysql2/promise";
import type { TransactionContext, TransactionRunner } from "../application/transaction.js";

export type SqlExecutor = Pick<PoolConnection, "execute">;
export type SqlTransactionRunner = <T>(work: (connection: PoolConnection) => Promise<T>) => Promise<T>;
const connections = new WeakMap<TransactionContext, SqlExecutor>();

export function sqlExecutor(context: TransactionContext | SqlExecutor): SqlExecutor {
  if ("execute" in context) return context;
  const connection = connections.get(context);
  if (!connection) throw new Error("Transaction context is inactive or belongs to another adapter");
  return connection;
}

export function createTransactionRunner(run: SqlTransactionRunner): TransactionRunner {
  return (work) => run(async (connection) => {
    const context = Object.freeze({}) as TransactionContext;
    connections.set(context, connection);
    try {
      return await work(context);
    } finally {
      connections.delete(context);
    }
  });
}
