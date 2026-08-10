import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../");
const sslCa = env.db.sslCaPath
  ? fs.readFileSync(path.isAbsolute(env.db.sslCaPath) ? env.db.sslCaPath : path.resolve(repositoryRoot, env.db.sslCaPath), "utf8")
  : undefined;

export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "Z",
  multipleStatements: true,
  ssl: env.db.ssl ? {
    rejectUnauthorized: true,
    ca: sslCa
  } : undefined
});

export async function withTransaction<T>(work: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
