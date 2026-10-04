import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { ListMyReportsQuery, ReportStatus } from "./report.dto.js";
import type { ReportRepository, UserReportRecord } from "./report.repository.port.js";
import { createReportUseCases } from "./report.use-cases.js";

function fixture() {
  const reports = new Map<string, UserReportRecord>();
  const hashes = new Map<string, string>();
  const events: string[] = [];
  let sequence = 0;
  const repository: ReportRepository = {
    async findAccessibleTarget(userId, sourceType, sourceId) {
      if (userId !== "reporter" || sourceId === "forged") return null;
      return {
        entityType: sourceType === "MESSAGE" ? "CHAT" : sourceType === "HANDOVER" ? "HANDOVER" : sourceType,
        entityId: sourceType === "MESSAGE" ? "room-id" : sourceId,
        sourceType, sourceId, title: "Privacy-safe target", status: "OPEN"
      };
    },
    async findByIdempotencyKey(reporterId, key) {
      const report = [...reports.values()].find((item) => item.id === `${reporterId}:${key}`);
      return report ? { report, requestHash: hashes.get(report.id) ?? null } : null;
    },
    async create(input) {
      reports.set(input.id, {
        id: input.id, entityType: input.target.entityType, entityId: input.target.entityId,
        sourceType: input.target.sourceType, sourceId: input.target.sourceId, reason: input.reason,
        details: input.details, status: "PENDING", resolution: null, reviewedAt: null, withdrawnAt: null,
        createdAt: "2026-09-22T00:00:00.000Z", target: { title: input.target.title, status: input.target.status }
      });
      hashes.set(input.id, input.requestHash);
    },
    async createAuditEvent(input) { events.push(`${input.reportId}:${input.action}`); },
    async listMine(reporterId, query: ListMyReportsQuery) {
      const items = [...reports.values()].filter((item) => item.id.startsWith(`${reporterId}:`) && (!query.status || item.status === query.status));
      return { total: items.length, page: query.page, pageSize: query.pageSize, items };
    },
    async findMine(reportId, reporterId) { return reportId.startsWith(`${reporterId}:`) ? reports.get(reportId) ?? null : null; },
    async lock(reportId) {
      const report = reports.get(reportId);
      return report ? { id: report.id, reporterId: report.id.split(":")[0]!, status: report.status, reviewedAt: report.reviewedAt, withdrawnAt: report.withdrawnAt } : null;
    },
    async withdraw(reportId) {
      const report = reports.get(reportId);
      if (!report || report.status !== "PENDING") return false;
      report.status = "WITHDRAWN";
      report.withdrawnAt = "2026-09-22T01:00:00.000Z";
      return true;
    }
  };
  const service = createReportUseCases({
    repository, transaction: (work) => work({} as TransactionContext),
    id: () => sequence++ % 2 === 0 ? "reporter:retry-key" : `event-${sequence}`,
    hashPayload: (value) => `hash:${value}`
  });
  return { service, reports, events };
}

const input = { targetType: "MESSAGE" as const, targetId: "message-id", reason: "Quấy rối", details: "Nội dung không phù hợp", idempotencyKey: "retry-key" };

test("valid report submission creates one report and one audit event, then replays safely", async () => {
  const { service, reports, events } = fixture();
  const first = await service.submit("reporter", input);
  const replay = await service.submit("reporter", input);
  assert.equal(first.id, replay.id);
  assert.equal(reports.size, 1);
  assert.deepEqual(events, ["reporter:retry-key:SUBMITTED"]);
  assert.equal(JSON.stringify(first).includes("private message body"), false);
});

test("forged inaccessible target is rejected before persistence", async () => {
  const { service, reports } = fixture();
  await assert.rejects(() => service.submit("reporter", { ...input, targetId: "forged" }), (error: unknown) => error instanceof AppError && error.code === "not_found");
  assert.equal(reports.size, 0);
});

test("reporter can withdraw pending report once and replay returns the same outcome", async () => {
  const { service, events } = fixture();
  const report = await service.submit("reporter", input);
  const withdrawn = await service.withdraw("reporter", report.id);
  const replay = await service.withdraw("reporter", report.id);
  assert.equal(withdrawn.status, "WITHDRAWN");
  assert.equal(replay.status, "WITHDRAWN");
  assert.equal(events.filter((event) => event.endsWith(":WITHDRAWN")).length, 1);
});

test("another user cannot read or withdraw a report and reviewed reports cannot be withdrawn", async () => {
  const { service, reports } = fixture();
  const report = await service.submit("reporter", input);
  await assert.rejects(() => service.getMine("outsider", report.id), (error: unknown) => error instanceof AppError && error.code === "not_found");
  await assert.rejects(() => service.withdraw("outsider", report.id), (error: unknown) => error instanceof AppError && error.code === "not_found");
  reports.get(report.id)!.status = "REVIEWED" as ReportStatus;
  reports.get(report.id)!.reviewedAt = "2026-09-22T02:00:00.000Z";
  await assert.rejects(() => service.withdraw("reporter", report.id), (error: unknown) => error instanceof AppError && error.code === "conflict");
});
