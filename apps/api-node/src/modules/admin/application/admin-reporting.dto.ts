export type ReportEntityType = "POST" | "USER" | "CLAIM" | "CHAT";

export type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED";

export type ModerationActionType = "WARN_USER" | "HIDE_POST" | "DELETE_POST" | "BAN_USER" | "UNBAN_USER" | "DISMISS_REPORT";

export type ListModerationReportsQuery = { page: number; pageSize: number; status?: "PENDING" | "REVIEWED" | "DISMISSED" | undefined; q?: string | undefined; entityType?: "POST" | "USER" | "CLAIM" | "CHAT" | undefined; };

export type ReviewModerationReportInput = { actionType: "WARN_USER" | "HIDE_POST" | "DELETE_POST" | "BAN_USER" | "UNBAN_USER" | "DISMISS_REPORT"; reason: string; };

export type DashboardKpiQuery = { from?: string | undefined; to?: string | undefined; };

export type StatisticsExportInput = { format: "CSV" | "JSON"; from?: string | undefined; to?: string | undefined; sections?: ("overview" | "trends" | "statusBreakdown")[] | undefined; };

export type StatisticsExportFormat = "CSV" | "JSON";

export type StatisticsExportSection = "overview" | "trends" | "statusBreakdown";
