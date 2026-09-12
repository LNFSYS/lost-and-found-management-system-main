import { verifyClaimConversationSchema } from "./claim-schema-verification.js";
import type {
  MigrationCompatibilityMatch,
  MigrationConnection,
  MigrationSchemaVerifier
} from "./migration-state.js";

type ColumnRow = {
  table_name: string;
  column_name: string;
  column_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | number | null;
  collation_name: string | null;
};
type IndexRow = {
  table_name: string;
  index_name: string;
  non_unique: number;
  seq_in_index: number;
  column_name: string;
  is_visible: string;
};
type ForeignKeyRow = {
  table_name: string;
  constraint_name: string;
  column_name: string;
  referenced_table_name: string;
  referenced_column_name: string;
  update_rule: string;
  delete_rule: string;
};

type ColumnSpec = [table: string, name: string, type: string, nullable: boolean, defaultValue: string | null];
type IndexSpec = [table: string, name: string, unique: boolean, columns: string[]];
type ForeignKeySpec = [table: string, name: string, column: string, referencedTable: string, referencedColumn: string];

function normalizedDefault(value: string | number | null) {
  return value === null ? null : String(value).replace(/\(\)$/, "").toUpperCase();
}

async function schemaRows(connection: MigrationConnection, tables: readonly string[]) {
  const placeholders = tables.map(() => "?").join(", ");
  const [columns] = await connection.query(`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name,
    COLUMN_TYPE AS column_type, IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
    COLLATION_NAME AS collation_name
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`, [...tables]);
  const [indexes] = await connection.query(`SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name,
    NON_UNIQUE AS non_unique, SEQ_IN_INDEX AS seq_in_index, COLUMN_NAME AS column_name, IS_VISIBLE AS is_visible
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`, [...tables]);
  const [foreignKeys] = await connection.query(`SELECT k.TABLE_NAME AS table_name, k.CONSTRAINT_NAME AS constraint_name,
    k.COLUMN_NAME AS column_name, k.REFERENCED_TABLE_NAME AS referenced_table_name,
    k.REFERENCED_COLUMN_NAME AS referenced_column_name, r.UPDATE_RULE AS update_rule, r.DELETE_RULE AS delete_rule
    FROM information_schema.KEY_COLUMN_USAGE k
    INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r
      ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME
      AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
    WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME IN (${placeholders})`, [...tables]);
  const [tableRows] = await connection.query(`SELECT TABLE_NAME AS table_name, ENGINE AS engine,
    TABLE_COLLATION AS table_collation FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`, [...tables]);
  return {
    columns: columns as ColumnRow[],
    indexes: indexes as IndexRow[],
    foreignKeys: foreignKeys as ForeignKeyRow[],
    tables: tableRows as { table_name: string; engine: string; table_collation: string }[]
  };
}

function verifyColumns(actual: ColumnRow[], expected: readonly ColumnSpec[], failures: string[]) {
  for (const [table, name, type, nullable, defaultValue] of expected) {
    const row = actual.find((candidate) => candidate.table_name === table && candidate.column_name === name);
    if (!row || row.column_type.toLowerCase() !== type.toLowerCase()
      || row.is_nullable !== (nullable ? "YES" : "NO")
      || normalizedDefault(row.column_default) !== normalizedDefault(defaultValue)) {
      failures.push(`column:${table}.${name}`);
      continue;
    }
    if (/^(char|varchar|text|enum)/.test(type) && row.collation_name !== "utf8mb4_unicode_ci") {
      failures.push(`collation:${table}.${name}`);
    }
  }
}

function verifyIndexes(actual: IndexRow[], expected: readonly IndexSpec[], failures: string[]) {
  for (const [table, name, unique, columns] of expected) {
    const rows = actual.filter((row) => row.table_name === table && row.index_name === name);
    if (rows.length !== columns.length || rows.some((row, index) =>
      Number(row.non_unique) !== (unique ? 0 : 1) || Number(row.seq_in_index) !== index + 1
      || row.column_name !== columns[index] || row.is_visible !== "YES")) {
      failures.push(`index:${table}.${name}`);
    }
  }
}

function verifyForeignKeys(actual: ForeignKeyRow[], expected: readonly ForeignKeySpec[], failures: string[]) {
  for (const [table, name, column, referencedTable, referencedColumn] of expected) {
    const row = actual.find((candidate) => candidate.table_name === table && candidate.constraint_name === name);
    if (!row || row.column_name !== column || row.referenced_table_name !== referencedTable
      || row.referenced_column_name !== referencedColumn
      || !["RESTRICT", "NO ACTION"].includes(row.update_rule)
      || !["RESTRICT", "NO ACTION"].includes(row.delete_rule)) {
      failures.push(`foreign-key:${table}.${name}`);
    }
  }
}

