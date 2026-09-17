import assert from "node:assert/strict";
import test from "node:test";
import { claimRepository, claimService, createTestClaimUseCases, matchingRepository, notificationRepository } from "../../../test/use-case-fixtures.js";

const claimId = "11111111-1111-4111-8111-111111111111";
const claimantId = "22222222-2222-4222-8222-222222222222";
const outsideUserId = "33333333-3333-4333-8333-333333333333";

function sampleClaim() {
  return {
    id: claimId,
    lostPostId: "44444444-4444-4444-8444-444444444444",
    foundPostId: "55555555-5555-4555-8555-555555555555",
    claimantId,
    finderId: "66666666-6666-4666-8666-666666666666",
    status: "CONVERSATION_OPEN" as const,
    finderDecision: "ACCEPTED" as const,
    description: "Mô tả riêng",
    approximateLostAt: null,
    approximateLocation: null,
    rejectionReason: null,
    moreInfoRequest: null,
    acceptedAt: "2026-09-03T00:00:00.000Z",
    rejectedAt: null,
    cancelledAt: null,
    createdAt: "2026-09-03T00:00:00.000Z",
    updatedAt: "2026-09-03T00:00:00.000Z",
    claimant: { id: claimantId, fullName: "Claimant", email: "claimant@example.com" },
    finder: { id: "66666666-6666-4666-8666-666666666666", fullName: "Finder", email: "finder@example.com" },
    posts: { lost: { id: "44444444-4444-4444-8444-444444444444", title: "Ví bị mất" }, found: { id: "55555555-5555-4555-8555-555555555555", title: "Ví nhặt được" } },
    roomId: "77777777-7777-4777-8777-777777777777"
  };
}

test("claim details deny an outside user without revealing the claim", async () => {
  const originalFindById = claimRepository.findById;
  const originalFindParticipant = claimRepository.findParticipant;
  try {
    claimRepository.findById = async () => sampleClaim();
    claimRepository.findParticipant = async () => null;
    await assert.rejects(
      () => claimService.getClaim(claimId, outsideUserId),
      (error: unknown) => (error as { code?: string; }).code === "not_found"
    );
  } finally {
    claimRepository.findById = originalFindById;
    claimRepository.findParticipant = originalFindParticipant;
  }
});

test("authorized claim details expose participant-safe data only", async () => {
  const originalFindById = claimRepository.findById;
  const originalFindParticipant = claimRepository.findParticipant;
  const originalListParticipants = claimRepository.listParticipants;
  try {
    claimRepository.findById = async () => sampleClaim();
    claimRepository.findParticipant = async () => ({ claimId, userId: claimantId, role: "CLAIMANT", consentStatus: "ACCEPTED", joinedAt: "2026-09-03T00:00:00.000Z", fullName: "Claimant" });
    claimRepository.listParticipants = async () => [{ claimId, userId: claimantId, role: "CLAIMANT", consentStatus: "ACCEPTED", joinedAt: "2026-09-03T00:00:00.000Z", fullName: "Claimant" }];
    const result = await claimService.getClaim(claimId, claimantId);
    assert.equal(result.canSend, true);
    assert.equal(JSON.stringify(result).includes("secure_url"), false);
    assert.equal(JSON.stringify(result).includes("private://"), false);
  } finally {
    claimRepository.findById = originalFindById;
    claimRepository.findParticipant = originalFindParticipant;
    claimRepository.listParticipants = originalListParticipants;
  }
});

test("claim list batches participant loading and exposes pagination metadata", async () => {
  const originalListForUser = claimRepository.listForUser;
  const originalListParticipantsForClaims = claimRepository.listParticipantsForClaims;
  const participant = { claimId, userId: claimantId, role: "CLAIMANT" as const, consentStatus: "ACCEPTED" as const, joinedAt: "2026-09-03T00:00:00.000Z", fullName: "Claimant" };
  let requestedQuery: unknown;
  let requestedClaimIds: string[] = [];
  claimRepository.listForUser = async (_userId, query) => {
    requestedQuery = query;
    return { total: 1, page: query.page, pageSize: query.pageSize, hasMore: false, items: [sampleClaim()] };
  };
  claimRepository.listParticipantsForClaims = async (claimIds) => {
    requestedClaimIds = claimIds;
    return new Map([[claimId, [participant]]]);
  };
  try {
    const result = await claimService.listClaims(claimantId, { page: 2, pageSize: 1 });
    assert.deepEqual(requestedQuery, { page: 2, pageSize: 1 });
    assert.deepEqual(requestedClaimIds, [claimId]);
    assert.deepEqual(result.items[0].participants, [participant]);
    assert.equal(result.hasMore, false);
  } finally {
    claimRepository.listForUser = originalListForUser;
    claimRepository.listParticipantsForClaims = originalListParticipantsForClaims;
  }
});

