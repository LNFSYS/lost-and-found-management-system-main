import assert from "node:assert/strict";
import test from "node:test";
import { createTestClaimUseCases } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { ClaimRepository } from "./claim.repository.port.js";

function legacyRepository() {
  const repository = unexpectedPort<ClaimRepository>("read-only claim repository");
  repository.findById = async () => ({
    id: "claim", lostPostId: null, foundPostId: "post", claimantId: "owner", finderId: "finder", status: "PENDING", finderDecision: "PENDING",
    description: null, approximateLostAt: null, approximateLocation: null, rejectionReason: null, moreInfoRequest: null,
    acceptedAt: null, rejectedAt: null, cancelledAt: null, createdAt: "2026-10-04T00:00:00Z", updatedAt: "2026-10-04T00:00:00Z",
    claimant: { id: "owner", fullName: "Owner", email: "owner@example.invalid" }, finder: { id: "finder", fullName: "Finder", email: "finder@example.invalid" },
    posts: { lost: null, found: { id: "post", title: "Keys" } }, roomId: null
  });
  repository.findParticipant = async (_claimId, actor) => actor === "owner" || actor === "finder" ? {
    claimId: "claim", userId: actor, role: actor === "owner" ? "CLAIMANT" : "FINDER", consentStatus: actor === "owner" ? "ACCEPTED" : "PENDING", joinedAt: null, fullName: actor
  } : null;
  repository.listParticipants = async () => [];
  repository.findClaimItemContext = async () => null;
  repository.findVerificationContext = async () => ({ foundPostId: "post", categoryName: "keys", parentCategoryName: null });
  repository.listVerificationQuestions = async () => [];
  repository.listVerificationAuditEvents = async () => [];
  repository.findRoomByClaim = async () => null;
  return repository;
}

for (const reader of ["getClaim", "getVerification", "getVerificationTemplates"] as const) {
  test(`${reader} rejects an outsider before any legacy transaction or consent repair`, async () => {
    const service = createTestClaimUseCases({ claimRepository: legacyRepository(), withTransaction: async () => { throw new Error("GET started a mutation transaction"); } });
    await assert.rejects(service[reader]("claim", "outsider"), e => (e as { code?: string }).code === "not_found");
  });
}

test("participants read PENDING legacy claims without accepting consent or opening rooms", async () => {
  const service = createTestClaimUseCases({ claimRepository: legacyRepository(), withTransaction: async () => { throw new Error("GET started a mutation transaction"); } });
  assert.equal((await service.getClaim("claim", "owner")).status, "PENDING");
  assert.equal((await service.getClaim("claim", "finder")).canSend, false);
  assert.equal((await service.getVerification("claim", "finder")).status, "PENDING");
  await assert.rejects(service.getVerificationTemplates("claim", "finder"), e => (e as { code?: string }).code === "not_found");
});
