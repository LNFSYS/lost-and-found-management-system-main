import type { PoolConnection } from "mysql2/promise";
import { withTransaction } from "../config/db.js";
import { adminAuditRepository, type AdminAuditRepository } from "../repositories/admin-audit.repository.js";
import {
  adminReportingRepository,
  type AdminReportingRepository,
  type DashboardBreakdown,
  type DashboardSnapshot,
  type DashboardTotals,
  type DailyTrendRow,
  type LockedReportRecord,
  type ModerationTargetRecord,
  type ModerationTargetType,
  type ReportingWindow
} from "../repositories/admin-reporting.repository.js";
import { HttpError } from "../utils/http-error.js";
import { id } from "../utils/security.js";
import {
  dashboardKpiQuerySchema,
  statisticsExportSchema,
  type DashboardKpiQuery,
  type ListModerationReportsQuery,
  type ModerationActionType,
  type ReviewModerationReportInput,
  type StatisticsExportInput,
  type StatisticsExportSection
} from "../validators/admin-reporting.validator.js";

type TransactionRunner = <T>(work: (connection: PoolConnection) => Promise<T>) => Promise<T>;

export interface DashboardKpiResponse {
  filters: { from: string; to: string; days: number; granularity: "day" };
  scope: { role: "ADMIN"; privateEvidenceIncluded: false };
  totals: DashboardTotals;
  snapshot: DashboardSnapshot;
  trends: Array<{
    date: string;
    posts: number;
    claims: number;
    appointments: number;
    returns: number;
    custody: number;
    reports: number;
  }>;
  statusBreakdown: DashboardBreakdown;
}

export interface StatisticsExportResponse {
  fileName: string;
  mimeType: string;
  generatedAt: string;
  rowCount: number;
  filters: { from: string; to: string; days: number };
  format: "CSV" | "JSON";
  content: string;
}

