import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { NotificationRepository } from "../../notifications/application/notification.repository.port.js";
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
        if (existing) return existing;
      }

      const post = await custodyRepository.findPostDetailsForIntake(input.postId);
      if (!post) throw new AppError("not_found", "Không tìm thấy bài đăng");
      if (post.userId !== finderId) throw new AppError("forbidden", "Chỉ người nhặt (Finder) của bài đăng mới được yêu cầu chuyển custody");
      if (post.status === "IN_CUSTODY" || post.status === "RESOLVED" || post.status === "CLOSED") {
        throw new AppError("bad_request", `Không thể yêu cầu custody cho bài đăng ở trạng thái ${post.status}`);
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
      await withTransaction(async (conn) => {
        await custodyRepository.createCustodyRequest(
          {
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
          },
          conn
        );

        await custodyRepository.createCustodyLog(
          {
            id: id(),
            custodyRequestId: requestId,
            actorId: finderId,
            action: "REQUESTED",
            fromStatus: null,
            toStatus: "PENDING",
            notes: `Finder yêu cầu chuyển giao custody với lý do: ${custodyReasonLabels[input.reason]}`
          },
          conn
        );

        // Notify staff and admin users about the new custody request
        const staffAndAdminIds = await custodyRepository.findStaffAndAdminUserIds();
        if (staffAndAdminIds.length > 0) {
          const reasonText = custodyReasonLabels[input.reason];
          const handoverPointName = input.proposedHandoverPointId 
            ? await warehouseRepository.findHandoverPointNameById(input.proposedHandoverPointId)
            : "Chưa xác định";
          
          const proposedTimeText = input.proposedTime 
            ? new Date(input.proposedTime).toLocaleString('vi-VN')
            : "Chưa xác định";

          for (const staffId of staffAndAdminIds) {
            await notificationRepository.create(
              {
                userId: staffId,
                type: "CUSTODY_REQUESTED",
                title: "Yêu cầu chuyển giao custody mới",
                body: `Finder yêu cầu chuyển giao vật phẩm "${post.title}". Lý do: ${reasonText}. Điểm đề xuất: ${handoverPointName}. Ngày gửi: ${proposedTimeText}`,
                entityType: "CUSTODY_REQUEST",
                entityId: requestId
              },
              conn
            );
          }
        }
      });

      const result = await custodyRepository.findCustodyRequestById(requestId);
      if (!result) throw new AppError("internal", "Không thể lấy thông tin yêu cầu custody vừa tạo");
      return result;
    },

    async listCustodyRequests(query: ListCustodyRequestsQuery) {
      return custodyRepository.listCustodyRequests(query);
    },

    async getCustodyRequestDetail(requestId: string) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      const logs = await custodyRepository.listCustodyLogs(requestId);
      return { request, logs };
    },

    async acceptCustodyRequest(requestId: string, input: AcceptCustodyRequestInput, actorId: string) {
      const request = await custodyRepository.findCustodyRequestById(requestId);
      if (!request) throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      if (request.status !== "PENDING") {
        throw new AppError("bad_request", `Không thể chấp nhận yêu cầu đang ở trạng thái ${custodyStatusLabels[request.status]}`);
      }

      const hp = await warehouseRepository.findHandoverPointById(input.confirmedHandoverPointId);
      if (!hp) throw new AppError("not_found", "Không tìm thấy điểm bàn giao xác nhận");

      const handoverPointName = await warehouseRepository.findHandoverPointNameById(input.confirmedHandoverPointId);

      await withTransaction(async (conn) => {
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
            fromStatus: request.status,
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
      const conditionNotes = input.conditionNotes.trim();
      const storageCode = input.storageCode?.trim() || null;

      await withTransaction(async (conn) => {
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
            fromStatus: request.status,
            toStatus: "INTAKED",
            notes: `Staff đã tiếp nhận vật phẩm thực tế vào kho (${storageCode ? `Mã vị trí: ${storageCode}` : "Chưa gắn mã"})`
          },
          conn
        );

        // 5. Update post status to IN_CUSTODY
        await custodyRepository.updatePostStatus(post.id, "IN_CUSTODY", conn);

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
      });

      const result = await warehouseRepository.findItemById(warehouseItemId);
      if (!result) throw new AppError("internal", "Không thể lấy lại thông tin vật phẩm kho vừa tạo");
      return result;
    }
  };

  return custodyService;
}

export type CustodyUseCases = ReturnType<typeof createCustodyUseCases>;
