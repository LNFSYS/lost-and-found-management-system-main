import assert from "node:assert/strict";
import test from "node:test";
import { createTestClaimUseCases, notificationRepository } from "../../../test/use-case-fixtures.js";
import type { ClaimAuditEventRecord, ClaimRepository, ClaimStatus, FinderDecision, VerificationQuestionRecord } from "./claim.repository.port.js";

const claimId = "11111111-1111-4111-8111-111111111111";
const claimantId = "22222222-2222-4222-8222-222222222222";
const finderId = "33333333-3333-4333-8333-333333333333";
const roomId = "44444444-4444-4444-8444-444444444444";

// Verification decisions now persist an in-app notification in the same transaction.
// Keep this focused harness self-contained while individual notification tests assert the payload.
notificationRepository.create = async (input) => ({
  id: "99999999-9999-4999-8999-999999999999",
  type: input.type,
  title: input.title,
  body: input.body ?? null,
  entityType: input.entityType ?? null,
  entityId: input.entityId ?? null,
  isRead: false,
  readAt: null,
  createdAt: "2026-09-18T01:00:00.000Z"
});

function claim(status: ClaimStatus, finderDecision: FinderDecision = "ACCEPTED") {
  return {
    id: claimId,
    lostPostId: null,
    foundPostId: "55555555-5555-4555-8555-555555555555",
    claimantId,
    finderId,
    status,
    finderDecision,
    description: null,
    approximateLostAt: null,
    approximateLocation: null,
    rejectionReason: status === "REJECTED" ? "Not verified" : null,
    moreInfoRequest: status === "NEED_MORE_INFO" ? "More detail" : null,
    acceptedAt: status === "ACCEPTED" ? "2026-09-18T01:00:00.000Z" : null,
    rejectedAt: status === "REJECTED" ? "2026-09-18T01:00:00.000Z" : null,
    cancelledAt: null,
    createdAt: "2026-09-18T00:00:00.000Z",
    updatedAt: "2026-09-18T01:00:00.000Z",
    claimant: { id: claimantId, fullName: "Claimant", email: "claimant@example.com" },
    finder: { id: finderId, fullName: "Finder", email: "finder@example.com" },
    posts: { lost: null, found: { id: "55555555-5555-4555-8555-555555555555", title: "Found phone" } },
    roomId
  };
}

function participant(userId: string) {
  return {
    claimId,
    userId,
    role: userId === finderId ? "FINDER" as const : "CLAIMANT" as const,
    consentStatus: "ACCEPTED" as const,
    joinedAt: "2026-09-18T00:00:00.000Z",
    fullName: userId === finderId ? "Finder" : "Claimant"
  };
}

function answeredQuestion(id: string, isMatch: boolean | null = null): VerificationQuestionRecord {
  return {
    id,
    claimId,
    postId: "55555555-5555-4555-8555-555555555555",
    prompt: "Private verification prompt",
    questionType: "TEXT",
    sourceSignal: `tpl:phone-device:v1:${id}`,
    expectedAnswerHash: null,
    options: null,
    privacyLevel: "PRIVATE",
    status: "DISABLED",
    assignedAt: "2026-09-18T00:10:00.000Z",
    answer: {
      answeredBy: claimantId,
      isMatch,
      attemptCount: 1,
      lastAttemptAt: "2026-09-18T00:20:00.000Z",
      answeredAt: "2026-09-18T00:20:00.000Z"
    }
  };
}

