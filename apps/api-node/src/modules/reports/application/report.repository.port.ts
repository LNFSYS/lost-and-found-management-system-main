import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ListMyReportsQuery, ReportEntityType, ReportSourceType, ReportStatus } from "./report.dto.js";

export interface AccessibleReportTarget {
  entityType: ReportEntityType;
  entityId: string;
  sourceType: ReportSourceType;
  sourceId: string;
  title: string;
  status: string;
}

export interface UserReportRecord {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  sourceType: ReportSourceType;
  sourceId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  resolution: string | null;
  reviewedAt: string | null;
  withdrawnAt: string | null;
  createdAt: string;
  target: { title: string; status: string };
}

export interface LockedUserReport {
  id: string;
  reporterId: string;
  status: ReportStatus;
  reviewedAt: string | null;
  withdrawnAt: string | null;
}

export interface ReportRepository {
  findAccessibleTarget(userId: string, sourceType: ReportSourceType, sourceId: string): Promise<AccessibleReportTarget | null>;
  findByIdempotencyKey(reporterId: string, key: string, connection?: TransactionContext): Promise<{ report: UserReportRecord; requestHash: string | null } | null>;
  create(input: {
    id: string; reporterId: string; target: AccessibleReportTarget; reason: string; details: string | null;
    idempotencyKey: string; requestHash: string;
  }, connection: TransactionContext): Promise<void>;
  createAuditEvent(input: { id: string; reportId: string; actorId: string; action: "SUBMITTED" | "WITHDRAWN" }, connection: TransactionContext): Promise<void>;
  listMine(reporterId: string, query: ListMyReportsQuery): Promise<{ total: number; page: number; pageSize: number; items: UserReportRecord[] }>;
  findMine(reportId: string, reporterId: string, connection?: TransactionContext): Promise<UserReportRecord | null>;
  lock(reportId: string, connection: TransactionContext): Promise<LockedUserReport | null>;
  withdraw(reportId: string, connection: TransactionContext): Promise<boolean>;
}
