import mysql, { type PoolConnection, type PoolOptions } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import { recordTransactionOutcome } from "../../application/transaction.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../../");
const sslCa = env.db.sslCaPath
  ? fs.readFileSync(path.isAbsolute(env.db.sslCaPath) ? env.db.sslCaPath : path.resolve(repositoryRoot, env.db.sslCaPath), "utf8")
  : undefined;

export function databasePoolOptions(multipleStatements: boolean): PoolOptions {
  return {
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.user,
    password: env.db.password,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 20_000,
    // mysql2 only enables idle eviction when maxIdle is below connectionLimit.
    maxIdle: 2,
    idleTimeout: 30_000,
    timezone: "Z",
    multipleStatements,
    ssl: env.db.ssl ? {
      rejectUnauthorized: true,
      ca: sslCa
    } : undefined
  };
}

export function createDatabasePool(options: { multipleStatements?: boolean; } = {}) {
  return mysql.createPool(databasePoolOptions(options.multipleStatements ?? false));
}

export function createMigrationPool() {
  return createDatabasePool({ multipleStatements: true });
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isUnavailableConnectionError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  if (code && ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "PROTOCOL_CONNECTION_LOST", "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR"].includes(code)) {
    return true;
  }
  return error instanceof Error && /connection is in closed state|connection lost|closed state/i.test(error.message);
}

export async function runInTransaction<T>(connection: PoolConnection, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  let transactionStarted = false;
  let commitStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const result = await work(connection);
    commitStarted = true;
    await connection.commit();
    return result;
  } catch (error) {
    recordTransactionOutcome(error, "UNKNOWN");
    if (isUnavailableConnectionError(error)) {
      try { connection.destroy(); } catch { /* Preserve the original database error. */ }
    } else if (transactionStarted) {
      try {
        await connection.rollback();
        if (!commitStarted) recordTransactionOutcome(error, "ROLLED_BACK");
      } catch {
        try { connection.destroy(); } catch { /* Preserve the original error; never reuse an unresolved transaction. */ }
      }
    }
    throw error;
  }
}
