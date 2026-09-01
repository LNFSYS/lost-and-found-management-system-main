import type { PoolConnection } from "mysql2/promise";
import { pool } from "../config/db.js";

type Queryable = Pick<PoolConnection, "execute">;

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  reason: string | null;
}

export const adminAuditRepository = {
  async record(entry: AdminAuditEntry, connection: Queryable = pool) {
    await connection.execute(
      `INSERT INTO admin_audit_logs
       (id, actor_id, action, target_type, target_id, before_state, after_state, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.actorId,
        entry.action,
        entry.targetType,
        entry.targetId,
        entry.beforeState === null ? null : JSON.stringify(entry.beforeState),
        entry.afterState === null ? null : JSON.stringify(entry.afterState),
        entry.reason
      ]
    );
  }
};

export type AdminAuditRepository = typeof adminAuditRepository;
