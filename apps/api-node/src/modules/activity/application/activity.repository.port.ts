export interface ActivityEvent {
  id: string; source: string; action: string; targetType: string; targetId: string;
  actorId: string | null; createdAt: string; fromStatus: string | null; toStatus: string | null;
}
export interface AuditFilter { query?: string; source?: string; actorId?: string; targetId?: string; from?: string; to?: string; page: number }
export interface JourneySummary {
  custodian:"FINDER"|"STAFF"|"OWNER"|"UNKNOWN";locationClass:"FINDER_HELD"|"WAREHOUSE"|"RETURNED"|"OTHER_DISPOSITION"|"UNKNOWN";
  receivedAt:string|null;returnedAt:string|null;custodyHours:number|null;feedbackEligible:boolean;
}
export interface ActivityRepository {
  audit(filter: AuditFilter, limit: number, tx?:TransactionContext): Promise<{ results: ActivityEvent[]; total: number }>;
  journey(postId: string, userId: string, page: number, asOf: string): Promise<{ title: string; status: string; results: ActivityEvent[]; total: number; summary:JourneySummary } | null>;
}
import type { TransactionContext } from "../../../shared/application/transaction.js";