const defaultSections: StatisticsExportSection[] = ["overview", "trends", "statusBreakdown"];
const maxRangeDays = 366;

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string, label: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new HttpError(422, `${label} phai co dinh dang YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new HttpError(422, `${label} khong hop le`);
  }
  return date;
}

function normalizeWindow(input: DashboardKpiQuery, now: Date): ReportingWindow {
  const today = startOfUtcDay(now);
  const toDate = input.to ? parseDateOnly(input.to, "to") : today;
  const fromDate = input.from ? parseDateOnly(input.from, "from") : addDays(toDate, -29);
  const endExclusive = addDays(toDate, 1);
  const days = Math.ceil((endExclusive.getTime() - fromDate.getTime()) / 86_400_000);

  if (days <= 0) throw new HttpError(422, "Khoang thoi gian khong hop le");
  if (days > maxRangeDays) throw new HttpError(422, `Khoang thoi gian toi da ${maxRangeDays} ngay`);

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
    start: fromDate,
    endExclusive,
    days
  };
}

function blankTrend(date: string) {
  return { date, posts: 0, claims: 0, appointments: 0, returns: 0, custody: 0, reports: 0 };
}

function fillDailyTrends(window: ReportingWindow, rows: DailyTrendRow[]): DashboardKpiResponse["trends"] {
  const byDate = new Map<string, ReturnType<typeof blankTrend>>();
  for (let cursor = new Date(window.start); cursor < window.endExclusive; cursor = addDays(cursor, 1)) {
    const date = formatDateOnly(cursor);
    byDate.set(date, blankTrend(date));
  }

  for (const row of rows) {
    const entry = byDate.get(row.date);
    if (entry) entry[row.metric] = row.total;
  }
  return [...byDate.values()];
}

function reportAuditState(report: LockedReportRecord) {
  return {
    id: report.id,
    entityType: report.entityType,
    entityId: report.entityId,
    status: report.status,
    reviewedBy: report.reviewedBy,
    reviewedAt: report.reviewedAt
  };
}

function targetAuditState(target: ModerationTargetRecord | null) {
  if (!target) return null;
  return { id: target.id, type: target.type, label: target.label, status: target.status };
}

function actionTargetType(actionType: ModerationActionType): ModerationTargetType {
  if (actionType === "HIDE_POST" || actionType === "DELETE_POST") return "POST";
  if (actionType === "DISMISS_REPORT") return "REPORT";
  return "USER";
}

function csvCell(value: string | number | null) {
  const raw = value === null ? "" : String(value);
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
}

function buildExportRows(data: DashboardKpiResponse, sections: StatisticsExportSection[]) {
  const rows: Array<Record<string, string | number | null>> = [];
  if (sections.includes("overview")) {
    for (const [metric, value] of Object.entries(data.totals)) {
      rows.push({ section: "overview", date: null, metric, status: null, value });
    }
    for (const [metric, value] of Object.entries(data.snapshot)) {
      rows.push({ section: "overview", date: null, metric: `snapshot.${metric}`, status: "CURRENT", value });
    }
  }
  if (sections.includes("trends")) {
    for (const trend of data.trends) {
      for (const metric of ["posts", "claims", "appointments", "returns", "custody", "reports"] as const) {
        rows.push({ section: "trends", date: trend.date, metric, status: null, value: trend[metric] });
      }
    }
  }
  if (sections.includes("statusBreakdown")) {
    for (const [group, items] of Object.entries(data.statusBreakdown)) {
      for (const item of items) {
        rows.push({ section: "statusBreakdown", date: null, metric: group, status: item.status, value: item.total });
      }
    }
  }
  return rows;
}

function renderCsv(rows: Array<Record<string, string | number | null>>) {
  const columns = ["section", "date", "metric", "status", "value"];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column] ?? null)).join(","))
  ].join("\n");
}

export function createAdminReportingService(options: {
  repository?: AdminReportingRepository;
  auditRepository?: AdminAuditRepository;
  transaction?: TransactionRunner;
  idFactory?: () => string;
  clock?: () => Date;
} = {}) {
  const repository = options.repository ?? adminReportingRepository;
  const audit = options.auditRepository ?? adminAuditRepository;
  const transaction = options.transaction ?? withTransaction;
  const idFactory = options.idFactory ?? id;
  const clock = options.clock ?? (() => new Date());

  async function recordAudit(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string | null;
    beforeState: Record<string, unknown> | null;
    afterState: Record<string, unknown> | null;
    reason?: string | null;
  }, connection?: PoolConnection) {
    await audit.record({
      id: idFactory(),
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      reason: input.reason ?? null
    }, connection);
  }

  async function loadTargetForAction(
    actionType: ModerationActionType,
    targetId: string,
    connection: PoolConnection,
    forUpdate: boolean
  ) {
    const targetType = actionTargetType(actionType);
    if (targetType === "POST") return repository.findPostTarget(targetId, connection, forUpdate);
    if (targetType === "USER") return repository.findUserTarget(targetId, connection, forUpdate);
    return null;
  }

  async function applyAction(actionType: ModerationActionType, targetId: string, connection: PoolConnection) {
    if (actionType === "DISMISS_REPORT" || actionType === "WARN_USER") return;
    if (actionType === "HIDE_POST" && !await repository.hidePost(targetId, connection)) throw new HttpError(404, "Khong tim thay bai dang can an");
    if (actionType === "DELETE_POST" && !await repository.deletePost(targetId, connection)) throw new HttpError(404, "Khong tim thay bai dang can xoa");
    if (actionType === "BAN_USER") {
      if (!await repository.setUserStatus(targetId, "DISABLED", connection)) throw new HttpError(404, "Khong tim thay nguoi dung can khoa");
      await repository.revokeRefreshTokens(targetId, connection);
    }
    if (actionType === "UNBAN_USER") {
      if (!await repository.setUserStatus(targetId, "ACTIVE", connection)) throw new HttpError(404, "Khong tim thay nguoi dung can mo khoa");
    }
  }

  function assertActionMatchesReport(actionType: ModerationActionType, report: LockedReportRecord) {
    if (actionType === "DISMISS_REPORT") return;
    if (report.entityType === "POST" && (actionType === "HIDE_POST" || actionType === "DELETE_POST" || actionType === "WARN_USER" || actionType === "BAN_USER" || actionType === "UNBAN_USER")) return;
    if (report.entityType === "USER" && (actionType === "WARN_USER" || actionType === "BAN_USER" || actionType === "UNBAN_USER")) return;
    throw new HttpError(422, "Hanh dong moderation khong phu hop voi doi tuong report");
  }

  async function getDashboardKpis(input: DashboardKpiQuery = {}) {
    const parsed = dashboardKpiQuerySchema.parse(input);
    const window = normalizeWindow(parsed, clock());
    const [dashboardTotals, trendRows, statusBreakdown] = await Promise.all([
      repository.getDashboardTotals(window),
      repository.getDailyTrends(window),
      repository.getStatusBreakdown(window)
    ]);
    return {
      filters: { from: window.from, to: window.to, days: window.days, granularity: "day" as const },
      scope: { role: "ADMIN" as const, privateEvidenceIncluded: false as const },
      totals: dashboardTotals.totals,
      snapshot: dashboardTotals.snapshot,
      trends: fillDailyTrends(window, trendRows),
      statusBreakdown
    };
  }

  async function logExportFailure(actorId: string, error: unknown, parsedInput: Partial<StatisticsExportInput> | null) {
    await recordAudit({
      actorId,
      action: "ADMIN_STATISTICS_EXPORT_FAILED",
      targetType: "STATISTICS_EXPORT",
      targetId: null,
      beforeState: null,
      afterState: {
        status: "FAILED",
        format: parsedInput?.format ?? null,
        sections: parsedInput?.sections ?? null,
        message: error instanceof HttpError ? error.message : error instanceof Error ? error.name : "UnknownError"
      },
      reason: "Statistics export failed"
    }).catch(() => undefined);
  }

  return {
    async listReports(filters: ListModerationReportsQuery) {
      return repository.listReports(filters);
    },

    async reviewReport(actorId: string, reportId: string, input: ReviewModerationReportInput) {
      return transaction(async (connection) => {
        const report = await repository.lockReport(reportId, connection);
        if (!report) throw new HttpError(404, "Khong tim thay report");
        if (report.status !== "PENDING") throw new HttpError(409, "Report da duoc xu ly");

        assertActionMatchesReport(input.actionType, report);
        const targetType = actionTargetType(input.actionType);
        const targetId = report.entityType === "POST" && targetType === "USER"
          ? (await repository.findPostOwnerTarget(report.entityId, connection, false))?.id
          : targetType === "REPORT"
            ? report.id
            : report.entityType === targetType
              ? report.entityId
              : null;
        if (!targetId) throw new HttpError(422, "Khong the suy ra doi tuong moderation tu report");

        const activeAdminCount = input.actionType === "BAN_USER" ? await repository.lockActiveAdmins(connection) : null;

        const beforeTarget = await loadTargetForAction(input.actionType, targetId, connection, true);
        if (targetType !== "REPORT" && !beforeTarget) throw new HttpError(404, "Khong tim thay doi tuong moderation");

        if (input.actionType === "BAN_USER") {
          if (targetId === actorId) throw new HttpError(409, "Admin khong duoc tu khoa chinh minh");
          if (beforeTarget?.isAdmin && beforeTarget.status === "ACTIVE" && (activeAdminCount ?? 0) <= 1) {
            throw new HttpError(409, "Khong the khoa Admin active cuoi cung");
          }
        }

        await applyAction(input.actionType, targetId, connection);
        const afterTarget = await loadTargetForAction(input.actionType, targetId, connection, false);
        const nextStatus = input.actionType === "DISMISS_REPORT" ? "DISMISSED" : "REVIEWED";
        await repository.setReportStatus(reportId, nextStatus, actorId, connection);
        await repository.createModerationAction({
          id: idFactory(),
          adminId: actorId,
          reportId,
          actionType: input.actionType,
          targetType,
          targetId,
          note: input.reason
        }, connection);
        await recordAudit({
          actorId,
          action: "MODERATION_REPORT_REVIEWED",
          targetType: "REPORT",
          targetId: reportId,
          beforeState: { report: reportAuditState(report), target: targetAuditState(beforeTarget) },
          afterState: {
            report: { ...reportAuditState(report), status: nextStatus, reviewedBy: actorId },
            action: { actionType: input.actionType, targetType, targetId },
            target: targetAuditState(afterTarget)
          },
          reason: input.reason
        }, connection);

        const updated = await repository.findReportById(reportId, connection);
        if (!updated) throw new HttpError(404, "Khong tim thay report");
        return updated;
      });
    },

    getDashboardKpis,

    async exportStatistics(actorId: string, rawInput: unknown): Promise<StatisticsExportResponse> {
      let parsed: StatisticsExportInput | null = null;
      try {
        parsed = statisticsExportSchema.parse(rawInput ?? {});
        const data = await getDashboardKpis({ from: parsed.from, to: parsed.to });
        const sections = parsed.sections ?? defaultSections;
        const rows = buildExportRows(data, sections);
        const generatedAt = clock().toISOString();
        const content = parsed.format === "JSON"
          ? JSON.stringify({ generatedAt, filters: data.filters, rows }, null, 2)
          : renderCsv(rows);
        const response = {
          fileName: `lnfs-statistics-${data.filters.from}-to-${data.filters.to}.${parsed.format.toLowerCase()}`,
          mimeType: parsed.format === "JSON" ? "application/json" : "text/csv",
          generatedAt,
          rowCount: rows.length,
          filters: { from: data.filters.from, to: data.filters.to, days: data.filters.days },
          format: parsed.format,
          content
        };
        await recordAudit({
          actorId,
          action: "ADMIN_STATISTICS_EXPORT_COMPLETED",
          targetType: "STATISTICS_EXPORT",
          targetId: null,
          beforeState: null,
          afterState: {
            format: parsed.format,
            sections,
            rowCount: rows.length,
            filters: response.filters,
            privateEvidenceIncluded: false
          },
          reason: "Statistics export completed"
        });
        return response;
      } catch (error) {
        await logExportFailure(actorId, error, parsed);
        throw error;
      }
    }
  };
}

export const adminReportingService = createAdminReportingService();
