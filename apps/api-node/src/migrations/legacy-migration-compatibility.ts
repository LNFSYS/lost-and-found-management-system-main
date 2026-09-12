import type { MigrationCompatibilityEntry } from "./migration-state.js";

// These exact records were read from the shared Aiven ledger on 2026-09-12.
// Entries with unavailable SQL remain historical compatibility records, never
// substitutes for new forward migrations.
export const legacyMigrationCompatibility = [
  {
    version: "040_peer_claim_conversations.sql",
    checksum: "b221b91ca91d232084eb2feafa77bc108dfd746ee678e8c4ec53d844904f625a",
    verifier: "claim-conversations",
    satisfiesVersions: ["045_peer_claim_conversations.sql"]
  },
  {
    version: "045_peer_claim_conversations.sql",
    checksum: "f325fd3fc12c6051cd5a5ab806043d99788ed5db574cccc64b5e14569742f998",
    verifier: "claim-conversations"
  },
  {
    version: "047_realtime_claim_chat.sql",
    checksum: "0b00e558ba1c4cc7156d7eb5192d8ee7cd25d39aa15311d33424478fede85db5",
    verifier: "realtime-claim-chat",
    satisfiesVersions: ["049_realtime_claim_chat_contract.sql"]
  },
  {
    version: "048_notification_type_text.sql",
    checksum: "bba2b7334358d80de0c1836e58bc615e6209f99c7291dca82e7c45140e4be5d6",
    verifier: "notification-type-text",
    satisfiesVersions: ["050_notification_type_text_contract.sql"]
  }
] as const satisfies readonly MigrationCompatibilityEntry[];