test("creating a claim for an already requested found post reopens the existing request", async () => {
  const existing = sampleClaim();
  const originalFindByRequestKey = claimRepository.findByRequestKey;
  const originalFindMatchPairForUpdate = claimRepository.findMatchPairForUpdate;
  const originalFindByFoundPostForClaimant = claimRepository.findByFoundPostForClaimant;
  const originalFindById = claimRepository.findById;
  const originalFindParticipant = claimRepository.findParticipant;
  const originalListParticipants = claimRepository.listParticipants;
  const originalGetConfigNumber = matchingRepository.getConfigNumber;
  const differentLostPostId = "88888888-8888-4888-8888-888888888888";

  try {
    claimRepository.findByRequestKey = async () => null;
    matchingRepository.getConfigNumber = async () => 0.6;
    claimRepository.findMatchPairForUpdate = async () => ({
      lost_post_id: differentLostPostId,
      found_post_id: existing.foundPostId,
      claimant_id: claimantId,
      finder_id: existing.finderId,
      total_score: 0.83,
      score_tier: "NOTIFY"
    });
    claimRepository.findByFoundPostForClaimant = async () => existing;
    claimRepository.findById = async () => existing;
    claimRepository.findParticipant = async () => ({ claimId, userId: claimantId, role: "CLAIMANT", consentStatus: "ACCEPTED", joinedAt: existing.createdAt, fullName: "Claimant" });
    claimRepository.listParticipants = async () => [];

    const result = await claimService.createClaim(claimantId, {
      lostPostId: differentLostPostId,
      foundPostId: existing.foundPostId,
      requestKey: "new-request-key"
    });

    assert.equal(result.id, existing.id);
    assert.equal(result.idempotent, true);
  } finally {
    claimRepository.findByRequestKey = originalFindByRequestKey;
    claimRepository.findMatchPairForUpdate = originalFindMatchPairForUpdate;
    claimRepository.findByFoundPostForClaimant = originalFindByFoundPostForClaimant;
    claimRepository.findById = originalFindById;
    claimRepository.findParticipant = originalFindParticipant;
    claimRepository.listParticipants = originalListParticipants;
    matchingRepository.getConfigNumber = originalGetConfigNumber;
  }
});

test("direct claims use the post owner as finder instead of a matching-only pair", async () => {
  const foundPostId = "99999999-9999-4999-8999-999999999999";
  const finderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const originalFindByRequestKey = claimRepository.findByRequestKey;
  const originalFindClaimablePostForUpdate = claimRepository.findClaimablePostForUpdate;
  const originalFindByFoundPostForClaimant = claimRepository.findByFoundPostForClaimant;
  const originalCreateClaim = claimRepository.createClaim;
  const originalAddParticipant = claimRepository.addParticipant;
  const originalFindById = claimRepository.findById;
  const originalFindParticipant = claimRepository.findParticipant;
  const originalListParticipants = claimRepository.listParticipants;
  const originalWriteAudit = claimRepository.writeAudit;
  const originalCreateNotification = notificationRepository.create;
  let created: Parameters<typeof claimRepository.createClaim>[0] | undefined;
  const participants: Array<Parameters<typeof claimRepository.addParticipant>[0]> = [];
  let notifiedUserId: string | undefined;

  try {
    claimRepository.findByRequestKey = async () => null;
    claimRepository.findClaimablePostForUpdate = async () => ({ id: foundPostId, ownerId: finderId });
    claimRepository.findByFoundPostForClaimant = async () => null;
    claimRepository.createClaim = async (input) => { created = input; };
    claimRepository.addParticipant = async (input) => { participants.push(input); };
    claimRepository.writeAudit = async () => undefined;
    notificationRepository.create = async (input) => {
      notifiedUserId = input.userId;
      return null;
    };
    claimRepository.findById = async (id) => ({
      ...sampleClaim(),
      id,
      lostPostId: null,
      foundPostId,
      finderId,
      status: "PENDING",
      finderDecision: "PENDING",
      acceptedAt: null,
      posts: { lost: null, found: { id: foundPostId, title: "Ví nhặt được" } },
      roomId: null
    });
    claimRepository.findParticipant = async (id, userId) => ({
      claimId: id,
      userId,
      role: userId === claimantId ? "CLAIMANT" : "FINDER",
      consentStatus: userId === claimantId ? "ACCEPTED" : "PENDING",
      joinedAt: userId === claimantId ? "2026-09-03T00:00:00.000Z" : null,
      fullName: userId === claimantId ? "Claimant" : "Finder"
    });
    claimRepository.listParticipants = async () => [];

    const result = await claimService.createClaim(claimantId, { postId: foundPostId, requestKey: "direct-claim-key" });

    assert.equal(created?.lostPostId, undefined);
    assert.equal(created?.foundPostId, foundPostId);
    assert.deepEqual(participants, [
      { claimId: created?.id, userId: claimantId, role: "CLAIMANT", consentStatus: "ACCEPTED" },
      { claimId: created?.id, userId: finderId, role: "FINDER", consentStatus: "PENDING" }
    ]);
    assert.equal(notifiedUserId, finderId);
    assert.equal(result.status, "PENDING");
    assert.equal(result.canSend, false);
  } finally {
    claimRepository.findByRequestKey = originalFindByRequestKey;
    claimRepository.findClaimablePostForUpdate = originalFindClaimablePostForUpdate;
    claimRepository.findByFoundPostForClaimant = originalFindByFoundPostForClaimant;
    claimRepository.createClaim = originalCreateClaim;
    claimRepository.addParticipant = originalAddParticipant;
    claimRepository.findById = originalFindById;
    claimRepository.findParticipant = originalFindParticipant;
    claimRepository.listParticipants = originalListParticipants;
    claimRepository.writeAudit = originalWriteAudit;
    notificationRepository.create = originalCreateNotification;
  }
});

