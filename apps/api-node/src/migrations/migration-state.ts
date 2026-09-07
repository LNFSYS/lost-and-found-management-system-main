import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export interface MigrationConnection {
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  release(): void;
  destroy(): void;
}
export interface MigrationPool { getConnection(): Promise<MigrationConnection>; }
export interface MigrationFile { version: string; sql: string; raw: string; normalized: string; }
export interface LedgerRow { version: string; checksum: string; }
export interface AttemptRow extends LedgerRow { status: string; }

export function migrationChecksums(sql: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  return { raw: hash(sql), normalized: hash(sql.replace(/\r\n/g, "\n")) };
}
export function checksumMatches(checksum: string, file: Pick<MigrationFile, "raw" | "normalized">) {
  return checksum === file.raw || checksum === file.normalized;
}
export async function readMigrationFiles(directory: string): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
  const files: MigrationFile[] = [];
  for (const version of names) {
    const sql = await readFile(path.join(directory, version), "utf8");
    files.push({ version, sql, ...migrationChecksums(sql) });
  }
  return files;
}
export async function readMigrationState(connection: MigrationConnection) {
  const [tables] = await connection.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('schema_migrations', 'schema_migration_attempts')"
  );
  const names = (tables as { name: string }[]).map((row) => row.name);
  const [ledger] = names.includes("schema_migrations")
    ? await connection.query("SELECT version, checksum FROM schema_migrations ORDER BY version") : [[]];
  const [attempts] = names.includes("schema_migration_attempts")
    ? await connection.query("SELECT version, checksum, status FROM schema_migration_attempts ORDER BY version") : [[]];
  return { ledger: ledger as LedgerRow[], attempts: attempts as AttemptRow[] };
}
export const recoveryInstruction = "Inspect the database for partially applied DDL and reconcile the schema before a reviewed retry. Do not edit applied SQL or erase attempt history blindly.";
export function validateMigrationState(files: MigrationFile[], state: Awaited<ReturnType<typeof readMigrationState>>) {
  for (const row of state.ledger) {
    const file = files.find((candidate) => candidate.version === row.version);
    if (!file) throw new Error(`Unknown applied migration: ${row.version}. Reconcile renamed versions before running any DDL.`);
    if (!checksumMatches(row.checksum, file)) throw new Error(`Migration checksum mismatch: ${row.version}`);
  }
  for (const attempt of state.attempts) {
    const file = files.find((candidate) => candidate.version === attempt.version);
    if (!file || !checksumMatches(attempt.checksum, file)) throw new Error(`Migration attempt checksum/version mismatch: ${attempt.version}`);
    if (attempt.status !== "APPLIED" || !state.ledger.some((row) => row.version === attempt.version)) {
      throw new Error(`Migration ${attempt.version} has an incomplete attempt (${attempt.status}). ${recoveryInstruction}`);
    }
  }
}
export function migrationLockName(database: string) {
  return `lnfs:migrate:${createHash("sha256").update(database).digest("hex").slice(0, 40)}`;
}
export async function withMigrationLock<T>(pool: MigrationPool, work: (connection: MigrationConnection, database: string) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  let lock: string | undefined;
  let destroyed = false;
  try {
    const [rows] = await connection.query("SELECT DATABASE() AS name");
    const database = (rows as { name: string | null }[])[0]?.name;
    if (!database) throw new Error("A database must be selected before migration");
    const name = migrationLockName(database);
    const [acquired] = await connection.query("SELECT GET_LOCK(?, 0) AS acquired", [name]);
    if (Number((acquired as { acquired: number | null }[])[0]?.acquired) !== 1) {
      throw new Error("Another migration/reconciliation owns the database lock; retry after it finishes");
    }
    lock = name;
    return await work(connection, database);
  } finally {
    try {
      if (lock) {
        const [rows] = await connection.query("SELECT RELEASE_LOCK(?) AS released", [lock]);
        if (Number((rows as { released: number | null }[])[0]?.released) !== 1) throw new Error("Migration lock release failed");
      }
    } catch (error) {
      // A session that might still own a named lock must never return to the pool.
      destroyed = true;
      connection.destroy();
      throw error;
    } finally {
      if (!destroyed) connection.release();
    }
  }
}