function commonRepository(overrides: Partial<ClaimRepository> = {}) {
  let currentStatus: ClaimStatus = "CONVERSATION_OPEN";
  let currentFinderDecision: FinderDecision = "ACCEPTED";
  const audits: ClaimAuditEventRecord[] = [];
  const repository = {
    findById: async () => claim(currentStatus, currentFinderDecision),
    findByIdForUpdate: async () => claim(currentStatus, currentFinderDecision),
    findParticipant: async (_claimId: string, userId: string) => participant(userId),
    listParticipants: async () => [participant(claimantId), participant(finderId)],
    findClaimItemContext: async () => ({
      foundPostId: claim("CONVERSATION_OPEN").foundPostId,
      title: "Found phone",
      categoryName: "Điện thoại",
      visibilityMode: "PUBLIC",
      areaName: "FPTU Đà Nẵng",
      buildingName: null,
      roomText: null,
      customLocation: null,
      handoverPointName: null,
      mediaId: null
    }),
    findVerificationContext: async () => ({ foundPostId: claim("CONVERSATION_OPEN").foundPostId, categoryName: "dien thoai", parentCategoryName: "thiet bi dien tu" }),
    findRoomByClaim: async () => ({ id: roomId, claimId, escalatedAt: null, escalatedBy: null, escalationReason: null, createdAt: "2026-09-18T00:00:00.000Z" }),
    listVerificationAuditEvents: async () => audits,
    findAuditByIdempotencyKey: async (_claimId: string, actorId: string, key: string) => audits.find((event) => event.actorId === actorId && event.metadata?.idempotencyKey === key) ?? null,
    updateFinderDecision: async (input: { status: ClaimStatus; finderDecision: FinderDecision }) => {
      currentStatus = input.status;
      currentFinderDecision = input.finderDecision;
    },
    markRoomEscalated: async () => undefined,
    clearRoomEscalation: async () => undefined,
    hasActiveAppointment: async () => false,
    writeAudit: async (input: Parameters<ClaimRepository["writeAudit"]>[0]) => {
      audits.push({
        id: input.eventId ?? "audit-event",
        claimId: input.claimId,
        actorId: input.actorId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        metadata: input.metadata ?? null,
        createdAt: "2026-09-18T01:00:00.000Z"
      });
    },
    createMessage: async () => ({
      id: "message-1",
      roomId: roomId,
      sender: { id: claimantId, fullName: "Claimant" },
      clientMessageId: "msg-1",
      content: "verification",
      messageType: "TEXT",
      isRead: true,
      readAt: null,
      createdAt: "2026-09-18T01:05:00.000Z"
    }),
    ...overrides
  } as unknown as ClaimRepository;
  return { repository, audits, status: () => currentStatus };
}

test("Finder verification is authoritative, appointment-eligible and idempotent", async () => {
  const questions = [answeredQuestion("case-accessory"), answeredQuestion("loss-context")];
  let transitions = 0;
  const harness = commonRepository({
    listVerificationQuestions: async () => questions,
    updateFinderDecision: async (input) => {
      transitions += 1;
      await (commonRepository().repository.updateFinderDecision(input, {} as never));
    }
  });
  let currentStatus: ClaimStatus = "CONVERSATION_OPEN";
  harness.repository.findById = async () => claim(currentStatus);
  harness.repository.findByIdForUpdate = async () => claim(currentStatus);
  harness.repository.updateFinderDecision = async (input) => { transitions += 1; currentStatus = input.status; };
  const service = createTestClaimUseCases({ claimRepository: harness.repository });
  const input = {
    decision: "VERIFY_FOR_MEETUP" as const,
    reason: "Two private answers and evidence are consistent",
    idempotencyKey: "verify-decision-2026"
  };

  const first = await service.decideVerification(claimId, finderId, input);
  const replay = await service.decideVerification(claimId, finderId, input);

  assert.equal(first.claim.status, "ACCEPTED");
  assert.equal(first.verification.appointmentEligible, true);
  assert.equal(replay.claim.status, "ACCEPTED");
  assert.equal(transitions, 1);
  assert.equal(harness.audits.length, 1);
  assert.equal(harness.audits[0]?.action, "VERIFICATION_ACCEPTED");
  assert.equal(JSON.stringify(first).includes("private-expected-answer-hash"), false);
});

test("claimant answer response and audit history do not expose raw answers", async () => {
  let storedAnswer: VerificationQuestionRecord["answer"] = null;
  const rawAnswer = "Blue case private answer";
  const question: VerificationQuestionRecord = { ...answeredQuestion("question-one"), status: "APPROVED", answer: null };
  const harness = commonRepository({
    listVerificationQuestions: async () => [{ ...question, answer: storedAnswer }],
    findVerificationQuestion: async () => ({ ...question, answer: storedAnswer }),
    saveVerificationAnswer: async (input) => {
      storedAnswer = {
        answeredBy: input.answeredBy,
        isMatch: null,
        attemptCount: 1,
        lastAttemptAt: "2026-09-18T01:00:00.000Z",
        answeredAt: "2026-09-18T01:00:00.000Z"
      };
    }
  });
  const service = createTestClaimUseCases({
    claimRepository: harness.repository
  });

  const result = await service.answerVerificationQuestion(claimId, question.id, claimantId, {
    answer: rawAnswer,
    idempotencyKey: "answer-request-2026"
  });
  const serialized = JSON.stringify(result);

  assert.equal(serialized.includes(rawAnswer), false);
  assert.equal(serialized.includes("\"isMatch\""), false);
});

