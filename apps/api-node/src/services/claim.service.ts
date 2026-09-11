import type { Express } from "express";
import type { PoolConnection } from "mysql2/promise";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { withTransaction } from "../config/db.js";
import { env } from "../config/env.js";
import { matchingRepository } from "../repositories/matching.repository.js";
import {
  claimRepository,
  type ClaimStatus,
  type ConsentStatus
} from "../repositories/claim.repository.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { HttpError } from "../utils/http-error.js";
import { mediaContentType, validateImageUpload } from "../utils/media.js";
import { ensureStoredFileExists, removeStoredFileIfPresent } from "../utils/media-storage.js";
import { hashToken, id } from "../utils/security.js";
import { isAppointmentEligible } from "./appointment-eligibility.js";
import {
  promptForKey,
  safeAnswer,
  safeReason,
  templateForCategory,
  validateCustomQuestion,
  type VerificationPrompt
} from "./verification-templates.js";
import type {
  ClaimDecisionInput,
  CreateClaimInput,
  CreateMessageInput,
  ListClaimsQuery,
  ListMessagesQuery,
  UploadEvidenceInput,
  VerificationAnswerInput,
  VerificationQuestionInput,
  VerificationReviewInput,
  WithdrawClaimInput
} from "../validators/claim.validator.js";

const evidenceRoot = path.resolve(env.uploadDir, "claim-evidence");
const privateEvidencePrefix = "private://claim-evidence/";
const roomStatuses: ClaimStatus[] = ["CONVERSATION_OPEN", "NEED_MORE_INFO", "ACCEPTED"];
type StoredClaim = NonNullable<Awaited<ReturnType<typeof claimRepository.findById>>>;

function canUseRoom(status: ClaimStatus, consentStatus: ConsentStatus | undefined) {
  return roomStatuses.includes(status) && consentStatus === "ACCEPTED";
}

function claimNotFound() {
  return new HttpError(404, "Không tìm thấy yêu cầu xác minh");
}

function serializeClaim(claim: StoredClaim) {
  return {
    ...claim,
    claimant: { id: claim.claimant.id, fullName: claim.claimant.fullName },
    finder: { id: claim.finder.id, fullName: claim.finder.fullName }
  };
}

function makeEvidenceStorage(claimId: string, evidenceId: string, extension: string) {
  const filename = `${evidenceId}.${extension}`;
  const dir = path.resolve(evidenceRoot, claimId);
  const filePath = path.resolve(dir, filename);
  if (!filePath.startsWith(`${evidenceRoot}${path.sep}`)) throw new HttpError(400, "Đường dẫn evidence không hợp lệ");
  return {
    dir,
    filePath,
    secureUrl: `${privateEvidencePrefix}${claimId}/${filename}`,
    publicId: `claim-evidence/${claimId}/${evidenceId}`
  };
}

function evidencePathFromSecureUrl(secureUrl: string) {
  if (!secureUrl.startsWith(privateEvidencePrefix)) throw new HttpError(404, "Không tìm thấy evidence");
  const parts = secureUrl.slice(privateEvidencePrefix.length).split("/");
  if (parts.length !== 2) throw new HttpError(404, "Không tìm thấy evidence");
  const [claimId, filename] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(claimId) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
    throw new HttpError(404, "Không tìm thấy evidence");
  }
  const filePath = path.resolve(evidenceRoot, claimId, filename);
  if (!filePath.startsWith(`${evidenceRoot}${path.sep}`)) throw new HttpError(404, "Không tìm thấy evidence");
  return filePath;
}

async function requireClaimParticipant(claimId: string, userId: string, requireRoom = false) {
  const claim = await claimRepository.findById(claimId);
  const participant = claim ? await claimRepository.findParticipant(claimId, userId) : null;
  if (!claim || !participant || (requireRoom && !canUseRoom(claim.status, participant.consentStatus))) throw claimNotFound();
  return { claim, participant };
}

async function openRoomIfNeeded(claimId: string, queryable: PoolConnection) {
  const existing = await claimRepository.findRoomByClaim(claimId, queryable);
  if (existing) return existing;
  return claimRepository.createRoom(claimId, queryable);
}

