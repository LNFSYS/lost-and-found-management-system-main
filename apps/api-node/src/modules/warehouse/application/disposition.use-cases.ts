import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { NotificationRepository } from "../../notifications/application/index.js";
import {
  checkDispositionEligibility,
  dispositionOrderStatusLabels,
  dispositionTypeLabels,
  isItemOverdue,
  type WarehouseStatus
} from "../domain/warehouse-policy.js";
import type {
  ApplyLegalHoldInput,
  CancelDispositionOrderInput,
  CreateDispositionOrderInput,
  ExecuteDispositionInput,
  ListDispositionOrdersQuery,
  ListOverdueItemsQuery,
  RejectDispositionOrderInput,
  ReleaseLegalHoldInput
} from "./disposition.dto.js";
import type { DispositionRepository } from "./disposition.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";

export interface DispositionDependencies {
  dispositionRepository: DispositionRepository;
  warehouseRepository: WarehouseRepository;
  notificationRepository: NotificationRepository;
  withTransaction: TransactionRunner;
  id: () => string;
}

export function createDispositionUseCases(options: DispositionDependencies) {
  const { dispositionRepository, warehouseRepository, notificationRepository, withTransaction, id } = options;

  const dispositionService = {
    // UC-148: List overdue warehouse items
    async listOverdueItems(query: ListOverdueItemsQuery) {
      return dispositionRepository.listOverdueItems(query);
    },

    // UC-149: View overdue item detail
    async getOverdueItemDetail(itemId: string) {
      const item = await warehouseRepository.findItemById(itemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");

      const [logs, activeHolds, activeClaimsCount] = await Promise.all([
        warehouseRepository.listLogs(itemId),
        dispositionRepository.listActiveLegalHolds(itemId),
        item.postId ? dispositionRepository.countActiveClaimsForPost(item.postId) : Promise.resolve(0)
      ]);

      const eligibility = checkDispositionEligibility({
        status: item.status,
        retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
        legalHoldCount: activeHolds.length,
        activeClaimsCount
      });

      return {
        item,
        logs,
        activeHolds,
        activeClaimsCount,
        eligibility
      };
    },

    // UC-151: Check disposition eligibility
    async checkItemEligibility(itemId: string) {
      const item = await warehouseRepository.findItemById(itemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");

      const [activeHolds, activeClaimsCount] = await Promise.all([
        dispositionRepository.listActiveLegalHolds(itemId),
        item.postId ? dispositionRepository.countActiveClaimsForPost(item.postId) : Promise.resolve(0)
      ]);

      return checkDispositionEligibility({
        status: item.status,
        retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
        legalHoldCount: activeHolds.length,
        activeClaimsCount
      });
    },

    // UC-152: Apply legal hold (Admin only)
    async applyLegalHold(input: ApplyLegalHoldInput, actorId: string) {
      const item = await warehouseRepository.findItemById(input.warehouseItemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do tạm giữ pháp lý");

      const holdId = id();
      await withTransaction(async (conn) => {
        await dispositionRepository.lockWarehouseItem(item.id, conn);
        await dispositionRepository.createLegalHold(
          {
            id: holdId,
            warehouseItemId: item.id,
            reason,
            appliedBy: actorId
          },
          conn
        );
        await dispositionRepository.incrementLegalHoldCount(item.id, 1, conn);
        await warehouseRepository.createStorageLog(
          {
            id: id(),
            warehouseItemId: item.id,
            postId: item.postId,
            handoverPointId: item.handoverPoint?.id ?? "",
            actorId,
            action: "CONDITION_UPDATED",
            note: `Áp dụng lệnh tạm giữ pháp lý (Legal Hold): ${reason}`
          },
          conn
        );
      });

      return dispositionRepository.findLegalHoldById(holdId);
    },

    // UC-152: Release legal hold (Admin only)
    async releaseLegalHold(holdId: string, input: ReleaseLegalHoldInput, actorId: string) {
      const hold = await dispositionRepository.findLegalHoldById(holdId);
      if (!hold) throw new AppError("not_found", "Không tìm thấy lệnh Legal Hold");
      if (!hold.isActive) throw new AppError("bad_request", "Lệnh Legal Hold này đã được gỡ trước đó");

      const releaseReason = input.releaseReason.trim();
      if (!releaseReason) throw new AppError("bad_request", "Vui lòng nhập lý do gỡ lệnh Legal Hold");

      await withTransaction(async (conn) => {
        await dispositionRepository.lockWarehouseItem(hold.warehouseItemId, conn);
        const currentHold = await dispositionRepository.findLegalHoldById(holdId, conn);
        if (!currentHold?.isActive) throw new AppError("conflict", "Legal hold was already released");
        await dispositionRepository.releaseLegalHold(
          holdId,
          {
            releasedBy: actorId,
            releaseReason,
            releasedAt: new Date()
          },
          conn
        );
        await dispositionRepository.incrementLegalHoldCount(hold.warehouseItemId, -1, conn);
        const item = await warehouseRepository.findItemById(hold.warehouseItemId);
        if (item) {
          await warehouseRepository.createStorageLog(
            {
              id: id(),
              warehouseItemId: item.id,
              postId: item.postId,
              handoverPointId: item.handoverPoint?.id ?? "",
              actorId,
              action: "CONDITION_UPDATED",
              note: `Gỡ lệnh tạm giữ pháp lý (Legal Hold): ${releaseReason}`
            },
            conn
          );
        }
      });

      return dispositionRepository.findLegalHoldById(holdId);
    },

    // UC-153: Create disposition order (Admin only)
    async createDispositionOrder(input: CreateDispositionOrderInput, actorId: string) {
      if (!input.warehouseItemIds || input.warehouseItemIds.length === 0) {
        throw new AppError("bad_request", "Cần chọn ít nhất một vật phẩm để tạo lệnh xử lý kho");
      }
      if (new Set(input.warehouseItemIds).size !== input.warehouseItemIds.length) {
        throw new AppError("bad_request", "Duplicate warehouse item IDs are not allowed");
      }

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do tạo lệnh xử lý");

      // Validate all items are eligible
      for (const itemId of input.warehouseItemIds) {
        const item = await warehouseRepository.findItemById(itemId);
        if (!item) throw new AppError("not_found", `Không tìm thấy vật phẩm mã ${itemId}`);

        const activeHolds = await dispositionRepository.listActiveLegalHolds(itemId);
        const activeClaimsCount = item.postId ? await dispositionRepository.countActiveClaimsForPost(item.postId) : 0;
        const eligibility = checkDispositionEligibility({
          status: item.status,
          retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
          legalHoldCount: activeHolds.length,
          activeClaimsCount
        });

        if (!eligibility.eligible) {
          throw new AppError("bad_request", `Vật phẩm "${item.itemName}" không đủ điều kiện xử lý: ${eligibility.blockers.join(", ")}`);
        }
      }

      const orderId = id();
      const orderNumber = await dispositionRepository.generateOrderNumber(input.dispositionType);

      await withTransaction(async (conn) => {
        for (const itemId of [...input.warehouseItemIds].sort()) {
          await dispositionRepository.lockWarehouseItem(itemId, conn);
          const item = await warehouseRepository.findItemById(itemId, conn);
          if (!item) throw new AppError("not_found", "Warehouse item not found");
          const holds = await dispositionRepository.listActiveLegalHolds(itemId, conn);
          const activeClaimsCount = item.postId ? await dispositionRepository.countActiveClaimsForPost(item.postId, conn) : 0;
          const eligibility = checkDispositionEligibility({
            status: item.status,
            retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
            legalHoldCount: holds.length,
            activeClaimsCount
          });
          if (!eligibility.eligible) throw new AppError("conflict", `Warehouse item is no longer eligible: ${eligibility.blockers.join(", ")}`);
        }
        await dispositionRepository.createDispositionOrder(
          {
            id: orderId,
            orderNumber,
            dispositionType: input.dispositionType,
            status: "PENDING_APPROVAL",
            reason,
            createdBy: actorId
          },
          input.warehouseItemIds,
          conn
        );
        const attached = await dispositionRepository.attachOrderToWarehouseItems(input.warehouseItemIds, orderId, conn);
        if (attached !== input.warehouseItemIds.length) {
          throw new AppError("conflict", "One or more items already belong to another order");
        }
      });

      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("internal", "Không thể lấy lại thông tin lệnh xử lý vừa tạo");
      return order;
    },

    // UC-154: List disposition orders
    async listDispositionOrders(query: ListDispositionOrdersQuery) {
      return dispositionRepository.listDispositionOrders(query);
    },

    // UC-154: View disposition order detail
    async getDispositionOrderDetail(orderId: string) {
      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("not_found", "Không tìm thấy lệnh xử lý kho");
      return order;
    },

    // UC-155: Approve disposition order (Admin only)
    async approveDispositionOrder(orderId: string, actorId: string) {
      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("not_found", "Không tìm thấy lệnh xử lý kho");
      if (order.status !== "PENDING_APPROVAL") {
        throw new AppError("bad_request", `Không thể phê duyệt lệnh đang ở trạng thái ${dispositionOrderStatusLabels[order.status]}`);
      }

      await withTransaction(async (conn) => {
        await dispositionRepository.lockDispositionOrder(orderId, conn);
        const currentOrder = await dispositionRepository.findDispositionOrderById(orderId, conn);
        if (currentOrder?.status !== "PENDING_APPROVAL" || !currentOrder.items?.length) {
          throw new AppError("conflict", "Disposition order is no longer awaiting approval");
        }
        for (const orderItem of [...currentOrder.items].sort((a, b) => a.warehouseItemId.localeCompare(b.warehouseItemId))) {
          await dispositionRepository.lockWarehouseItem(orderItem.warehouseItemId, conn);
          const item = await warehouseRepository.findItemById(orderItem.warehouseItemId, conn);
          if (!item || orderItem.status !== "PENDING") throw new AppError("conflict", "Order item is no longer eligible");
          const holds = await dispositionRepository.listActiveLegalHolds(item.id, conn);
          const activeClaimsCount = item.postId ? await dispositionRepository.countActiveClaimsForPost(item.postId, conn) : 0;
          const eligibility = checkDispositionEligibility({
            status: item.status,
            retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
            legalHoldCount: holds.length,
            activeClaimsCount
          });
          if (!eligibility.eligible) throw new AppError("conflict", `Order item is no longer eligible: ${eligibility.blockers.join(", ")}`);
        }
        await dispositionRepository.updateDispositionOrderStatus(
          orderId,
          {
            status: "APPROVED",
            approvedBy: actorId,
            approvedAt: new Date()
          },
          conn
        );
      });

      return dispositionRepository.findDispositionOrderById(orderId);
    },

    // UC-156: Reject disposition order (Admin only)
    async rejectDispositionOrder(orderId: string, input: RejectDispositionOrderInput, actorId: string) {
      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("not_found", "Không tìm thấy lệnh xử lý kho");
      if (order.status !== "PENDING_APPROVAL") {
        throw new AppError("bad_request", `Không thể từ chối lệnh đang ở trạng thái ${dispositionOrderStatusLabels[order.status]}`);
      }

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do từ chối lệnh");

      await withTransaction(async (conn) => {
        await dispositionRepository.lockDispositionOrder(orderId, conn);
        const currentOrder = await dispositionRepository.findDispositionOrderById(orderId, conn);
        if (currentOrder?.status !== "PENDING_APPROVAL") {
          throw new AppError("conflict", "Disposition order is no longer pending approval");
        }
        const itemIds = currentOrder.items?.map((item) => item.warehouseItemId) ?? [];
        await dispositionRepository.updateDispositionOrderStatus(
          orderId,
          {
            status: "REJECTED",
            rejectionReason: reason
          },
          conn
        );
        // Release items from order
        if (itemIds.length > 0) {
          const released = await dispositionRepository.attachOrderToWarehouseItems(itemIds, null, conn, orderId);
          if (released !== itemIds.length) throw new AppError("conflict", "Order items changed during rejection");
        }
      });

      return dispositionRepository.findDispositionOrderById(orderId);
    },

    // UC-157: Cancel disposition order (Admin only)
    async cancelDispositionOrder(orderId: string, input: CancelDispositionOrderInput, actorId: string) {
      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("not_found", "Không tìm thấy lệnh xử lý kho");
      if (order.status !== "APPROVED" && order.status !== "PENDING_APPROVAL") {
        throw new AppError("bad_request", `Không thể hủy lệnh đang ở trạng thái ${dispositionOrderStatusLabels[order.status]}`);
      }

      const reason = input.reason.trim();
      if (!reason) throw new AppError("bad_request", "Vui lòng nhập lý do hủy lệnh");

      await withTransaction(async (conn) => {
        await dispositionRepository.lockDispositionOrder(orderId, conn);
        const currentOrder = await dispositionRepository.findDispositionOrderById(orderId, conn);
        if (!currentOrder || (currentOrder.status !== "APPROVED" && currentOrder.status !== "PENDING_APPROVAL")) {
          throw new AppError("conflict", "Disposition order can no longer be cancelled");
        }
        if (currentOrder.items?.some((item) => item.status !== "PENDING")) {
          throw new AppError("conflict", "A partially processed order cannot be cancelled");
        }
        const itemIds = currentOrder.items?.map((item) => item.warehouseItemId) ?? [];
        await dispositionRepository.updateDispositionOrderStatus(
          orderId,
          {
            status: "CANCELLED",
            cancelledBy: actorId,
            cancelledAt: new Date(),
            cancellationReason: reason
          },
          conn
        );
        // Release items from order
        if (itemIds.length > 0) {
          const released = await dispositionRepository.attachOrderToWarehouseItems(itemIds, null, conn, orderId);
          if (released !== itemIds.length) throw new AppError("conflict", "Order items changed during cancellation");
        }
      });

      return dispositionRepository.findDispositionOrderById(orderId);
    },

    // UC-158: Record evidence & execute disposition (Staff / Admin)
    async executeDisposition(orderId: string, input: ExecuteDispositionInput, actorId: string) {
      const order = await dispositionRepository.findDispositionOrderById(orderId);
      if (!order) throw new AppError("not_found", "Không tìm thấy lệnh xử lý kho");
      if (order.status !== "APPROVED") {
        throw new AppError("bad_request", `Chỉ có thể thực hiện xử lý vật phẩm khi lệnh đã được phê duyệt (Trạng thái hiện tại: ${dispositionOrderStatusLabels[order.status]})`);
      }

      if (!input.processedItemIds || input.processedItemIds.length === 0) {
        throw new AppError("bad_request", "Cần chọn ít nhất một vật phẩm đã xử lý thực tế");
      }

      if (new Set(input.processedItemIds).size !== input.processedItemIds.length) {
        throw new AppError("bad_request", "Duplicate warehouse item IDs are not allowed");
      }

      const targetStatus: WarehouseStatus =
        order.dispositionType === "DISPOSAL"
          ? "DISPOSED"
          : order.dispositionType === "DONATION"
            ? "DONATED"
            : "TRANSFERRED";

      await withTransaction(async (conn) => {
        await dispositionRepository.lockDispositionOrder(orderId, conn);
        const currentOrder = await dispositionRepository.findDispositionOrderById(orderId, conn);
        if (!currentOrder || currentOrder.status !== "APPROVED" || !currentOrder.approvedBy) {
          throw new AppError("conflict", "Disposition order is not approved");
        }
        const pendingIds = new Set(currentOrder.items?.filter((item) => item.status === "PENDING").map((item) => item.warehouseItemId));
        if (input.processedItemIds.some((itemId) => !pendingIds.has(itemId))) {
          throw new AppError("bad_request", "Every item must be pending in this disposition order");
        }
        if (input.evidenceUrls?.some((evidence) => evidence.warehouseItemId && !pendingIds.has(evidence.warehouseItemId))) {
          throw new AppError("bad_request", "Evidence item does not belong to this disposition order");
        }
        const previousStatuses = new Map<string, WarehouseStatus>();
        for (const itemId of [...input.processedItemIds].sort()) {
          await dispositionRepository.lockWarehouseItem(itemId, conn);
          const item = await warehouseRepository.findItemById(itemId, conn);
          if (!item) throw new AppError("not_found", "Warehouse item not found");
          const activeHolds = await dispositionRepository.listActiveLegalHolds(itemId, conn);
          const activeClaimsCount = item.postId ? await dispositionRepository.countActiveClaimsForPost(item.postId, conn) : 0;
          const eligibility = checkDispositionEligibility({
            status: item.status,
            retentionDeadline: item.retentionDeadline ? new Date(item.retentionDeadline) : null,
            legalHoldCount: activeHolds.length,
            activeClaimsCount
          });
          if (!eligibility.eligible) throw new AppError("conflict", `Item is no longer eligible: ${eligibility.blockers.join(", ")}`);
          previousStatuses.set(itemId, item.status);
        }
        // 1. Save evidence if provided
        if (input.evidenceUrls && input.evidenceUrls.length > 0) {
          const evidenceRecords = input.evidenceUrls.map((ev) => ({
            id: id(),
            dispositionOrderId: orderId,
            warehouseItemId: ev.warehouseItemId ?? null,
            fileUrl: ev.fileUrl,
            fileKind: ev.fileKind,
            uploadedBy: actorId,
            description: ev.description?.trim() || null
          }));
          await dispositionRepository.addDispositionEvidence(evidenceRecords, conn);
        }

        // 2. The guarded update must affect every approved, eligible item or the transaction rolls back.
        const updatedCount = await dispositionRepository.updateWarehouseItemsStatus(orderId, input.processedItemIds, targetStatus, conn);
        if (updatedCount !== input.processedItemIds.length) {
          throw new AppError("conflict", "Warehouse eligibility changed; no disposition was recorded");
        }
        await dispositionRepository.markOrderItemsProcessed(orderId, input.processedItemIds, input.notes, conn);

        // 4. Create storage logs for all processed items
        for (const itemId of input.processedItemIds) {
          const item = await warehouseRepository.findItemById(itemId);
          if (item) {
            await warehouseRepository.createStorageLog(
              {
                id: id(),
                warehouseItemId: itemId,
                postId: item.postId,
                handoverPointId: item.handoverPoint?.id ?? "",
                actorId,
                action: targetStatus,
                fromStatus: previousStatuses.get(itemId) ?? item.status,
                toStatus: targetStatus,
                note: `Thực hiện lệnh xử lý ${order.orderNumber} (${dispositionTypeLabels[order.dispositionType]}): ${input.notes || "Hoàn tất"}`
              },
              conn
            );
          }
        }

        // 5. Check if all items in order are processed -> Mark COMPLETED
        const pendingItems = currentOrder.items?.filter((it) => !input.processedItemIds.includes(it.warehouseItemId) && it.status !== "PROCESSED") ?? [];
        if (pendingItems.length === 0) {
          await dispositionRepository.updateDispositionOrderStatus(
            orderId,
            {
              status: "COMPLETED",
              completedBy: actorId,
              completedAt: new Date()
            },
            conn
          );
        }
      });

      return dispositionRepository.findDispositionOrderById(orderId);
    }
  };

  return dispositionService;
}

export type DispositionUseCases = ReturnType<typeof createDispositionUseCases>;
