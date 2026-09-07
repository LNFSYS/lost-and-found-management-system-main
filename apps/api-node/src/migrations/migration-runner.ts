import {
  readMigrationFiles, readMigrationState, recoveryInstruction, validateMigrationState,
  withMigrationLock, type MigrationPool
} from "./migration-state.js";

export type { MigrationPool } from "./migration-state.js";

function statementFailurePoint(error: unknown) {
  const candidate = error as { index?: unknown; code?: unknown };
  if (typeof candidate.index === "number" && Number.isInteger(candidate.index)) return `statement ${candidate.index + 1}`;
  if (typeof candidate.code === "string" && /^[A-Z0-9_]+$/.test(candidate.code)) return candidate.code;
  return "unknown statement";
}

export async function runMigrations(input: {
  directory: string;
  pool: MigrationPool;
  log?: (message: string) => void;
}) {
  const files = await readMigrationFiles(input.directory);
  const log = input.log ?? console.info;
  await withMigrationLock(input.pool, async (connection) => {
    const state = await readMigrationState(connection);
    // Validate all history before even the first pending migration can auto-commit DDL.
    validateMigrationState(files, state);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migration_attempts (
      version VARCHAR(100) PRIMARY KEY, checksum CHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP NULL, failure_point VARCHAR(100) NULL, error_message VARCHAR(500) NULL
    )`);
    for (const file of files) {
      if (state.ledger.some((row) => row.version === file.version)) continue;
      await connection.query(
        "INSERT INTO schema_migration_attempts (version, checksum, status) VALUES (?, ?, 'RUNNING')",
        [file.version, file.raw]
      );
      try {
        // DDL is not rollback-safe. Only success-ledger and attempt completion are atomic.
        await connection.query(file.sql);
        await connection.query("START TRANSACTION");
        await connection.query("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [file.version, file.raw]);
        await connection.query(
          "UPDATE schema_migration_attempts SET status = 'APPLIED', completed_at = CURRENT_TIMESTAMP, failure_point = NULL, error_message = NULL WHERE version = ?",
          [file.version]
        );
        await connection.query("COMMIT");
      } catch (error) {
        const failurePoint = statementFailurePoint(error);
        await connection.query("ROLLBACK");
        await connection.query(
          "UPDATE schema_migration_attempts SET status = 'FAILED', completed_at = CURRENT_TIMESTAMP, failure_point = ?, error_message = ? WHERE version = ?",
          [failurePoint, `Migration failed at ${failurePoint}; inspect schema before retry`, file.version]
        );
        // Provider messages can contain values from data-changing SQL.
        throw new Error(`Migration ${file.version} failed at ${failurePoint}. ${recoveryInstruction}`);
      }
      log(`Applied migration ${file.version}`);
    }
  });
}
