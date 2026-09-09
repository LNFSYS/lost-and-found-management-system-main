import type { TransactionContext } from "../../../shared/application/transaction.js";
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

export interface AdminAuditRepository {
  record(entry: AdminAuditEntry, connection?: TransactionContext): Promise<void>;
}
