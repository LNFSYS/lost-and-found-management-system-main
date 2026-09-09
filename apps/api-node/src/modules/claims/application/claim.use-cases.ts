import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { mediaContentType, validateImageUpload } from "../../../shared/domain/media.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import type { MatchingRepository } from "../../matching/application/index.js";
import type { NotificationRepository } from "../../notifications/application/index.js";
import { canUseRoom } from "../domain/claim-policy.js";
import type {
  ClaimDecisionInput,
  CreateClaimInput,
  CreateMessageInput,
  ListClaimsQuery,
  ListMessagesQuery,
  UploadEvidenceInput
} from "./claim.dto.js";
import type { ClaimRepository, ClaimStatus } from "./claim.repository.port.js";

function claimNotFound() {
  return new AppError("not_found", "Không tìm thấy yêu cầu xác minh");
}

export interface ClaimDependencies {
  claimRepository: ClaimRepository;
  matchingRepository: MatchingRepository;
  notificationRepository: NotificationRepository;
  withTransaction: TransactionRunner;
  id: () => string;
  mediaStorage: PrivateMediaStorage;
}
export function createClaimUseCases(options: ClaimDependencies) {
  const { claimRepository, matchingRepository, notificationRepository, withTransaction, id, mediaStorage } = options;

  type StoredClaim = NonNullable<Awaited<ReturnType<typeof claimRepository.findById>>>;

  function serializeClaim(claim: StoredClaim) {
    return {
      ...claim,
      claimant: { id: claim.claimant.id, fullName: claim.claimant.fullName },
      finder: { id: claim.finder.id, fullName: claim.finder.fullName }
    };
  }

  async function requireClaimParticipant(claimId: string, userId: string, requireRoom = false) {
    const claim = await claimRepository.findById(claimId);
    const participant = claim ? await claimRepository.findParticipant(claimId, userId) : null;
    if (!claim || !participant || (requireRoom && !canUseRoom(claim.status, participant.consentStatus))) throw claimNotFound();
    return { claim, participant };
  }

  async function openRoomIfNeeded(claimId: string, queryable: TransactionContext) {
    const existing = await claimRepository.findRoomByClaim(claimId, queryable);
    if (existing) return existing;
    return claimRepository.createRoom(claimId, queryable);
  }

  async function details(claimId: string, userId: string) {
    const { claim, participant } = await requireClaimParticipant(claimId, userId);
    return {
      ...serializeClaim(claim),
      participants: await claimRepository.listParticipants(claimId),
      room: claim.roomId ? { id: claim.roomId } : null,
      canSend: canUseRoom(claim.status, participant.consentStatus)
    };
  }

  const claimService = {
    async createClaim(claimantId: string, input: CreateClaimInput) {
      const result = await withTransaction(async (connection) => {
        if (input.requestKey) {
          const byKey = await claimRepository.findByRequestKey(claimantId, input.requestKey, connection);
          if (byKey) {
            if (byKey.lostPostId !== input.lostPostId || byKey.foundPostId !== input.foundPostId) {
              throw new AppError("conflict", "Idempotency-Key đã được sử dụng cho yêu cầu khác");
            }
            return { claim: byKey, idempotent: true };
          }
        }

        const suggestionThreshold = await matchingRepository.getConfigNumber("matching.suggestion_threshold", 0.6);
        const pair = await claimRepository.findMatchPairForUpdate(input.lostPostId, input.foundPostId, suggestionThreshold, connection);
        if (!pair) throw new AppError("conflict", "Hai bài đăng chưa có matching hợp lệ để tạo yêu cầu");
        if (pair.claimant_id !== claimantId) throw claimNotFound();
        if (pair.finder_id === claimantId) throw new AppError("conflict", "Bạn không thể yêu cầu xác minh bài đăng của chính mình");

        const existing = await claimRepository.findByPair(input.lostPostId, input.foundPostId, claimantId, connection);
        if (existing) {
          if (input.requestKey && existing.id) {
            const sameKey = await claimRepository.findByRequestKey(claimantId, input.requestKey, connection);
            if (sameKey) return { claim: sameKey, idempotent: true };
          }
          throw new AppError("conflict", "Bạn đã gửi yêu cầu cho cặp bài đăng này");
        }

        const claimId = id();
        await claimRepository.createClaim({
          id: claimId,
          lostPostId: input.lostPostId,
          foundPostId: input.foundPostId,
          claimantId,
          requestKey: input.requestKey,
          description: input.description,
          approximateLostAt: input.approximateLostAt,
          approximateLocation: input.approximateLocation
        }, connection);
        await claimRepository.addParticipant({ claimId, userId: claimantId, role: "CLAIMANT", consentStatus: "ACCEPTED" }, connection);
        await claimRepository.addParticipant({ claimId, userId: pair.finder_id, role: "FINDER", consentStatus: "PENDING" }, connection);
        await claimRepository.writeAudit({ claimId, actorId: claimantId, action: "CLAIM_CREATED", toStatus: "PENDING" }, connection);
        await notificationRepository.create({
          userId: pair.finder_id,
          type: "CLAIM_REQUEST_RECEIVED",
          title: "\u0042\u1ea1n v\u1eeba nh\u1eadn \u0111\u01b0\u1ee3c 1 y\u00eau c\u1ea7u trao \u0111\u1ed5i ri\u00eang",
          body: "M\u1edf m\u1ee5c Trao \u0111\u1ed5i ri\u00eang \u0111\u1ec3 xem v\u00e0 ph\u1ea3n h\u1ed3i y\u00eau c\u1ea7u.",
          entityType: "CLAIM",
          entityId: claimId,
          dedupeKey: `claim:${claimId}:request`
        }, connection);
        const claim = await claimRepository.findById(claimId, connection);
        if (!claim) throw new AppError("internal", "Không thể tạo yêu cầu xác minh");
        return { claim, idempotent: false };
      });

      return { ...await details(result.claim.id, claimantId), idempotent: result.idempotent };
    },

    async listClaims(userId: string, query: ListClaimsQuery = { page: 1, pageSize: 50 }) {
      const result = await claimRepository.listForUser(userId, query);
      const participants = await claimRepository.listParticipantsForClaims(result.items.map((claim) => claim.id));
      return {
        ...result,
        items: result.items.map((claim) => ({
          ...serializeClaim(claim),
          participants: participants.get(claim.id) ?? [],
          room: claim.roomId ? { id: claim.roomId } : null
        }))
      };
    },

    async getClaim(claimId: string, userId: string) {
      return details(claimId, userId);
    },

    async decide(claimId: string, finderId: string, input: ClaimDecisionInput) {
      const result = await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
        if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId) throw claimNotFound();

        if (input.decision === "ACCEPT" || input.decision === "REQUEST_MORE_INFO") {
          const nextStatus: ClaimStatus = input.decision === "ACCEPT" ? "CONVERSATION_OPEN" : "NEED_MORE_INFO";
          if (claim.finderDecision === "ACCEPTED" && claim.roomId && claim.status === nextStatus) return claim;
          if (!["PENDING", "NEED_MORE_INFO", "CONVERSATION_OPEN"].includes(claim.status)) {
            throw new AppError("conflict", "Yêu cầu này không còn chờ phản hồi");
          }
          await claimRepository.updateFinderParticipant(claimId, finderId, "ACCEPTED", connection);
          await claimRepository.updateFinderDecision({
            claimId,
            status: nextStatus,
            finderDecision: "ACCEPTED",
            note: input.note,
            acceptedAt: true
          }, connection);
          await openRoomIfNeeded(claimId, connection);
          await claimRepository.writeAudit({
            claimId,
            actorId: finderId,
            action: input.decision === "ACCEPT" ? "FINDER_ACCEPTED" : "MORE_INFO_REQUESTED",
            fromStatus: claim.status,
            toStatus: nextStatus,
            metadata: input.note ? { noteProvided: true } : undefined
          }, connection);
          if (input.decision === "ACCEPT") {
            await notificationRepository.create({
              userId: claim.claimantId,
              type: "CLAIM_ACCEPTED",
              title: "Y\u00eau c\u1ea7u trao \u0111\u1ed5i ri\u00eang \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn",
              body: "Finder \u0111\u00e3 x\u00e1c nh\u1eadn. Ph\u00f2ng trao \u0111\u1ed5i ri\u00eang \u0111\u00e3 m\u1edf \u0111\u1ec3 hai b\u00ean nh\u1eafn tin v\u00e0 chia s\u1ebb evidence.",
              entityType: "CLAIM",
              entityId: claimId,
              dedupeKey: `claim:${claimId}:accepted`
            }, connection);
          }
        } else {
          if (claim.status !== "PENDING" || claim.finderDecision !== "PENDING") throw new AppError("conflict", "Yêu cầu này không còn chờ phản hồi");
          await claimRepository.updateFinderParticipant(claimId, finderId, "DECLINED", connection);
          await claimRepository.updateFinderDecision({ claimId, status: "REJECTED", finderDecision: "DECLINED", note: input.note, rejectedAt: true }, connection);
          await claimRepository.writeAudit({ claimId, actorId: finderId, action: "FINDER_DECLINED", fromStatus: claim.status, toStatus: "REJECTED" }, connection);
        }
        return claimRepository.findById(claimId, connection);
      });

      if (!result) throw new AppError("internal", "Không thể cập nhật yêu cầu xác minh");
      return details(claimId, finderId);
    },

    async withdraw(claimId: string, claimantId: string) {
      await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        if (!claim || claim.claimantId !== claimantId) throw claimNotFound();
        const withdrawn = await claimRepository.withdrawClaim(claimId, claimantId, connection);
        if (!withdrawn) throw new AppError("conflict", "Yêu cầu này không thể rút ở trạng thái hiện tại");
        await claimRepository.writeAudit({ claimId, actorId: claimantId, action: "CLAIM_WITHDRAWN", fromStatus: claim.status, toStatus: "CANCELLED" }, connection);
      });
      return details(claimId, claimantId);
    },

    async getRoom(claimId: string, userId: string) {
      const { claim, participant } = await requireClaimParticipant(claimId, userId, true);
      const room = await claimRepository.findRoomByClaim(claimId);
      if (!room) throw new AppError("conflict", "Phòng trao đổi chưa được mở");
      return { id: room.id, claimId: claim.id, status: claim.status, participantRole: participant.role, createdAt: room.createdAt };
    },

    async listRooms(userId: string) {
      const claims = await claimRepository.listRoomsForUser(userId);
      return { items: claims.map((claim) => ({ id: claim.roomId, claimId: claim.id, status: claim.status, finder: serializeClaim(claim).finder, claimant: serializeClaim(claim).claimant, posts: claim.posts, updatedAt: claim.updatedAt })) };
    },

    async listMessages(claimId: string, userId: string, query: ListMessagesQuery) {
      const room = await this.getRoom(claimId, userId);
      return { room, ...(await claimRepository.listMessages(room.id, query)) };
    },

    async sendMessage(claimId: string, userId: string, input: CreateMessageInput) {
      const room = await this.getRoom(claimId, userId);
      const message = await withTransaction(async (connection) => {
        const lockedClaim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = lockedClaim ? await claimRepository.findParticipant(claimId, userId, connection) : null;
        const lockedRoom = lockedClaim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
        if (!lockedClaim || !lockedRoom || !participant || !canUseRoom(lockedClaim.status, participant.consentStatus) || lockedRoom.id !== room.id) throw claimNotFound();
        const created = await claimRepository.createMessage({ roomId: room.id, senderId: userId, content: input.content, clientMessageId: input.clientMessageId }, connection);
        if (!created) throw new AppError("internal", "Không thể gửi tin nhắn");
        await claimRepository.writeAudit({ claimId, actorId: userId, action: "MESSAGE_SENT" }, connection);
        return created;
      });
      return message;
    },

    async listEvidence(claimId: string, userId: string) {
      await requireClaimParticipant(claimId, userId, true);
      return { items: await claimRepository.listEvidence(claimId) };
    },

    async uploadEvidence(claimId: string, userId: string, input: UploadEvidenceInput, file: ImageUpload) {
      const image = validateImageUpload(file);
      const evidenceId = id();
      const storage = await mediaStorage.save(claimId, evidenceId, image.extension, file.buffer);
      try {
        await withTransaction(async (connection) => {
          const lockedClaim = await claimRepository.findByIdForUpdate(claimId, connection);
          const participant = lockedClaim ? await claimRepository.findParticipant(claimId, userId, connection) : null;
          const room = lockedClaim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
          if (!lockedClaim || !room || !participant || !canUseRoom(lockedClaim.status, participant.consentStatus)) throw claimNotFound();
          await claimRepository.createEvidence({
            id: evidenceId,
            claimId,
            uploadedBy: userId,
            secureUrl: storage.secureUrl,
            publicId: storage.publicId,
            mediaFormat: image.format,
            mediaBytes: image.bytes,
            description: input.description
          }, connection);
          await claimRepository.writeAudit({ claimId, actorId: userId, action: "PRIVATE_EVIDENCE_UPLOADED", metadata: { evidenceId, bytes: image.bytes } }, connection);
        });
      } catch (error) {
        await mediaStorage.remove(storage.secureUrl).catch(() => undefined);
        throw error;
      }
      const evidence = (await claimRepository.findEvidence(claimId, evidenceId));
      if (!evidence) throw new AppError("internal", "Không thể lưu evidence");
      const { secureUrl: _secureUrl, publicId: _publicId, ...safeEvidence } = evidence;
      return safeEvidence;
    },

    async getEvidenceFile(claimId: string, evidenceId: string, userId: string) {
      await requireClaimParticipant(claimId, userId, true);
      const evidence = await claimRepository.findEvidence(claimId, evidenceId);
      if (!evidence) throw new AppError("not_found", "Không tìm thấy evidence");
      const filePath = await mediaStorage.resolve(evidence.secureUrl);
      return { filePath, contentType: mediaContentType((evidence.mediaFormat ?? "jpg") as "jpg" | "png" | "webp") };
    }
  };
  return claimService;
}

export type ClaimUseCases = ReturnType<typeof createClaimUseCases>;
