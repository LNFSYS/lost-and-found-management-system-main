import type { AdminAuditEntry, AdminAuditRepository } from "../application/admin-audit.repository.port.js";

export type { AdminAuditEntry, AdminAuditRepository } from "../application/admin-audit.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { PoolConnection } from "mysql2/promise";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

export function createAdminAuditRepository(pool: SqlExecutor) {

  const adminAuditRepository = {
    async record(entry: AdminAuditEntry, connection: Queryable = pool) {
      await sqlExecutor(connection).execute(
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
  } satisfies AdminAuditRepository;

  return adminAuditRepository;

}
