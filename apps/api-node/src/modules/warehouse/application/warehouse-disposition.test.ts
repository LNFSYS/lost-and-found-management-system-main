import assert from "node:assert/strict";
import test from "node:test";
import { createTestWarehouseUseCases } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { WarehouseRepository, WarehouseItemLock } from "./warehouse.repository.port.js";
import type { NotificationRepository } from "../../notifications/application/index.js";

function fixture() {
  const item: WarehouseItemLock = { id: "item", postId: "post", handoverPointId: "desk", status: "STORED", conditionNotes: null, storageCode: "A1", retentionDeadline: new Date(0), legalHold: false, reservedClaimId: null };
  const orders: Awaited<ReturnType<WarehouseRepository["listApprovals"]>> = [];
  const logs: string[] = [];
  let attached = false;
  const repository = unexpectedPort<WarehouseRepository>("warehouse");
  repository.isStaff = async actor => ["staff", "admin", "reviewer"].includes(actor);
  repository.isAdmin = async actor => ["admin", "reviewer"].includes(actor);
  repository.lockItemForUpdate = async () => item;
  repository.lockPhysicalPost = async () => {};
  repository.hasBlockingCases = async () => false;
  repository.blockingCaseKinds = async () => await repository.hasBlockingCases(item.postId, {} as never) ? ["CLAIM"] : [];
  repository.listApprovals = async () => orders;
  repository.listAttachedProofs = async () => attached ? [{ id: "proof" }] : [];
  repository.listLogs = async () => [];
  repository.setLegalHold = async (_id, held) => { item.legalHold = held; };
  repository.createStorageLog = async input => { logs.push(input.note ?? input.action); };
  repository.createApproval = async input => { orders.push({ id: input.id, itemId: item.id, requesterId: input.actorId, requesterName: "Admin", approverName: null, target: input.target, reason: input.reason, status: "PENDING", createdAt: new Date().toISOString(), approvedAt: null, executedAt: null }); };
  repository.lockApproval = async id => orders.find(order => order.id === id) ?? null;
  repository.approveAction = async id => { orders.find(order => order.id === id)!.status = "APPROVED"; };
  repository.executeAction = async id => { orders.find(order => order.id === id)!.status = "EXECUTED"; };
  repository.updateItemState = async (_id, value) => { if (value.status) item.status = value.status; };
  repository.findProof = async () => ({ id: "proof", itemId: item.id, actorId: "staff", storageRef: "private-secret", format: "png", attached });
  repository.attachProof = async () => { attached = true; };
  return { item, orders, logs, repository, service: createTestWarehouseUseCases({ warehouseRepository: repository }) };
}

test("eligible order, separate approval and evidence execution are replay safe", async () => {
  const f = fixture();
  const first = await f.service.requestDisposition("item", "DONATED", "Approved policy", "admin");
  assert.deepEqual(await f.service.requestDisposition("item", "DONATED", "Approved policy", "admin"), first);
  assert.equal(f.orders.length, 1);
  await assert.rejects(f.service.approveDisposition(first.approvalId, "admin"));
  await f.service.approveDisposition(first.approvalId, "reviewer");
  await f.service.approveDisposition(first.approvalId, "reviewer");
  await f.service.executeDisposition(first.approvalId, "staff", ["proof"]);
  await f.service.executeDisposition(first.approvalId, "staff", ["proof"]);
  assert.equal(f.item.status, "DONATED");
  assert.equal(f.logs.length, 3);
  assert.deepEqual((await f.service.dispositionContext("item", "staff")).proofs, [{ id: "proof" }]);
});

test("legal hold is Admin only and replay does not duplicate its audit", async () => {
  const f = fixture();
  await assert.rejects(f.service.legalHold("item", true, "Court request", "staff"));
  await f.service.legalHold("item", true, "Court request", "admin");
  await f.service.legalHold("item", true, "Court request", "admin");
  assert.equal(f.logs.length, 1);
  assert.equal((await f.service.dispositionContext("item", "staff")).eligible, false);
  await f.service.legalHold("item", false, "Released", "reviewer");
  assert.equal(f.logs.length, 2);
});

