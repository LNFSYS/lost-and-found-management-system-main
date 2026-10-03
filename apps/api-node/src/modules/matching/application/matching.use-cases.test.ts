import assert from "node:assert/strict";
import test from "node:test";
import { defaultMatchingConfig, type MatchingConfig } from "../domain/matching.engine.js";
import type { MatchingRepository } from "./matching.repository.port.js";
import { createMatchingUseCases, sanitizeMatchingConfig } from "./matching.use-cases.js";

function config(overrides: Partial<MatchingConfig> = {}): MatchingConfig {
  return {
    ...defaultMatchingConfig,
    ...overrides,
    weights: { ...defaultMatchingConfig.weights, ...overrides.weights }
  };
}

test("matching config preserves valid ordered thresholds and weights", () => {
  const input = config({
    weakThreshold: 0.4,
    suggestionThreshold: 0.58,
    notificationThreshold: 0.72,
    highConfidenceThreshold: 0.9,
    weights: { text: 0.35, category: 0.2, location: 0.15, time: 0.1, image: 0.1, ocr: 0.1 }
  });

  assert.deepEqual(sanitizeMatchingConfig(input), input);
});

test("matching config falls back when thresholds are out of order or out of range", () => {
  const sanitized = sanitizeMatchingConfig(config({
    weakThreshold: 0.8,
    suggestionThreshold: 0.6,
    highConfidenceThreshold: 1.2
  }));

  assert.equal(sanitized.weakThreshold, defaultMatchingConfig.weakThreshold);
  assert.equal(sanitized.suggestionThreshold, defaultMatchingConfig.suggestionThreshold);
  assert.equal(sanitized.notificationThreshold, defaultMatchingConfig.notificationThreshold);
  assert.equal(sanitized.highConfidenceThreshold, defaultMatchingConfig.highConfidenceThreshold);
});

test("matching config falls back when all weights are unusable", () => {
  const sanitized = sanitizeMatchingConfig(config({
    weights: { text: 0, category: 0, location: 0, time: 0, image: 0, ocr: 0 }
  }));

  assert.deepEqual(sanitized.weights, defaultMatchingConfig.weights);
});

function feedbackFixture() {
  let feedback: Awaited<ReturnType<MatchingRepository["findFeedback"]>> = null;
  let dismissal: Awaited<ReturnType<MatchingRepository["findDismissal"]>> = null;
  const repository = {
    findMatchForPost: async (matchId: string, postId: string) => matchId === "match-1" && postId === "post-1"
      ? { id: matchId, lostPostId: postId, foundPostId: "post-2" }
      : null,
    findFeedback: async () => feedback,
    saveFeedback: async (input: Parameters<MatchingRepository["saveFeedback"]>[0]) => {
      feedback ??= { ...input, createdAt: "2026-09-27T00:00:00.000Z", updatedAt: "2026-09-27T00:00:00.000Z" };
      return feedback;
    },
    findDismissal: async () => dismissal,
    saveDismissal: async (input: Parameters<MatchingRepository["saveDismissal"]>[0]) => {
      dismissal ??= { id: input.id, correlationKey: input.correlationKey, reason: input.reason, createdAt: "2026-09-27T00:00:00.000Z" };
      return dismissal;
    }
  } as unknown as MatchingRepository;
  return createMatchingUseCases({ matchingRepository: repository, postRepository: {} as never, idFactory: () => "record-1" });
}

test("match feedback replay returns the original record without duplication", async () => {
  const service = feedbackFixture();
  const input = { matchId: "match-1", postId: "post-1", userId: "user-1", value: "USEFUL" as const, correlationKey: "request-123" };
  const first = await service.submitFeedback(input);
  const replay = await service.submitFeedback(input);

  assert.equal(replay.id, first.id);
  await assert.rejects(
    service.submitFeedback({ ...input, value: "INCORRECT" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "conflict"
  );
});

test("match dismissal replay is idempotent and forged match identifiers are rejected", async () => {
  const service = feedbackFixture();
  const input = { matchId: "match-1", postId: "post-1", userId: "user-1", correlationKey: "request-456" };
  const first = await service.dismissSuggestion(input);
  const replay = await service.dismissSuggestion(input);

  assert.equal(replay.id, first.id);
  await assert.rejects(
    service.dismissSuggestion({ ...input, matchId: "forged-match", correlationKey: "request-789" }),
    (error: unknown) => error instanceof Error && "code" in error && error.code === "not_found"
  );
});
