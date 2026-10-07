import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { canTransitionCustodyStatus } from "../domain/custody-request-policy.js";
import { calculateRetentionDeadline, retentionConfigKeyForCategory, retentionFallbacks } from "../domain/warehouse-policy.js";
import type { AcceptCustodyRequestInput, CancelCustodyRequestInput, CreateCustodyRequestInput, IntakeCustodyRequestInput, ListCustodyRequestsQuery, RejectCustodyRequestInput } from "./custody-request.dto.js";
import type { CustodyRequestLock, CustodyRequestRepository } from "./custody-request.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";
import { custodyNotifications, type CustodyNotifications } from "./custody-notifications.js";
import { custodyFingerprint } from "./custody-fingerprint.js";
import { intakeFingerprint, prepareIntakeEvidence, serializeWarehouseImage, validateIntakeEvidence } from "./intake-evidence.js";

const clean = (value: string | null | undefined) => value?.trim() || null;
export interface CustodyRequestDependencies extends CustodyNotifications {
  custodyRequestRepository: CustodyRequestRepository;
  warehouseRepository: WarehouseRepository;
  withTransaction: TransactionRunner;
  id: () => string;
}

export function createCustodyRequestUseCases(options: CustodyRequestDependencies) {
  const { custodyRequestRepository: repo, warehouseRepository: warehouse, withTransaction, id } = options;
  const notifications = custodyNotifications(options, repo);
  async function staff(actorId: string) {
    if (!await repo.isStaff(actorId)) throw new AppError("forbidden", "Chỉ Staff/Admin được thực hiện thao tác này");
  }
  async function photoSource(request: Pick<CustodyRequestLock, "postId" | "claimId" | "roomId" | "requesterId" | "intakeType">, db?: TransactionContext) {
    if (request.postId || !request.claimId || !request.roomId || request.intakeType !== "CUSTODY_TRANSFER") return null;
    return repo.findPhotoSource(request.claimId, request.requesterId, request.roomId, db);
  }
  async function eligible(request: CustodyRequestLock, db: TransactionContext) {
    return request.postId
      ? await repo.lockEligiblePost(request.postId, request.requesterId, db)
        && (!request.claimId || await repo.validateClaimLink(request.postId, request.requesterId, request.claimId, request.roomId, db))
      : Boolean(await photoSource(request, db));
  }
  return {
    async listRequests(query: ListCustodyRequestsQuery, actorId: string) {
      await staff(actorId);
      const [counts, list] = await Promise.all([repo.countByStatus(), repo.listRequests(query)]);
      return { counts, ...list, page: query.page, pageSize: query.pageSize };
    },
    async getRequest(requestId: string, actorId: string) {
      const request = await repo.findById(requestId);
      if (!request || (request.requester.id !== actorId && !await repo.isStaff(actorId))) {
        throw new AppError("not_found", "Không tìm thấy yêu cầu custody");
      }
      return { request, audit: await repo.listAudit(requestId) };
    },
    async getIntakeContext(requestId: string, actorId: string) {
      await staff(actorId);
      const request = await repo.findById(requestId);
      const photo = request ? await photoSource({ ...request, requesterId: request.requester.id }) : null;
      const post = request?.postId ? await warehouse.getPostInfoForIntake(request.postId) : photo?.post;
      if (!request || !post || post.finderUserId !== request.requester.id) throw new AppError("conflict", "Yêu cầu cần kiểm tra lại nguồn vật phẩm hoặc ảnh đối chiếu của Finder");
      return { request, post, images: (photo ? [photo.image] : await warehouse.listSourceImages(request.postId!)).map(serializeWarehouseImage) };
    },
    async getMyRequestByPost(postId: string, actorId: string) {
      const post = await warehouse.getPostInfoForIntake(postId);
      if (!post || post.finderUserId !== actorId) return { request: null, warehouseItem: null };
      return { request: await repo.findActiveByPostId(postId, actorId), warehouseItem: await warehouse.findItemByPostId(postId) };
    },
    async createRequest(input: CreateCustodyRequestInput, actorId: string) {
      if (!input.postId || input.intakeType === "WALK_IN" || (input.roomId && !input.claimId)) {
        throw new AppError("bad_request", "Cần bài FOUND hợp lệ; walk-in dùng luồng tiếp nhận của Staff");
      }
      const postId = input.postId;
      // An actor-scoped replay remains valid after the original lifecycle completes.
      const completedReplay = input.idempotencyKey ? await repo.findByIdempotencyKey(input.idempotencyKey, actorId) : null;
      if (completedReplay) {
        const savedHash = completedReplay.requestHash ?? custodyFingerprint({ ...completedReplay, handoverPointId: completedReplay.handoverPoint?.id });
        if (savedHash !== custodyFingerprint(input)) throw new AppError("conflict", "Idempotency key đã dùng với nội dung khác");
        return { request: completedReplay, idempotent: true };
      }
      const result = await withTransaction(async db => {
        // All entry points serialize requests against the physical FOUND post.
        if (!await repo.lockEligiblePost(postId, actorId, db)) throw new AppError("forbidden", "Bạn không sở hữu bài FOUND đang hoạt động");
        if (input.claimId && !await repo.validateClaimLink(postId, actorId, input.claimId, input.roomId ?? null, db)) {
          throw new AppError("bad_request", "Claim/phòng trao đổi không thuộc vật phẩm và Finder này");
        }
        const replay = input.idempotencyKey ? await repo.findByIdempotencyKey(input.idempotencyKey, actorId, db) : null;
        if (replay) {
          const savedHash = replay.requestHash ?? custodyFingerprint({ ...replay, handoverPointId: replay.handoverPoint?.id });
          if (savedHash !== custodyFingerprint(input)) {
            throw new AppError("conflict", "Idempotency key đã dùng với nội dung khác");
          }
          return { request: replay, idempotent: true, deliveries: [] };
        }
        const existing = await repo.findActiveByPostId(postId, actorId, db);
        if (existing) return { request: existing, idempotent: true, deliveries: [] };
        if (await repo.hasWarehouseItem(postId, db)) throw new AppError("conflict", "Vật phẩm đã được tiếp nhận; không thể yêu cầu lần nữa");
        if (!input.handoverPointId || !await warehouse.findHandoverPointById(input.handoverPointId)) throw new AppError("bad_request", "Cần điểm bàn giao đang hoạt động");
        const requestId = id();
        await repo.createRequest({ ...input, id: requestId, postId, requesterId: actorId, intakeType: "CUSTODY_TRANSFER", reason: clean(input.reason) }, db);
        await repo.writeAudit({ id: id(), custodyRequestId: requestId, actorId, action: "CREATED", fromStatus: null, toStatus: "PENDING" }, db);
        const deliveries = await notifications.record({ id: requestId, postId, claimId: input.claimId ?? null, requesterId: actorId, event: "CREATED" }, db);
        const request = await repo.findById(requestId, db);
        if (!request) throw new AppError("internal", "Không thể đọc yêu cầu vừa tạo");
        return { request, idempotent: false, deliveries };
      });
      await notifications.publish(result.deliveries);
      return { request: result.request, idempotent: result.idempotent };
    },
    async acceptRequest(requestId: string, input: AcceptCustodyRequestInput, actorId: string) {
      await staff(actorId);
      if (!await warehouse.findHandoverPointById(input.handoverPointId)) throw new AppError("bad_request", "Điểm bàn giao không hoạt động");
      const deliveries = await withTransaction(async db => {
        const lock = await repo.lockForUpdate(requestId, db);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu");
        if (!await eligible(lock, db)) {
          throw new AppError("conflict", "Hồ sơ custody cần kiểm tra lại nguồn vật phẩm hoặc ảnh đối chiếu trước khi duyệt");
        }
        if (lock.status === "ACCEPTED") {
          const current = await repo.findById(requestId, db);
          if (lock.handoverPointId !== input.handoverPointId || current?.confirmedHandoverAt !== (input.confirmedHandoverAt?.toISOString() ?? null)) throw new AppError("conflict", "Yêu cầu đã duyệt với lịch khác");
          return [];
        }
        if (!canTransitionCustodyStatus(lock.status, "ACCEPTED")) throw new AppError("conflict", "Yêu cầu không còn chờ duyệt");
        await repo.updateStatus(requestId, { status: "ACCEPTED", handlerId: actorId, handoverPointId: input.handoverPointId, confirmedHandoverAt: input.confirmedHandoverAt ?? null }, db);
        await repo.writeAudit({ id: id(), custodyRequestId: requestId, actorId, action: "ACCEPTED", fromStatus: lock.status, toStatus: "ACCEPTED", metadata: { note: clean(input.reason) } }, db);
        return notifications.record({ id: requestId, postId: lock.postId, claimId: lock.claimId, requesterId: lock.requesterId, event: "ACCEPTED" }, db);
      });
      await notifications.publish(deliveries);
      return repo.findById(requestId);
    },
    async rejectRequest(requestId: string, input: RejectCustodyRequestInput, actorId: string) {
      await staff(actorId);
      if (!clean(input.reason)) throw new AppError("bad_request", "Cần lý do từ chối");
      return close(requestId, "REJECTED", input.reason, actorId);
    },
    async cancelRequest(requestId: string, input: CancelCustodyRequestInput, actorId: string) {
      if (!clean(input.reason)) throw new AppError("bad_request", "Cần lý do hủy yêu cầu");
      return close(requestId, "CANCELLED", input.reason, actorId);
    },
    async confirmIntake(requestId: string, input: IntakeCustodyRequestInput, actorId: string) {
      await staff(actorId);
      validateIntakeEvidence(input);
      const payload = intakeFingerprint({ ...input, accessories: input.accessories.trim(), intakeImageIds: [...input.intakeImageIds].sort(), confirmedHandoverAt: input.confirmedHandoverAt?.toISOString() ?? null });
      const receivedAt = input.confirmedHandoverAt ?? new Date();
      if (!Number.isFinite(receivedAt.getTime()) || receivedAt.getTime() > Date.now()) throw new AppError("bad_request", "Thời gian tiếp nhận không được ở tương lai");
      if (!clean(input.conditionNotes)) throw new AppError("bad_request", "Cần tình trạng vật phẩm");
      const deliveries = await withTransaction(async db => {
        const lock = await repo.lockForUpdate(requestId, db);
        if (!lock) throw new AppError("not_found", "Không tìm thấy yêu cầu");
        if (lock.status === "INTAKED" && lock.warehouseItemId) {
          const replay = await prepareIntakeEvidence(warehouse, input, actorId, requestId, payload, db);
          if (replay !== lock.warehouseItemId) throw new AppError("conflict", "Yêu cầu đã được tiếp nhận bằng phiên khác");
          return [];
        }
        if (!canTransitionCustodyStatus(lock.status, "INTAKED")) throw new AppError("conflict", "Yêu cầu không còn chờ tiếp nhận");
        if (!await eligible(lock, db)) throw new AppError("conflict", "Nguồn bàn giao hoặc ảnh đối chiếu của Finder không hợp lệ cho intake");
        if (lock.postId && await repo.hasWarehouseItem(lock.postId, db)) throw new AppError("conflict", "Vật phẩm đã có hồ sơ kho");
        if (!lock.postId && lock.claimId) {
          const existing = await repo.findActiveByClaimId(lock.claimId, db);
          if (existing && existing.id !== requestId) throw new AppError("conflict", "Cuộc trò chuyện đã có yêu cầu custody khác");
        }
        if (!lock.handoverPointId || !await warehouse.findHandoverPointById(lock.handoverPointId)) throw new AppError("conflict", "Điểm bàn giao không hoạt động");
        const photo = await photoSource(lock, db);
        const post = lock.postId ? await warehouse.getPostInfoForIntake(lock.postId, db) : photo?.post;
        if (!post || post.finderUserId !== lock.requesterId) throw new AppError("conflict", "Không tìm thấy vật phẩm của Finder");
        const replay = await prepareIntakeEvidence(warehouse, input, actorId, requestId, payload, db);
        if (replay) throw new AppError("conflict", "Phiên đối chiếu đã dùng cho vật phẩm khác");
        const categoryId = input.categoryId !== undefined ? input.categoryId : post.categoryId;
        const category = categoryId ? await warehouse.findCategoryNames(categoryId) : null;
        if (categoryId && !category) throw new AppError("bad_request", "Danh mục tiếp nhận không hợp lệ");
        let areaId = input.areaId !== undefined ? input.areaId : post.areaId;
        const buildingId = input.buildingId !== undefined ? input.buildingId : post.buildingId;
        if (buildingId) {
          const building = await warehouse.findBuildingById(buildingId);
          if (!building || (areaId && building.areaId !== areaId)) throw new AppError("bad_request", "Địa điểm không thuộc khu vực đã chọn");
          areaId = building.areaId;
        }
        if (areaId && !await warehouse.findAreaById(areaId)) throw new AppError("bad_request", "Khu vực tiếp nhận không hợp lệ");
        const key = retentionConfigKeyForCategory(category);
        const days = await warehouse.getConfigInt(key, retentionFallbacks[key]);
        const warehouseItemId = id();
        const storageCode = clean(input.storageCode) ?? await warehouse.generateNextStorageCode(db);
        await warehouse.createItem({ id: warehouseItemId, postId: lock.postId, handoverPointId: lock.handoverPointId,
          itemName: clean(input.itemName) ?? post.title, description: input.description !== undefined ? clean(input.description) : post.description, categoryId, areaId, buildingId,
          roomText: input.roomText !== undefined ? clean(input.roomText) : post.roomText, finderUserId: post.finderUserId,
          finderName: input.finderName !== undefined ? clean(input.finderName) : post.finderName, finderContact: input.finderContact !== undefined ? clean(input.finderContact) : post.finderContact,
          conditionNotes: input.conditionNotes.trim(), storageCode, receivedAt, retentionDeadline: calculateRetentionDeadline(receivedAt, days), createdBy: actorId }, db);
        await warehouse.createStorageLog({ id: id(), warehouseItemId, postId: lock.postId, handoverPointId: lock.handoverPointId, actorId,
          action: "RECEIVED", toStatus: "RECEIVED", conditionNotes: input.conditionNotes.trim(), storageCode, note: `Custody ${requestId}` }, db);
        await warehouse.completeIntakeSession({ id: input.intakeKey, itemId: warehouseItemId, requestPayload: payload,
          sourceSnapshot: photo ? { ...post, claimId: lock.claimId, roomId: lock.roomId, lostPostId: photo.lostPostId, contactPhotoId: photo.image.id } : post,
          quantity: input.receivedQuantity, accessories: input.accessories.trim() }, db);
        // Physical intake changes custody, never ownership or resolution.
        await repo.updateStatus(requestId, { status: "INTAKED", handlerId: actorId, warehouseItemId, confirmedHandoverAt: receivedAt }, db);
        await repo.writeAudit({ id: id(), custodyRequestId: requestId, actorId, action: "INTAKED", fromStatus: lock.status, toStatus: "INTAKED", metadata: { warehouseItemId, receivedAt: receivedAt.toISOString(), retentionDays: days } }, db);
        return notifications.record({ id: requestId, postId: lock.postId, claimId: lock.claimId, requesterId: lock.requesterId, event: "INTAKED" }, db);
      });
      await notifications.publish(deliveries);
      return repo.findById(requestId);
    }
  };

  async function close(requestId: string, status: "REJECTED" | "CANCELLED", reason: string | null | undefined, actorId: string) {
    const deliveries = await withTransaction(async db => {
      const lock = await repo.lockForUpdate(requestId, db);
      if (!lock || (lock.requesterId !== actorId && !await repo.isStaff(actorId, db))) throw new AppError("not_found", "Không tìm thấy yêu cầu");
      if (lock.status === status) return [];
      if (!canTransitionCustodyStatus(lock.status, status)) throw new AppError("conflict", "Không thể đóng yêu cầu đã tiếp nhận/kết thúc");
      await repo.updateStatus(requestId, { status, rejectionReason: clean(reason) }, db);
      if (lock.claimId) await repo.clearEscalation(lock.claimId, db);
      await repo.writeAudit({ id: id(), custodyRequestId: requestId, actorId, action: status, fromStatus: lock.status, toStatus: status, metadata: { reason: clean(reason) } }, db);
      return notifications.record({ id: requestId, postId: lock.postId, claimId: lock.claimId, requesterId: lock.requesterId, event: status }, db);
    });
    await notifications.publish(deliveries);
    return repo.findById(requestId);
  }
}
export type CustodyRequestUseCases = ReturnType<typeof createCustodyRequestUseCases>;
