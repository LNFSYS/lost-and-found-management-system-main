import assert from "node:assert/strict";
import test from "node:test";
import { defaultMatchingConfig, type MatchingConfig } from "../domain/matching.engine.js";
import type { MatchingRepository } from "./matching.repository.port.js";
import { createMatchingUseCases, sanitizeMatchingConfig } from "./matching.use-cases.js";
import type { NotificationRecord } from "../../notifications/application/notification.repository.port.js";
import { recordTransactionOutcome } from "../../../shared/application/transaction.js";

function config(overrides: Partial<MatchingConfig> = {}): MatchingConfig {
  return {
    ...defaultMatchingConfig,
    ...overrides,
    weights: { ...defaultMatchingConfig.weights, ...overrides.weights }
  };
}

function notificationFixture({ failEmail = false, lostDismissed = false, persisted = true, deadlockOutcome = "", deadlockCount = 0 } = {}) {
  const events: string[] = [];
  const notifications: Array<Record<string, unknown>> = [];
  let notified = false;
  const transaction = Object.freeze({}) as never;
  const repository = {
    getConfigNumber: async (_key: string, fallback: number) => fallback,
    findCandidate: async () => ({ id: "found", userId: "finder", type: "FOUND", text: "wallet", imageText: "", ocrText: "" }),
    listOppositeCandidates: async () => [],
    persistForSource: async () => { events.push("persist"); return persisted; },
    listForPost: async () => [],
    lockUnnotifiedMatches: async (_postId: string, threshold: number, tx: unknown) => {
      assert.equal(threshold, 0.6); assert.equal(tx, transaction);
      return notified ? [] : [{ id: "match", lostPostId: "lost", foundPostId: "found", lostUserId: "owner", foundUserId: "finder", lostDismissed, foundDismissed: false }];
    },
    markNotified: async (_id: string, tx: unknown) => { assert.equal(tx, transaction); notified = true; events.push("mark"); }
  } as unknown as MatchingRepository;
  const service = createMatchingUseCases({ matchingRepository: repository,
    postRepository: { findVisibleById: async () => ({ id: "found", userId: "finder" }), findVisibleByIds: async () => [] } as never,
    idFactory: () => "fixture", delivery: {
      transaction: work => {
        if (deadlockCount-- > 0) {
          const error = Object.assign(new Error("deadlock"), { code: "ER_LOCK_DEADLOCK" });
          recordTransactionOutcome(error, deadlockOutcome === "ROLLED_BACK" ? "ROLLED_BACK" : "UNKNOWN");
          events.push("deadlock");
          return Promise.reject(error);
        }
        return work(transaction);
      },
      notifications: { create: async (input: Record<string, unknown>, tx: unknown) => {
        assert.equal(tx, transaction); events.push("notification"); notifications.push(input);
        return { ...input, id: `notification-${input.userId}` } as unknown as NotificationRecord;
      } } as never,
      emails: { enqueue: async (input: { eventType: string; recipientUserId: string }, tx: unknown) => {
        assert.equal(input.eventType, "MATCH"); assert.equal(tx, transaction); events.push(`email:${input.recipientUserId}`);
        if (failEmail) throw new Error("queue unavailable");
      } } as never
    } });
  return { service, events, notifications, notified: () => notified };
}

test("matching notifies both owners after persistence and never repeats a notified pair", async () => {
  const fixture = notificationFixture();
  await fixture.service.runForPost("found");
  await fixture.service.runForPost("found");
  assert.deepEqual(fixture.events, ["persist", "notification", "email:owner", "notification", "email:finder", "mark", "persist"]);
  assert.deepEqual(fixture.notifications.map(row => [row.userId, row.entityType, row.entityId, row.dedupeKey]), [
    ["owner", "POST_MATCH", "lost", "matching:match:owner"], ["finder", "POST_MATCH", "found", "matching:match:finder"]
  ]);
  assert.ok(fixture.notifications.every(row => row.type === "MATCH_FOUND"));
});

test("matching does not notify dismissed recipients or a lost persistence lease", async () => {
  const dismissed = notificationFixture({ lostDismissed: true });
  await dismissed.service.runForPost("found");
  assert.deepEqual(dismissed.notifications.map(row => row.userId), ["finder"]);
  const stale = notificationFixture({ persisted: false });
  await assert.rejects(stale.service.runForPost("found"), /lease or source eligibility/);
  assert.deepEqual(stale.events, ["persist"]);
});

