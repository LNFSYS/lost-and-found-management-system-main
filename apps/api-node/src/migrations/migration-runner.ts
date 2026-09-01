import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface MigrationConnection {
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  release(): void;
}

export interface MigrationPool {
  query(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  getConnection(): Promise<MigrationConnection>;
}

interface AppliedRow { checksum: string; }
interface AttemptRow { checksum: string; status: string; }

const recoveryInstruction = "Inspect the database for partially applied DDL, reconcile the schema, then remove this version from schema_migration_attempts before retrying. Do not edit a migration already recorded in schema_migrations.";

function statementFailurePoint(error: unknown) {
  const candidate = error as { index?: unknown; code?: unknown };
  if (typeof candidate.index === "number" && Number.isInteger(candidate.index)) return `statement ${candidate.index + 1}`;
  if (typeof candidate.code === "string" && candidate.code) return candidate.code;
  return "unknown statement";
}

function safeErrorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "unknown migration error").slice(0, 500);
}

function migrationChecksums(sql: string) {
  return {
    raw: createHash("sha256").update(sql).digest("hex"),
    normalized: createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex")
  };
}

function checksumMatches(value: string, checksums: ReturnType<typeof migrationChecksums>) {
  return value === checksums.raw || value === checksums.normalized;
}

export async function runMigrations(input: {
  directory: string;
  pool: MigrationPool;
  log?: (message: string) => void;
}) {
  const log = input.log ?? console.info;
  const files = (await readdir(input.directory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();

  await input.pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await input.pool.query(`CREATE TABLE IF NOT EXISTS schema_migration_attempts (
    version VARCHAR(100) PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    failure_point VARCHAR(100) NULL,
    error_message VARCHAR(500) NULL
  )`);

  for (const file of files) {
    const sql = await readFile(path.join(input.directory, file), "utf8");
    const checksums = migrationChecksums(sql);
    const checksum = checksums.raw;
    const [appliedResult] = await input.pool.query("SELECT checksum FROM schema_migrations WHERE version = ?", [file]);
    const applied = appliedResult as AppliedRow[];
    if (applied.length) {
      if (!checksumMatches(applied[0].checksum, checksums)) throw new Error(`Migration checksum mismatch: ${file}`);
      continue;
    }

    const [attemptResult] = await input.pool.query("SELECT checksum, status FROM schema_migration_attempts WHERE version = ?", [file]);
    const attempts = attemptResult as AttemptRow[];
    if (attempts.length) {
      const reason = checksumMatches(attempts[0].checksum, checksums) ? attempts[0].status : "CHECKSUM_CHANGED";
      throw new Error(`Migration ${file} has an incomplete attempt (${reason}). ${recoveryInstruction}`);
    }

    await input.pool.query(
      "INSERT INTO schema_migration_attempts (version, checksum, status) VALUES (?, ?, 'RUNNING')",
      [file, checksum]
    );

    const connection = await input.pool.getConnection();
    try {
      // MySQL DDL auto-commits. The attempt marker detects a crash or partial DDL instead of claiming rollback safety.
      await connection.query(sql);
      await connection.query("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [file, checksum]);
      await input.pool.query(
        "UPDATE schema_migration_attempts SET status = 'APPLIED', completed_at = CURRENT_TIMESTAMP, failure_point = NULL, error_message = NULL WHERE version = ?",
        [file]
      );
      log(`Applied migration ${file}`);
    } catch (error) {
      const failurePoint = statementFailurePoint(error);
      const errorMessage = safeErrorMessage(error);
      await input.pool.query(
        "UPDATE schema_migration_attempts SET status = 'FAILED', completed_at = CURRENT_TIMESTAMP, failure_point = ?, error_message = ? WHERE version = ?",
        [failurePoint, errorMessage, file]
      ).catch(() => undefined);
      throw new Error(`Migration ${file} failed at ${failurePoint}: ${errorMessage}. ${recoveryInstruction}`, { cause: error });
    } finally {
      connection.release();
    }
  }
}