test("sending a chat message pushes a privacy-safe realtime notification to the counterpart", async () => {
  const claim = sampleClaim();
  const room = { id: claim.roomId!, claimId: claim.id, createdAt: claim.createdAt };
  const realtimeEvents: unknown[] = [];
  const service = createTestClaimUseCases({
    realtimeNotifier: {
      publishNotification(input) {
        realtimeEvents.push(input);
        return { delivered: 1 };
      }
    }
  });
  const originalFindById = claimRepository.findById;
  const originalFindParticipant = claimRepository.findParticipant;
  const originalFindRoomByClaim = claimRepository.findRoomByClaim;
  const originalFindByIdForUpdate = claimRepository.findByIdForUpdate;
  const originalCreateMessage = claimRepository.createMessage;
  const originalWriteAudit = claimRepository.writeAudit;
  const originalCreateNotification = notificationRepository.create;

  try {
    claimRepository.findById = async () => claim;
    claimRepository.findParticipant = async (_claimId, userId) => ({
      claimId,
      userId,
      role: userId === claimantId ? "CLAIMANT" : "FINDER",
      consentStatus: "ACCEPTED",
      joinedAt: claim.createdAt,
      fullName: userId === claimantId ? "Claimant" : "Finder"
    });
    claimRepository.findRoomByClaim = async () => room;
    claimRepository.findByIdForUpdate = async () => claim;
    claimRepository.createMessage = async () => ({
      id: "99999999-9999-4999-8999-999999999999",
      roomId: room.id,
      sender: { id: claimantId, fullName: "Claimant" },
      clientMessageId: "retry-1",
      content: "serial private secret text",
      messageType: "TEXT",
      isRead: false,
      readAt: null,
      createdAt: claim.createdAt
    });
    claimRepository.writeAudit = async () => undefined;
    notificationRepository.create = async (input) => ({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      isRead: false,
      readAt: null,
      createdAt: claim.createdAt
    });

    const message = await service.sendMessage(claimId, claimantId, {
      content: "serial private secret text",
      clientMessageId: "retry-1"
    });

    assert.equal(message.id, "99999999-9999-4999-8999-999999999999");
    assert.equal(realtimeEvents.length, 1);
    assert.equal((realtimeEvents[0] as { userId: string; }).userId, claim.finderId);
    assert.equal((realtimeEvents[0] as { workflow: string; }).workflow, "CHAT");
    assert.equal((realtimeEvents[0] as { roomId: string; }).roomId, room.id);
    assert.equal(JSON.stringify(realtimeEvents).includes("serial private secret text"), false);
  } finally {
    claimRepository.findById = originalFindById;
    claimRepository.findParticipant = originalFindParticipant;
    claimRepository.findRoomByClaim = originalFindRoomByClaim;
    claimRepository.findByIdForUpdate = originalFindByIdForUpdate;
    claimRepository.createMessage = originalCreateMessage;
    claimRepository.writeAudit = originalWriteAudit;
    notificationRepository.create = originalCreateNotification;
  }
});