export async function verifyRealtimeClaimChatSchema(connection: MigrationConnection) {
  const tables = ["chat_rooms", "chat_messages", "claim_room_blocks"] as const;
  const actual = await schemaRows(connection, tables);
  const failures: string[] = [];
  verifyColumns(actual.columns, [
    ["chat_rooms", "next_sequence", "bigint unsigned", false, "1"],
    ["chat_rooms", "blocked_by", "char(36)", true, null],
    ["chat_rooms", "blocked_at", "datetime", true, null],
    ["chat_rooms", "escalated_at", "datetime", true, null],
    ["chat_rooms", "escalated_by", "char(36)", true, null],
    ["chat_rooms", "escalation_reason", "varchar(255)", true, null],
    ["chat_messages", "sequence", "bigint unsigned", false, null],
    ["chat_messages", "client_message_id", "varchar(190)", true, null],
    ["chat_messages", "content", "text", true, null],
    ["chat_messages", "media_url", "varchar(500)", true, null],
    ["chat_messages", "media_public_id", "varchar(255)", true, null],
    ["chat_messages", "media_bytes", "int unsigned", true, null],
    ["chat_messages", "media_format", "varchar(10)", true, null],
    ["chat_messages", "message_type", "enum('TEXT','IMAGE','SYSTEM')", false, "TEXT"],
    ["chat_messages", "is_read", "tinyint(1)", false, "0"],
    ["chat_messages", "delivery_status", "enum('SENT','DELIVERED','READ')", false, "SENT"],
    ["chat_messages", "delivered_at", "datetime", true, null],
    ["chat_messages", "edited_at", "datetime", true, null],
    ["chat_messages", "deleted_at", "datetime", true, null],
    ["chat_messages", "read_at", "datetime", true, null],
    ["claim_room_blocks", "room_id", "char(36)", false, null],
    ["claim_room_blocks", "blocked_by", "char(36)", false, null],
    ["claim_room_blocks", "blocked_user_id", "char(36)", false, null],
    ["claim_room_blocks", "reason", "varchar(255)", true, null],
    ["claim_room_blocks", "created_at", "datetime", false, "CURRENT_TIMESTAMP"]
  ], failures);
  verifyIndexes(actual.indexes, [
    ["chat_messages", "uq_chat_message_idempotency", true, ["room_id", "sender_id", "client_message_id"]],
    ["chat_messages", "uq_chat_messages_room_sequence", true, ["room_id", "sequence"]],
    ["chat_messages", "idx_chat_messages_room_unread", false, ["room_id", "sender_id", "is_read", "created_at"]],
    ["claim_room_blocks", "PRIMARY", true, ["room_id", "blocked_by", "blocked_user_id"]],
    ["claim_room_blocks", "idx_claim_room_blocks_target", false, ["blocked_user_id", "created_at"]]
  ], failures);
  verifyForeignKeys(actual.foreignKeys, [
    ["chat_messages", "fk_messages_room", "room_id", "chat_rooms", "id"],
    ["chat_messages", "fk_messages_sender", "sender_id", "users", "id"],
    ["chat_rooms", "fk_chat_rooms_claim", "claim_id", "claims", "id"],
    ["claim_room_blocks", "fk_claim_room_blocks_room", "room_id", "chat_rooms", "id"],
    ["claim_room_blocks", "fk_claim_room_blocks_actor", "blocked_by", "users", "id"],
    ["claim_room_blocks", "fk_claim_room_blocks_target", "blocked_user_id", "users", "id"]
  ], failures);
  for (const table of tables) {
    if (!actual.tables.some((row) => row.table_name === table && row.engine === "InnoDB"
      && row.table_collation === "utf8mb4_unicode_ci")) failures.push(`table:${table}`);
  }
  const [consistency] = await connection.query(`SELECT
    (SELECT COUNT(*) FROM chat_messages WHERE sequence < 1) AS invalid_sequence,
    (SELECT COUNT(*) FROM chat_rooms room WHERE room.next_sequence <= COALESCE(
      (SELECT MAX(message.sequence) FROM chat_messages message WHERE message.room_id = room.id), 0)) AS invalid_next_sequence`);
  const row = (consistency as { invalid_sequence: number; invalid_next_sequence: number }[])[0];
  if (Number(row?.invalid_sequence) !== 0) failures.push("data:chat_messages.sequence");
  if (Number(row?.invalid_next_sequence) !== 0) failures.push("data:chat_rooms.next_sequence");
  if (failures.length) throw new Error(`Realtime claim chat schema mismatch: ${failures.join(", ")}`);
}

