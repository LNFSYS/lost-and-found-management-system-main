import { z } from "zod";

const uuid = z.string().uuid();
const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngay phai co dinh dang YYYY-MM-DD");

export const reportEntityTypeSchema = z.enum(["POST", "USER", "CLAIM", "CHAT"]);
export const reportStatusSchema = z.enum(["PENDING", "REVIEWED", "DISMISSED"]);
export const moderationActionTypeSchema = z.enum([
  "WARN_USER",
  "HIDE_POST",
  "DELETE_POST",
  "BAN_USER",
  "UNBAN_USER",
  "DISMISS_REPORT"
]);
export const statisticsExportFormatSchema = z.enum(["CSV", "JSON"]);
export const statisticsExportSectionSchema = z.enum(["overview", "trends", "statusBreakdown"]);

export const adminReportIdParamSchema = z.object({ id: uuid });

export const listModerationReportsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: reportStatusSchema.optional(),
  entityType: reportEntityTypeSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
});

export const reviewModerationReportSchema = z.object({
  actionType: moderationActionTypeSchema,
  reason: z.string().trim().min(3).max(255)
}).strict();

export const dashboardKpiQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional()
});

export const statisticsExportSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  format: statisticsExportFormatSchema.default("CSV"),
  sections: z.array(statisticsExportSectionSchema).min(1).max(3).optional()
}).default({});

export type { DashboardKpiQuery, ListModerationReportsQuery, ModerationActionType, ReportEntityType, ReportStatus, ReviewModerationReportInput, StatisticsExportFormat, StatisticsExportInput, StatisticsExportSection } from "../../application/admin-reporting.dto.js";
