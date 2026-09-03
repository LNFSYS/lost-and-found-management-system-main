import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import type {
  AdminReportingRepository,
  DashboardBreakdown,
  DashboardTotals,
  LockedReportRecord,
  ModerationReportRecord,
  ModerationTargetRecord,
  ReportingWindow
} from "../repositories/admin-reporting.repository.js";
import { HttpError } from "../utils/http-error.js";
import { createAdminReportingService } from "./admin-reporting.service.js";

const fixedNow = new Date("2026-09-02T10:00:00.000Z");

function makeReport(overrides: Partial<ModerationReportRecord> = {}): ModerationReportRecord {
  return {
    id: overrides.id ?? "report-id",
    reporter: overrides.reporter ?? { id: "reporter-id", fullName: "Reporter", email: "reporter@example.com" },
    entityType: overrides.entityType ?? "POST",
    entityId: overrides.entityId ?? "post-id",
    reason: overrides.reason ?? "Spam",
    details: overrides.details ?? "DROP TABLE reports; <script>alert(1)</script>",
    status: overrides.status ?? "PENDING",
    reviewer: overrides.reviewer ?? null,
    reviewedAt: overrides.reviewedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-09-01T00:00:00.000Z",
    entity: overrides.entity ?? { type: overrides.entityType ?? "POST", title: "Lost card", status: "OPEN", ownerName: "Owner", referenceId: overrides.entityId ?? "post-id" }
  };
}

function locked(report: ModerationReportRecord): LockedReportRecord {
  return {
    id: report.id,
    reporterId: report.reporter.id,
    entityType: report.entityType,
    entityId: report.entityId,
    reason: report.reason,
    status: report.status,
    reviewedBy: report.reviewer?.id ?? null,
    reviewedAt: report.reviewedAt,
    createdAt: report.createdAt
  };
}

function fakeRepository(seedReports: ModerationReportRecord[] = []) {
  const reports = new Map(seedReports.map((report) => [report.id, { ...report }]));
  const targets = new Map<string, ModerationTargetRecord>([
    ["post-id", { id: "post-id", type: "POST", label: "Lost card", status: "OPEN" }],
    ["user-id", { id: "user-id", type: "USER", label: "Problem User", status: "ACTIVE" }]
  ]);
  const actions: unknown[] = [];
  const totals: DashboardTotals = {
    posts: 4,
    openPosts: 2,
    claims: 3,
    appointments: 2,
    returns: 1,
    custodyItems: 5,
    unresolvedReports: 1
  };
  const breakdown: DashboardBreakdown = {
    posts: [{ status: "OPEN", total: 2 }],
    claims: [{ status: "PENDING", total: 3 }],
    appointments: [{ status: "COMPLETED", total: 1 }],
    custody: [{ status: "STORED", total: 5 }],
    reports: [{ status: "PENDING", total: 1 }]
  };

  const repository: AdminReportingRepository = {
    async listReports(filters) {
      const items = [...reports.values()].filter((report) => !filters.status || report.status === filters.status);
      return { total: items.length, page: filters.page, pageSize: filters.pageSize, items };
    },
    async findReportById(reportId) {
      const report = reports.get(reportId);
      return report ? { ...report } : null;
    },
    async lockReport(reportId) {
      const report = reports.get(reportId);
      return report ? locked(report) : null;
    },
    async setReportStatus(reportId, status, reviewerId) {
      const report = reports.get(reportId);
      if (!report) return false;
      report.status = status;
      report.reviewer = { id: reviewerId, fullName: "Admin" };
      report.reviewedAt = "2026-09-02T10:00:00.000Z";
      return true;
    },
    async createModerationAction(input) {
      actions.push(input);
    },
    async findPostTarget(postId) {
      const target = targets.get(postId);
      return target && target.type === "POST" ? { ...target } : null;
    },
    async findUserTarget(userId) {
      const target = targets.get(userId);
      return target && target.type === "USER" ? { ...target } : null;
    },
    async hidePost(postId) {
      const target = targets.get(postId);
      if (!target) return false;
      target.status = "HIDDEN";
      return true;
    },
    async deletePost(postId) {
      const target = targets.get(postId);
      if (!target) return false;
      target.status = "HIDDEN";
      return true;
    },
    async setUserStatus(userId, status) {
      const target = targets.get(userId);
      if (!target) return false;
      target.status = status;
      return true;
    },
    async revokeRefreshTokens() {},
    async getDashboardTotals() {
      return totals;
    },
    async getDailyTrends(_window: ReportingWindow) {
      return [
        { date: "2026-09-01", metric: "posts", total: 2 },
        { date: "2026-09-01", metric: "claims", total: 1 },
        { date: "2026-09-02", metric: "reports", total: 1 }
      ];
    },
    async getStatusBreakdown() {
      return breakdown;
    }
  };

  return { repository, reports, targets, actions };
}