export async function verifyNotificationTypeTextSchema(connection: MigrationConnection) {
  const actual = await schemaRows(connection, ["notifications"]);
  const failures: string[] = [];
  verifyColumns(actual.columns, [
    ["notifications", "type", "varchar(60)", false, null]
  ], failures);
  if (!actual.tables.some((row) => row.table_name === "notifications" && row.engine === "InnoDB"
    && row.table_collation === "utf8mb4_unicode_ci")) failures.push("table:notifications");
  if (failures.length) throw new Error(`Notification schema mismatch: ${failures.join(", ")}`);
}

export async function verifyOperationalSchema(connection: MigrationConnection) {
  await verifyClaimConversationSchema(connection);
  await verifyNotificationTypeTextSchema(connection);
  const tables = ["return_feedback", "warehouse_items", "storage_logs", "post_media", "users"] as const;
  const actual = await schemaRows(connection, tables);
  const failures: string[] = [];
  verifyColumns(actual.columns, [
    ["return_feedback", "appointment_id", "char(36)", false, null],
    ["return_feedback", "idempotency_key", "varchar(128)", true, null],
    ["return_feedback", "status", "enum('NEW','REVIEWED','FLAGGED','DISMISSED')", false, "NEW"],
    ["warehouse_items", "status", "enum('PENDING_APPROVAL','RECEIVED','STORED','CLAIMED','RETURNED','EXPIRED','DISPOSED','DONATED','TRANSFERRED')", false, "RECEIVED"],
    ["warehouse_items", "storage_code", "varchar(60)", true, null],
    ["warehouse_items", "retention_deadline", "datetime", true, null],
    ["storage_logs", "warehouse_item_id", "char(36)", true, null],
    ["storage_logs", "action", "enum('RECEIVED','STORED','CLAIMED','RETURNED','EXPIRED','DISPOSED','DONATED','TRANSFERRED','OVERDUE_MARKED','CONDITION_UPDATED')", false, null],
    ["post_media", "secure_url", "varchar(500)", false, null],
    ["post_media", "public_id", "varchar(255)", false, null],
    ["post_media", "resource_type", "varchar(20)", false, "image"],
    ["post_media", "format", "varchar(10)", true, null],
    ["post_media", "bytes", "int", true, null],
    ["users", "avatar_cloudinary_public_id", "varchar(255)", true, null],
    ["users", "avatar_cloudinary_asset_id", "varchar(255)", true, null],
    ["users", "avatar_cloudinary_version", "int", true, null],
    ["users", "avatar_cloudinary_format", "varchar(16)", true, null],
    ["users", "avatar_cloudinary_resource_type", "varchar(16)", true, null],
    ["users", "avatar_cloudinary_bytes", "int", true, null]
  ], failures);
  verifyIndexes(actual.indexes, [
    ["return_feedback", "uq_return_feedback_appointment_reviewer_idempotency", true, ["appointment_id", "reviewer_id", "idempotency_key"]],
    ["return_feedback", "idx_return_feedback_reviewer_fk_support", false, ["reviewer_id"]],
    ["warehouse_items", "idx_warehouse_retention_deadline", false, ["retention_deadline"]],
    ["storage_logs", "idx_storage_logs_warehouse_item", false, ["warehouse_item_id", "created_at"]],
    ["post_media", "idx_post_media_kind_sort", false, ["post_id", "media_kind", "sort_order", "created_at"]]
  ], failures);
  verifyForeignKeys(actual.foreignKeys, [
    ["return_feedback", "fk_return_feedback_appointment", "appointment_id", "return_appointments", "id"],
    ["return_feedback", "fk_return_feedback_reviewer", "reviewer_id", "users", "id"],
    ["warehouse_items", "fk_warehouse_post", "post_id", "posts", "id"],
    ["storage_logs", "fk_storage_logs_warehouse_item", "warehouse_item_id", "warehouse_items", "id"],
    ["post_media", "fk_post_media_post", "post_id", "posts", "id"]
  ], failures);
  for (const table of tables) {
    if (!actual.tables.some((row) => row.table_name === table && row.engine === "InnoDB"
      && row.table_collation === "utf8mb4_unicode_ci")) failures.push(`table:${table}`);
  }
  if (failures.length) throw new Error(`Operational schema mismatch: ${failures.join(", ")}`);
}

const verifiers: Record<MigrationSchemaVerifier, (connection: MigrationConnection) => Promise<void>> = {
  "claim-conversations": verifyClaimConversationSchema,
  "realtime-claim-chat": verifyRealtimeClaimChatSchema,
  "notification-type-text": verifyNotificationTypeTextSchema
};

export async function verifyMigrationCompatibility(
  connection: MigrationConnection,
  matches: readonly MigrationCompatibilityMatch[]
) {
  const required = new Set(matches.map((match) => match.verifier));
  for (const verifier of required) await verifiers[verifier](connection);
}
