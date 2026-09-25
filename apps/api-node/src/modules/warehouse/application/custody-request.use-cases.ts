import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { NotificationRepository } from "../../notifications/application/index.js";
import {
  calculateRetentionDeadline,
  custodyReasonLabels,
  custodyStatusLabels,
  retentionConfigKeyForCategory,
  retentionFallbacks
} from "../domain/warehouse-policy.js";
import type {
  AcceptCustodyRequestInput,
  CancelCustodyRequestInput,
  ConfirmStaffIntakeInput,
  CreateCustodyRequestInput,
  ListCustodyRequestsQuery,
  RejectCustodyRequestInput
} from "./custody-request.dto.js";
import type { CustodyRepository } from "./custody.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";

export interface CustodyDependencies {
  custodyRepository: CustodyRepository;
  warehouseRepository: WarehouseRepository;
  notificationRepository: NotificationRepository;
  withTransaction: TransactionRunner;
  id: () => string;
}

export function createCustodyUseCases(options: CustodyDependencies) {
  const { custodyRepository, warehouseRepository, notificationRepository, withTransaction, id } = options;

  async function notifyClaimant(claimId: string | null | undefined, finderId: string, type: "CUSTODY_REQUESTED" | "CUSTODY_ACCEPTED" | "CUSTODY_REJECTED" | "CUSTODY_INTAKED", connection: Parameters<NotificationRepository["create"]>[1]) {
    if (!claimId) return;
    const claimantId = await custodyRepository.findClaimantId(claimId);
    if (!claimantId || claimantId === finderId) return;
    await notificationRepository.create({
      userId: claimantId,
      type,
      title: "Custody status changed",
      body: "The custody status of an item in your claim changed. Sign in to view the claim.",
      entityType: "CLAIM",
      entityId: claimId
    }, connection);
  }

  async function retentionDaysForCategory(categoryId: string | null | undefined) {
    if (!categoryId) {
      return warehouseRepository.getConfigInt("warehouse.retention_days_default", retentionFallbacks["warehouse.retention_days_default"]);
    }
    const category = await warehouseRepository.findCategoryNames(categoryId);
    if (!category) return warehouseRepository.getConfigInt("warehouse.retention_days_default", retentionFallbacks["warehouse.retention_days_default"]);
    const key = retentionConfigKeyForCategory(category);
    return warehouseRepository.getConfigInt(key, retentionFallbacks[key]);
  }

  const custodyService = {
    async createCustodyRequest(input: CreateCustodyRequestInput, finderId: string) {
      if (input.idempotencyKey) {
        const existing = await custodyRepository.findByIdempotencyKey(finderId, input.idempotencyKey);
        if (existing) {
          if (existing.postId !== input.postId || existing.claimId !== (input.claimId ?? null)) {
            throw new AppError("conflict", "Idempotency key was already used for another custody request");
          }
          return existing;
        }
      }

      const post = await custodyRepository.findPostDetailsForIntake(input.postId);
      if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng");
      if (post.type !== "FOUND") throw new AppError("bad_request", "Only found posts can enter custody");
      if (post.userId !== finderId) throw new AppError("forbidden", "Chỉ người nhặt (Finder) của bài đăng mới được yêu cầu chuyển custody");
      if (post.status !== "OPEN" && post.status !== "MATCHED") {
        throw new AppError("bad_request", `Không thể yêu cầu custody cho bài đăng ở trạng thái ${post.status}`);
      }

      if (input.claimId && await custodyRepository.findClaimPostId(input.claimId) !== post.id) {
        throw new AppError("bad_request", "Claim does not belong to this found post");
      }

      const activePending = await custodyRepository.findActivePendingRequestByPost(input.postId);
      if (activePending) {
        throw new AppError("conflict", "Đã có một yêu cầu chuyển giao đang chờ Staff xử lý cho vật phẩm này");
      }

      if (input.proposedHandoverPointId) {
        const hp = await warehouseRepository.findHandoverPointById(input.proposedHandoverPointId);
        if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao đề xuất");
      }

      const requestId = id();
      try {
        await withTransaction(async (conn) => {
          await custodyRepository.createCustodyRequest({
            id: requestId,
            postId: input.postId,
            finderId,
            claimId: input.claimId ?? null,
            status: "PENDING",
            reason: input.reason,
            reasonNotes: input.reasonNotes?.trim() || null,
            proposedHandoverPointId: input.proposedHandoverPointId ?? null,
            proposedTime: input.proposedTime ?? null,
            idempotencyKey: input.idempotencyKey ?? null
          }, conn);

          await custodyRepository.createCustodyLog({
            id: id(),
            custodyRequestId: requestId,
            actorId: finderId,
            action: "REQUESTED",
            fromStatus: null,
            toStatus: "PENDING",
            notes: `Finder yêu cầu chuyển giao custody với lý do: ${custodyReasonLabels[input.reason]}`
          }, conn);
          const staffAndAdminIds = await custodyRepository.findStaffAndAdminUserIds();
          for (const staffId of staffAndAdminIds) {
            await notificationRepository.create({
              userId: staffId,
              type: "CUSTODY_REQUESTED",
              title: "Yêu cầu chuyển giao custody mới",
              body: "A custody request needs staff review.",
              entityType: "CUSTODY_REQUEST",
              entityId: requestId
            }, conn);
          }
          await notifyClaimant(input.claimId, finderId, "CUSTODY_REQUESTED", conn);
        });
      } catch (error) {
        const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY";
        if (!duplicate) throw error;
        const replay = input.idempotencyKey
          ? await custodyRepository.findByIdempotencyKey(finderId, input.idempotencyKey)
          : null;
        if (replay && replay.postId === input.postId && replay.claimId === (input.claimId ?? null)) return replay;
        throw new AppError("conflict", "An active custody request already exists for this post");
      }

      const result = await custodyRepository.findCustodyRequestById(requestId);
      if (!result) throw new AppError("internal", "Không thể lấy thông tin yêu cầu custody vừa tạo");
      return result;
    },

    async listCustodyRequests(query: ListCustodyRequestsQuery) {
      return custodyRepository.listCustodyRequests(query);
    },

    async getCustodyRequestDetail(requestId: string, actorId: string, isStaffOrAdmin: boolean) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (request && !isStaffOrAdmin && request.finderId !== actorId) {
        throw new AppError("forbidden", "You cannot view this custody request");
      }
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      const logs = await custodyRepository.listCustodyLogs(requestId);
      return { request, logs };
    },

    async acceptCustodyRequest(requestId: string, input: AcceptCustodyRequestInput, actorId: string) {
      if (input.assignedHandlerId && input.assignedHandlerId !== actorId) {
        throw new AppError("forbidden", "A handler cannot be assigned without staff verification");
      }
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      if (request.status !== "PENDING") {
        throw new AppError("bad_request", `Không thể chấp nhận yêu cầu đang ở trạng thái ${custodyStatusLabels[request.status]}`);
      }

      const hp = await warehouseRepository.findHandoverPointById(input.confirmedHandoverPointId);
      if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao xác nhận");

      const handoverPointName = await warehouseRepository.findHandoverPointNameById(input.confirmedHandoverPointId);

      await withTransaction(async (conn) => {
        await custodyRepository.lockCustodyRequestById(requestId, conn);
        const current = await custodyRepository.findCustodyRequestById(requestId, conn);
        if (current?.status !== "PENDING") throw new AppError("conflict", "Custody request is no longer pending");
        await custodyRepository.updateCustodyRequest(
          requestId,
          {
            status: "ACCEPTED",
            confirmedHandoverPointId: input.confirmedHandoverPointId,
            assignedHandlerId: input.assignedHandlerId ?? actorId
          },
          conn
        );

        await custodyRepository.createCustodyLog(
          {
            id: id(),
            custodyRequestId: requestId,
            actorId,
            action: "ACCEPTED",
            fromStatus: "PENDING",
            toStatus: "ACCEPTED",
            notes: input.notes?.trim() || "Staff đã chấp nhận yêu cầu tiếp nhận vật phẩm"
          },
          conn
        );

        const currentTime = new Date().toLocaleString('vi-VN', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        await notificationRepository.create(
          {
            userId: request.finderId,
            type: "CUSTODY_ACCEPTED",
            title: "Yêu cầu chuyển giao đồ thất lạc đã được duyệt",
            body: `Staff đã đồng ý tiếp nhận đồ vật "${request.postTitle ?? "vật phẩm"}". Thời gian: ${currentTime}. Địa điểm: ${handoverPointName || "Điểm bàn giao xác nhận"}. Vui lòng mang đồ đến theo lịch hẹn.`,
            entityType: "CUSTODY_REQUEST",
            entityId: requestId
          },
          conn
        );
        await notifyClaimant(request.claimId, request.finderId, "CUSTODY_ACCEPTED", conn);
      });

      return custodyRepository.findCustodyRequestById(requestId);
    },

    async rejectCustodyRequest(requestId: string, input: RejectCustodyRequestInput, actorId: string) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      if (request.status !== "PENDING") {
        throw new AppError("bad_request", `Không thể từ chối yêu cầu đang ở trạng thái ${custodyStatusLabels[request.status]}`);
      }

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do từ chối");

      await withTransaction(async (conn) => {
        await custodyRepository.lockCustodyRequestById(requestId, conn);
        const current = await custodyRepository.findCustodyRequestById(requestId, conn);
        if (current?.status !== "PENDING") throw new AppError("conflict", "Custody request is no longer pending");
        await custodyRepository.updateCustodyRequest(
          requestId,
          {
            status: "REJECTED"
          },
          conn
        );

        await custodyRepository.createCustodyLog(
          {
            id: id(),
            custodyRequestId: requestId,
            actorId,
            action: "REJECTED",
            fromStatus: "PENDING",
            toStatus: "REJECTED",
            notes: `Từ chối: ${reason}`
          },
          conn
        );

        await notificationRepository.create(
          {
            userId: request.finderId,
            type: "CUSTODY_REJECTED",
            title: "Yêu cầu chuyển giao custody bị từ chối",
            body: `Yêu cầu chuyển giao vật phẩm "${request.postTitle ?? "vật phẩm"}" không được tiếp nhận. Lý do: ${reason}`,
            entityType: "CUSTODY_REQUEST",
            entityId: requestId
          },
          conn
        );
        await notifyClaimant(request.claimId, request.finderId, "CUSTODY_REJECTED", conn);
      });

      return custodyRepository.findCustodyRequestById(requestId);
    },

    async cancelCustodyRequest(requestId: string, input: CancelCustodyRequestInput, actorId: string, isStaffOrAdmin: boolean) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      if (request.status !== "PENDING" && request.status !== "ACCEPTED") {
        throw new AppError("bad_request", `Không thể hủy yêu cầu đang ở trạng thái ${custodyStatusLabels[request.status]}`);
      }

      if (!isStaffOrAdmin && request.finderId !== actorId) {
        throw new AppError("forbidden", "Bạn không có quyền hủy yêu cầu này");
      }

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do hủy yêu cầu");

      await withTransaction(async (conn) => {
        await custodyRepository.lockCustodyRequestById(requestId, conn);
        const current = await custodyRepository.findCustodyRequestById(requestId, conn);
        if (current?.status !== "PENDING" && current?.status !== "ACCEPTED") {
          throw new AppError("conflict", "Custody request can no longer be cancelled");
        }
        await custodyRepository.updateCustodyRequest(
          requestId,
          {
            status: "CANCELLED"
          },
          conn
        );

        await custodyRepository.createCustodyLog(
          {
            id: id(),
            custodyRequestId: requestId,
            actorId,
            action: "CANCELLED",
            fromStatus: current.status,
            toStatus: "CANCELLED",
            notes: `Hủy yêu cầu: ${reason}`
          },
          conn
        );
      });

      return custodyRepository.findCustodyRequestById(requestId);
    },

    async confirmStaffIntake(requestId: string, input: ConfirmStaffIntakeInput, actorId: string) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");

      // Idempotency check: if already INTAKED and linked to warehouse item, return existing record
      if (request.status === "INTAKED" && request.warehouseItemId) {
        const existingItem = await warehouseRepository.findItemById(request.warehouseItemId);
        if (existingItem) return existingItem;
      }

      if (request.status !== "PENDING" && request.status !== "ACCEPTED") {
        throw new AppError("bad_request", `Không thể tiếp nhận thực tế cho yêu cầu đang ở trạng thái ${custodyStatusLabels[request.status]}`);
      }

      const post = await custodyRepository.findPostDetailsForIntake(request.postId);
      if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng liên kết");

      const handoverPointId = input.handoverPointId || request.confirmedHandoverPointId || request.proposedHandoverPointId || post.handoverPointId;
      if (!handoverPointId) throw new AppError("bad_request", "Cần xác định điểm bàn giao tiếp nhận");

      const hp = await warehouseRepository.findHandoverPointById(handoverPointId);
      if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");

      const receivedAt = input.receivedAt ?? new Date();
      if (receivedAt.getTime() > Date.now() + 60_000) {
        throw new AppError("bad_request", "Thời gian tiếp nhận không được ở tương lai");
      }

      const retentionDays = await retentionDaysForCategory(post.categoryId);
      const retentionDeadline = calculateRetentionDeadline(receivedAt, retentionDays);
      const warehouseItemId = id();
      let resultItemId = warehouseItemId;
      const conditionNotes = input.conditionNotes.trim();
      const storageCode = input.storageCode?.trim() || null;

      await withTransaction(async (conn) => {
        await custodyRepository.lockCustodyRequestById(requestId, conn);
        const current = await custodyRepository.findCustodyRequestById(requestId, conn);
        if (!current) throw new AppError("not_found", "Custody request not found");
        if (current.status === "INTAKED" && current.warehouseItemId) {
          resultItemId = current.warehouseItemId;
          return;
        }
        if (current.status !== "PENDING" && current.status !== "ACCEPTED") {
          throw new AppError("conflict", "Custody request is no longer available for intake");
        }
        // 1. Create warehouse item
        await warehouseRepository.createItem(
          {
            id: warehouseItemId,
            postId: post.id,
            handoverPointId,
            itemName: post.title,
            description: post.description,
            categoryId: post.categoryId,
            areaId: input.areaId ?? post.areaId,
            buildingId: input.buildingId ?? post.buildingId,
            roomText: input.roomText ?? post.roomText,
            finderName: request.finderName ?? null,
            finderContact: request.finderContact ?? null,
            conditionNotes,
            storageCode,
            receivedAt,
            retentionDeadline,
            createdBy: actorId
          },
          conn
        );

        // 2. Create warehouse storage log
        await warehouseRepository.createStorageLog(
          {
            id: id(),
            warehouseItemId,
            postId: post.id,
            handoverPointId,
            actorId,
            action: "RECEIVED",
            fromStatus: null,
            toStatus: "RECEIVED",
            conditionNotes,
            storageCode,
            note: `Staff tiếp nhận vật phẩm từ yêu cầu custody ${request.id}`
          },
          conn
        );

        // 3. Update custody request
        await custodyRepository.updateCustodyRequest(
          requestId,
          {
            status: "INTAKED",
            warehouseItemId,
            confirmedHandoverPointId: handoverPointId
          },
          conn
        );

        // 4. Create custody log
        await custodyRepository.createCustodyLog(
          {
            id: id(),
            custodyRequestId: requestId,
            actorId,
            action: "INTAKED",
            fromStatus: current.status,
            toStatus: "INTAKED",
            notes: `Staff đã tiếp nhận vật phẩm thực tế vào kho (${storageCode ? `Mã vị trí: ${storageCode}` : "Chưa gắn mã"})`
          },
          conn
        );

        // 5. Update post status to IN_CUSTODY
        if (!await custodyRepository.updatePostStatus(post.id, "IN_CUSTODY", conn)) {
          throw new AppError("conflict", "Found post is no longer eligible for custody intake");
        }

        // 6. Notify Finder
        await notificationRepository.create(
          {
            userId: request.finderId,
            type: "CUSTODY_INTAKED",
            title: "Vật phẩm đã được nhập vào kho trường",
            body: `Vật phẩm "${post.title}" đã được Staff tiếp nhận và nhập kho an toàn. Trách nhiệm bảo quản hiện thuộc về văn phòng quản lý.`,
            entityType: "WAREHOUSE_ITEM",
            entityId: warehouseItemId
          },
          conn
        );
        await notifyClaimant(request.claimId, request.finderId, "CUSTODY_INTAKED", conn);
      });

      const result = await warehouseRepository.findItemById(resultItemId);
      if (!result) throw new AppError("internal", "Không thể lấy lại thông tin vật phẩm kho vừa tạo");
      return result;
    }
  };

  return custodyService;
}

export type CustodyUseCases = ReturnType<typeof createCustodyUseCases>;
