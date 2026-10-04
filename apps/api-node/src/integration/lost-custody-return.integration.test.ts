import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { isolatedJourney, withActorJourney } from "../test/actor-journey-fixture.js";
import { sqlExecutor } from "../shared/infrastructure/transaction-context.js";
import { verifyClaimConversationSchema } from "../migrations/claim-schema-verification.js";
import type { MigrationConnection } from "../migrations/migration-state.js";

for (const legacy of [false, true]) {
  test(`LOST -> linked FOUND -> custody -> Staff verification -> return (${legacy ? "legacy reversed roles" : "new participants"})`, isolatedJourney, async () => withActorJourney(async f => {
    const { pool, p, ids, claims, services, point, image } = f;
    const approval = await f.contactPhotos.analyze(ids.lost, ids.finder, image);
    assert.equal(approval.approved, true);
    const direct = await claims.createDirectMessage(ids.finder, { postId: ids.lost, sourceFoundPostId: ids.found,
      contactCheckId: approval.checkId!, content: "I found these keys", clientMessageId: randomUUID() });
    const claimId = direct.claim.id;
    if (legacy) {
      await p.transaction(async db => {
        await sqlExecutor(db).execute("DELETE FROM claim_participants WHERE claim_id = ?", [claimId]);
        await sqlExecutor(db).execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'CLAIMANT','ACCEPTED'), (?,?,'FINDER','ACCEPTED')", [claimId,ids.finder,claimId,ids.owner]);
      });
    }
    const connection = await pool.getConnection();
    try { await verifyClaimConversationSchema(connection as unknown as MigrationConnection); }
    finally { connection.release(); }
    assert.equal((await claims.getClaim(claimId, ids.finder)).finderId, ids.finder);
    assert.equal((await claims.getVerification(claimId, ids.owner)).participantRole, "CLAIMANT");
    await claims.decideVerification(claimId, ids.finder, { decision: "ESCALATE_TO_CUSTODY", reason: "Transfer to Staff", handoverPointId: point, idempotencyKey: randomUUID() });
    const [requests] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id = ?", [claimId]);
    const requestId = String(requests[0]!.id);
    const receipt = await services.custodyRequestService.confirmIntake(requestId, await f.evidence(requestId), ids.staff);
    const itemId = receipt!.warehouseItemId!;
    const review = await services.warehouseService.returnClaimReviews(itemId, ids.staff);
    assert.deepEqual(review.claims.map(c => [c.claimId,c.recipientId,c.verified]), [[claimId,ids.owner,false]]);
    const proof = await services.warehouseService.uploadProof(itemId, image, ids.staff);
    const input = { claimId, recipientId: ids.owner, receiverName: "Fixture owner", receiverIdentity: "ID-123456", receiverPhone: "0359123456", proofImage: proof.id };
    await assert.rejects(services.warehouseService.returnItem(itemId, input, ids.staff));
    const verification = { claimId, recipientId: ids.owner, verified: true, reason: "Compared private markings and ID in person" };
    await assert.rejects(services.warehouseService.verifyCustodyClaim(itemId, { ...verification, recipientId: ids.finder }, ids.staff));
    await assert.rejects(services.warehouseService.verifyCustodyClaim(itemId, verification, ids.finder));
    await services.warehouseService.legalHold(itemId, true, "Check hold", ids.admin);
    await assert.rejects(services.warehouseService.verifyCustodyClaim(itemId, verification, ids.staff));
    await services.warehouseService.legalHold(itemId, false, "Release hold", ids.admin);
    const reportId = randomUUID();
    await p.transaction(db => p.reportRepository.create({ id: reportId, reporterId: ids.owner,
      target: { entityType: "CHAT", entityId: direct.claim.room!.id, sourceType: "MESSAGE", sourceId: direct.message.id, title: "Fixture", status: "CONVERSATION_OPEN" },
      reason: "Dispute", details: null, idempotencyKey: randomUUID(), requestHash: "fixture" }, db));
    await assert.rejects(services.warehouseService.verifyCustodyClaim(itemId, verification, ids.staff));
    await pool.execute("UPDATE reports SET status = 'REVIEWED' WHERE id = ?", [reportId]);
    await services.warehouseService.verifyCustodyClaim(itemId, verification, ids.staff);
    await assert.rejects(services.warehouseService.returnItem(itemId, { receiverName: input.receiverName, receiverIdentity: input.receiverIdentity, receiverPhone: input.receiverPhone, proofImage: proof.id }, ids.staff));
    await services.warehouseService.legalHold(itemId, true, "Return hold", ids.admin);
    await assert.rejects(services.warehouseService.returnItem(itemId, input, ids.staff));
    await services.warehouseService.legalHold(itemId, false, "Return cleared", ids.admin);
    assert.equal((await services.warehouseService.returnRecipients(itemId, ids.staff)).recipients[0]!.recipientId, ids.owner);
    assert.equal((await services.warehouseService.returnItem(itemId, input, ids.staff))!.status, "RETURNED");
    const [completed] = await pool.query<RowDataPacket[]>("SELECT appointment_id FROM warehouse_completed_returns WHERE warehouse_item_id = ?", [itemId]);
    const feedback = await p.returnFeedbackRepository.findAppointmentForFeedback(String(completed[0]!.appointment_id));
    assert.equal(feedback!.claimantId, ids.owner);
    assert.equal(feedback!.finderId, ids.finder);
    const [history] = await pool.query<RowDataPacket[]>("SELECT actor_id,action FROM claim_audit_events WHERE claim_id = ?", [claimId]);
    assert.ok(history.some(e => e.action === "CUSTODY_ESCALATED" && e.actor_id === ids.finder));
    assert.equal(history.filter(e => e.action === "STAFF_CUSTODY_VERIFIED").length, 1);
    if (!legacy) {
      const [participants] = await pool.query<RowDataPacket[]>("SELECT user_id,participant_role FROM claim_participants WHERE claim_id = ? ORDER BY participant_role", [claimId]);
      assert.deepEqual(participants.map(cp => [cp.user_id,cp.participant_role]), [[ids.owner,"CLAIMANT"],[ids.finder,"FINDER"]]);
    }
  }));
}