test("finder can send verification questions without changing ownership or appointment eligibility", async () => {
  const assigned: VerificationQuestionRecord[] = [];
  let stateTransitions = 0;
  const harness = commonRepository({
    listVerificationQuestions: async () => assigned,
    createVerificationQuestion: async (input) => {
      assigned.push({
        ...input,
        claimId,
        options: null,
        status: "APPROVED",
        assignedAt: "2026-09-18T01:00:00.000Z",
        answer: null
      });
    },
    assignVerificationQuestion: async () => undefined,
    updateFinderDecision: async () => { stateTransitions += 1; }
  });
  const service = createTestClaimUseCases({
    claimRepository: harness.repository
  });

  const result = await service.sendVerificationQuestion(claimId, finderId, {
    templateId: "phone-device",
    templateVersion: 1,
    promptKey: "custom",
    prompt: "Claimant asks to describe the phone case color.",
    idempotencyKey: "claimant-question-reviewed-1"
  });

  assert.equal(stateTransitions, 0);
  assert.equal(result.status, "CONVERSATION_OPEN");
  assert.equal(result.appointmentEligible, false);
  assert.equal(harness.audits[0]?.action, "QUESTION_SENT");
});

test("an unrelated user cannot read verification questions or decision reasons", async () => {
  let privateReads = 0;
  const harness = commonRepository({
    findParticipant: async () => null,
    listVerificationQuestions: async () => { privateReads += 1; return []; },
    listVerificationAuditEvents: async () => { privateReads += 1; return []; }
  });
  const service = createTestClaimUseCases({ claimRepository: harness.repository });
  await assert.rejects(service.getVerification(claimId, "99999999-9999-4999-8999-999999999999"), (error: unknown) => (
    error instanceof Error && "code" in error && error.code === "not_found"
  ));
  assert.equal(privateReads, 0);
});

test("incomplete answers cannot become ACCEPTED but can produce a safe more-info outcome", async () => {
  let currentStatus: ClaimStatus = "CONVERSATION_OPEN";
  const harness = commonRepository({ listVerificationQuestions: async () => [] });
  harness.repository.findById = async () => claim(currentStatus);
  harness.repository.findByIdForUpdate = async () => claim(currentStatus);
  harness.repository.updateFinderDecision = async (input) => { currentStatus = input.status; };
  const service = createTestClaimUseCases({ claimRepository: harness.repository });

  await assert.rejects(service.decideVerification(claimId, finderId, {
    decision: "VERIFY_FOR_MEETUP",
    reason: "No private answers were provided",
    idempotencyKey: "incomplete-accept-key"
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "conflict");
  assert.equal(currentStatus, "CONVERSATION_OPEN");

  const result = await service.decideVerification(claimId, finderId, {
    decision: "REQUEST_MORE_INFO",
    reason: "Please provide another private distinguishing detail",
    idempotencyKey: "safe-more-info-key"
  });
  assert.equal(result.claim.status, "NEED_MORE_INFO");
  assert.equal(result.verification.appointmentEligible, false);
  assert.equal(harness.audits[0]?.action, "MORE_INFO_REQUESTED");
});

test("an authorized correction appends a correction event instead of replacing history", async () => {
  let currentStatus: ClaimStatus = "ACCEPTED";
  const harness = commonRepository({ listVerificationQuestions: async () => [answeredQuestion("case-accessory")] });
  const originalDecision: ClaimAuditEventRecord = {
    id: "77777777-7777-4777-8777-777777777777",
    claimId,
    actorId: finderId,
    action: "VERIFICATION_ACCEPTED",
    fromStatus: "CONVERSATION_OPEN",
    toStatus: "ACCEPTED",
    metadata: { decision: "VERIFY_FOR_MEETUP", reason: "Original review" },
    createdAt: "2026-09-18T01:00:00.000Z"
  };
  harness.audits.push(originalDecision);
  harness.repository.findById = async () => claim(currentStatus);
  harness.repository.findByIdForUpdate = async () => claim(currentStatus);
  harness.repository.updateFinderDecision = async (input) => { currentStatus = input.status; };
  const service = createTestClaimUseCases({ claimRepository: harness.repository });

  const result = await service.decideVerification(claimId, finderId, {
    decision: "DECLINE",
    reason: "Authorized review found the earlier decision was incorrect",
    correctsEventId: originalDecision.id,
    idempotencyKey: "correction-decision-key"
  });

  assert.equal(result.claim.status, "REJECTED");
  assert.equal(harness.audits.length, 2);
  assert.equal(harness.audits[0]?.action, "VERIFICATION_ACCEPTED");
  assert.equal(harness.audits[1]?.action, "VERIFICATION_DECISION_CORRECTED");
  assert.equal(harness.audits[1]?.metadata?.correctsEventId, originalDecision.id);
});
