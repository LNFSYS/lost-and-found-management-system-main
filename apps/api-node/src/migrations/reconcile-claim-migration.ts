import { verifyClaimConversationSchema } from "./claim-schema-verification.js";
import {
  checksumMatches, readMigrationFiles, readMigrationState, validateMigrationState, withMigrationLock,
  type MigrationConnection, type MigrationFile, type MigrationPool
} from "./migration-state.js";

export const legacyClaimVersion = "040_peer_claim_conversations.sql";
export const canonicalClaimVersion = "045_peer_claim_conversations.sql";

async function inspect(connection: MigrationConnection, files: MigrationFile[]) {
  const file = files.find((f) => f.version === canonicalClaimVersion);
  if (!file) throw new Error("Canonical claim migration file is missing");
  const state = await readMigrationState(connection);
  const old = state.ledger.find((r) => r.version === legacyClaimVersion);
  const current = state.ledger.find((r) => r.version === canonicalClaimVersion);
  if (old && current) throw new Error("Both alias ledger versions exist; manual investigation required");
  if (!old && state.attempts.some((r) => r.version === legacyClaimVersion)) {
    throw new Error("Legacy attempt has no matching legacy ledger; manual investigation required");
  }
  if (old && !checksumMatches(old.checksum, file)) throw new Error("Legacy claim migration checksum mismatch");
  const normalized = {
    ledger: state.ledger.map((r) => r.version === legacyClaimVersion ? { ...r, version: canonicalClaimVersion } : r),
    attempts: state.attempts.map((r) => r.version === legacyClaimVersion ? { ...r, version: canonicalClaimVersion } : r)
  };
  if (state.attempts.some((r) => r.version === canonicalClaimVersion) && old) throw new Error("Canonical claim migration already has an attempt; manual investigation required");
  validateMigrationState(files, normalized);
  if (old || current) await verifyClaimConversationSchema(connection);
  return { status: old ? "READY" as const : current ? "ALREADY_CANONICAL" as const : "NOT_NEEDED" as const,
    hasLegacyAttempt: state.attempts.some((r) => r.version === legacyClaimVersion) };
}

export async function reconcileClaimMigration(input: {
  directory: string; pool: MigrationPool; apply?: boolean; expectedDatabase?: string;
}) {
  if (input.apply && !input.expectedDatabase) throw new Error("Apply requires an explicit expected database");
  const files = await readMigrationFiles(input.directory);
  const work = async (connection: MigrationConnection, database: string) => {
    if (input.expectedDatabase && database !== input.expectedDatabase) throw new Error("Database target does not match explicit confirmation");
    await connection.query(input.apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY");
    try {
      const before = await inspect(connection, files);
      if (input.apply && before.status === "READY") {
        const [ledger] = await connection.query("UPDATE schema_migrations SET version = ? WHERE version = ?", [canonicalClaimVersion, legacyClaimVersion]);
        if ((ledger as { affectedRows: number }).affectedRows !== 1) throw new Error("Alias ledger changed during reconciliation");
        if (before.hasLegacyAttempt) {
          const [attempt] = await connection.query("UPDATE schema_migration_attempts SET version = ? WHERE version = ? AND status = 'APPLIED'", [canonicalClaimVersion, legacyClaimVersion]);
          if ((attempt as { affectedRows: number }).affectedRows !== 1) throw new Error("Alias attempt changed during reconciliation");
        }
        const after = await inspect(connection, files);
        if (after.status !== "ALREADY_CANONICAL") throw new Error("Reconciliation postcondition failed");
        await connection.query("COMMIT");
        return { database, mode: "apply", before: before.status, after: after.status, from: legacyClaimVersion, to: canonicalClaimVersion };
      }
      await connection.query("ROLLBACK");
      return { database, mode: input.apply ? "apply" : "dry-run", before: before.status, after: before.status,
        from: legacyClaimVersion, to: canonicalClaimVersion };
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    }
  };
  if (input.apply) return withMigrationLock(input.pool, work);
  const connection = await input.pool.getConnection();
  try {
    const [rows] = await connection.query("SELECT DATABASE() AS name");
    const database = (rows as { name: string | null }[])[0]?.name;
    if (!database) throw new Error("A database must be selected");
    return await work(connection, database);
  } finally { connection.release(); }
}
