import type { RowDataPacket } from "mysql2";
import type { SqlExecutor } from "../shared/infrastructure/transaction-context.js";

export const warehouseMaintenanceColumns = {
  custody_requests: ["id", "post_id", "claim_id", "requester_id", "status", "warehouse_item_id", "request_payload"],
  warehouse_items: ["id", "status", "deleted_at", "retention_deadline", "legal_hold", "reserved_claim_id"],
  warehouse_private_proofs: ["id", "storage_ref", "attached_at", "created_at"],
  warehouse_intake_sessions: ["id", "actor_id", "warehouse_item_id", "created_at"],
  warehouse_intake_images: ["id", "intake_id", "storage_ref", "created_at"],
  lost_contact_photo_checks: ["id", "claim_id", "storage_ref", "expires_at"],
  claims: ["id", "post_id", "source_found_post_id"],
  claim_participants: ["claim_id", "user_id", "consent_status"],
  users: ["id", "status"],
  user_roles: ["user_id", "role_code"],
  notifications: ["id", "user_id", "type", "title", "body", "entity_type", "entity_id", "dedupe_key", "is_read", "read_at", "created_at"],
  notification_email_preferences: ["user_id", "chat_mode", "claim_mode", "quiet_hours_start", "quiet_hours_end", "timezone", "updated_at"],
  notification_email_outbox: ["id", "notification_id", "recipient_user_id", "event_type", "entity_type", "entity_id", "room_id", "delivery_mode", "idempotency_key", "due_at"]
} as const;

export interface WarehouseMaintenanceSchema {
  ready: boolean;
  missing: string[];
}

export async function checkWarehouseMaintenanceSchema(database: SqlExecutor): Promise<WarehouseMaintenanceSchema> {
  const tables = Object.keys(warehouseMaintenanceColumns);
  const [rows] = await database.execute<RowDataPacket[]>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${tables.map(() => "?").join(",")})`, tables
  );
  const columns = new Set(rows.map(row => `${row.table_name}.${row.column_name}`));
  const missing: string[] = [];
  for (const [table, required] of Object.entries(warehouseMaintenanceColumns)) {
    if (!rows.some(row => row.table_name === table)) missing.push(table);
    else for (const column of required) if (!columns.has(`${table}.${column}`)) missing.push(`${table}.${column}`);
  }
  return { ready: missing.length === 0, missing };
}