test("direct LOST claim persists ownership roles while preserving requester idempotency and withdrawal", isolatedJourney, async () => withActorJourney(async f => {
  const approval = await f.contactPhotos.analyze(f.ids.lost, f.ids.finder, f.image);
  const input = { postId: f.ids.lost, contactCheckId: approval.checkId!, requestKey: randomUUID() };
  const created = await f.claims.createClaim(f.ids.finder, input);
  assert.equal((await f.claims.createClaim(f.ids.finder, input)).id, created.id);
  const [participants] = await f.pool.query<RowDataPacket[]>("SELECT user_id,participant_role FROM claim_participants WHERE claim_id = ? ORDER BY participant_role", [created.id]);
  assert.deepEqual(participants.map(cp => [cp.user_id,cp.participant_role]), [[f.ids.owner,"CLAIMANT"],[f.ids.finder,"FINDER"]]);
  const [storage] = await f.pool.query<RowDataPacket[]>("SELECT claimant_id FROM claims WHERE id = ?", [created.id]);
  assert.equal(storage[0]!.claimant_id, f.ids.finder);
  await assert.rejects(f.claims.withdraw(created.id, f.ids.finder, randomUUID()));
  assert.equal((await f.claims.withdraw(created.id, f.ids.owner, randomUUID())).status, "CANCELLED");
  const connection = await f.pool.getConnection();
  try {
    await verifyClaimConversationSchema(connection as unknown as MigrationConnection);
    await connection.execute("DELETE FROM claim_participants WHERE claim_id = ? AND user_id = ?", [created.id,f.ids.owner]);
    await assert.rejects(verifyClaimConversationSchema(connection as unknown as MigrationConnection), /participant backfill is incomplete/);
  } finally { connection.release(); }
}));
