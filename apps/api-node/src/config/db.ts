import mysql, { type PoolConnection, type PoolOptions } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
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
  timezone: "Z",
  multipleStatements,
  ssl: env.db.ssl ? {
    rejectUnauthorized: true,
    ca: sslCa
  } : undefined
  };
}

export function createDatabasePool(options: { multipleStatements?: boolean } = {}) {
  return mysql.createPool(databasePoolOptions(options.multipleStatements ?? false));
}

export const pool = createDatabasePool();

export function createMigrationPool() {
  return createDatabasePool({ multipleStatements: true });
}

export async function runInTransaction<T>(connection: PoolConnection, work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  await connection.beginTransaction();
  try {
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export async function withTransaction<T>(work: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    return await runInTransaction(connection, work);
  } finally {
    connection.release();
  }
}
