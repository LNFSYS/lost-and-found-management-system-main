import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

async function run() {
  const migrationsDir = path.dirname(fileURLToPath(import.meta.url));
  const files = (await readdir(migrationsDir)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const [rows] = await pool.query<Array<RowDataPacket & { checksum: string }>>("SELECT checksum FROM schema_migrations WHERE version = ?", [file]);
    if (rows.length) {
      if (rows[0].checksum !== checksum) throw new Error(`Migration checksum mismatch: ${file}`);
      continue;
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [file, checksum]);
      await connection.commit();
      console.info(`Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  await pool.end();
}

run().catch((error) => {
  console.error("Migration failed", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
