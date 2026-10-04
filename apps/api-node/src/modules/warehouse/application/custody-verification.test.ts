import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createTestWarehouseUseCases } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { WarehouseRepository, WarehouseItemLock, WarehouseClaimReview, WarehouseItem } from "./warehouse.repository.port.js";

function fixture() {
  const item: WarehouseItemLock = { id: randomUUID(), postId: randomUUID(), handoverPointId: randomUUID(), status: "RECEIVED", conditionNotes: "Good", storageCode: "A1", retentionDeadline: new Date(), legalHold: false, reservedClaimId: null };
  const claim: WarehouseClaimReview = { claimId: randomUUID(), recipientId: randomUUID(), fullName: "Owner", description: "Private identifying feature", status: "CONVERSATION_OPEN", verified: false };
  const writes: unknown[] = [];
  const repository = unexpectedPort<WarehouseRepository>("warehouse");
  repository.isStaff = async () => true;
  repository.lockItemForUpdate = async () => item;
  repository.lockPhysicalPost = async () => {};
  repository.lockReturnClaim = async () => claim;
  repository.hasBlockingCases = async (_post, _db, completingClaim) => { assert.equal(completingClaim, claim.claimId); return false; };
  repository.recordStaffVerification = async input => { writes.push(input); claim.verified = true; claim.status = "ACCEPTED"; };
  repository.createStorageLog = async () => {};
  repository.getPostInfoForIntake = async () => null;
  repository.findItemById = async () => ({ postId: item.postId }) as WarehouseItem;
  repository.listReturnClaimReviews = async () => [claim];
  const service = createTestWarehouseUseCases({ warehouseRepository: repository });
  const input = { claimId: claim.claimId, recipientId: claim.recipientId, verified: true, reason: "Checked unique concealed feature and identity at desk" };
  return { item, claim, repository, service, writes, input };
}

test("Staff explicitly verifies an unverified custody claim without changing physical state; replay adds no decision", async () => {
  const f = fixture();
  assert.equal(f.claim.verified, false);
  const result = await f.service.verifyCustodyClaim(f.item.id, f.input, "staff");
  assert.equal(result.claims[0].verified, true);
  assert.equal(f.item.status, "RECEIVED");
  await f.service.verifyCustodyClaim(f.item.id, f.input, "staff");
  assert.equal(f.writes.length, 1);
});

for (const scenario of ["non-staff", "no physical post", "legal hold", "terminal", "other reservation", "other claim/dispute", "wrong recipient", "wrong post/claim", "missing confirmation", "missing rationale"]) {
  test(`Staff custody verification rejects ${scenario} without a decision`, async () => {
    const f = fixture();
    if (scenario === "non-staff") f.repository.isStaff = async () => false;
    if (scenario === "no physical post") f.item.postId = null;
    if (scenario === "legal hold") f.item.legalHold = true;
    if (scenario === "terminal") f.item.status = "DONATED";
    if (scenario === "other reservation") f.item.reservedClaimId = randomUUID();
    if (scenario === "other claim/dispute") f.repository.hasBlockingCases = async () => true;
    if (scenario === "wrong recipient") f.input.recipientId = randomUUID();
    if (scenario === "wrong post/claim") f.repository.lockReturnClaim = async () => null;
    if (scenario === "missing confirmation") f.input.verified = false;
    if (scenario === "missing rationale") f.input.reason = "ok";
    await assert.rejects(f.service.verifyCustodyClaim(f.item.id, f.input, "staff"));
    assert.equal(f.writes.length, 0);
    assert.equal(f.claim.status, "CONVERSATION_OPEN");
  });
}