async function details(claimId: string, userId: string) {
  const { claim, participant } = await requireClaimParticipant(claimId, userId);
  const verification = claim.status === "ACCEPTED" && claim.roomId
    ? await verificationData(claim, participant.role)
    : null;
  return {
    ...serializeClaim(claim),
    participants: await claimRepository.listParticipants(claimId),
    room: claim.roomId ? { id: claim.roomId } : null,
    canSend: canUseRoom(claim.status, participant.consentStatus),
    appointmentEligible: verification?.appointmentEligible ?? false,
    verificationOutcome: verification?.latestDecision?.action ?? null
  };
}

type VerificationAudit = Awaited<ReturnType<typeof claimRepository.listClaimAuditEvents>>[number];

function metadataString(event: VerificationAudit, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function metadataNumber(event: VerificationAudit, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "number" ? value : undefined;
}

function verificationSnapshot(claim: StoredClaim, participantRole: "CLAIMANT" | "FINDER", categoryName: string | null, prompts: Array<VerificationPrompt & { source: "BUILT_IN" | "DB"; questionId?: string; privacyLevel?: string }>, audits: VerificationAudit[]) {
  const template = templateForCategory(categoryName);
  const sentQuestions = audits
    .filter((event) => event.action === "VERIFICATION_QUESTION_SENT")
    .map((event) => ({
      questionKey: metadataString(event, "questionKey") ?? "unknown",
      prompt: metadataString(event, "prompt") ?? "Câu hỏi xác minh riêng tư",
      senderId: event.actorId,
      sentAt: event.createdAt,
      messageId: metadataString(event, "messageId") ?? null,
      templateId: metadataString(event, "templateId") ?? template.id,
      templateVersion: metadataNumber(event, "templateVersion") ?? template.version
    }));
  const answers = audits
    .filter((event) => event.action === "VERIFICATION_ANSWER_SUBMITTED")
    .map((event) => ({
      questionKey: metadataString(event, "questionKey") ?? "unknown",
      answeredBy: event.actorId,
      answerLength: metadataNumber(event, "answerLength") ?? 0,
      answeredAt: event.createdAt,
      messageId: metadataString(event, "messageId") ?? null
    }));
  const reviews = audits
    .filter((event) => event.action === "VERIFICATION_REVIEW_RECORDED")
    .map((event) => ({
      questionKey: metadataString(event, "questionKey") ?? "unknown",
      result: metadataString(event, "result") ?? "UNCLEAR",
      confidence: metadataNumber(event, "confidence") ?? 0,
      reason: participantRole === "FINDER" ? metadataString(event, "reason") ?? "" : undefined,
      reviewedAt: event.createdAt
    }));
  const finalDecision = [...audits].reverse().find((event) => [
    "FINDER_VERIFIED_FOR_MEETUP",
    "FINDER_DECLINED",
    "CUSTODY_ESCALATION_REQUESTED"
  ].includes(event.action));
  const answerKeys = new Set(answers.map((answer) => answer.questionKey));
  const latestAnswerAt = new Map<string, string>();
  answers.forEach((answer) => latestAnswerAt.set(answer.questionKey, answer.answeredAt));
  const passKeys = new Set(reviews.filter((review) => review.result === "PASS" && latestAnswerAt.get(review.questionKey) && review.reviewedAt >= latestAnswerAt.get(review.questionKey)!).map((review) => review.questionKey));
  const appointmentEligible = isAppointmentEligible({ claimStatus: claim.status, latestDecisionAction: finalDecision?.action });
  return {
    category: categoryName,
    template: { id: template.id, version: template.version, minimumAnswers: template.minimumAnswers },
    prompts: participantRole === "FINDER" ? prompts : sentQuestions.map((question) => ({ key: question.questionKey, prompt: question.prompt, questionType: "TEXT" as const })),
    sentQuestions,
    answers: participantRole === "FINDER" ? answers : answers.filter((answer) => answer.answeredBy === claim.claimantId),
    reviews: participantRole === "FINDER" ? reviews : [],
    latestDecision: finalDecision ? { action: finalDecision.action, reason: participantRole === "FINDER" ? metadataString(finalDecision, "reason") ?? null : null, createdAt: finalDecision.createdAt } : null,
    canVerify: participantRole === "FINDER" && answerKeys.size >= template.minimumAnswers && [...passKeys].some((key) => answerKeys.has(key)),
    appointmentEligible
  };
}

function promptList(categoryName: string | null, dbQuestions: Awaited<ReturnType<typeof claimRepository.listVerificationQuestions>>) {
  const template = templateForCategory(categoryName);
  const configured = template.prompts.map((prompt) => ({ ...prompt, source: "BUILT_IN" as const }));
  const stored = dbQuestions.map((question) => ({
    key: question.id,
    prompt: question.prompt,
    questionType: question.questionType === "MASKED_SERIAL" ? "TEXT" as const : question.questionType,
    options: question.options,
    source: "DB" as const,
    questionId: question.id,
    privacyLevel: question.privacyLevel
  }));
  return [...configured, ...stored];
}

async function verificationData(claim: StoredClaim, participantRole: "CLAIMANT" | "FINDER", queryable?: PoolConnection) {
  const categoryName = await claimRepository.findFoundCategory(claim.foundPostId, queryable);
  const dbQuestions = await claimRepository.listVerificationQuestions(claim.id, queryable);
  const audits = await claimRepository.listClaimAuditEvents(claim.id, queryable);
  return verificationSnapshot(claim, participantRole, categoryName, promptList(categoryName, dbQuestions), audits);
}

export const claimService = {
  async createClaim(claimantId: string, input: CreateClaimInput) {
    const result = await withTransaction(async (connection) => {
      if (input.requestKey) {
        const byKey = await claimRepository.findByRequestKey(claimantId, input.requestKey, connection);
        if (byKey) {
          if (byKey.lostPostId !== input.lostPostId || byKey.foundPostId !== input.foundPostId) {
            throw new HttpError(409, "Idempotency-Key đã được sử dụng cho yêu cầu khác");
          }
          return { claim: byKey, idempotent: true };
        }
      }

      const suggestionThreshold = await matchingRepository.getConfigNumber("matching.suggestion_threshold", 0.6);
      const pair = await claimRepository.findMatchPairForUpdate(input.lostPostId, input.foundPostId, suggestionThreshold, connection);
      if (!pair) throw new HttpError(409, "Hai bài đăng chưa có matching hợp lệ để tạo yêu cầu");
      if (pair.claimant_id !== claimantId) throw claimNotFound();
      if (pair.finder_id === claimantId) throw new HttpError(409, "Bạn không thể yêu cầu xác minh bài đăng của chính mình");

      const existing = await claimRepository.findByPair(input.lostPostId, input.foundPostId, claimantId, connection);
      if (existing) {
        if (input.requestKey && existing.id) {
          const sameKey = await claimRepository.findByRequestKey(claimantId, input.requestKey, connection);
          if (sameKey) return { claim: sameKey, idempotent: true };
        }
        throw new HttpError(409, "Bạn đã gửi yêu cầu cho cặp bài đăng này");
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
      if (!claim) throw new HttpError(500, "Không thể tạo yêu cầu xác minh");
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

  async getVerification(claimId: string, userId: string) {
    const { claim, participant } = await requireClaimParticipant(claimId, userId, true);
    return verificationData(claim, participant.role);
  },

  async sendVerificationQuestion(claimId: string, finderId: string, input: VerificationQuestionInput) {
    const result = await withTransaction(async (connection) => {
      const claim = await claimRepository.findByIdForUpdate(claimId, connection);
      const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
      if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId || !canUseRoom(claim.status, participant.consentStatus)) throw claimNotFound();
      if (!["CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Phần xác minh đã đóng ở trạng thái hiện tại");
      const duplicate = await claimRepository.findAuditByIdempotency(claimId, finderId, input.idempotencyKey, connection);
      if (duplicate?.action === "VERIFICATION_QUESTION_SENT") {
        const room = await claimRepository.findRoomByClaim(claimId, connection);
        const message = room ? await claimRepository.findMessageByClientId(room.id, finderId, input.idempotencyKey, connection) : null;
        return { message, idempotent: true };
      }
      if (duplicate) throw new HttpError(409, "Idempotency-Key đã được dùng cho thao tác xác minh khác");
      const priorAudits = await claimRepository.listClaimAuditEvents(claimId, connection);
      if ([...priorAudits].reverse().find((event) => event.action === "CUSTODY_ESCALATION_REQUESTED")) throw new HttpError(409, "Case đã chuyển custody và không còn nhận câu hỏi mới");
      const categoryName = await claimRepository.findFoundCategory(claim.foundPostId, connection);
      const template = templateForCategory(categoryName);
      if (input.templateId !== template.id || input.templateVersion !== template.version) throw new HttpError(409, "Template câu hỏi đã cũ, vui lòng tải lại");
      const dbQuestions = await claimRepository.listVerificationQuestions(claimId, connection);
      const configuredPrompt = promptForKey(template, input.questionKey);
      const storedPrompt = dbQuestions.find((question) => question.id === input.questionKey);
      if (!configuredPrompt && !storedPrompt && input.questionKey !== "custom") throw new HttpError(400, "Câu hỏi không thuộc template đang hoạt động");
      if (input.questionKey === "custom") {
        const customError = validateCustomQuestion(input.prompt);
        if (customError) throw new HttpError(422, customError);
      } else {
        const expectedPrompt = configuredPrompt?.prompt ?? storedPrompt?.prompt;
        if (expectedPrompt !== input.prompt.trim()) throw new HttpError(409, "Nội dung câu hỏi không khớp phiên bản template");
      }
      const room = await openRoomIfNeeded(claimId, connection);
      const message = await claimRepository.createMessage({ roomId: room.id, senderId: finderId, content: input.prompt.trim(), clientMessageId: input.idempotencyKey }, connection);
      if (!message) throw new HttpError(500, "Không thể gửi câu hỏi xác minh");
      await claimRepository.writeAudit({
        claimId,
        actorId: finderId,
        action: "VERIFICATION_QUESTION_SENT",
        metadata: {
          idempotencyKey: input.idempotencyKey,
          questionKey: input.questionKey,
          prompt: input.prompt.trim(),
          templateId: input.templateId,
          templateVersion: input.templateVersion,
          messageId: message.id,
          custom: input.questionKey === "custom"
        }
      }, connection);
      return { message, idempotent: false };
    });
    return result;
  },

  async submitVerificationAnswer(claimId: string, claimantId: string, input: VerificationAnswerInput) {
    const result = await withTransaction(async (connection) => {
      const claim = await claimRepository.findByIdForUpdate(claimId, connection);
      const participant = claim ? await claimRepository.findParticipant(claimId, claimantId, connection) : null;
      if (!claim || !participant || participant.role !== "CLAIMANT" || claim.claimantId !== claimantId || !canUseRoom(claim.status, participant.consentStatus)) throw claimNotFound();
      if (!["CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Phần xác minh đã đóng ở trạng thái hiện tại");
      const duplicate = await claimRepository.findAuditByIdempotency(claimId, claimantId, input.idempotencyKey, connection);
      if (duplicate?.action === "VERIFICATION_ANSWER_SUBMITTED") {
        const room = await claimRepository.findRoomByClaim(claimId, connection);
        const message = room ? await claimRepository.findMessageByClientId(room.id, claimantId, input.idempotencyKey, connection) : null;
        return { message, idempotent: true };
      }
      if (duplicate) throw new HttpError(409, "Idempotency-Key đã được dùng cho thao tác xác minh khác");
      const audits = await claimRepository.listClaimAuditEvents(claimId, connection);
      if ([...audits].reverse().find((event) => event.action === "CUSTODY_ESCALATION_REQUESTED")) throw new HttpError(409, "Case đã chuyển custody và không còn nhận câu trả lời mới");
      const sent = [...audits].reverse().find((event) => event.action === "VERIFICATION_QUESTION_SENT" && metadataString(event, "questionKey") === input.questionKey);
      if (!sent) throw new HttpError(409, "Câu hỏi này chưa được Finder gửi trong phòng riêng");
      const answerError = safeAnswer(input.answer);
      if (answerError) throw new HttpError(422, answerError);
      const room = await openRoomIfNeeded(claimId, connection);
      const message = await claimRepository.createMessage({ roomId: room.id, senderId: claimantId, content: input.answer.trim(), clientMessageId: input.idempotencyKey }, connection);
      if (!message) throw new HttpError(500, "Không thể gửi câu trả lời xác minh");
      const dbQuestion = (await claimRepository.listVerificationQuestions(claimId, connection)).find((question) => question.id === input.questionKey);
      if (dbQuestion) await claimRepository.recordVerificationAnswer({ claimId, questionId: dbQuestion.id, answeredBy: claimantId, isMatch: hashToken(input.answer.trim()) === dbQuestion.expectedAnswerHash }, connection);
      await claimRepository.writeAudit({
        claimId,
        actorId: claimantId,
        action: "VERIFICATION_ANSWER_SUBMITTED",
        metadata: {
          idempotencyKey: input.idempotencyKey,
          questionKey: input.questionKey,
          messageId: message.id,
          answerLength: input.answer.trim().length
        }
      }, connection);
      return { message, idempotent: false };
    });
    return result;
  },

  async reviewVerificationQuestion(claimId: string, finderId: string, input: VerificationReviewInput) {
    const result = await withTransaction(async (connection) => {
      const claim = await claimRepository.findByIdForUpdate(claimId, connection);
      const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
      if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId || !canUseRoom(claim.status, participant.consentStatus)) throw claimNotFound();
      if (!["CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Phần xác minh đã đóng ở trạng thái hiện tại");
      const duplicate = await claimRepository.findAuditByIdempotency(claimId, finderId, input.idempotencyKey, connection);
      if (duplicate?.action === "VERIFICATION_REVIEW_RECORDED") return { idempotent: true };
      if (duplicate) throw new HttpError(409, "Idempotency-Key đã được dùng cho thao tác xác minh khác");
      const audits = await claimRepository.listClaimAuditEvents(claimId, connection);
      if ([...audits].reverse().find((event) => event.action === "CUSTODY_ESCALATION_REQUESTED")) throw new HttpError(409, "Case đã chuyển custody và không còn review routine");
      if (!audits.some((event) => event.action === "VERIFICATION_ANSWER_SUBMITTED" && metadataString(event, "questionKey") === input.questionKey)) throw new HttpError(409, "Chưa có câu trả lời để đánh giá");
      await claimRepository.writeAudit({
        claimId,
        actorId: finderId,
        action: "VERIFICATION_REVIEW_RECORDED",
        metadata: {
          idempotencyKey: input.idempotencyKey,
          questionKey: input.questionKey,
          result: input.result,
          confidence: input.confidence,
          reason: safeReason(input.reason)
        }
      }, connection);
      return { idempotent: false };
    });
    return { ...await claimService.getVerification(claimId, finderId), idempotent: result.idempotent };
  },

  async decide(claimId: string, finderId: string, input: ClaimDecisionInput) {
    const result = await withTransaction(async (connection) => {
      const claim = await claimRepository.findByIdForUpdate(claimId, connection);
      const participant = claim ? await claimRepository.findParticipant(claimId, finderId, connection) : null;
      if (!claim || !participant || participant.role !== "FINDER" || claim.finderId !== finderId) throw claimNotFound();
      const duplicate = await claimRepository.findAuditByIdempotency(claimId, finderId, input.idempotencyKey, connection);
      if (duplicate && (duplicate.action.startsWith("FINDER_") || duplicate.action === "CUSTODY_ESCALATION_REQUESTED")) return claim;
      if (duplicate) throw new HttpError(409, "Idempotency-Key đã được dùng cho thao tác xác minh khác");
      if (input.expectedStatus && input.expectedStatus !== claim.status) throw new HttpError(409, "Trạng thái yêu cầu đã thay đổi, vui lòng tải lại");
      const decision = input.decision === "ACCEPT" ? "OPEN_CONVERSATION" : input.decision;
      const reason = safeReason(input.note);
      if (decision === "VERIFY_FOR_MEETUP") {
        const priorVerification = await verificationData(claim, "FINDER", connection);
        if (priorVerification.latestDecision?.action === "CUSTODY_ESCALATION_REQUESTED") throw new HttpError(409, "Case đã chuyển custody và không thể xác minh để hẹn gặp");
      }

      if (decision === "OPEN_CONVERSATION" || decision === "REQUEST_MORE_INFO") {
        if (!["PENDING", "NEED_MORE_INFO", "CONVERSATION_OPEN"].includes(claim.status)) throw new HttpError(409, "Yêu cầu này không còn chờ phản hồi");
        const nextStatus: ClaimStatus = decision === "OPEN_CONVERSATION" ? "CONVERSATION_OPEN" : "NEED_MORE_INFO";
        if (decision === "OPEN_CONVERSATION" && claim.status === nextStatus && claim.roomId) return claim;
        await claimRepository.updateFinderParticipant(claimId, finderId, "ACCEPTED", connection);
        await claimRepository.updateFinderDecision({ claimId, status: nextStatus, finderDecision: "ACCEPTED", note: reason ?? undefined, acceptedAt: true }, connection);
        await openRoomIfNeeded(claimId, connection);
        await claimRepository.writeAudit({
          claimId,
          actorId: finderId,
          action: decision === "OPEN_CONVERSATION" ? "FINDER_OPENED_CONVERSATION" : "FINDER_REQUESTED_MORE_INFO",
          fromStatus: claim.status,
          toStatus: nextStatus,
          metadata: { idempotencyKey: input.idempotencyKey, reason, decision }
        }, connection);
        if (decision === "OPEN_CONVERSATION") await notificationRepository.create({
          userId: claim.claimantId,
          type: "CLAIM_CONVERSATION_OPENED",
          title: "Phòng trao đổi riêng đã được mở",
          body: "Finder đã mở phòng trao đổi. Đây chưa phải xác minh quyền sở hữu.",
          entityType: "CLAIM",
          entityId: claimId,
          dedupeKey: `claim:${claimId}:conversation-open`
        }, connection);
      } else if (decision === "VERIFY_FOR_MEETUP") {
        if (!["CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Cần mở phòng trao đổi trước khi xác minh");
        const verification = await verificationData(claim, "FINDER", connection);
        if (!verification.canVerify) throw new HttpError(409, "Cần ít nhất một câu trả lời và đánh giá PASS trước khi cho phép hẹn gặp");
        await claimRepository.updateFinderParticipant(claimId, finderId, "ACCEPTED", connection);
        await claimRepository.updateFinderDecision({ claimId, status: "ACCEPTED", finderDecision: "ACCEPTED", note: reason ?? undefined, acceptedAt: true }, connection);
        await claimRepository.writeAudit({ claimId, actorId: finderId, action: "FINDER_VERIFIED_FOR_MEETUP", fromStatus: claim.status, toStatus: "ACCEPTED", metadata: { idempotencyKey: input.idempotencyKey, reason, appointmentEligible: true } }, connection);
      } else if (decision === "DECLINE") {
        if (!["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Yêu cầu này không còn chờ phản hồi");
        await claimRepository.updateFinderParticipant(claimId, finderId, "DECLINED", connection);
        await claimRepository.updateFinderDecision({ claimId, status: "REJECTED", finderDecision: "DECLINED", note: reason ?? undefined, rejectedAt: true }, connection);
        await claimRepository.writeAudit({ claimId, actorId: finderId, action: "FINDER_DECLINED", fromStatus: claim.status, toStatus: "REJECTED", metadata: { idempotencyKey: input.idempotencyKey, reason } }, connection);
      } else if (decision === "ESCALATE_TO_CUSTODY") {
        if (!["PENDING", "CONVERSATION_OPEN", "NEED_MORE_INFO"].includes(claim.status)) throw new HttpError(409, "Yêu cầu này không thể chuyển custody ở trạng thái hiện tại");
        let toStatus = claim.status;
        if (claim.status === "PENDING") {
          toStatus = "CONVERSATION_OPEN";
          await claimRepository.updateFinderParticipant(claimId, finderId, "ACCEPTED", connection);
          await claimRepository.updateFinderDecision({ claimId, status: toStatus, finderDecision: "ACCEPTED", note: reason ?? undefined, acceptedAt: true }, connection);
          await openRoomIfNeeded(claimId, connection);
        }
        await claimRepository.writeAudit({ claimId, actorId: finderId, action: "CUSTODY_ESCALATION_REQUESTED", fromStatus: claim.status, toStatus, metadata: { idempotencyKey: input.idempotencyKey, reason, appointmentEligible: false } }, connection);
      }
      return claimRepository.findById(claimId, connection);
    });

    if (!result) throw new HttpError(500, "Không thể cập nhật yêu cầu xác minh");
    return details(claimId, finderId);
  },

  async withdraw(claimId: string, claimantId: string, input: WithdrawClaimInput = { idempotencyKey: id() }) {
    await withTransaction(async (connection) => {
      const claim = await claimRepository.findByIdForUpdate(claimId, connection);
      if (!claim || claim.claimantId !== claimantId) throw claimNotFound();
      const duplicate = await claimRepository.findAuditByIdempotency(claimId, claimantId, input.idempotencyKey, connection);
      if (duplicate?.action === "CLAIM_WITHDRAWN") return;
      if (duplicate) throw new HttpError(409, "Idempotency-Key đã được dùng cho thao tác khác");
      const withdrawn = await claimRepository.withdrawClaim(claimId, claimantId, connection);
      if (!withdrawn) throw new HttpError(409, "Yêu cầu này không thể rút ở trạng thái hiện tại");
      await claimRepository.writeAudit({ claimId, actorId: claimantId, action: "CLAIM_WITHDRAWN", fromStatus: claim.status, toStatus: "CANCELLED", metadata: { idempotencyKey: input.idempotencyKey, reason: safeReason(input.note) } }, connection);
    });
    return details(claimId, claimantId);
  },

  async getRoom(claimId: string, userId: string) {
    const { claim, participant } = await requireClaimParticipant(claimId, userId, true);
    const room = await claimRepository.findRoomByClaim(claimId);
    if (!room) throw new HttpError(409, "Phòng trao đổi chưa được mở");
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
      if (!created) throw new HttpError(500, "Không thể gửi tin nhắn");
      await claimRepository.writeAudit({ claimId, actorId: userId, action: "MESSAGE_SENT" }, connection);
      return created;
    });
    return message;
  },

  async listEvidence(claimId: string, userId: string) {
    await requireClaimParticipant(claimId, userId, true);
    return { items: await claimRepository.listEvidence(claimId) };
  },

  async uploadEvidence(claimId: string, userId: string, input: UploadEvidenceInput, file: Express.Multer.File) {
    const image = validateImageUpload(file);
    const evidenceId = id();
    const storage = makeEvidenceStorage(claimId, evidenceId, image.extension);
    await mkdir(storage.dir, { recursive: true });
    await writeFile(storage.filePath, file.buffer, { flag: "wx" });
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
      await removeStoredFileIfPresent(storage.filePath).catch(() => undefined);
      throw error;
    }
    const evidence = (await claimRepository.findEvidence(claimId, evidenceId));
    if (!evidence) throw new HttpError(500, "Không thể lưu evidence");
    const { secureUrl: _secureUrl, publicId: _publicId, ...safeEvidence } = evidence;
    return safeEvidence;
  },

  async getEvidenceFile(claimId: string, evidenceId: string, userId: string) {
    await requireClaimParticipant(claimId, userId, true);
    const evidence = await claimRepository.findEvidence(claimId, evidenceId);
    if (!evidence) throw new HttpError(404, "Không tìm thấy evidence");
    const filePath = evidencePathFromSecureUrl(evidence.secureUrl);
    await ensureStoredFileExists(filePath);
    return { filePath, contentType: mediaContentType((evidence.mediaFormat ?? "jpg") as "jpg" | "png" | "webp") };
  }
};
