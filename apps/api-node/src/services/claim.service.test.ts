import assert from "node:assert/strict";
import test from "node:test";
import { claimRepository } from "../repositories/claim.repository.js";
import { claimService } from "./claim.service.js";

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
      (error: unknown) => (error as { status?: number }).status === 404
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
