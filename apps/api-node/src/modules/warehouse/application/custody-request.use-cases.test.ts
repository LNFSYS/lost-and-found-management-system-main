import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { createCustodyUseCases } from "./custody-request.use-cases.js";
import type { CustodyRepository, CustodyRequestRecord } from "./custody.repository.port.js";
import type { WarehouseRepository } from "./warehouse.repository.port.js";
import type { NotificationRepository } from "../../notifications/application/index.js";

const request = {
  id: "request-1", postId: "post-1", finderId: "finder-1", claimId: null,
  status: "ACCEPTED", reason: "VOLUNTARY", reasonNotes: null,
  proposedHandoverPointId: null, proposedTime: null, confirmedHandoverPointId: "hp-1",
  assignedHandlerId: "staff-1", warehouseItemId: null, idempotencyKey: null,
  createdAt: "2026-09-20T00:00:00.000Z", updatedAt: "2026-09-20T00:00:00.000Z"
} satisfies CustodyRequestRecord;

const post = {
  id: "post-1", userId: "finder-1", type: "FOUND", status: "OPEN", title: "Bag",
  description: "Bag", categoryId: null, areaId: null, buildingId: null,
  roomText: null, handoverPointId: "hp-1", contactInfo: null
};

function service(custody: Partial<CustodyRepository>, warehouse: Partial<WarehouseRepository> = {}) {
  return createCustodyUseCases({
    custodyRepository: custody as CustodyRepository,
    warehouseRepository: warehouse as WarehouseRepository,
    notificationRepository: { create: async () => null } as unknown as NotificationRepository,
    withTransaction: async (work) => work({} as TransactionContext),
    id: () => "new-id"
  });
}

test("custody detail rejects a signed-in non-owner before reading logs", async () => {
  let logsRead = false;
  const useCases = service({
    findCustodyRequestById: async () => request,
    listCustodyLogs: async () => { logsRead = true; return []; }
  });
  await assert.rejects(useCases.getCustodyRequestDetail(request.id, "stranger", false), { code: "forbidden" });
  assert.equal(logsRead, false);
  assert.equal((await useCases.getCustodyRequestDetail(request.id, "finder-1", false)).request.id, request.id);
});

test("custody request rejects a forged claim from another post", async () => {
  let inserted = false;
  const useCases = service({
    findPostDetailsForIntake: async () => post,
    findClaimPostId: async () => "another-post",
    createCustodyRequest: async () => { inserted = true; }
  });
  await assert.rejects(useCases.createCustodyRequest({ postId: post.id, claimId: "claim-1", reason: "VOLUNTARY" }, post.userId), { code: "bad_request" });
  assert.equal(inserted, false);
});

test("custody request rejects an inactive found post", async () => {
  const useCases = service({ findPostDetailsForIntake: async () => ({ ...post, status: "HIDDEN" }) });
  await assert.rejects(useCases.createCustodyRequest({ postId: post.id, reason: "VOLUNTARY" }, post.userId), { code: "bad_request" });
});

test("custody request rejects a lost post even when the actor owns it", async () => {
  const useCases = service({ findPostDetailsForIntake: async () => ({ ...post, type: "LOST" }) });
  await assert.rejects(useCases.createCustodyRequest({ postId: post.id, reason: "VOLUNTARY" }, post.userId), { code: "bad_request" });
});

test("intake rechecks the locked request and replays the existing warehouse item", async () => {
  let reads = 0;
  let locks = 0;
  let creates = 0;
  const existingItem = { id: "warehouse-1", itemName: "Bag" };
  const useCases = service({
    findCustodyRequestById: async () => ++reads === 1 ? request : { ...request, status: "INTAKED", warehouseItemId: existingItem.id },
    lockCustodyRequestById: async () => { locks++; },
    findPostDetailsForIntake: async () => post
  }, {
    findHandoverPointById: async () => "hp-1",
    getConfigInt: async () => 60,
    createItem: async () => { creates++; },
    findItemById: async () => existingItem as never
  });
  const result = await useCases.confirmStaffIntake(request.id, { conditionNotes: "Good" }, "staff-1");
  assert.equal(result.id, existingItem.id);
  assert.equal(locks, 1);
  assert.equal(creates, 0);
});
