import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { ListMyReportsQuery, SubmitReportInput } from "./report.dto.js";
import type { ReportRepository } from "./report.repository.port.js";

export interface ReportDependencies {
  repository: ReportRepository;
  transaction: TransactionRunner;
  id: () => string;
  hashPayload: (value: string) => string;
}

export function createReportUseCases({ repository, transaction, id, hashPayload }: ReportDependencies) {
  return {
    async submit(reporterId: string, input: SubmitReportInput) {
      const target = await repository.findAccessibleTarget(reporterId, input.targetType, input.targetId);
      if (!target) throw new AppError("not_found", "Không tìm thấy đối tượng có thể báo cáo");
      const details = input.details?.trim() || null;
      const requestHash = hashPayload(JSON.stringify({ targetType: input.targetType, targetId: input.targetId, reason: input.reason, details }));
      return transaction(async (connection) => {
        const existing = await repository.findByIdempotencyKey(reporterId, input.idempotencyKey, connection);
        if (existing) {
          if (existing.requestHash !== requestHash) throw new AppError("conflict", "Mã gửi lại đã được dùng cho nội dung khác");
          return existing.report;
        }
        const reportId = id();
        try {
          await repository.create({ id: reportId, reporterId, target, reason: input.reason, details, idempotencyKey: input.idempotencyKey, requestHash }, connection);
        } catch (error) {
          const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
          if (code !== "ER_DUP_ENTRY") throw error;
          const replay = await repository.findByIdempotencyKey(reporterId, input.idempotencyKey, connection);
          if (!replay || replay.requestHash !== requestHash) throw new AppError("conflict", "Mã gửi lại đã được dùng cho nội dung khác");
          return replay.report;
        }
        await repository.createAuditEvent({ id: id(), reportId, actorId: reporterId, action: "SUBMITTED" }, connection);
        const created = await repository.findMine(reportId, reporterId, connection);
        if (!created) throw new AppError("internal", "Không thể đọc báo cáo vừa tạo");
        return created;
      });
    },

    listMine(reporterId: string, query: ListMyReportsQuery) {
      return repository.listMine(reporterId, query);
    },

    async getMine(reporterId: string, reportId: string) {
      const report = await repository.findMine(reportId, reporterId);
      if (!report) throw new AppError("not_found", "Không tìm thấy báo cáo");
      return report;
    },

    async withdraw(reporterId: string, reportId: string) {
      return transaction(async (connection) => {
        const report = await repository.lock(reportId, connection);
        if (!report || report.reporterId !== reporterId) throw new AppError("not_found", "Không tìm thấy báo cáo");
        if (report.status === "WITHDRAWN") {
          const existing = await repository.findMine(reportId, reporterId, connection);
          if (!existing) throw new AppError("not_found", "Không tìm thấy báo cáo");
          return existing;
        }
        if (report.status !== "PENDING" || report.reviewedAt) throw new AppError("conflict", "Báo cáo đã được xử lý và không thể rút");
        if (!await repository.withdraw(reportId, connection)) throw new AppError("conflict", "Báo cáo không còn ở trạng thái chờ xử lý");
        await repository.createAuditEvent({ id: id(), reportId, actorId: reporterId, action: "WITHDRAWN" }, connection);
        const updated = await repository.findMine(reportId, reporterId, connection);
        if (!updated) throw new AppError("internal", "Không thể đọc báo cáo đã rút");
        return updated;
      });
    }
  };
}

export type ReportUseCases = ReturnType<typeof createReportUseCases>;
