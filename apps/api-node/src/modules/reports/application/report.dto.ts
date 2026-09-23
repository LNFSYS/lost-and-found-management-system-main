export type ReportSourceType = "POST" | "CLAIM" | "MESSAGE" | "HANDOVER";
export type ReportEntityType = "POST" | "CLAIM" | "CHAT" | "HANDOVER";
export type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED" | "WITHDRAWN";

export interface SubmitReportInput {
  targetType: ReportSourceType;
  targetId: string;
  reason: string;
  details?: string | undefined;
  idempotencyKey: string;
}

export interface ListMyReportsQuery {
  page: number;
  pageSize: number;
  status?: ReportStatus | undefined;
}
