import type { TransactionRunner } from "../../../shared/application/transaction.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import { validateImageUpload } from "../../../shared/domain/media.js";
import type { CustodyRequestRepository } from "./custody-request.repository.port.js";
import { custodyNotifications, type CustodyNotifications } from "./custody-notifications.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { calculateRetentionDeadline, canTransitionWarehouseStatus, retentionConfigKeyForCategory, retentionFallbacks, warehouseStatusLabels } from "../domain/warehouse-policy.js";
import type {
  CreateWarehouseItemInput,
  ListWarehouseItemsQuery,
  UpdateWarehouseItemInput,
  ReturnWarehouseItemInput,
  WarehouseStatus
} from "./warehouse.dto.js";
import type { StorageLogAction, WarehouseRepository } from "./warehouse.repository.port.js";

function clean(value: string | null | undefined) {
  const next = value?.trim();
  return next ? next : null;
}

function ensureNotFuture(value: Date) {
  if (!Number.isFinite(value.getTime()) || value.getTime() > Date.now()) throw new AppError("bad_request", "Thời gian tiếp nhận không được ở tương lai");
}

export interface WarehouseDependencies extends CustodyNotifications {
  warehouseRepository: WarehouseRepository;
  custodyRequestRepository: CustodyRequestRepository;
  proofStorage: PrivateMediaStorage;
  withTransaction: TransactionRunner;
  id: () => string;
}
export function createWarehouseUseCases(options: WarehouseDependencies) {
  const { warehouseRepository, custodyRequestRepository, proofStorage, withTransaction, id } = options;
  const notifications = custodyNotifications(options, custodyRequestRepository);
  async function staff(actorId: string) {
    if (!await warehouseRepository.isStaff(actorId)) throw new AppError("forbidden", "Chỉ Staff/Admin được thao tác kho");
  }
  async function admin(actorId: string) {
    if (!await warehouseRepository.isAdmin(actorId)) throw new AppError("forbidden", "Chỉ Admin được quản lý legal hold và phê duyệt xử lý");
  }

  async function retentionDaysForCategory(categoryId: string | null | undefined) {
    if (!categoryId) {
      return warehouseRepository.getConfigInt("warehouse.retention_days_default", retentionFallbacks["warehouse.retention_days_default"]);
    }
    const category = await warehouseRepository.findCategoryNames(categoryId);
    if (!category) throw new AppError("not_found", "Không tìm thấy danh mục vật phẩm");
    const key = retentionConfigKeyForCategory(category);
    return warehouseRepository.getConfigInt(key, retentionFallbacks[key]);
  }

  async function resolveLocation(input: Pick<CreateWarehouseItemInput, "areaId" | "buildingId">) {
    let areaId = input.areaId ?? null;
    const buildingId = input.buildingId ?? null;
    if (buildingId) {
      const building = await warehouseRepository.findBuildingById(buildingId);
      if (!building) throw new AppError("not_found", "Không tìm thấy địa điểm");
      if (areaId && areaId !== building.areaId) throw new AppError("bad_request", "Địa điểm không thuộc khu vực đã chọn");
      areaId = building.areaId;
    }
    if (areaId && !await warehouseRepository.findAreaById(areaId)) throw new AppError("not_found", "Không tìm thấy khu vực");
    return { areaId, buildingId };
  }

  const warehouseService = {
    async getCatalog() {
      return warehouseRepository.getCatalog();
    },

    async listItems(query: ListWarehouseItemsQuery) {
      const [stats, handoverCounts, list] = await Promise.all([
        warehouseRepository.getStats(),
        warehouseRepository.listHandoverCounts(),
        warehouseRepository.listItems(query)
      ]);
      return {
        stats,
        handoverCounts,
        total: list.total,
        page: query.page,
        pageSize: query.pageSize,
        items: list.items
      };
    },

    async createItem(input: CreateWarehouseItemInput, actorId: string) {
      await staff(actorId);
      if (!await warehouseRepository.findHandoverPointById(input.handoverPointId)) throw new AppError("not_found", "Không tìm thấy điểm bàn giao");
      if (input.postId && !await warehouseRepository.findPostById(input.postId)) throw new AppError("not_found", "Không tìm thấy bài đăng liên quan");
      if (input.categoryId && !await warehouseRepository.findCategoryNames(input.categoryId)) throw new AppError("not_found", "Không tìm thấy danh mục vật phẩm");

      const receivedAt = input.receivedAt ?? new Date();
      ensureNotFuture(receivedAt);
      const location = await resolveLocation(input);
      const retentionDays = await retentionDaysForCategory(input.categoryId);
      const retentionDeadline = calculateRetentionDeadline(receivedAt, retentionDays);
      const warehouseItemId = id();
      const conditionNotes = input.conditionNotes.trim();
      let storageCode = clean(input.storageCode);
      if (!storageCode) {
        storageCode = await warehouseRepository.generateNextStorageCode();
      }

      await withTransaction(async (connection) => {
        if (input.postId && (!await warehouseRepository.lockFoundPost(input.postId, connection) || await warehouseRepository.hasItemForPost(input.postId, connection))) {
          throw new AppError("conflict", "Bài FOUND không hợp lệ hoặc đã được tiếp nhận");
        }
        await warehouseRepository.createItem({
          id: warehouseItemId,
          postId: input.postId ?? null,
          handoverPointId: input.handoverPointId,
          itemName: input.itemName.trim(),
          description: clean(input.description),
          categoryId: input.categoryId ?? null,
          areaId: location.areaId,
          buildingId: location.buildingId,
          roomText: clean(input.roomText),
          finderName: clean(input.finderName),
          finderContact: clean(input.finderContact),
          conditionNotes,
          storageCode,
          receivedAt,
          retentionDeadline,
          createdBy: actorId
        }, connection);
        await warehouseRepository.createStorageLog({
          id: id(),
          warehouseItemId,
          postId: input.postId ?? null,
          handoverPointId: input.handoverPointId,
          actorId,
          action: "RECEIVED",
          fromStatus: null,
          toStatus: "RECEIVED",
          conditionNotes,
          storageCode,
          note: "Đã tiếp nhận vật phẩm"
        }, connection);
      });

      const item = await warehouseRepository.findItemById(warehouseItemId);
      if (!item) throw new AppError("internal", "Không thể đọc lại vật phẩm vừa tạo");
      return item;
    },

    async updateItem(itemId: string, input: UpdateWarehouseItemInput, actorId: string) {
      await staff(actorId);
      let action: StorageLogAction = "CONDITION_UPDATED";
      await withTransaction(async (connection) => {
        const current = await warehouseRepository.lockItemForUpdate(itemId, connection);
        if (!current) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
        if (current.postId) await warehouseRepository.lockPhysicalPost(current.postId, connection);

        const nextStatus = input.status ?? current.status;
        const statusChanged = input.status !== undefined && input.status !== current.status;
        if (statusChanged && ["CLAIMED","RETURNED","DISPOSED","DONATED","TRANSFERRED"].includes(nextStatus)) throw new AppError("conflict", "Trạng thái này yêu cầu workflow có xác minh/phê duyệt");
        if (statusChanged && current.status === "CLAIMED") throw new AppError("conflict", "Dùng thao tác giải phóng reservation có lý do");
        if (statusChanged && nextStatus === "EXPIRED") {
          if (current.legalHold || !current.retentionDeadline || current.retentionDeadline.getTime() > Date.now() || await warehouseRepository.hasBlockingCases(current.postId, connection)) {
            throw new AppError("conflict", "Vật phẩm chưa đủ điều kiện quá hạn hoặc có case/hold đang hoạt động");
          }
        }
        if (statusChanged && !canTransitionWarehouseStatus(current.status, nextStatus)) {
          throw new AppError("bad_request", `Không thể chuyển trạng thái từ ${warehouseStatusLabels[current.status]} sang ${warehouseStatusLabels[nextStatus]}`);
        }

        const conditionNotes = input.conditionNotes !== undefined ? clean(input.conditionNotes) : undefined;
        const storageCode = input.storageCode !== undefined ? clean(input.storageCode) : undefined;
        const nextStorageCode = storageCode !== undefined ? storageCode : current.storageCode;
        if (nextStatus === "STORED" && !nextStorageCode) throw new AppError("bad_request", "Cần mã vị trí lưu kho khi chuyển sang Đang lưu kho");

        action = statusChanged ? nextStatus : "CONDITION_UPDATED";
        const returnedAt = statusChanged && nextStatus === "RETURNED" ? new Date() : undefined;
        await warehouseRepository.updateItemState(current.id, {
          status: statusChanged ? nextStatus : undefined,
          conditionNotes,
          storageCode,
          returnedAt
        }, connection);
        await warehouseRepository.createStorageLog({
          id: id(),
          warehouseItemId: current.id,
          postId: current.postId,
          handoverPointId: current.handoverPointId,
          actorId,
          action,
          fromStatus: statusChanged ? current.status : current.status,
          toStatus: nextStatus,
          conditionNotes: conditionNotes ?? current.conditionNotes,
          storageCode: nextStorageCode,
          note: clean(input.note)
        }, connection);
      });

      const item = await warehouseRepository.findItemById(itemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
      return item;
    },

    async returnItem(itemId: string, input: ReturnWarehouseItemInput, actorId: string) {
      await staff(actorId);
      const proofIds = input.proofImage.split("\n");
      if (!proofIds.length || proofIds.length > 5 || proofIds.some(proofId => !/^[0-9a-f-]{36}$/i.test(proofId))) throw new AppError("bad_request", "Cần reference proof riêng tư");
      const claimId = input.claimId ?? null;
      const recipientId = input.recipientId ?? null;
      const hasLinkedClaim = Boolean(claimId || recipientId);
      if (hasLinkedClaim && (!claimId || !recipientId)) throw new AppError("bad_request", "claimId và recipientId phải được gửi cùng nhau");
      const deliveries = await withTransaction(async (connection) => {
        const current = await warehouseRepository.lockItemForUpdate(itemId, connection);
        if (!current) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
        if (current.status === "RETURNED") {
          const completed = await warehouseRepository.findCompletedReturn(itemId, connection);
          if (!completed || completed.claimId !== claimId || completed.recipientId !== recipientId || completed.receiverName !== input.receiverName || completed.receiverIdentity !== input.receiverIdentity || completed.receiverPhone !== input.receiverPhone || completed.actorId !== actorId || [...completed.proofIds].sort().join() !== [...proofIds].sort().join()) throw new AppError("conflict", "Vật phẩm đã được trả với hồ sơ khác");
          return [];
        }
        if (current.postId) await warehouseRepository.lockPhysicalPost(current.postId, connection);
        if (!["STORED","RECEIVED","CLAIMED"].includes(current.status) || current.legalHold) {
          throw new AppError("conflict", `Vật phẩm đang ở trạng thái ${warehouseStatusLabels[current.status as WarehouseStatus]} nên không thể thao tác trả lại`);
        }
        if (current.reservedClaimId && !claimId) throw new AppError("conflict", "Vật phẩm đang được giữ cho một claim; hãy liên kết claim khi trả hàng");
        if (current.reservedClaimId && current.reservedClaimId !== claimId) throw new AppError("conflict", "Vật phẩm đã được giữ cho claim khác");
        if (claimId && recipientId && !await warehouseRepository.verifiedRecipient(claimId, current.postId, recipientId, connection)) throw new AppError("conflict", "Người nhận chưa được xác minh trong claim của vật phẩm");
        if (await warehouseRepository.hasBlockingCases(current.postId, connection, claimId ?? undefined)) throw new AppError("conflict", "Vật phẩm còn claim khác hoặc dispute chưa giải quyết");
        for (const proofId of proofIds) {
          const proof = await warehouseRepository.findProof(proofId, connection);
          if (!proof || proof.itemId !== itemId || proof.actorId !== actorId || proof.attached) throw new AppError("forbidden", "Proof không thuộc vật phẩm/Staff này");
          await warehouseRepository.attachProof(proofId, connection);
        }
        const completedAt = new Date();
        const appointmentId = await warehouseRepository.completeReturn({ id: id(), itemId, claimId, recipientId, receiverName: input.receiverName, receiverIdentity: input.receiverIdentity, receiverPhone: input.receiverPhone, actorId, proofIds, completedAt }, connection);

        await warehouseRepository.updateItemState(current.id, {
          status: "RETURNED",
          returnedAt: completedAt
        }, connection);

        const note = [
          "TRẢ HÀNG CHO CHỦ SỞ HỮU",
          appointmentId ? `Completed return: ${appointmentId}` : "Direct in-person return (no LNFS claim)",
          `Recipient name: ${input.receiverName}`,
          `Recipient phone: ${input.receiverPhone}`,
          "Recipient identity: stored in restricted completed-return record",
          `Proof references: ${proofIds.join(" ")}`,
          input.note ? `\nGhi chú: ${input.note}` : ""
        ].filter(Boolean).join("\n");

        await warehouseRepository.createStorageLog({
          id: id(),
          warehouseItemId: current.id,
          postId: current.postId,
          handoverPointId: current.handoverPointId,
          actorId,
          action: "RETURNED",
          fromStatus: current.status,
          toStatus: "RETURNED",
          conditionNotes: current.conditionNotes,
          storageCode: current.storageCode,
          note
        }, connection);
        const request = current.postId ? await custodyRequestRepository.findActiveByPostId(current.postId, (await warehouseRepository.getPostInfoForIntake(current.postId, connection))?.finderUserId ?? "", connection) : null;
        return request ? notifications.record({ id: request.id, postId: current.postId, claimId, requesterId: request.requester.id, event: "RETURNED" }, connection) : [];
      });
      await notifications.publish(deliveries);
      return warehouseRepository.findItemById(itemId);
    },

    async uploadProof(itemId: string, file: ImageUpload, actorId: string) {
      await staff(actorId);
      const item = await warehouseRepository.findItemById(itemId);
      if (!item || !["RECEIVED","STORED","CLAIMED","EXPIRED"].includes(item.status)) throw new AppError("conflict", "Vật phẩm không thể nhận proof");
      const image = validateImageUpload(file);
      if (image.bytes > 5 * 1024 * 1024) throw new AppError("payload_too_large", "Ảnh tối đa 5MB");
      const proofId = id();
      const stored = await proofStorage.save(actorId, proofId, image.extension, file.buffer);
      try {
        await warehouseRepository.createProof({ id: proofId, itemId, actorId, storageRef: stored.secureUrl, format: image.format, bytes: image.bytes });
      } catch (error) {
        await proofStorage.remove(stored.secureUrl);
        throw error;
      }
      return { id: proofId, url: `/api/staff/warehouse-proofs/${proofId}` };
    },
    async getProof(proofId: string, actorId: string) {
      await staff(actorId);
      const proof = await warehouseRepository.findProof(proofId);
      if (!proof) throw new AppError("not_found", "Không tìm thấy proof");
      return proofStorage.resolve(proof.storageRef, proof.format);
    },
    async returnRecipients(itemId: string, actorId: string) {
      await staff(actorId);
      const item = await warehouseRepository.findItemById(itemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm");
      return { recipients: await warehouseRepository.listVerifiedRecipients(item.postId) };
    },
    async returnClaimReviews(itemId: string, actorId: string) {
      await staff(actorId);
      const item = await warehouseRepository.findItemById(itemId);
      if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm");
      return { claims: await warehouseRepository.listReturnClaimReviews(item.postId) };
    },
    async verifyCustodyClaim(itemId: string, input: { claimId: string; recipientId: string; verified: boolean; reason: string; }, actorId: string) {
      await staff(actorId);
      const reason = input.reason.trim();
      if (!input.verified || reason.length < 10 || reason.length > 1000) throw new AppError("invalid_input", "Cần xác nhận đối chiếu và ghi nội dung xác minh từ 10 đến 1000 ký tự");
      const deliveries = await withTransaction(async db => {
        const item = await warehouseRepository.lockItemForUpdate(itemId, db);
        if (!item?.postId || item.legalHold || !["RECEIVED", "STORED", "CLAIMED", "EXPIRED"].includes(item.status)) throw new AppError("conflict", "Chỉ xác minh sau khi Staff đã tiếp nhận vật phẩm và không có legal hold");
        await warehouseRepository.lockPhysicalPost(item.postId, db);
        const claim = await warehouseRepository.lockReturnClaim(input.claimId, item.postId, db);
        if (!claim || claim.recipientId !== input.recipientId) throw new AppError("conflict", "Claim hoặc người nhận không hợp lệ cho vật phẩm này");
        if (item.reservedClaimId && item.reservedClaimId !== claim.claimId) throw new AppError("conflict", "Vật phẩm đã được giữ cho claim khác");
        if (await warehouseRepository.hasBlockingCases(item.postId, db, claim.claimId)) throw new AppError("conflict", "Vật phẩm còn claim khác hoặc dispute chưa giải quyết");
        if (claim.verified) return [];
        await warehouseRepository.recordStaffVerification({ id: id(), itemId, claimId: claim.claimId, recipientId: claim.recipientId, actorId, fromStatus: claim.status, reason }, db);
        await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: itemId, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: "CONDITION_UPDATED", fromStatus: item.status, toStatus: item.status, note: `Staff verified claim ${claim.claimId} at intake desk` }, db);
        const source = await warehouseRepository.getPostInfoForIntake(item.postId, db);
        const request = source ? await custodyRequestRepository.findActiveByPostId(item.postId, source.finderUserId, db) : null;
        return request ? notifications.record({ id: request.id, postId: item.postId, claimId: claim.claimId, requesterId: request.requester.id, event: `VERIFIED:${claim.claimId}` }, db) : [];
      });
      await notifications.publish(deliveries);
      const item = await warehouseRepository.findItemById(itemId);
      return { claims: await warehouseRepository.listReturnClaimReviews(item?.postId ?? null) };
    },
    async reserveItem(itemId: string, claimId: string, recipientId: string, actorId: string) {
      await staff(actorId);
      await withTransaction(async db => {
        const item = await warehouseRepository.lockItemForUpdate(itemId, db);
        if (!item || item.legalHold || !["RECEIVED","STORED"].includes(item.status)) throw new AppError("conflict", "Không thể giữ vật phẩm này");
        if (item.postId) await warehouseRepository.lockPhysicalPost(item.postId, db);
        if (!await warehouseRepository.verifiedRecipient(claimId, item.postId, recipientId, db)) throw new AppError("conflict", "Chủ sở hữu chưa được xác minh");
        await warehouseRepository.reserve(itemId, claimId, db);
        await warehouseRepository.updateItemState(itemId, { status: "CLAIMED" }, db);
        await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: itemId, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: "CLAIMED", fromStatus: item.status, toStatus: "CLAIMED", note: `Verified claim ${claimId}` }, db);
      });
      return warehouseRepository.findItemById(itemId);
    },
    async releaseReservation(itemId: string, reason: string, actorId: string) {
      await staff(actorId);
      if (!clean(reason)) throw new AppError("bad_request", "Cần lý do giải phóng reservation");
      await withTransaction(async db => {
        const item = await warehouseRepository.lockItemForUpdate(itemId, db);
        if (item?.postId) await warehouseRepository.lockPhysicalPost(item.postId, db);
        if (!item || item.status !== "CLAIMED" || item.legalHold || await warehouseRepository.hasBlockingCases(item.postId, db) || !item.storageCode) throw new AppError("conflict", "Reservation còn case đang hoạt động hoặc chưa có vị trí lưu kho");
        await warehouseRepository.reserve(itemId, null, db);
        await warehouseRepository.updateItemState(itemId, { status: "STORED" }, db);
        await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: itemId, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: "STORED", fromStatus: "CLAIMED", toStatus: "STORED", note: reason.trim() }, db);
      });
      return warehouseRepository.findItemById(itemId);
    },
    async legalHold(itemId: string, held: boolean, reason: string, actorId: string) {
      await admin(actorId);
      if (!clean(reason)) throw new AppError("bad_request", "Cần lý do legal hold");
      await withTransaction(async db => {
        const item = await warehouseRepository.lockItemForUpdate(itemId, db);
        if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm");
        await warehouseRepository.setLegalHold(itemId, held, db);
        await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: itemId, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: "CONDITION_UPDATED", fromStatus: item.status, toStatus: item.status, note: `Legal hold ${held}: ${reason}` }, db);
      });
    },
    async requestDisposition(itemId: string, target: "DISPOSED" | "DONATED" | "TRANSFERRED", reason: string, actorId: string) {
      await admin(actorId);
      if (!clean(reason)) throw new AppError("bad_request", "Cần lý do xử lý");
      const approvalId = id();
      await withTransaction(async db => {
        const item = await warehouseRepository.lockItemForUpdate(itemId, db);
        if (!item) throw new AppError("not_found", "Không tìm thấy vật phẩm");
        await warehouseRepository.createApproval({ id: approvalId, itemId, actorId, target, reason: reason.trim() }, db);
      });
      return { approvalId };
    },
    async approveDisposition(approvalId: string, actorId: string) {
      await admin(actorId);
      await withTransaction(async db => {
        const approval = await warehouseRepository.lockApproval(approvalId, db);
        if (!approval || approval.requesterId === actorId) throw new AppError("forbidden", "Cần người phê duyệt khác người đề nghị");
        if (approval.status === "APPROVED") return;
        if (approval.status !== "PENDING") throw new AppError("conflict", "Lệnh không còn chờ duyệt");
        await warehouseRepository.approveAction(approvalId, actorId, db);
      });
    },
    async executeDisposition(approvalId: string, actorId: string, proofIds: string[] = []) {
      await staff(actorId);
      try { await withTransaction(async db => {
        const approval = await warehouseRepository.lockApproval(approvalId, db);
        if (approval?.status === "EXECUTED") return;
        if (!approval || approval.status !== "APPROVED") throw new AppError("conflict", "Lệnh chưa được phê duyệt");
        const item = await warehouseRepository.lockItemForUpdate(approval.itemId, db);
        if (item?.postId) await warehouseRepository.lockPhysicalPost(item.postId, db);
        if (!item || !["RECEIVED","STORED","EXPIRED"].includes(item.status) || item.legalHold || !item.retentionDeadline || item.retentionDeadline.getTime() > Date.now() || await warehouseRepository.hasBlockingCases(item.postId, db)) throw new AppError("conflict", "Không đủ điều kiện xử lý: retention/claim/appointment/dispute/legal hold");
        if (!proofIds.length || proofIds.length > 5 || new Set(proofIds).size !== proofIds.length) throw new AppError("bad_request", "Cần chứng từ xử lý riêng tư");
        for (const proofId of proofIds) {
          const proof = await warehouseRepository.findProof(proofId, db);
          if (!proof || proof.itemId !== item.id || proof.actorId !== actorId || proof.attached) throw new AppError("forbidden", "Chứng từ không thuộc vật phẩm/người thực hiện");
          await warehouseRepository.attachProof(proofId, db);
        }
        await warehouseRepository.updateItemState(item.id, { status: approval.target }, db);
        await warehouseRepository.executeAction(approvalId, db);
        await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: item.id, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: approval.target, fromStatus: item.status, toStatus: approval.target, note: `Approval ${approvalId}\nProof references: ${proofIds.join(" ")}` }, db);
      }); } catch (error) {
        if (error instanceof AppError) await withTransaction(async db => {
          const approval = await warehouseRepository.lockApproval(approvalId, db);
          const item = approval ? await warehouseRepository.lockItemForUpdate(approval.itemId, db) : null;
          if (item) await warehouseRepository.createStorageLog({ id: id(), warehouseItemId: item.id, postId: item.postId, handoverPointId: item.handoverPointId, actorId, action: "CONDITION_UPDATED", fromStatus: item.status, toStatus: item.status, note: `DISPOSITION_DENIED: approval ${approvalId}; guards not satisfied` }, db);
        });
        throw error;
      }
    },
    async runMaintenance() {
      const deliveries = await withTransaction(async db => {
        const pending = [];
        for (const request of await warehouseRepository.listOverdueRequests(db)) pending.push(...await notifications.record({ ...request, event: "OVERDUE" }, db));
        for (const proof of await warehouseRepository.listExpiredProofs(db)) {
          await proofStorage.remove(proof.storageRef);
          await warehouseRepository.deleteUnusedProof(proof.id, db);
        }
        return pending;
      });
      await notifications.publish(deliveries);
    },

    async listLogs(itemId: string) {
      if (!await warehouseRepository.findItemById(itemId)) throw new AppError("not_found", "Không tìm thấy vật phẩm trong kho");
      return warehouseRepository.listLogs(itemId);
    }
  };
  return warehouseService;
}

export type WarehouseUseCases = ReturnType<typeof createWarehouseUseCases>;
