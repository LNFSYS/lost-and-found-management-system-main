import type { Logger } from "../../../shared/application/logger.port.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import type { TransactionContext, TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import { validateImageUpload } from "../../../shared/domain/media.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import type { MatchingRepository } from "../../matching/application/index.js";
import type { NotificationRecord, NotificationRepository } from "../../notifications/application/index.js";
import { canSubmitVerificationDecision, canUseRoom, isAppointmentEligible } from "../domain/claim-policy.js";
import {
  findVerificationPrompt,
  normalizeVerificationPrompt,
  resolveVerificationTemplate,
  unsafeVerificationPromptReason,
  unsafeVerificationReasonReason
} from "../domain/verification-question-templates.js";
import type {
  AnswerVerificationQuestionInput,
  ClaimDecisionInput,
  CreateClaimInput,
  CreateMessageInput,
  ListClaimsQuery,
  ListMessagesQuery,
  SendVerificationQuestionInput,
  UploadEvidenceInput,
  VerificationDecisionInput
} from "./claim.dto.js";
import type { ClaimRepository, ClaimStatus } from "./claim.repository.port.js";

type WorkflowNotificationKind = "CLAIM" | "CHAT" | "APPOINTMENT" | "RETURN";

function claimNotFound() {
  return new AppError("not_found", "Không tìm thấy yêu cầu xác minh");
}

