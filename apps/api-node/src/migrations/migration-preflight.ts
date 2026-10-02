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
      pending,
      warnings: [
        ...(compatibilityMatches.some(match => match.verifier === "custody-recovery-baseline")
          ? ["Historical 053 ledger scope differs from recovered custody runtime schema. No alias: canonical 053 and additive 054 remain required; old disposition/legal-hold tables are not certified by this recovery."] : []),
        ...(compatibilityMatches.some(match => ["matching-feedback-recovery-baseline", "custody-time-removal"].includes(match.verifier))
          ? ["Original SQL for historical matching 054 / custody-time 055 is unavailable. Exact ledger records and observed schema are recognized for user-approved forward recovery only; original data/configuration effects are NOT certified or replayed."] : [])
      ]
    };
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
