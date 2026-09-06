import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import type { ReturnAppointmentForFeedback, ReturnFeedbackRecord, ReturnFeedbackRepository, ReputationScoreRecord } from "../repositories/return-feedback.repository.js";
import type { AccessTokenPayload } from "../types/auth.js";
import { returnFeedbackSchema } from "../validators/return-feedback.validator.js";
import { createReturnFeedbackService } from "./return-feedback.service.js";

const appointmentId = "11111111-1111-4111-8111-111111111111";
const secondAppointmentId = "88888888-8888-4888-8888-888888888888";
const claimId = "22222222-2222-4222-8222-222222222222";
const postId = "33333333-3333-4333-8333-333333333333";
const claimantId = "44444444-4444-4444-8444-444444444444";
const finderId = "55555555-5555-4555-8555-555555555555";

function viewer(sub = claimantId, roles: AccessTokenPayload["roles"] = ["USER"]): AccessTokenPayload {
  return { sub, email: `${sub}@example.com`, roles, sessionVersion: 0 };
}

function appointment(overrides: Partial<ReturnAppointmentForFeedback> = {}): ReturnAppointmentForFeedback {
  return {
    id: appointmentId,
    claimId,
    postId,
    status: "COMPLETED",
    completedAt: "2026-09-05T08:00:00.000Z",
    finderConfirmedAt: "2026-09-05T08:02:00.000Z",
    ownerConfirmedAt: "2026-09-05T08:03:00.000Z",
    custodyAuthorizedAt: null,
    claimantId,
    claimantName: "Claimant",
    finderId,
    finderName: "Finder",
    postTitle: "Found phone",
    ...overrides
  };
}

function feedback(overrides: Partial<ReturnFeedbackRecord> = {}): ReturnFeedbackRecord {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    appointmentId,
    claimId,
    postId,
    reviewerId: claimantId,
    reviewerName: "Claimant",
    targetUserId: finderId,
    targetName: "Finder",
    idempotencyKey: "retry-key",
    rating: 5,
    comment: "Tra do dung hen",
    isNegative: false,
    status: "NEW",
    createdAt: "2026-09-05T08:04:00.000Z",
    ...overrides
  };
}

function createHarness(currentAppointment = appointment()) {
  const state = {
    feedbacks: [] as ReturnFeedbackRecord[],
    reputationLogs: 0,
    score: { userId: finderId, totalPoints: 0, level: "NEW", updatedAt: null } as ReputationScoreRecord
  };
  const repository: ReturnFeedbackRepository = {
    findAppointmentForFeedback: async () => currentAppointment,
    listFeedbackForAppointment: async () => state.feedbacks,
    findFeedbackByReviewer: async (appointmentId, reviewerId) => state.feedbacks.find((item) => item.appointmentId === appointmentId && item.reviewerId === reviewerId) ?? null,
    findFeedbackByIdempotency: async (appointmentId, reviewerId, key) => state.feedbacks.find((item) => item.appointmentId === appointmentId && item.reviewerId === reviewerId && item.idempotencyKey === key) ?? null,
    createFeedback: async (input) => {
      state.feedbacks.push(feedback({
        id: input.id,
        appointmentId: input.appointmentId,
        claimId: input.claimId,
        postId: input.postId,
        reviewerId: input.reviewerId,
        targetUserId: input.targetUserId,
        idempotencyKey: input.idempotencyKey,
        rating: input.rating,
        comment: input.comment,
        isNegative: input.isNegative
      }));
    },
    findFeedbackById: async (feedbackId) => state.feedbacks.find((item) => item.id === feedbackId) ?? null,
    getReputationForUpdate: async () => state.score,
    upsertReputationScore: async (input) => {
      state.score = { userId: input.userId, totalPoints: input.totalPoints, level: input.level, updatedAt: "2026-09-05T08:05:00.000Z" };
    },
    createReputationLog: async () => { state.reputationLogs += 1; }
  };
  const service = createReturnFeedbackService({
    repository,
    runInTransaction: async (work) => work({} as PoolConnection)
  });
  return { service, state };
}

test("dual-confirmed return feedback creates exactly one feedback and reputation event", async () => {
  const { service, state } = createHarness();
  const result = await service.submitFeedback(appointmentId, { rating: 5, comment: "Tra do dung hen", idempotencyKey: "retry-key" }, viewer());

  assert.equal(result.feedback.rating, 5);
  assert.equal(result.feedback.target.id, finderId);
  assert.equal(result.reputationEventCreated, true);
  assert.equal(state.feedbacks.length, 1);
  assert.equal(state.reputationLogs, 1);
  assert.equal(state.score.totalPoints, 6);
});

test("pending or not dual-confirmed returns are rejected without reputation", async () => {
  for (const current of [
    appointment({ status: "PENDING", completedAt: null }),
    appointment({ finderConfirmedAt: null, ownerConfirmedAt: null })
  ]) {
    const { service, state } = createHarness(current);
    await assert.rejects(
      service.submitFeedback(appointmentId, { rating: 4, comment: null, idempotencyKey: "pending-key" }, viewer()),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 409
    );
    assert.equal(state.feedbacks.length, 0);
    assert.equal(state.reputationLogs, 0);
  }
});

test("same idempotency key returns the original result without duplication", async () => {
  const { service, state } = createHarness();
  const first = await service.submitFeedback(appointmentId, { rating: 4, comment: "Ok", idempotencyKey: "same-key" }, viewer());
  const retry = await service.submitFeedback(appointmentId, { rating: 1, comment: "Different", idempotencyKey: "same-key" }, viewer());

  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.reputationEventCreated, false);
  assert.equal(retry.feedback.id, first.feedback.id);
  assert.equal(state.feedbacks.length, 1);
  assert.equal(state.reputationLogs, 1);
});

test("the same idempotency key can be used for a different appointment", async () => {
  const { service, state } = createHarness(appointment({ id: secondAppointmentId }));
  state.feedbacks.push(feedback({ appointmentId, idempotencyKey: "shared-key" }));

  const result = await service.submitFeedback(secondAppointmentId, { rating: 4, comment: "Khac lich", idempotencyKey: "shared-key" }, viewer());

  assert.equal(result.idempotent, false);
  assert.equal(result.feedback.appointmentId, secondAppointmentId);
  assert.equal(state.feedbacks.length, 2);
  assert.equal(state.reputationLogs, 1);
});

test("non-participants cannot read eligibility or submit feedback", async () => {
  const { service } = createHarness();
  const stranger = viewer("77777777-7777-4777-8777-777777777777");
  await assert.rejects(service.getEligibility(appointmentId, stranger), (error: unknown) => error instanceof Error && "status" in error && error.status === 403);
  await assert.rejects(service.submitFeedback(appointmentId, { rating: 5, comment: null, idempotencyKey: "stranger-key" }, stranger), (error: unknown) => error instanceof Error && "status" in error && error.status === 403);
});

test("feedback validator rejects invalid rating and html content", () => {
  assert.throws(() => returnFeedbackSchema.parse({ rating: 6, comment: "ok", idempotencyKey: "valid-key" }));
  assert.throws(() => returnFeedbackSchema.parse({ rating: 5, comment: "<script>alert(1)</script>", idempotencyKey: "valid-key" }));
});
