import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createTestWarehouseUseCases } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { WarehouseRepository, WarehouseItemLock, WarehouseItem } from "./warehouse.repository.port.js";

function expiredFixture() {
  const item: WarehouseItemLock = { id: randomUUID(), postId: null, handoverPointId: randomUUID(), status: "EXPIRED", conditionNotes: "Good", storageCode: "A1", retentionDeadline: new Date("2026-01-01"), legalHold: false, reservedClaimId: null };
  const proofId: string = randomUUID();
  const repository = unexpectedPort<WarehouseRepository>("warehouse");
  let completed = 0, attached = false;
  repository.isStaff = async () => true;
  repository.lockItemForUpdate = async () => ({ ...item });
  repository.lockPhysicalPost = async () => {};
  repository.hasBlockingCases = async () => false;
  repository.findProof = async () => ({ id: proofId, itemId: item.id, actorId: "staff", storageRef: "private", format: "jpeg", attached: false });
  repository.attachProof = async () => { attached = true; };
  repository.completeReturn = async input => { assert.equal(input.claimId, null); completed++; return null; };
  repository.updateItemState = async (_id, state) => { assert.equal(state.status, "RETURNED"); assert.ok(state.returnedAt); item.status = "RETURNED"; };
  repository.createStorageLog = async input => { assert.equal(input.fromStatus, "EXPIRED"); assert.equal(input.toStatus, "RETURNED"); };
  repository.findItemById = async () => ({ id: item.id, status: item.status }) as WarehouseItem;
  const service = createTestWarehouseUseCases({ warehouseRepository: repository });
  return { item, repository, service, completed: () => completed, attached: () => attached, input: { receiverName: "Owner", receiverIdentity: "ID1234", receiverPhone: "0359123456", proofImage: proofId } };
}

test("expired but undisposed property uses the canonical return and private evidence", async () => {
  const f = expiredFixture();
  assert.equal((await f.service.returnItem(f.item.id, f.input, "staff"))?.status, "RETURNED");
  assert.equal(f.completed(), 1);
  assert.equal(f.attached(), true);
});

for (const scenario of ["legal hold", "blocking case", "unverified claimant", "wrong proof", "missing proof", "DISPOSED", "DONATED", "TRANSFERRED", "PENDING_APPROVAL"]) {
  test(`canonical return still rejects ${scenario} for expired property`, async () => {
    const f = expiredFixture();
    if (scenario === "legal hold") f.item.legalHold = true;
    if (scenario === "blocking case") f.repository.hasBlockingCases = async () => true;
    if (scenario === "unverified claimant") { Object.assign(f.input, { claimId: randomUUID(), recipientId: randomUUID() }); f.repository.verifiedRecipient = async () => false; }
    if (scenario === "wrong proof") f.repository.findProof = async () => null;
    if (scenario === "missing proof") f.input.proofImage = "";
    if (["DISPOSED", "DONATED", "TRANSFERRED", "PENDING_APPROVAL"].includes(scenario)) f.item.status = scenario as WarehouseItemLock["status"];
    await assert.rejects(f.service.returnItem(f.item.id, f.input, "staff"));
    assert.equal(f.completed(), 0);
    assert.equal(f.attached(), false);
  });
}
