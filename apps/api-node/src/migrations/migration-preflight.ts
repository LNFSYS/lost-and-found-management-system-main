import { legacyMigrationCompatibility } from "./legacy-migration-compatibility.js";
import { matchingRecoverySupersession } from "./matching-recovery-supersession.js";
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
    const superseded = await matchingRecoverySupersession(connection, files, state.ledger);
    const pending = pendingMigrationFiles(files, state, compatibilityMatches)
      .filter(file => !superseded.some(entry => entry.version === file.version)).map((file) => file.version);
    await connection.query("ROLLBACK");
    return {
      sourceMigrations: files.length,
      appliedMigrations: state.ledger.length,
      appliedAttempts: state.attempts.filter((attempt) => attempt.status === "APPLIED").length,
      compatibilityRecords: compatibilityMatches.filter((match) => match.source === "ledger").map((match) => match.version),
      pending,
      superseded,
      warnings: [
        ...(compatibilityMatches.some(match => match.verifier === "custody-recovery-baseline")
          ? ["Historical 053 ledger scope differs from recovered custody runtime schema. No alias: canonical 053 and additive 054 remain required; old disposition/legal-hold tables are not certified by this recovery."] : []),
        ...superseded.map(entry => `${entry.version} is superseded by verified ${entry.supersededBy}; original SQL is NOT replayed or recorded as APPLIED.`),
        ...(compatibilityMatches.some(match => match.verifier === "custody-time-removal")
          ? ["Original SQL for historical custody-time 055 remains unavailable; observed schema is checked, original effects are not replayed."] : [])
      ]
    };
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}
