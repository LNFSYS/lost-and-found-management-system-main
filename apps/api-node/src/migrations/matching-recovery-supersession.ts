import { verifyMatchingFeedbackRecoveryBaseline } from "./legacy-schema-verification.js";
import { checksumMatches, type MigrationConnection, type MigrationFile, type LedgerRow } from "./migration-state.js";

const original = "054_matching_feedback_periodic_refresh.sql";
const recovery = "057_matching_feedback_recovery_contract.sql";
const originalChecksum = "404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d";
const recoveryChecksum = "fe2df69e5f0118901a660f871393a74f018e78479afa01a009f379100817cc1d";

export async function matchingRecoverySupersession(connection: MigrationConnection, files: MigrationFile[], ledger: LedgerRow[]) {
  const originalFile = files.find(file => file.version === original);
  if (originalFile && originalFile.normalized !== originalChecksum) throw new Error("Original matching 054 SQL must retain its reviewed checksum");
  if (ledger.some(row => row.version === original)) {
    await verifyMatchingFeedbackRecoveryBaseline(connection);
    return [];
  }
  const replacement = ledger.find(row => row.version === recovery);
  if (!replacement || !originalFile) return [];
  const recoveryFile = files.find(file => file.version === recovery);
  if (!recoveryFile || !checksumMatches(replacement.checksum, recoveryFile)
    || recoveryFile.normalized !== recoveryChecksum || originalFile.normalized !== originalChecksum) {
    throw new Error("Matching supersession requires the exact reviewed original/recovery SQL and applied recovery checksum");
  }
  // Supersession is a read-only plan, not an APPLIED record for SQL never run.
  await verifyMatchingFeedbackRecoveryBaseline(connection);
  return [{ version: original, supersededBy: recovery }];
}