for (const guard of ["deadline", "hold", "reservation", "cases", "terminal"]) {
  test(`request, approval and execution recheck ${guard}`, async () => {
    const f = fixture();
    const order = await f.service.requestDisposition("item", "DISPOSED", "Retention expired", "admin");
    if (guard === "deadline") f.item.retentionDeadline = new Date(Date.now() + 86400000);
    if (guard === "hold") f.item.legalHold = true;
    if (guard === "reservation") { f.item.reservedClaimId = "claim"; f.item.status = "CLAIMED"; }
    if (guard === "cases") f.repository.hasBlockingCases = async () => true;
    if (guard === "terminal") f.item.status = "RETURNED";
    assert.equal((await f.service.dispositionContext("item", "staff")).eligible, false);
    await assert.rejects(f.service.requestDisposition("item", "DONATED", "Different request", "admin"));
    await assert.rejects(f.service.approveDisposition(order.approvalId, "reviewer"));
    f.orders[0].status = "APPROVED";
    await assert.rejects(f.service.executeDisposition(order.approvalId, "staff", ["proof"]));
    assert.equal(f.orders[0].status, "APPROVED");
    assert.deepEqual(await f.repository.listAttachedProofs("item"), []);
  });
}

test("outsiders cannot view context or evidence; Staff cannot create or approve orders", async () => {
  const f = fixture();
  await assert.rejects(f.service.dispositionContext("item", "user"));
  await assert.rejects(f.service.getProof("proof", "user"));
  await assert.rejects(f.service.requestDisposition("item", "DONATED", "Reason", "staff"));
  await assert.rejects(f.service.approveDisposition("order", "staff"));
  assert.equal(f.logs.length, 0);
});

test("execution rejects missing, duplicate and cross-user evidence", async () => {
  for (const proofIds of [[], ["proof", "proof"], ["foreign"]]) {
    const f = fixture();
    const order = await f.service.requestDisposition("item", "DISPOSED", "Retention expired", "admin");
    await f.service.approveDisposition(order.approvalId, "reviewer");
    f.repository.findProof = async () => null;
    await assert.rejects(f.service.executeDisposition(order.approvalId, "staff", proofIds));
    assert.equal(f.item.status, "STORED");
  }
});

test("retention reminders cover walk-ins before/after deadline and deduplicate without private data", async () => {
  const { repository } = fixture();
  const created = new Map<string, Parameters<NotificationRepository["create"]>[0]>();
  const published: string[] = [];
  repository.getConfigInt = async () => 7;
  repository.listStaffIds = async () => ["staff", "admin"];
  repository.listRetentionAlerts = async () => [
    { id: "walk-in", deadline: "2026-10-10T00:00:00.000Z", overdue: false },
    { id: "custody", deadline: "2026-01-01T00:00:00.000Z", overdue: true }
  ];
  repository.listOverdueRequests = async () => [];
  repository.listExpiredProofs = async () => [];
  repository.listExpiredIntakeSessions = async () => [];
  const notificationRepository = unexpectedPort<NotificationRepository>("notifications");
  notificationRepository.create = async input => {
    if (created.has(input.dedupeKey!)) return null;
    created.set(input.dedupeKey!, input);
    return { id: input.dedupeKey!, type: input.type, title: input.title, body: input.body ?? null, entityType: input.entityType ?? null, entityId: input.entityId ?? null, isRead: false, readAt: null, createdAt: "2026-01-01T00:00:00Z" };
  };
  const service = createTestWarehouseUseCases({ warehouseRepository: repository, notificationRepository,
    publishCustodyNotification: async (userId, value) => { published.push(`${userId}:${value.id}`); } });
  await service.runMaintenance();
  await service.runMaintenance();
  assert.equal(created.size, 4);
  assert.equal(published.length, 4);
  assert.deepEqual(new Set([...created.values()].map(n => n.type)), new Set(["WAREHOUSE_DUE_SOON", "WAREHOUSE_OVERDUE"]));
  for (const event of created.values()) {
    assert.ok(["staff", "admin"].includes(event.userId));
    assert.equal(event.entityType, "WAREHOUSE_ITEM");
    assert.doesNotMatch(JSON.stringify(event), /private-secret|evidence|contact|email/);
  }
});
