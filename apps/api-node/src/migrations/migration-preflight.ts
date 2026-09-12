import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import { verifyMigrationCompatibility, verifyOperationalSchema } from "./legacy-schema-verification.js";
import {
  pendingMigrationFiles,
  readMigrationFiles,
  readMigrationState,
  validateMigrationState,
  type MigrationPool
} from "./migration-state.js";

export async function preflightMigrations(input: { directory: string; pool: MigrationPool }) {
  const files = await readMigrationFiles(input.directory);
  const connection = await input.pool.getConnection();
  try {
    await connection.query("START TRANSACTION READ ONLY");
    const state = await readMigrationState(connection);
    const compatibilityMatches = validateMigrationState(files, state, legacyMigrationCompatibility);
    await verifyMigrationCompatibility(connection, compatibilityMatches);
    await verifyOperationalSchema(connection);
    const pending = pendingMigrationFiles(files, state, compatibilityMatches).map((file) => file.version);
    await connection.query("ROLLBACK");
    return {
      sourceMigrations: files.length,
      appliedMigrations: state.ledger.length,
      appliedAttempts: state.attempts.filter((attempt) => attempt.status === "APPLIED").length,
      compatibilityRecords: compatibilityMatches.filter((match) => match.source === "ledger").map((match) => match.version),
      pending
    };
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