test("failed matching email enqueue does not set the notification marker", async () => {
  const fixture = notificationFixture({ failEmail: true });
  await assert.rejects(fixture.service.runForPost("found"), /queue unavailable/);
  assert.equal(fixture.notified(), false);
  assert.ok(!fixture.events.includes("mark"));
});

test("opening saved matching results never produces email", async () => {
  const fixture = notificationFixture();
  await fixture.service.getStoredResults("found");
  assert.deepEqual(fixture.events, []);
});

test("matching retries only confirmed rolled-back deadlocks, with at most three attempts", async () => {
  const recovered = notificationFixture({ deadlockOutcome: "ROLLED_BACK", deadlockCount: 2 });
  await recovered.service.runForPost("found");
  assert.equal(recovered.notifications.length, 2);
  assert.equal(recovered.events.filter(event => event === "deadlock").length, 2);
  for (const [outcome, expected] of [["UNKNOWN", 1], ["ROLLED_BACK", 3]] as const) {
    const failing = notificationFixture({ deadlockOutcome: outcome, deadlockCount: 10 });
    await assert.rejects(failing.service.runForPost("found"), /deadlock/);
    assert.equal(failing.events.filter(event => event === "deadlock").length, expected);
    assert.equal(failing.notifications.length, 0);
  }
});

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

test("owned LOST suggestions are removed before calculating pagination metadata", async () => {
  const matches = Array.from({ length: 42 }, (_, index) => ({ id: `match-${index}`, lostPostId: `lost-${index}`, foundPostId: "source", updatedAt: "2026-10-03T00:00:00.000Z" }));
  const service = createMatchingUseCases({
    matchingRepository: {
      getConfigNumber: async (_key: string, fallback: number) => fallback,
      listForPost: async (_post: string, _score: number, viewer?: string) => { assert.equal(viewer, "owner"); return matches; }
    } as unknown as MatchingRepository,
    postRepository: { findVisibleById: async () => ({ id: "source", userId: "owner", type: "FOUND" }), findVisibleByIds: async () => matches.map((match, index) => ({ id: match.lostPostId, type: "LOST", userId: index === 0 ? "owner" : "other" })) } as never,
    idFactory: () => "fixture"
  });
  const result = await service.getStoredResults("source", undefined, "owner", 2, 20);
  assert.equal(result.total, 41);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 20);
  assert.equal(result.hasMore, true);
  assert.equal(result.results.length, 20);
  assert.equal(result.results[0].candidate.id, "lost-21");
});

for (const viewer of ["owner", "staff", "admin"]) {
  test(`matching filters source-owner LOST before pageSize=1 for ${viewer}, while keeping viewer feedback scope`, async () => {
    const matches = [{ id: "self", lostPostId: "owner-lost", foundPostId: "source", updatedAt: "2026-10-04T00:00:00Z" }, { id: "other", lostPostId: "staff-lost", foundPostId: "source", updatedAt: "2026-10-04T00:00:00Z" }];
    const service = createMatchingUseCases({
      matchingRepository: { getConfigNumber: async (_key: string, fallback: number) => fallback, listForPost: async (_source: string, _score: number, actor?: string) => { assert.equal(actor,viewer); return matches; } } as unknown as MatchingRepository,
      postRepository: { findVisibleById: async () => ({ id: "source", userId: "owner", type: "FOUND" }), findVisibleByIds: async () => [{ id: "owner-lost", userId: "owner", type: "LOST" }, { id: "staff-lost", userId: "staff", type: "LOST", status: "RESOLVED" }] } as never,
      idFactory: () => "fixture"
    });
    const first = await service.getStoredResults("source", undefined, viewer, 1, 1);
    assert.equal(first.total,1);
    assert.equal(first.hasMore,false);
    assert.equal(first.results[0].candidate.id,"staff-lost");
    const next = await service.getStoredResults("source", undefined, viewer, 2, 1);
    assert.equal(next.total,1);
    assert.equal(next.hasMore,false);
    assert.deepEqual(next.results,[]);
  });
}