export interface ClaimDependencies {
  claimRepository: ClaimRepository;
  matchingRepository: MatchingRepository;
  notificationRepository: NotificationRepository;
  realtimeNotifier?: {
    publishNotification(input: {
      userId: string;
      notification: NotificationRecord;
      workflow: WorkflowNotificationKind;
      roomId?: string | null;
    }): { delivered: number } | Promise<{ delivered: number; }>;
  };
  withTransaction: TransactionRunner;
  id: () => string;
  mediaStorage: PrivateMediaStorage;
  logger: Logger;
  hashIdempotencyPayload: (value: string) => string;
}
export function createClaimUseCases(options: ClaimDependencies) {
  const {
    claimRepository, matchingRepository, notificationRepository, realtimeNotifier, withTransaction, id, mediaStorage,
    logger, hashIdempotencyPayload
  } = options;

  type StoredClaim = NonNullable<Awaited<ReturnType<typeof claimRepository.findById>>>;

  function serializeClaim(claim: StoredClaim) {
    return {
      ...claim,
      appointmentEligible: isAppointmentEligible(claim.status),
      conversationDecision: claim.finderDecision === "ACCEPTED" ? "OPEN_CONVERSATION" : claim.finderDecision,
      claimant: { id: claim.claimant.id, fullName: claim.claimant.fullName },
      finder: { id: claim.finder.id, fullName: claim.finder.fullName }
    };
  }

  function requestFingerprint(value: Record<string, unknown>) {
    return hashIdempotencyPayload(JSON.stringify(value));
  }

  function parseTemplateSignal(value: string) {
    const match = /^tpl:([^:]+):v(\d+):(.+)$/.exec(value);
    return match ? { templateId: match[1]!, templateVersion: Number(match[2]), promptKey: match[3]! } : null;
  }

  function publicAuditMetadata(metadata: Record<string, unknown> | null) {
    if (!metadata) return null;
    const {
      idempotencyKey: _idempotencyKey,
      requestFingerprint: _requestFingerprint,
      ...safe
    } = metadata;
    return safe;
  }

  function ensureIdempotentReplay(
    existing: Awaited<ReturnType<typeof claimRepository.findAuditByIdempotencyKey>>,
    fingerprint: string
  ) {
    if (!existing) return false;
    if (existing.metadata?.requestFingerprint !== fingerprint) {
      throw new AppError("conflict", "Idempotency-Key đã được sử dụng cho một yêu cầu khác");
    }
    return true;
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

  async function repairLegacyDirectClaim(claimId: string) {
    const claim = await claimRepository.findById(claimId);
    if (!claim || claim.lostPostId !== null || claim.status !== "PENDING") return;
    await withTransaction(async (connection) => {
      const lockedClaim = await claimRepository.findByIdForUpdate(claimId, connection);
      if (!lockedClaim || lockedClaim.lostPostId !== null || lockedClaim.status !== "PENDING") return;
      await claimRepository.updateFinderDecision({ claimId, status: "CONVERSATION_OPEN", finderDecision: "ACCEPTED" }, connection);
      await claimRepository.updateParticipantConsent(claimId, lockedClaim.claimantId, "ACCEPTED", connection);
      await claimRepository.updateParticipantConsent(claimId, lockedClaim.finderId, "ACCEPTED", connection);
      if (!await claimRepository.findRoomByClaim(claimId, connection)) await claimRepository.createRoom(claimId, connection);
    });
  }

  function counterpartId(claim: StoredClaim, userId: string) {
    if (claim.claimantId === userId) return claim.finderId;
    if (claim.finderId === userId) return claim.claimantId;
    return null;
  }

  async function publishWorkflowNotification(input: {
    userId: string | null;
    notification: NotificationRecord | null;
    workflow: WorkflowNotificationKind;
    roomId?: string | null;
  }) {
    if (!input.userId || !input.notification || !realtimeNotifier) return;
    await realtimeNotifier.publishNotification({
      userId: input.userId,
      notification: input.notification,
      workflow: input.workflow,
      roomId: input.roomId
    });
  }

  async function details(claimId: string, userId: string) {
    const { claim, participant } = await requireClaimParticipant(claimId, userId);
    const [participants, itemContext] = await Promise.all([
      claimRepository.listParticipants(claimId),
      claimRepository.findClaimItemContext(claimId)
    ]);
    const seesPrivateItemContext = userId === claim.finderId;
    const exactLocation = itemContext
      ? itemContext.handoverPointName ?? itemContext.customLocation ?? itemContext.buildingName ?? itemContext.roomText ?? itemContext.areaName
      : null;
    return {
      ...serializeClaim(claim),
      participants,
      room: claim.roomId ? { id: claim.roomId } : null,
      canSend: canUseRoom(claim.status, participant.consentStatus),
      item: itemContext ? {
        postId: itemContext.foundPostId,
        title: itemContext.title,
        categoryName: itemContext.categoryName,
        locationLabel: seesPrivateItemContext ? exactLocation : itemContext.areaName,
        imageUrl: itemContext.mediaId && (itemContext.visibilityMode === "PUBLIC" || seesPrivateItemContext)
          ? `/api/posts/${itemContext.foundPostId}/media/${itemContext.mediaId}`
          : null
      } : null
    };
  }

  async function verificationDetails(claimId: string, userId: string, queryable?: TransactionContext) {
    const claim = await claimRepository.findById(claimId, queryable);
    const participant = claim ? await claimRepository.findParticipant(claimId, userId, queryable) : null;
    if (!claim || !participant) throw claimNotFound();
    const [context, questions, history, room] = await Promise.all([
      claimRepository.findVerificationContext(claimId, queryable),
      claimRepository.listVerificationQuestions(claimId, queryable),
      claimRepository.listVerificationAuditEvents(claimId, queryable),
      claimRepository.findRoomByClaim(claimId, queryable)
    ]);
    if (!context) throw new AppError("internal", "Không thể xác định danh mục của vật phẩm");
    const template = resolveVerificationTemplate(context.categoryName, context.parentCategoryName);
    const answeredCount = questions.filter((question) => question.answer !== null).length;
    const matchedCount = questions.filter((question) => question.answer?.isMatch === true).length;
    return {
      claimId,
      status: claim.status,
      appointmentEligible: isAppointmentEligible(claim.status),
      participantRole: participant.role,
      roomEscalation: room?.escalatedAt ? {
        escalatedAt: room.escalatedAt,
        escalatedBy: room.escalatedBy,
        reason: room.escalationReason
      } : null,
      policy: {
        templateId: template.id,
        templateVersion: template.version,
        minimumAnswers: template.minimumAnswers,
        answeredCount,
        readyForDecision: answeredCount >= template.minimumAnswers
      },
      questions: questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        questionType: question.questionType,
        privacyLevel: question.privacyLevel,
        status: question.status,
        assignedAt: question.assignedAt,
        template: parseTemplateSignal(question.sourceSignal),
        answer: question.answer ? {
          answered: true,
          attemptCount: question.answer.attemptCount,
          answeredAt: question.answer.answeredAt
        } : null
      })),
      history: history.map((event) => {
        const metadata = publicAuditMetadata(event.metadata);
        return {
          id: event.id,
          actorId: event.actorId,
          action: event.action,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          metadata,
          createdAt: event.createdAt
        };
      })
    };
  }

  const claimService = {
    async createClaim(requesterId: string, input: CreateClaimInput) {
      const result = await withTransaction(async (connection) => {
        const requestedPostId = input.postId ?? input.foundPostId;
        if (!requestedPostId) throw new AppError("invalid_input", "Cần chọn một bài viết để claim");

        if (input.requestKey) {
          const byKey = await claimRepository.findByRequestKey(requesterId, input.requestKey, connection);
          if (byKey) {
            if (byKey.foundPostId !== requestedPostId || (input.lostPostId && byKey.lostPostId !== input.lostPostId)) {
              throw new AppError("conflict", "Idempotency-Key đã được sử dụng cho yêu cầu khác");
            }
            return { claim: byKey, idempotent: true };
          }
        }

        let lostPostId: string | undefined;
        let foundPostId: string;
        let claimClaimantId: string;
        let finderId: string;

        if (input.postId) {
          const post = await claimRepository.findClaimablePostForUpdate(input.postId, connection);
          if (!post) throw new AppError("conflict", "Bài viết không còn mở để claim");
          foundPostId = post.id;
          if (post.type === "LOST") {
            claimClaimantId = post.ownerId;
            finderId = requesterId;
          } else {
            claimClaimantId = requesterId;
            finderId = post.ownerId;
          }
        } else {
          if (!input.lostPostId || !input.foundPostId) {
            throw new AppError("invalid_input", "Cần đầy đủ cặp bài viết matching");
          }
          const suggestionThreshold = await matchingRepository.getConfigNumber("matching.suggestion_threshold", 0.6);
          const pair = await claimRepository.findMatchPairForUpdate(input.lostPostId, input.foundPostId, suggestionThreshold, connection);
          if (!pair) throw new AppError("conflict", "Hai bài đăng chưa có matching hợp lệ để tạo claim");
          if (pair.claimant_id !== requesterId) throw claimNotFound();
          lostPostId = pair.lost_post_id;
          foundPostId = pair.found_post_id;
          claimClaimantId = pair.claimant_id;
          finderId = pair.finder_id;
        }

        // Chỉ check self-claim khi claim từ matching pair (không phải từ /posts)
        if (finderId === claimClaimantId) throw new AppError("conflict", "Bạn không thể tạo conversation với chính mình");

        const existing = await claimRepository.findByFoundPostForClaimant(foundPostId, claimClaimantId, connection);
        if (existing) {
          if (input.postId && existing.status === "PENDING") {
            await claimRepository.updateFinderDecision({
              claimId: existing.id,
              status: "CONVERSATION_OPEN",
              finderDecision: "ACCEPTED"
            }, connection);
            await claimRepository.updateParticipantConsent(existing.id, existing.claimantId, "ACCEPTED", connection);
            await claimRepository.updateParticipantConsent(existing.id, existing.finderId, "ACCEPTED", connection);
            if (!await claimRepository.findRoomByClaim(existing.id, connection)) {
              await claimRepository.createRoom(existing.id, connection);
            }
          }
          return { claim: existing, idempotent: true };
        }

        const claimId = id();
        await claimRepository.createClaim({
          id: claimId,
          lostPostId,
          foundPostId,
          claimantId: claimClaimantId,
          status: input.postId ? "CONVERSATION_OPEN" : "PENDING",
          finderDecision: input.postId ? "ACCEPTED" : "PENDING",
          requestKey: input.requestKey,
          description: input.description,
          approximateLostAt: input.approximateLostAt,
          approximateLocation: input.approximateLocation
        }, connection);
        await claimRepository.addParticipant({ claimId, userId: claimClaimantId, role: "CLAIMANT", consentStatus: "ACCEPTED" }, connection);
        await claimRepository.addParticipant({ claimId, userId: finderId, role: "FINDER", consentStatus: input.postId ? "ACCEPTED" : "PENDING" }, connection);
        if (input.postId) await claimRepository.createRoom(claimId, connection);
        const toStatus = input.postId ? "CONVERSATION_OPEN" : "PENDING";
        await claimRepository.writeAudit({ claimId, actorId: requesterId, action: "CLAIM_CREATED", toStatus }, connection);
        const notification = await notificationRepository.create({
          userId: claimClaimantId === requesterId ? finderId : claimClaimantId,
          type: "CLAIM_REQUEST_RECEIVED",
          title: "Bạn có một cuộc trao đổi riêng mới",
          body: "Có người vừa claim bài viết và đã có thể nhắn tin trực tiếp với bạn trong mục Trao đổi riêng.",
          entityType: "CLAIM",
          entityId: claimId,
          dedupeKey: `claim:${claimId}:conversation`
        }, connection);
        const claim = await claimRepository.findById(claimId, connection);
        if (!claim) throw new AppError("internal", "Không thể tạo yêu cầu xác minh");
        return { claim, idempotent: false, notification, notificationUserId: claimClaimantId === requesterId ? finderId : claimClaimantId };
      });

      await publishWorkflowNotification({
        userId: "notificationUserId" in result ? (result.notificationUserId ?? null) : null,
        notification: "notification" in result ? (result.notification ?? null) : null,
        workflow: "CLAIM"
      });
      return { ...await details(result.claim.id, requesterId), idempotent: result.idempotent };
    },

    async listClaims(userId: string, query: ListClaimsQuery = { page: 1, pageSize: 50 }) {
      const result = await claimRepository.listForUser(userId, query);
      const claimIds = result.items.map((claim) => claim.id);
      const [participants, conversations] = await Promise.all([
        claimRepository.listParticipantsForClaims(claimIds),
        claimRepository.listConversationSummaries(claimIds, userId)
      ]);
      return {
        ...result,
        items: result.items.map((claim) => ({
          ...serializeClaim(claim),
          participants: participants.get(claim.id) ?? [],
          room: claim.roomId ? { id: claim.roomId } : null,
          conversation: conversations.get(claim.id) ?? { lastMessage: null, lastMessageAt: null, unreadCount: 0, custodyEscalated: false }
        }))
      };
    },

    async getClaim(claimId: string, userId: string) {
      await repairLegacyDirectClaim(claimId);
      return details(claimId, userId);
    },

    async getVerificationTemplates(claimId: string, finderId: string) {
      await repairLegacyDirectClaim(claimId);
      const claim = await claimRepository.findById(claimId);
      const participant = claim ? await claimRepository.findParticipant(claimId, finderId) : null;
      const denialReason = !claim
        ? "CLAIM_NOT_FOUND"
        : !participant
          ? "PARTICIPANT_NOT_FOUND"
          : participant.role !== "FINDER"
            ? `ROLE_${participant.role}`
            : claim.finderId !== finderId
              ? "FINDER_ID_MISMATCH"
              : !canUseRoom(claim.status, participant.consentStatus)
                ? `ROOM_NOT_AVAILABLE_${claim.status}_${participant.consentStatus}`
                : null;
      if (denialReason) {
        logger.warn(`[claims] verification templates denied ${JSON.stringify({
          claimId,
          userId: finderId,
          reason: denialReason,
          claimFinderId: claim?.finderId ?? null,
          claimClaimantId: claim?.claimantId ?? null,
          claimStatus: claim?.status ?? null,
          participantRole: participant?.role ?? null,
          participantConsent: participant?.consentStatus ?? null
        })}`);
        throw claimNotFound();
      }
      const context = await claimRepository.findVerificationContext(claimId);
      if (!context) throw new AppError("internal", "Không thể xác định danh mục của vật phẩm");
      const template = resolveVerificationTemplate(context.categoryName, context.parentCategoryName);
      return {
        category: context.categoryName,
        template: {
          id: template.id,
          version: template.version,
          minimumAnswers: template.minimumAnswers,
          prompts: template.prompts,
          customFollowUpAllowed: true
        }
      };
    },

    async getVerification(claimId: string, userId: string) {
      await repairLegacyDirectClaim(claimId);
      return verificationDetails(claimId, userId);
    },

    async sendVerificationQuestion(claimId: string, finderId: string, input: SendVerificationQuestionInput) {
      const prompt = normalizeVerificationPrompt(input.prompt);
      const unsafeReason = unsafeVerificationPromptReason(prompt);
      if (unsafeReason) throw new AppError("invalid_input", unsafeReason);
      const fingerprint = requestFingerprint({
        operation: "SEND_VERIFICATION_QUESTION",
        templateId: input.templateId,
        templateVersion: input.templateVersion,
        promptKey: input.promptKey,
        prompt
      });

      await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
        const room = claim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
        if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId
          || !canUseRoom(claim.status, participant.consentStatus)) throw claimNotFound();

        const existing = await claimRepository.findAuditByIdempotencyKey(claimId, finderId, input.idempotencyKey, connection);
        if (ensureIdempotentReplay(existing, fingerprint)) return;
        if (!canSubmitVerificationDecision(claim.status)) {
          throw new AppError("conflict", "Claim không còn ở trạng thái có thể gửi câu hỏi xác minh");
        }

        const context = await claimRepository.findVerificationContext(claimId, connection);
        if (!context) throw new AppError("internal", "Không thể xác định danh mục của vật phẩm");
        const categoryTemplate = resolveVerificationTemplate(context.categoryName, context.parentCategoryName);
        if (categoryTemplate.id !== input.templateId || categoryTemplate.version !== input.templateVersion) {
          throw new AppError("conflict", "Phiên bản bộ câu hỏi không còn phù hợp với danh mục hiện tại");
        }

        let questionType: "TEXT" | "MASKED_SERIAL" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL" = "TEXT";
        let privacyLevel: "PRIVATE" | "HIGHLY_PRIVATE" = "HIGHLY_PRIVATE";
        if (input.promptKey !== "custom") {
          const selected = findVerificationPrompt(input.templateId, input.templateVersion, input.promptKey);
          if (!selected || selected.template.id !== categoryTemplate.id) {
            throw new AppError("invalid_input", "Câu hỏi không thuộc bộ câu hỏi đang áp dụng");
          }
          questionType = selected.prompt.questionType;
          privacyLevel = selected.prompt.privacyLevel;
        }

        const questionId = id();
        await claimRepository.createVerificationQuestion({
          id: questionId,
          postId: context.foundPostId,
          prompt,
          questionType,
          sourceSignal: `tpl:${input.templateId}:v${input.templateVersion}:${input.promptKey}`,
          expectedAnswerHash: null,
          privacyLevel,
          createdBy: finderId
        }, connection);
        await claimRepository.assignVerificationQuestion(claimId, questionId, connection);
        
        if (room) {
          const messageContent = `🔍 Câu hỏi xác minh:\n${prompt}`;
          await claimRepository.createMessage({ 
            roomId: room.id, 
            senderId: finderId,
            content: messageContent,
            clientMessageId: `verification-question-${questionId}-${Date.now()}`
          }, connection);
        }
        
        await claimRepository.writeAudit({
          eventId: id(),
          claimId,
          actorId: finderId,
          action: "QUESTION_SENT",
          fromStatus: claim.status,
          toStatus: claim.status,
          metadata: {
            questionId,
            templateId: input.templateId,
            templateVersion: input.templateVersion,
            promptKey: input.promptKey,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint
          }
        }, connection);
      });
      return verificationDetails(claimId, finderId);
    },

    async answerVerificationQuestion(
      claimId: string,
      questionId: string,
      claimantId: string,
      input: AnswerVerificationQuestionInput
    ) {
      const answer = input.answer.trim();
      if (!answer || answer.length > 500) throw new AppError("invalid_input", "Câu trả lời phải có từ 1 đến 500 ký tự");
      const fingerprint = requestFingerprint({ operation: "ANSWER_VERIFICATION_QUESTION", questionId, answer });

      await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = claim ? await claimRepository.findParticipant(claimId, claimantId, connection) : null;
        const room = claim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
        if (!claim || !participant || participant.role !== "CLAIMANT" || claim.claimantId !== claimantId
          || !canUseRoom(claim.status, participant.consentStatus)) throw claimNotFound();
        const existing = await claimRepository.findAuditByIdempotencyKey(claimId, claimantId, input.idempotencyKey, connection);
        if (ensureIdempotentReplay(existing, fingerprint)) return;
        if (!canSubmitVerificationDecision(claim.status)) {
          throw new AppError("conflict", "Claim không còn nhận câu trả lời xác minh");
        }
        const question = await claimRepository.findVerificationQuestion(claimId, questionId, connection);
        if (!question || question.status === "DISABLED") throw new AppError("conflict", "Câu hỏi không còn hiệu lực");
        if ((question.answer?.attemptCount ?? 0) >= 3) {
          throw new AppError("conflict", "Câu hỏi đã đạt giới hạn số lần trả lời");
        }
        await claimRepository.saveVerificationAnswer({ id: id(), claimId, questionId, answeredBy: claimantId, isMatch: null }, connection);
        
        if (room) {
          const messageContent = `🔍 Câu hỏi xác minh:\n${question.prompt}\n\n✏️ Câu trả lời: ${answer}`;
          await claimRepository.createMessage({ 
            roomId: room.id, 
            senderId: claimantId,
            content: messageContent,
            clientMessageId: `verification-answer-${questionId}-${Date.now()}`
          }, connection);
        }
        
        await claimRepository.writeAudit({
          eventId: id(),
          claimId,
          actorId: claimantId,
          action: "ANSWER_SUBMITTED",
          fromStatus: claim.status,
          toStatus: claim.status,
          metadata: {
            questionId,
            attempt: (question.answer?.attemptCount ?? 0) + 1,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint
          }
        }, connection);
      });
      return verificationDetails(claimId, claimantId);
    },

    async decideVerification(claimId: string, finderId: string, input: VerificationDecisionInput) {
      const unsafeReason = unsafeVerificationReasonReason(input.reason);
      if (unsafeReason) throw new AppError("invalid_input", unsafeReason);
      const fingerprint = requestFingerprint({
        operation: "VERIFICATION_DECISION",
        decision: input.decision,
        reason: input.reason,
        correctsEventId: input.correctsEventId ?? null
      });

      let decisionMessage: Awaited<ReturnType<typeof claimRepository.createMessage>> = null;
      await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
        const room = claim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
        if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId) throw claimNotFound();
        const existing = await claimRepository.findAuditByIdempotencyKey(claimId, finderId, input.idempotencyKey, connection);
        if (ensureIdempotentReplay(existing, fingerprint)) return;

        const history = await claimRepository.listVerificationAuditEvents(claimId, connection);
        const finalActions = new Set(["VERIFICATION_ACCEPTED", "VERIFICATION_DECLINED", "CUSTODY_ESCALATED", "VERIFICATION_DECISION_CORRECTED"]);
        const latestDecision = [...history].reverse().find((event) => finalActions.has(event.action));
        const isCorrection = Boolean(input.correctsEventId);
        if (isCorrection) {
          if (!latestDecision || latestDecision.id !== input.correctsEventId || !["ACCEPTED", "REJECTED"].includes(claim.status)) {
            throw new AppError("conflict", "Chỉ có thể sửa quyết định xác minh mới nhất");
          }
          if (await claimRepository.hasActiveAppointment(claimId, connection)) {
            throw new AppError("conflict", "Không thể sửa quyết định khi claim đã có lịch hẹn đang hoạt động");
          }
        } else if (!canSubmitVerificationDecision(claim.status)) {
          throw new AppError("conflict", "Claim không còn chờ quyết định xác minh");
        }

        const context = await claimRepository.findVerificationContext(claimId, connection);
        if (!context) throw new AppError("internal", "Không thể xác định danh mục của vật phẩm");
        const template = resolveVerificationTemplate(context.categoryName, context.parentCategoryName);
        const questions = await claimRepository.listVerificationQuestions(claimId, connection);
        const answeredCount = questions.filter((question) => question.answer).length;
        if (input.decision === "VERIFY_FOR_MEETUP" && answeredCount < template.minimumAnswers) {
          throw new AppError("conflict", "Cần đủ số câu trả lời xác minh trước khi đề xuất gặp mặt");
        }

        const nextStatus: ClaimStatus = input.decision === "VERIFY_FOR_MEETUP"
          ? "ACCEPTED"
          : input.decision === "REQUEST_MORE_INFO"
            ? "NEED_MORE_INFO"
            : "REJECTED";
        const finderDecision = input.decision === "DECLINE" ? "DECLINED" : "ACCEPTED";
        await claimRepository.updateFinderDecision({
          claimId,
          status: nextStatus,
          finderDecision,
          note: input.reason,
          acceptedAt: input.decision === "VERIFY_FOR_MEETUP",
          rejectedAt: input.decision === "DECLINE" || input.decision === "ESCALATE_TO_CUSTODY"
        }, connection);
        if (input.decision === "ESCALATE_TO_CUSTODY") {
          await claimRepository.markRoomEscalated({ claimId, actorId: finderId, reason: input.reason }, connection);
        } else if (isCorrection) {
          await claimRepository.clearRoomEscalation(claimId, connection);
        }

        const action = isCorrection
          ? "VERIFICATION_DECISION_CORRECTED"
          : input.decision === "VERIFY_FOR_MEETUP" ? "VERIFICATION_ACCEPTED"
            : input.decision === "DECLINE" ? "VERIFICATION_DECLINED"
              : input.decision === "ESCALATE_TO_CUSTODY" ? "CUSTODY_ESCALATED"
                : "MORE_INFO_REQUESTED";
        await claimRepository.writeAudit({
          eventId: id(),
          claimId,
          actorId: finderId,
          action,
          fromStatus: claim.status,
          toStatus: nextStatus,
          metadata: {
            decision: input.decision,
            reason: input.reason,
            answeredCount,
            minimumAnswers: template.minimumAnswers,
            appointmentEligible: isAppointmentEligible(nextStatus),
            correctsEventId: input.correctsEventId ?? null,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint
          }
        }, connection);
        const decisionLabel = input.decision === "VERIFY_FOR_MEETUP" ? "Đề xuất gặp mặt"
          : input.decision === "REQUEST_MORE_INFO" ? "Yêu cầu thêm thông tin"
            : input.decision === "DECLINE" ? "Từ chối claim" : "Chuyển sang custody";
        if (room) {
          decisionMessage = await claimRepository.createMessage({
            roomId: room.id,
            senderId: finderId,
            content: `⚖️ ${isCorrection ? "Finder đã điều chỉnh quyết định" : "Finder đã chọn quyết định"}: ${decisionLabel}`,
            clientMessageId: `verification-decision-${input.idempotencyKey}`
          }, connection);
        }
      });
      return {
        claim: await details(claimId, finderId),
        verification: await verificationDetails(claimId, finderId),
        message: decisionMessage
      };
    },

    async decide(claimId: string, finderId: string, input: ClaimDecisionInput) {
      if (!input.idempotencyKey) throw new AppError("invalid_input", "Thiếu Idempotency-Key cho quyết định mở conversation");
      if (!input.note?.trim()) throw new AppError("invalid_input", "Cần nhập lý do cho quyết định");
      const unsafeReason = unsafeVerificationReasonReason(input.note);
      if (unsafeReason) throw new AppError("invalid_input", unsafeReason);
      const fingerprint = requestFingerprint({ operation: "OPEN_CONVERSATION_DECISION", decision: input.decision, note: input.note });
      const result = await withTransaction(async (connection) => {
        let notification: NotificationRecord | null = null;
        let notificationUserId: string | null = null;
        let roomId: string | null = null;
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
        if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId) throw claimNotFound();

        const existing = await claimRepository.findAuditByIdempotencyKey(claimId, finderId, input.idempotencyKey!, connection);
        if (ensureIdempotentReplay(existing, fingerprint)) {
          return { claim, notification, notificationUserId, roomId: claim.roomId };
        }
        if (claim.status !== "PENDING" || claim.finderDecision !== "PENDING") {
          throw new AppError("conflict", "Yêu cầu này không còn chờ phản hồi mở conversation");
        }

        if (input.decision === "ACCEPT" || input.decision === "REQUEST_MORE_INFO") {
          const nextStatus: ClaimStatus = input.decision === "ACCEPT" ? "CONVERSATION_OPEN" : "NEED_MORE_INFO";
          await claimRepository.updateFinderParticipant(claimId, finderId, "ACCEPTED", connection);
          await claimRepository.updateFinderDecision({
            claimId,
            status: nextStatus,
            finderDecision: "ACCEPTED",
            note: input.note
          }, connection);
          const room = await openRoomIfNeeded(claimId, connection);
          roomId = room.id;
          await claimRepository.writeAudit({
            claimId,
            actorId: finderId,
            action: input.decision === "ACCEPT" ? "CONVERSATION_OPENED" : "MORE_INFO_REQUESTED",
            fromStatus: claim.status,
            toStatus: nextStatus,
            metadata: {
              semanticAction: input.decision === "ACCEPT" ? "ACCEPT / OPEN_CONVERSATION" : input.decision,
              reason: input.note,
              idempotencyKey: input.idempotencyKey,
              requestFingerprint: fingerprint
            }
          }, connection);
          if (input.decision === "ACCEPT") {
            notification = await notificationRepository.create({
              userId: claim.claimantId,
              type: "CLAIM_ACCEPTED",
              title: "Y\u00eau c\u1ea7u trao \u0111\u1ed5i ri\u00eang \u0111\u00e3 \u0111\u01b0\u1ee3c x\u00e1c nh\u1eadn",
              body: "Finder \u0111\u00e3 x\u00e1c nh\u1eadn. Ph\u00f2ng trao \u0111\u1ed5i ri\u00eang \u0111\u00e3 m\u1edf \u0111\u1ec3 hai b\u00ean nh\u1eafn tin v\u00e0 chia s\u1ebb evidence.",
              entityType: "CLAIM",
              entityId: claimId,
              dedupeKey: `claim:${claimId}:accepted`
            }, connection);
            notificationUserId = claim.claimantId;
          }
        } else {
          await claimRepository.updateFinderParticipant(claimId, finderId, "DECLINED", connection);
          await claimRepository.updateFinderDecision({ claimId, status: "REJECTED", finderDecision: "DECLINED", note: input.note, rejectedAt: true }, connection);
          await claimRepository.writeAudit({
            claimId,
            actorId: finderId,
            action: "FINDER_DECLINED",
            fromStatus: claim.status,
            toStatus: "REJECTED",
            metadata: {
              reason: input.note,
              idempotencyKey: input.idempotencyKey,
              requestFingerprint: fingerprint
            }
          }, connection);
        }
        return { claim: await claimRepository.findById(claimId, connection), notification, notificationUserId, roomId };
      });

      if (!result.claim) throw new AppError("internal", "Không thể cập nhật yêu cầu xác minh");
      await publishWorkflowNotification({
        userId: result.notificationUserId,
        notification: result.notification,
        workflow: "CLAIM",
        roomId: result.roomId
      });
      return details(claimId, finderId);
    },

    async withdraw(claimId: string, claimantId: string, idempotencyKey?: string) {
      if (!idempotencyKey) throw new AppError("invalid_input", "Thiếu Idempotency-Key khi rút claim");
      const fingerprint = requestFingerprint({ operation: "WITHDRAW_CLAIM" });
      await withTransaction(async (connection) => {
        const claim = await claimRepository.findByIdForUpdate(claimId, connection);
        if (!claim || claim.claimantId !== claimantId) throw claimNotFound();
        const existing = await claimRepository.findAuditByIdempotencyKey(claimId, claimantId, idempotencyKey, connection);
        if (ensureIdempotentReplay(existing, fingerprint)) return;
        const withdrawn = await claimRepository.withdrawClaim(claimId, claimantId, connection);
        if (!withdrawn) throw new AppError("conflict", "Yêu cầu này không thể rút ở trạng thái hiện tại");
        await claimRepository.writeAudit({
          claimId,
          actorId: claimantId,
          action: "CLAIM_WITHDRAWN",
          fromStatus: claim.status,
          toStatus: "CANCELLED",
          metadata: { idempotencyKey, requestFingerprint: fingerprint, reason: "Claimant withdrew the claim" }
        }, connection);
      });
      return details(claimId, claimantId);
    },

    async getRoom(claimId: string, userId: string) {
      const { claim, participant } = await requireClaimParticipant(claimId, userId, true);
      let room = await claimRepository.findRoomByClaim(claimId);
      if (!room && canUseRoom(claim.status, participant.consentStatus)) {
        room = await withTransaction(async (connection) => {
          const lockedClaim = await claimRepository.findByIdForUpdate(claimId, connection);
          const lockedParticipant = lockedClaim ? await claimRepository.findParticipant(claimId, userId, connection) : null;
          if (!lockedClaim || !lockedParticipant || !canUseRoom(lockedClaim.status, lockedParticipant.consentStatus)) {
            throw claimNotFound();
          }
          const existingRoom = await claimRepository.findRoomByClaim(claimId, connection);
          if (existingRoom) return existingRoom;
          await claimRepository.createRoom(claimId, connection);
          return claimRepository.findRoomByClaim(claimId, connection);
        });
      }
      if (!room) throw new AppError("conflict", "Phòng trao đổi chưa được mở");
      return { id: room.id, claimId: claim.id, status: claim.status, participantRole: participant.role, createdAt: room.createdAt };
    },

    async listRooms(userId: string) {
      const claims = await claimRepository.listRoomsForUser(userId);
      return { items: claims.map((claim) => ({ id: claim.roomId, claimId: claim.id, status: claim.status, finder: serializeClaim(claim).finder, claimant: serializeClaim(claim).claimant, posts: claim.posts, updatedAt: claim.updatedAt })) };
    },

    async listMessages(claimId: string, userId: string, query: ListMessagesQuery) {
      const room = await this.getRoom(claimId, userId);
      await claimRepository.markMessagesRead(room.id, userId);
      return { room, ...(await claimRepository.listMessages(room.id, query)) };
    },

    async sendMessage(claimId: string, userId: string, input: CreateMessageInput) {
      const room = await this.getRoom(claimId, userId);
      const result = await withTransaction(async (connection) => {
        const lockedClaim = await claimRepository.findByIdForUpdate(claimId, connection);
        const participant = lockedClaim ? await claimRepository.findParticipant(claimId, userId, connection) : null;
        const lockedRoom = lockedClaim ? await claimRepository.findRoomByClaim(claimId, connection) : null;
        if (!lockedClaim || !lockedRoom || !participant || !canUseRoom(lockedClaim.status, participant.consentStatus) || lockedRoom.id !== room.id) throw claimNotFound();
        
        // Auto-detect verification answer from message content
        if (input.content.includes("✏️ Câu trả lời:") && participant.role === "CLAIMANT") {
          const answerMatch = input.content.match(/✏️ Câu trả lời:\s*(.+)/);
          if (answerMatch) {
            const answerText = answerMatch[1].trim();
            const questionMatch = input.content.match(/🔍 Câu hỏi xác minh:\s*(.+?)(?:\n\n✏️|$)/);
            if (questionMatch) {
              const questionText = questionMatch[1].trim();
              const questions = await claimRepository.listVerificationQuestions(claimId, connection);
              const question = questions.find(q => q.prompt === questionText && q.status !== "DISABLED" && !q.answer);
              if (question) {
                await claimRepository.saveVerificationAnswer({ 
                  id: id(), 
                  claimId, 
                  questionId: question.id, 
                  answeredBy: userId, 
                  isMatch: null 
                }, connection);
              }
            }
          }
        }
        
        const created = await claimRepository.createMessage({ roomId: room.id, senderId: userId, content: input.content, clientMessageId: input.clientMessageId }, connection);
        if (!created) throw new AppError("internal", "Không thể gửi tin nhắn");
        await claimRepository.writeAudit({ claimId, actorId: userId, action: "MESSAGE_SENT" }, connection);
        const recipientId = counterpartId(lockedClaim, userId);
        const notification = recipientId ? await notificationRepository.create({
          userId: recipientId,
          type: "CHAT_MESSAGE_RECEIVED",
          title: "Bạn có tin nhắn mới trong phòng trao đổi riêng",
          body: "Mở phòng trao đổi riêng để xem nội dung. Thông báo không hiển thị nội dung riêng tư.",
          entityType: "CLAIM",
          entityId: claimId,
          dedupeKey: `claim:${claimId}:message:${created.id}`
        }, connection) : null;
        return { message: created, notification, recipientId };
      });
      await publishWorkflowNotification({
        userId: result.recipientId,
        notification: result.notification,
        workflow: "CHAT",
        roomId: room.id
      });
      return result.message;
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
          if (!lockedClaim || !room || !participant || participant.role !== "CLAIMANT" || lockedClaim.claimantId !== userId
            || !canUseRoom(lockedClaim.status, participant.consentStatus)) throw claimNotFound();
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
      const resolved = await mediaStorage.resolve(evidence.secureUrl, evidence.mediaFormat ?? "jpg");
      return { body: resolved.body, contentType: resolved.contentType };
    }
  };
  return claimService;
}

export type ClaimUseCases = ReturnType<typeof createClaimUseCases>;
