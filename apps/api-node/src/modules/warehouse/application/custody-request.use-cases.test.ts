import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createCustodyRequestUseCases } from "./custody-request.use-cases.js";
import type { CustodyRequestRepository } from "./custody-request.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import { fakeTransaction } from "../../../test/use-case-fixtures.js";
import { canTransitionCustodyStatus, isCustodyTerminal } from "../domain/custody-request-policy.js";

test("allows PENDING → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "ACCEPTED"), true);
});

test("allows PENDING → REJECTED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "REJECTED"), true);
});

test("allows PENDING → CANCELLED transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "CANCELLED"), true);
});

test("blocks PENDING → INTAKED direct transition", () => {
  assert.equal(canTransitionCustodyStatus("PENDING", "INTAKED"), false);
});

test("allows ACCEPTED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("ACCEPTED", "INTAKED"), true);
});

test("allows ACCEPTED → CANCELLED transition", () => {
  assert.equal(canTransitionCustodyStatus("ACCEPTED", "CANCELLED"), true);
});

test("blocks REJECTED → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("REJECTED", "ACCEPTED"), false);
});

test("blocks REJECTED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("REJECTED", "INTAKED"), false);
});

test("blocks CANCELLED → ACCEPTED transition", () => {
  assert.equal(canTransitionCustodyStatus("CANCELLED", "ACCEPTED"), false);
});

test("blocks CANCELLED → INTAKED transition", () => {
  assert.equal(canTransitionCustodyStatus("CANCELLED", "INTAKED"), false);
});

test("blocks INTAKED → any transition (terminal)", () => {
  assert.equal(canTransitionCustodyStatus("INTAKED", "PENDING"), false);
  assert.equal(canTransitionCustodyStatus("INTAKED", "ACCEPTED"), false);
  assert.equal(canTransitionCustodyStatus("INTAKED", "CANCELLED"), false);
});

test("identifies terminal states correctly", () => {
  assert.equal(isCustodyTerminal("REJECTED"), true);
  assert.equal(isCustodyTerminal("CANCELLED"), true);
  assert.equal(isCustodyTerminal("INTAKED"), true);
  assert.equal(isCustodyTerminal("PENDING"), false);
  assert.equal(isCustodyTerminal("ACCEPTED"), false);
});

for (const [name, eligible] of [["invalid physical FOUND ownership", false], ["mismatched claim/room source", true]] as const) {
  test(`staff cannot accept a legacy custody request with ${name}`, async () => {
    const requestId = randomUUID(), postId = randomUUID(), requesterId = randomUUID(), claimId = randomUUID(), pointId = randomUUID();
    let validated = false;
    const repository = unexpectedPort<CustodyRequestRepository>("custody");
    repository.isStaff = async () => true;
    repository.lockForUpdate = async () => ({ id: requestId, postId, requesterId, claimId, roomId: null,
      status: "PENDING", intakeType: "CUSTODY_TRANSFER", handoverPointId: pointId, warehouseItemId: null });
    repository.lockEligiblePost = async () => eligible;
    repository.validateClaimLink = async () => { validated = true; return false; };
    const warehouse = unexpectedPort<WarehouseRepository>("warehouse"); warehouse.findHandoverPointById = async () => pointId;
    const service = createCustodyRequestUseCases({ custodyRequestRepository: repository, warehouseRepository: warehouse, withTransaction: fakeTransaction, id: randomUUID });
    await assert.rejects(service.acceptRequest(requestId, { handoverPointId: pointId }, randomUUID()), error => (error as { code: string }).code === "conflict");
    assert.equal(validated, eligible);
  });
}
