import type { NotificationRepository } from "../../notifications/application/notification.repository.port.js";
import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { canTransitionCustodyStatus } from "../domain/custody-request-policy.js";
import type {
  AcceptCustodyRequestInput,
  CancelCustodyRequestInput,
  CreateCustodyRequestInput,
  IntakeCustodyRequestInput,
  ListCustodyRequestsQuery,
  RejectCustodyRequestInput
} from "./custody-request.dto.js";
import type { CustodyRequestRepository } from "./custody-request.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";
import { calculateRetentionDeadline, retentionFallbacks } from "../domain/warehouse-policy.js";

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

export interface CustodyRequestDependencies {
  custodyRequestRepository: CustodyRequestRepository;
  warehouseRepository: WarehouseRepository;
  notificationRepository?: NotificationRepository;
  withTransaction: TransactionRunner;
  id: () => string;
}

export function createCustodyRequestUseCases(options: CustodyRequestDependencies) {
  const { custodyRequestRepository, warehouseRepository, notificationRepository, withTransaction, id } = options;

  const custodyRequestService = {
    async listRequests(query: ListCustodyRequestsQuery) {
      const [counts, list] = await Promise.all([
        custodyRequestRepository.countByStatus(),
        custodyRequestRepository.listRequests(query)
      ]);
      return { counts, ...list, page: query.page, pageSize: query.pageSize };
    },

    async getRequest(requestId: string) {
      const request = await custodyRequestRepository.findById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      const audit = await custodyRequestRepository.listAudit(requestId);
      return { request, audit };
    },

    async getMyRequestByPost(postId: string, actorId: string) {
      const request = await custodyRequestRepository.findActiveByPostId(postId, actorId);
      return { request };
    },

    async createRequest(input: CreateCustodyRequestInput, actorId: string) {
      // Idempotency check
      if (input.idempotencyKey) {
        const existing = await custodyRequestRepository.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return { request: existing, idempotent: true };
      }

      // If linked to a claim, check no duplicate pending request exists
      if (input.claimId) {
        const existing = await custodyRequestRepository.findPendingByClaimId(input.claimId);
        if (existing) return { request: existing, idempotent: true };
      }

      // Validate handover point if provided
      if (input.handoverPointId) {
        const hp = await warehouseRepository.findHandoverPointById(input.handoverPointId);
        if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      }

      const requestId = id();
      const intakeType = input.intakeType ?? "CUSTODY_TRANSFER";

      await withTransaction(async (connection) => {
        await custodyRequestRepository.createRequest({
          id: requestId,
          claimId: input.claimId ?? null,
          roomId: input.roomId ?? null,
          postId: input.postId ?? null,
          requesterId: actorId,
          intakeType,
          reason: clean(input.reason),
          handoverPointId: input.handoverPointId ?? null,
          idempotencyKey: input.idempotencyKey ?? null
        }, connection);

        await custodyRequestRepository.writeAudit({
          id: id(),
          custodyRequestId: requestId,
          actorId,
          action: "CREATED",
          fromStatus: null,
          toStatus: "PENDING",
          metadata: {
            intakeType,
            claimId: input.claimId ?? null,
            postId: input.postId ?? null
          }
        }, connection);
      });

      const request = await custodyRequestRepository.findById(requestId);
      if (!request) throw new AppError("internal", "Không thể đọc lại yêu cầu custody vừa tạo");
      return { request, idempotent: false };
    },

    async acceptRequest(requestId: string, input: AcceptCustodyRequestInput, actorId: string) {
      // Validate handover point
      const hp = await warehouseRepository.findHandoverPointById(input.handoverPointId);
      if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");

      await withTransaction(async (connection) => {
        const lock = await custodyRequestRepository.lockForUpdate(requestId, connection);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");

        if (!canTransitionCustodyStatus(lock.status, "ACCEPTED")) {
          throw new AppError("conflict", `Không thể chấp nhận yêu cầu ở trạng thái ${lock.status}`);
        }

        await custodyRequestRepository.updateStatus(requestId, {
          status: "ACCEPTED",
          handlerId: actorId,
          handoverPointId: input.handoverPointId,
          confirmedHandoverAt: input.confirmedHandoverAt ?? null
        }, connection);

        await custodyRequestRepository.writeAudit({
          id: id(),
          custodyRequestId: requestId,
          actorId,
          action: "ACCEPTED",
          fromStatus: lock.status,
          toStatus: "ACCEPTED",
          metadata: {
            handoverPointId: input.handoverPointId,
            hasConfirmedTime: input.confirmedHandoverAt != null,
            reason: clean(input.reason)
          }
        }, connection);
      });

      const updated = await custodyRequestRepository.findById(requestId);
      if (updated && notificationRepository) {
        const pointName = updated.handoverPoint?.name ?? "Quầy Lost & Found";
        const scheduledTime = updated.confirmedHandoverAt
          ? ` vào lúc ${new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(updated.confirmedHandoverAt))}`
          : "";
        const notes = clean(input.reason) ? `. Ghi chú: "${clean(input.reason)}"` : "";
        await notificationRepository.create({
          userId: updated.requester.id,
          type: "APPOINTMENT_UPDATED",
          title: "Yêu cầu Custody đã được chấp nhận!",
          body: `Nhân viên tại ${pointName} đã chấp nhận yêu cầu bàn giao tài sản${scheduledTime}${notes}. Vui lòng mang tài sản đến quầy đúng hẹn.`,
          entityType: "CUSTODY_REQUEST",
          entityId: requestId
        }).catch(() => null);
      }
      return updated;
    },

    async rejectRequest(requestId: string, input: RejectCustodyRequestInput, actorId: string) {
      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Lý do từ chối không được để trống");

      await withTransaction(async (connection) => {
        const lock = await custodyRequestRepository.lockForUpdate(requestId, connection);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");

        if (!canTransitionCustodyStatus(lock.status, "REJECTED")) {
          throw new AppError("conflict", `Không thể từ chối yêu cầu ở trạng thái ${lock.status}`);
        }

        await custodyRequestRepository.updateStatus(requestId, {
          status: "REJECTED",
          handlerId: actorId,
          rejectionReason: reason
        }, connection);

        await custodyRequestRepository.writeAudit({
          id: id(),
          custodyRequestId: requestId,
          actorId,
          action: "REJECTED",
          fromStatus: lock.status,
          toStatus: "REJECTED",
          metadata: { reason }
        }, connection);
      });

      const updated = await custodyRequestRepository.findById(requestId);
      if (updated && notificationRepository) {
        await notificationRepository.create({
          userId: updated.requester.id,
          type: "APPOINTMENT_UPDATED",
          title: "Yêu cầu Custody bị từ chối",
          body: `Lý do từ chối: ${reason}`,
          entityType: "CUSTODY_REQUEST",
          entityId: requestId
        }).catch(() => null);
      }
      return updated;
    },

    async cancelRequest(requestId: string, input: CancelCustodyRequestInput, actorId: string) {
      await withTransaction(async (connection) => {
        const lock = await custodyRequestRepository.lockForUpdate(requestId, connection);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");

        if (!canTransitionCustodyStatus(lock.status, "CANCELLED")) {
          throw new AppError("conflict", `Không thể hủy yêu cầu ở trạng thái ${lock.status}`);
        }

        await custodyRequestRepository.updateStatus(requestId, {
          status: "CANCELLED",
          handlerId: actorId,
          rejectionReason: clean(input.reason)
        }, connection);

        await custodyRequestRepository.writeAudit({
          id: id(),
          custodyRequestId: requestId,
          actorId,
          action: "CANCELLED",
          fromStatus: lock.status,
          toStatus: "CANCELLED",
          metadata: { reason: clean(input.reason) }
        }, connection);
      });

      return custodyRequestRepository.findById(requestId);
    },

    async confirmIntake(requestId: string, input: IntakeCustodyRequestInput, actorId: string) {
      const conditionNotes = input.conditionNotes.trim();
      if (!conditionNotes) throw new AppError("bad_request", "Tình trạng vật phẩm không được để trống");

      let warehouseItemId: string | null = null;

      await withTransaction(async (connection) => {
        const lock = await custodyRequestRepository.lockForUpdate(requestId, connection);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");

        // Enforce ACCEPTED → INTAKED only (no PENDING → INTAKED)
        if (!canTransitionCustodyStatus(lock.status, "INTAKED")) {
          throw new AppError("conflict", `Không thể tiếp nhận vật phẩm ở trạng thái ${lock.status}. Yêu cầu phải được duyệt trước.`);
        }

        // Prevent duplicate warehouse record
        if (lock.warehouseItemId) {
          throw new AppError("conflict", "Yêu cầu này đã được tiếp nhận trước đó");
        }

        // Resolve handover point
        const handoverPointId = lock.handoverPointId;
        if (!handoverPointId) throw new AppError("bad_request", "Chưa có điểm bàn giao được xác nhận");

        // Create warehouse item
        warehouseItemId = id();
        const receivedAt = input.confirmedHandoverAt ?? new Date();
        const retentionDays = await warehouseRepository.getConfigInt(
          "warehouse.retention_days_default",
          retentionFallbacks["warehouse.retention_days_default"]
        );
        const retentionDeadline = calculateRetentionDeadline(receivedAt, retentionDays);

        let storageCode = clean(input.storageCode);
        if (!storageCode) {
          storageCode = await warehouseRepository.generateNextStorageCode(connection);
        }

        const postInfo = lock.postId ? await warehouseRepository.getPostInfoForIntake(lock.postId, connection) : null;

        await warehouseRepository.createItem({
          id: warehouseItemId,
          postId: lock.postId,
          handoverPointId,
          itemName: postInfo?.title || `Custody #${requestId.slice(0, 8)}`,
          description: postInfo?.description || null,
          categoryId: postInfo?.categoryId || null,
          areaId: postInfo?.areaId || null,
          buildingId: postInfo?.buildingId || null,
          roomText: postInfo?.roomText || null,
          finderUserId: postInfo?.finderUserId || null,
          finderName: postInfo?.finderName || null,
          finderContact: postInfo?.finderContact || null,
          conditionNotes,
          storageCode,
          receivedAt,
          retentionDeadline,
          createdBy: actorId
        }, connection);

        await warehouseRepository.createStorageLog({
          id: id(),
          warehouseItemId,
          postId: lock.postId,
          handoverPointId,
          actorId,
          action: "RECEIVED",
          fromStatus: null,
          toStatus: "RECEIVED",
          conditionNotes,
          storageCode,
          note: `Tiếp nhận từ yêu cầu custody #${requestId.slice(0, 8)}`
        }, connection);

        if (lock.postId) {
          await warehouseRepository.updatePostStatus(lock.postId, "RESOLVED", connection);
        }

        await custodyRequestRepository.updateStatus(requestId, {
          status: "INTAKED",
          handlerId: actorId,
          warehouseItemId,
          confirmedHandoverAt: input.confirmedHandoverAt ?? new Date()
        }, connection);

        await custodyRequestRepository.writeAudit({
          id: id(),
          custodyRequestId: requestId,
          actorId,
          action: "INTAKED",
          fromStatus: lock.status,
          toStatus: "INTAKED",
          metadata: {
            warehouseItemId,
            conditionNotes,
            storageCode
          }
        }, connection);
      });

      return custodyRequestRepository.findById(requestId);
    }
  };

  return custodyRequestService;
}

export type CustodyRequestUseCases = ReturnType<typeof createCustodyRequestUseCases>;