function serviceFor(repository: AdminReportingRepository, auditRecords: unknown[] = []) {
  return createAdminReportingService({
    repository,
    auditRepository: { async record(input) { auditRecords.push(input); } },
    transaction: async (work) => work({} as PoolConnection),
    idFactory: () => `id-${auditRecords.length}`,
    clock: () => fixedNow
  });
}

test("review report applies moderation action and records actor/reason without report details", async () => {
  const { repository, reports, targets, actions } = fakeRepository([makeReport()]);
  const auditRecords: unknown[] = [];
  const service = serviceFor(repository, auditRecords);

  const reviewed = await service.reviewReport("admin-id", "report-id", {
    actionType: "HIDE_POST",
    reason: "Policy violation"
  });

  assert.equal(reviewed.status, "REVIEWED");
  assert.equal(reports.get("report-id")?.reviewer?.id, "admin-id");
  assert.equal(targets.get("post-id")?.status, "HIDDEN");
  assert.equal(actions.length, 1);
  assert.match(JSON.stringify(actions[0]), /Policy violation/);
  assert.match(JSON.stringify(auditRecords[0]), /MODERATION_REPORT_REVIEWED/);
  assert.equal(JSON.stringify(auditRecords).includes("DROP TABLE"), false);
  assert.equal(JSON.stringify(auditRecords).includes("<script>"), false);
});

test("review report rejects concurrent moderation of an already handled report", async () => {
  const { repository, actions } = fakeRepository([makeReport({ status: "REVIEWED", reviewer: { id: "other-admin", fullName: "Other Admin" } })]);
  const service = serviceFor(repository);

  await assert.rejects(() => service.reviewReport("admin-id", "report-id", {
    actionType: "DISMISS_REPORT",
    reason: "Already reviewed"
  }), (error: unknown) => error instanceof HttpError && error.status === 409);
  assert.equal(actions.length, 0);
});

test("dashboard KPIs are bounded and fill reproducible daily buckets", async () => {
  const service = serviceFor(fakeRepository().repository);

  const kpis = await service.getDashboardKpis({ from: "2026-09-01", to: "2026-09-02" });
  assert.deepEqual(kpis.filters, { from: "2026-09-01", to: "2026-09-02", days: 2, granularity: "day" });
  assert.equal(kpis.scope.privateEvidenceIncluded, false);
  assert.equal(kpis.trends.length, 2);
  assert.equal(kpis.trends[0].posts, 2);
  assert.equal(kpis.trends[0].claims, 1);
  assert.equal(kpis.trends[1].reports, 1);

  await assert.rejects(() => service.getDashboardKpis({ from: "2025-01-01", to: "2026-09-02" }), (error: unknown) => (
    error instanceof HttpError && error.status === 422
  ));
});

test("statistics export uses aggregate allowlist and logs success and failure", async () => {
  const auditRecords: unknown[] = [];
  const service = serviceFor(fakeRepository().repository, auditRecords);

  const exported = await service.exportStatistics("admin-id", { from: "2026-09-01", to: "2026-09-02", format: "CSV" });
  assert.equal(exported.mimeType, "text/csv");
  assert.match(exported.content, /^section,date,metric,status,value/);
  assert.equal(exported.content.includes("DROP TABLE"), false);
  assert.equal(exported.content.includes("private"), false);
  assert.equal(JSON.stringify(auditRecords).includes("ADMIN_STATISTICS_EXPORT_COMPLETED"), true);
  assert.equal(JSON.stringify(auditRecords).includes("\"privateEvidenceIncluded\":false"), true);

  await assert.rejects(() => service.exportStatistics("admin-id", { from: "2025-01-01", to: "2026-09-02" }), (error: unknown) => (
    error instanceof HttpError && error.status === 422
  ));
  assert.equal(JSON.stringify(auditRecords).includes("ADMIN_STATISTICS_EXPORT_FAILED"), true);
});
