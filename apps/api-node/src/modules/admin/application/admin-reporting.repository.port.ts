import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ListModerationReportsQuery, ModerationActionType, ReportEntityType, ReportStatus } from "./admin-reporting.dto.js";

export type ModerationTargetType = "USER" | "POST" | "REPORT";

export interface ReportingWindow {
  from: string;
  to: string;
  start: Date;
  endExclusive: Date;
  days: number;
}

export interface ReportEntitySummary {
  type: ReportEntityType;
  title: string | null;
  status: string | null;
  ownerName: string | null;
  referenceId: string | null;
}

export interface ModerationReportRecord {
  id: string;
  reporter: {
    id: string;
    fullName: string;
    email: string;
  };
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewer: {
    id: string;
    fullName: string;
  } | null;
  reviewedAt: string | null;
  createdAt: string;
  entity: ReportEntitySummary;
}

export interface LockedReportRecord {
  id: string;
  reporterId: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: string;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface ModerationTargetRecord {
  id: string;
  type: "USER" | "POST";
  label: string;
  status: string;
  isAdmin?: boolean;
}

export interface DashboardTotals {
  posts: number;
  claims: number;
  appointments: number;
  returns: number;
}

export interface DashboardSnapshot {
  openPosts: number;
  custodyItems: number;
  unresolvedReports: number;
}

export interface DailyTrendRow {
  date: string;
  metric: "posts" | "claims" | "appointments" | "returns" | "custody" | "reports";
  total: number;
}

export interface StatusCount {
  status: string;
  total: number;
}

export interface DashboardBreakdown {
  posts: StatusCount[];
  claims: StatusCount[];
  appointments: StatusCount[];
  custody: StatusCount[];
  reports: StatusCount[];
}

export interface AdminReportingRepository {
  listReports(filters: ListModerationReportsQuery): Promise<{
    total: number;
    page: number;
    pageSize: number;
    items: ModerationReportRecord[];
  }>;
  findReportById(reportId: string, connection?: TransactionContext): Promise<ModerationReportRecord | null>;
  lockReport(reportId: string, connection: TransactionContext): Promise<LockedReportRecord | null>;
  setReportStatus(reportId: string, status: ReportStatus, reviewerId: string, connection: TransactionContext): Promise<boolean>;
  createModerationAction(input: {
    id: string;
    adminId: string;
    reportId: string;
    actionType: ModerationActionType;
    targetType: ModerationTargetType;
    targetId: string;
    note: string;
  }, connection: TransactionContext): Promise<void>;
  findPostTarget(postId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<ModerationTargetRecord | null>;
  findUserTarget(userId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<ModerationTargetRecord | null>;
  findPostOwnerTarget(postId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<ModerationTargetRecord | null>;
  hidePost(postId: string, connection: TransactionContext): Promise<boolean>;
  deletePost(postId: string, connection: TransactionContext): Promise<boolean>;
  setUserStatus(userId: string, status: "ACTIVE" | "DISABLED", connection: TransactionContext): Promise<boolean>;
  lockActiveAdmins(connection: TransactionContext): Promise<number>;
  revokeRefreshTokens(userId: string, connection: TransactionContext): Promise<void>;
  getDashboardTotals(window: ReportingWindow): Promise<{
    totals: {
      posts: number;
      claims: number;
      appointments: number;
      returns: number;
    };
    snapshot: {
      openPosts: number;
      custodyItems: number;
      unresolvedReports: number;
    };
  }>;
  getDailyTrends(window: ReportingWindow): Promise<DailyTrendRow[]>;
  getStatusBreakdown(window: ReportingWindow): Promise<DashboardBreakdown>;
}
