import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { isolatedJourney, withActorJourney } from "../test/actor-journey-fixture.js";

test("publication deletion preserves active custody, claim and legal-hold workflows", isolatedJourney, async () => withActorJourney(async f => {
  const { ids, services, claims, pool } = f;
  const direct = await claims.createDirectMessage(ids.owner, { postId: ids.found, content: "These are mine" });
  await claims.decideVerification(direct.claim.id, ids.finder, { decision: "ESCALATE_TO_CUSTODY", reason: "Staff custody", handoverPointId: f.point, idempotencyKey: randomUUID() });
  await assert.rejects(services.postService.softDeletePost(ids.found, ids.finder), e => (e as { code?: string }).code === "conflict");
  const [requests] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id = ?", [direct.claim.id]);
  const requestId = String(requests[0]!.id);
  const intake = await services.custodyRequestService.confirmIntake(requestId, await f.evidence(requestId), ids.staff);
  const itemId = intake!.warehouseItemId!;
  await assert.rejects(services.postService.softDeletePost(ids.found, ids.finder), e => (e as { code?: string }).code === "conflict");
  await assert.rejects(services.postService.softDeletePost(ids.found, ids.outsider), e => (e as { code?: string }).code === "not_found");
  assert.equal((await services.warehouseService.returnClaimReviews(itemId, ids.staff)).claims[0]!.recipientId, ids.owner);
  await services.warehouseService.verifyCustodyClaim(itemId, { claimId: direct.claim.id, recipientId: ids.owner, verified: true, reason: "Compared private markings and ID" }, ids.staff);
  const proof = await services.warehouseService.uploadProof(itemId, f.image, ids.staff);
  await services.warehouseService.returnItem(itemId, { claimId: direct.claim.id, recipientId: ids.owner, receiverName: "Fixture", receiverIdentity: "ID-123456", receiverPhone: "0359123456", proofImage: proof.id }, ids.staff);
  await services.warehouseService.legalHold(itemId, true, "Preserve history", ids.admin);
  await assert.rejects(services.postService.softDeletePost(ids.found, ids.finder));
  await services.warehouseService.legalHold(itemId, false, "History released", ids.admin);
  await services.postService.softDeletePost(ids.found, ids.finder);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT deleted_at FROM posts WHERE id = ?", [ids.found]);
  assert.ok(rows[0]!.deleted_at);
  assert.equal((await pFeedback()).finderId, ids.finder);
  async function pFeedback() {
    const [completed] = await pool.query<RowDataPacket[]>("SELECT appointment_id FROM warehouse_completed_returns WHERE warehouse_item_id = ?", [itemId]);
    return (await f.p.returnFeedbackRepository.findAppointmentForFeedback(String(completed[0]!.appointment_id)))!;
  }
}));

test("deletion before custody prevents intake, while cancellation permits deletion", isolatedJourney, async () => withActorJourney(async f => {
  await f.services.postService.softDeletePost(f.ids.found, f.ids.finder);
  await assert.rejects(f.services.custodyRequestService.createRequest({ postId: f.ids.found, handoverPointId: f.point }, f.ids.finder));
  await assert.rejects(f.services.warehouseService.createItem({ ...await f.evidence(), postId: f.ids.found, itemName: "Deleted source", handoverPointId: f.point }, f.ids.staff));
  const newPost = randomUUID();
  await f.pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,'FOUND','Keys','keys','Fixture','fixture',?)", [newPost,f.ids.finder,f.categoryId]);
  const request = await f.services.custodyRequestService.createRequest({ postId: newPost, handoverPointId: f.point }, f.ids.finder);
  await f.services.custodyRequestService.cancelRequest(request.request.id, { reason: "No handover" }, f.ids.finder);
  await f.services.postService.softDeletePost(newPost, f.ids.finder);
}));

test("concurrent post deletion and walk-in intake cannot both succeed", isolatedJourney, async () => withActorJourney(async f => {
  const evidence = await f.evidence();
  const original = f.p.warehouseRepository.createItem;
  let started!: () => void, release!: () => void;
  const locked = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  f.p.warehouseRepository.createItem = async (input, db) => {
    started();
    await gate;
    return original(input, db);
  };
  const intake = f.services.warehouseService.createItem({ ...evidence, postId: f.ids.found, itemName: "Keys", handoverPointId: f.point }, f.ids.staff);
  await locked;
  const deletion = f.services.postService.softDeletePost(f.ids.found, f.ids.finder);
  const settled = Promise.allSettled([deletion, intake]);
  try {
    await new Promise(resolve => setTimeout(resolve, 50));
  } finally { release(); }
  const results = await settled;
  assert.equal(results[0]!.status, "rejected");
  assert.equal(results[1]!.status, "fulfilled");
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  const [rows] = await f.pool.query<RowDataPacket[]>("SELECT p.deleted_at,wi.id AS item_id FROM posts p LEFT JOIN warehouse_items wi ON wi.post_id = p.id WHERE p.id = ?", [f.ids.found]);
  assert.equal(Boolean(rows[0]!.deleted_at) && Boolean(rows[0]!.item_id), false);
}));

test("a post-level dispute blocks deletion until explicitly resolved", isolatedJourney, async () => withActorJourney(async f => {
  const reportId = randomUUID();
  await f.p.transaction(db => f.p.reportRepository.create({ id: reportId, reporterId: f.ids.owner,
    target: { entityType: "POST", entityId: f.ids.found, sourceType: "POST", sourceId: f.ids.found, title: "Fixture", status: "OPEN" },
    reason: "Dispute", details: null, idempotencyKey: randomUUID(), requestHash: "fixture" }, db));
  await assert.rejects(f.services.postService.softDeletePost(f.ids.found, f.ids.finder));
  await f.pool.execute("UPDATE reports SET status = 'REVIEWED' WHERE id = ?", [reportId]);
  await f.services.postService.softDeletePost(f.ids.found, f.ids.finder);
}));
