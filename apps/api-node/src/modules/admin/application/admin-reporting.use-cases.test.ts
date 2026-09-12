import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { createTestAdminReportingUseCases as createAdminReportingService } from "../../../test/use-case-fixtures.js";
import { reviewModerationReportSchema } from "../interfaces/http/admin-reporting.validator.js";
import type { AdminReportingRepository, DashboardBreakdown, DashboardSnapshot, DashboardTotals, LockedReportRecord, ModerationReportRecord, ModerationTargetRecord, ReportingWindow } from "./admin-reporting.repository.port.js";

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

function fakeRepository(seedReports: ModerationReportRecord[] = [], options: { activeAdminCount?: number; } = {}) {
  const reports = new Map(seedReports.map((report) => [report.id, { ...report }]));
  const targets = new Map<string, ModerationTargetRecord>([
    ["post-id", { id: "post-id", type: "POST", label: "Lost card", status: "OPEN" }],
    ["user-id", { id: "user-id", type: "USER", label: "Problem User", status: "ACTIVE", isAdmin: false }]
  ]);
  let activeAdminLocks = 0;
  const actions: unknown[] = [];
  const totals: DashboardTotals = {
    posts: 4,
    claims: 3,
    appointments: 2,
    returns: 1
  };
  const snapshot: DashboardSnapshot = {
    openPosts: 2,
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
    async findPostOwnerTarget(postId) {
      if (postId !== "post-id") return null;
      const target = targets.get("user-id");
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
    async lockActiveAdmins() {
      activeAdminLocks += 1;
      return options.activeAdminCount ?? [...targets.values()].filter((target) => target.type === "USER" && target.isAdmin && target.status === "ACTIVE").length;
    },
    async revokeRefreshTokens() { },
    async getDashboardTotals() {
      return { totals, snapshot };
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

  return { repository, reports, targets, actions, getActiveAdminLocks: () => activeAdminLocks };
}

type TestTransaction = <T>(work: (connection: TransactionContext) => Promise<T>) => Promise<T>;

function serviceFor(repository: AdminReportingRepository, auditRecords: unknown[] = [], transaction: TestTransaction = async (work) => work({} as TransactionContext)) {
  return createAdminReportingService({
    repository,
    auditRepository: { async record(input) { auditRecords.push(input); } },
    transaction,
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
  assert.equal((actions[0] as { targetType: string; targetId: string; }).targetType, "POST");
  assert.equal((actions[0] as { targetType: string; targetId: string; }).targetId, "post-id");
  assert.match(JSON.stringify(actions[0]), /Policy violation/);
  assert.match(JSON.stringify(auditRecords[0]), /MODERATION_REPORT_REVIEWED/);
  assert.match(JSON.stringify(auditRecords[0]), /post-id/);
  assert.equal(JSON.stringify(auditRecords).includes("DROP TABLE"), false);
  assert.equal(JSON.stringify(auditRecords).includes("<script>"), false);
});

test("review report rejects concurrent moderation of an already handled report", async () => {
  const { repository, actions } = fakeRepository([makeReport({ status: "REVIEWED", reviewer: { id: "other-admin", fullName: "Other Admin" } })]);
  const service = serviceFor(repository);

  await assert.rejects(() => service.reviewReport("admin-id", "report-id", {
    actionType: "DISMISS_REPORT",
    reason: "Already reviewed"
  }), (error: unknown) => error instanceof AppError && error.code === "conflict");
  assert.equal(actions.length, 0);
});

test("moderation request cannot provide arbitrary post or user target ids", () => {
  for (const payload of [
    { actionType: "HIDE_POST", targetPostId: "00000000-0000-4000-8000-000000000000", reason: "Policy violation" },
    { actionType: "BAN_USER", targetUserId: "00000000-0000-4000-8000-000000000000", reason: "Policy violation" }
  ]) {
    assert.equal(reviewModerationReportSchema.safeParse(payload).success, false);
  }
});

test("moderation derives the post owner for user actions", async () => {
  const report = makeReport();
  const { repository, actions } = fakeRepository([report]);
  const service = serviceFor(repository);

  await service.reviewReport("admin-id", report.id, { actionType: "WARN_USER", reason: "Policy violation" });
  assert.equal(actions[0] && (actions[0] as { targetId: string; }).targetId, "user-id");
});

test("moderation rejects self-ban and protects the last active admin", async () => {
  const selfReport = makeReport({ entityType: "USER", entityId: "user-id", entity: { type: "USER", title: "Admin", status: "ACTIVE", ownerName: null, referenceId: "user-id" } });
  const selfRepo = fakeRepository([selfReport]);
  await assert.rejects(() => serviceFor(selfRepo.repository).reviewReport("user-id", selfReport.id, {
    actionType: "BAN_USER",
    reason: "Policy violation"
  }), (error: unknown) => error instanceof AppError && error.code === "conflict");

  const lastReport = makeReport({ entityType: "USER", entityId: "user-id", entity: { type: "USER", title: "Admin", status: "ACTIVE", ownerName: null, referenceId: "user-id" } });
  const lastRepo = fakeRepository([lastReport], { activeAdminCount: 1 });
  lastRepo.targets.set("user-id", { id: "user-id", type: "USER", label: "Admin", status: "ACTIVE", isAdmin: true });
  await assert.rejects(() => serviceFor(lastRepo.repository).reviewReport("other-admin", lastReport.id, {
    actionType: "BAN_USER",
    reason: "Policy violation"
  }), (error: unknown) => error instanceof AppError && error.code === "conflict");
  assert.equal(lastRepo.getActiveAdminLocks(), 1);
});

test("moderation can ban a normal user", async () => {
  const report = makeReport({ entityType: "USER", entityId: "user-id", entity: { type: "USER", title: "User", status: "ACTIVE", ownerName: null, referenceId: "user-id" } });
  const state = fakeRepository([report]);
  const service = serviceFor(state.repository);
  await service.reviewReport("admin-id", report.id, { actionType: "BAN_USER", reason: "Policy violation" });
  assert.equal(state.targets.get("user-id")?.status, "DISABLED");
});

test("moderation can unban a disabled user from a user report", async () => {
  const report = makeReport({ id: "unban-report", entityType: "USER", entityId: "user-id", entity: { type: "USER", title: "User", status: "DISABLED", ownerName: null, referenceId: "user-id" } });
  const state = fakeRepository([report]);
  state.targets.set("user-id", { id: "user-id", type: "USER", label: "Problem User", status: "DISABLED", isAdmin: false });
  const service = serviceFor(state.repository);
  await service.reviewReport("admin-id", report.id, { actionType: "UNBAN_USER", reason: "Restriction reviewed" });
  assert.equal(state.targets.get("user-id")?.status, "ACTIVE");
});

test("concurrent admin bans cannot disable the last active admin", async () => {
  const firstReport = makeReport({ id: "admin-ban-a", entityType: "USER", entityId: "admin-a" });
  const secondReport = makeReport({ id: "admin-ban-b", entityType: "USER", entityId: "admin-b" });
  const state = fakeRepository([firstReport, secondReport]);
  state.targets.set("admin-a", { id: "admin-a", type: "USER", label: "Admin A", status: "ACTIVE", isAdmin: true });
  state.targets.set("admin-b", { id: "admin-b", type: "USER", label: "Admin B", status: "ACTIVE", isAdmin: true });

  let queue = Promise.resolve();
  const transaction: TestTransaction = async (work) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await work({} as TransactionContext);
    } finally {
      release();
    }
  };
  const service = serviceFor(state.repository, [], transaction);
  const results = await Promise.allSettled([
    service.reviewReport("root-admin", firstReport.id, { actionType: "BAN_USER", reason: "First decision" }),
    service.reviewReport("root-admin", secondReport.id, { actionType: "BAN_USER", reason: "Second decision" })
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal([state.targets.get("admin-a")?.status, state.targets.get("admin-b")?.status].filter((status) => status === "ACTIVE").length, 1);
});

test("moderation rejects actions that do not match claim or chat reports", async () => {
  const report = makeReport({ entityType: "CLAIM", entityId: "claim-id" });
  const state = fakeRepository([report]);
  await assert.rejects(() => serviceFor(state.repository).reviewReport("admin-id", report.id, {
    actionType: "HIDE_POST",
    reason: "Policy violation"
  }), (error: unknown) => error instanceof AppError && error.code === "invalid_input");
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
    error instanceof AppError && error.code === "invalid_input"
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

  await assert.rejects(() => service.exportStatistics("admin-id", { from: "2025-01-01", to: "2026-09-02", format: "CSV" }), (error: unknown) => (
    error instanceof AppError && error.code === "invalid_input"
  ));
  assert.equal(JSON.stringify(auditRecords).includes("ADMIN_STATISTICS_EXPORT_FAILED"), true);
});
