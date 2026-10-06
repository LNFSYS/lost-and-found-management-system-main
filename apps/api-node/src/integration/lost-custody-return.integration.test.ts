import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { isolatedJourney, withActorJourney } from "../test/actor-journey-fixture.js";
import { sqlExecutor } from "../shared/infrastructure/transaction-context.js";
import { verifyClaimConversationSchema } from "../migrations/claim-schema-verification.js";
import type { MigrationConnection } from "../migrations/migration-state.js";

for (const legacy of [false, true]) {
 for (const photoOnly of [false, true]) {
  test(`LOST -> ${photoOnly ? "Finder contact photo without FOUND" : "linked FOUND"} -> custody -> Staff verification -> return (${legacy ? "legacy reversed roles" : "new participants"})`, isolatedJourney, async () => withActorJourney(async f => {
    const { pool, p, ids, claims, services, point, image } = f;
    const approval = await f.contactPhotos.analyze(ids.lost, ids.finder, image);
    assert.equal(approval.approved, true);
    if (photoOnly) await pool.execute("DELETE FROM posts WHERE id = ?", [ids.found]);
    const direct = await claims.createDirectMessage(ids.finder, { postId: ids.lost, ...(photoOnly ? {} : { sourceFoundPostId: ids.found }),
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
    const decision = { decision: "ESCALATE_TO_CUSTODY" as const, reason: "Transfer to Staff", handoverPointId: point, idempotencyKey: randomUUID() };
    await claims.decideVerification(claimId, ids.finder, decision);
    await claims.decideVerification(claimId, ids.finder, decision);
    const [requests] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id = ?", [claimId]);
    const requestId = String(requests[0]!.id);
    assert.equal(requests.length, 1);
    if (photoOnly) {
      const context = await services.custodyRequestService.getIntakeContext(requestId, ids.staff);
      assert.equal(context.request.postId, null);
      assert.equal(context.post.finderUserId, ids.finder);
      assert.equal(context.images[0]!.provenance, "CONTACT_PHOTO");
      assert.equal(context.images[0]!.id, approval.checkId);
      assert.equal("storageRef" in context.images[0]!, false);
      await services.warehouseService.getImage(approval.checkId!, "CONTACT_PHOTO", ids.staff);
      await assert.rejects(services.warehouseService.getImage(approval.checkId!, "CONTACT_PHOTO", ids.outsider));
      const [notifications] = await pool.query<RowDataPacket[]>("SELECT user_id FROM notifications WHERE entity_id IN (?,?)", [requestId,claimId]);
      assert.ok(notifications.some(row => row.user_id === ids.owner));
    }
    const receipt = await services.custodyRequestService.confirmIntake(requestId, await f.evidence(requestId), ids.staff);
    const itemId = receipt!.warehouseItemId!;
    if (photoOnly) {
      const item = await p.warehouseRepository.findItemById(itemId);
      assert.equal(item!.postId, null);
      assert.equal(item!.finder.userId, ids.finder);
      assert.ok((await services.warehouseService.listImages(itemId, ids.staff)).images.some(row => row.id === approval.checkId && row.provenance === "CONTACT_PHOTO"));
    }
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
}

test("photo custody requires the consumed Finder image, room consent and strict score; generic custody cannot forge the photo route", isolatedJourney, async () => withActorJourney(async f => {
  const { ids, pool, claims, services } = f;
  const approval = await f.contactPhotos.analyze(ids.lost, ids.finder, f.image);
  const direct = await claims.createDirectMessage(ids.finder, { postId: ids.lost, contactCheckId: approval.checkId!, content: "Found your keys", clientMessageId: randomUUID() });
  const decision = { decision: "ESCALATE_TO_CUSTODY" as const, reason: "Please receive these keys", handoverPointId: f.point, idempotencyKey: randomUUID() };
  await assert.rejects(claims.decideVerification(direct.claim.id, ids.owner, decision));
  await assert.rejects(services.warehouseService.getImage(approval.checkId!, "CONTACT_PHOTO", ids.staff));
  await assert.rejects(services.custodyRequestService.createRequest({ intakeType: "CUSTODY_TRANSFER", claimId: direct.claim.id, roomId: direct.claim.room!.id, handoverPointId: f.point }, ids.finder));
  await pool.execute("UPDATE lost_contact_photo_checks SET score = 0.49999 WHERE id = ?", [approval.checkId]);
  await assert.rejects(claims.decideVerification(direct.claim.id, ids.finder, decision));
  await pool.execute("UPDATE lost_contact_photo_checks SET score = 0.5 WHERE id = ?", [approval.checkId]);
  await pool.execute("UPDATE claim_participants SET consent_status = 'DECLINED' WHERE claim_id = ? AND user_id = ?", [direct.claim.id,ids.owner]);
  await assert.rejects(claims.decideVerification(direct.claim.id, ids.finder, decision));
  await pool.execute("UPDATE claim_participants SET consent_status = 'ACCEPTED' WHERE claim_id = ? AND user_id = ?", [direct.claim.id,ids.owner]);
  await pool.execute("UPDATE lost_contact_photo_checks SET actor_id = ? WHERE id = ?", [ids.outsider,approval.checkId]);
  await assert.rejects(claims.decideVerification(direct.claim.id, ids.finder, decision));
  await pool.execute("UPDATE lost_contact_photo_checks SET actor_id = ?, expires_at = DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR) WHERE id = ?", [ids.finder,approval.checkId]);
  await claims.decideVerification(direct.claim.id, ids.finder, decision);
  const [rows] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id = ?", [direct.claim.id]);
  const requestId = String(rows[0]!.id);
  await services.custodyRequestService.cancelRequest(requestId, { reason: "Cancelled before physical receipt" }, ids.finder);
  await assert.rejects(services.warehouseService.getImage(approval.checkId!, "CONTACT_PHOTO", ids.staff));
  await claims.decideVerification(direct.claim.id, ids.finder, { ...decision, idempotencyKey: randomUUID() });
  const [retry] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE claim_id = ? AND status = 'PENDING'", [direct.claim.id]);
  const nextId = String(retry[0]!.id);
  const evidence = await f.evidence(nextId);
  await services.custodyRequestService.confirmIntake(nextId, evidence, ids.staff);
  await services.custodyRequestService.confirmIntake(nextId, evidence, ids.staff);
  await assert.rejects(claims.decideVerification(direct.claim.id, ids.finder, { ...decision, idempotencyKey: randomUUID() }));
  const [items] = await pool.query<RowDataPacket[]>("SELECT id FROM warehouse_items WHERE post_id IS NULL AND finder_user_id = ?", [ids.finder]);
  assert.equal(items.length, 1);
}));

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

test("50 percent opens the real room, posts its photo once and permits a communication-only meetup", isolatedJourney, async () => withActorJourney(async f => {
  const { ids, claims, pool, p, services } = f;
  const check = await f.contactPhotos.analyze(ids.lost, ids.finder, f.image);
  await pool.execute("UPDATE lost_contact_photo_checks SET score = 0.5 WHERE id = ?", [check.checkId]);
  const request = { postId: ids.lost, contactCheckId: check.checkId!, sourceFoundPostId: ids.found, requestKey: randomUUID() };
  const created = await claims.createClaim(ids.finder, request);
  assert.equal((await claims.createClaim(ids.finder, request)).id, created.id);
  const roomId = created.room!.id;
  const initial = await p.claimRepository.listMessages(roomId, { limit: 100 });
  assert.equal(initial.items.length, 1); assert.equal(initial.items[0]!.messageType, "IMAGE");
  assert.ok(initial.items[0]!.mediaUrl!.startsWith(`/api/claims/${created.id}/evidence/`));
  const verification = await claims.getVerification(created.id, ids.finder);
  assert.equal(verification.policy.answeredCount, 0);
  assert.equal(verification.policy.readyForDecision, true);
  assert.equal(verification.policy.photoContactEligible, true);
  const decision = { decision: "VERIFY_FOR_MEETUP" as const, reason: "Compare the item in person", idempotencyKey: randomUUID() };
  await assert.rejects(claims.decideVerification(created.id, ids.owner, decision));
  await claims.decideVerification(created.id, ids.finder, decision);
  const [audit] = await pool.query<RowDataPacket[]>("SELECT metadata_json FROM claim_audit_events WHERE claim_id = ? AND action = 'VERIFICATION_ACCEPTED'", [created.id]);
  assert.equal(audit[0]!.metadata_json.communicationOnly, true);
  assert.equal(await p.transaction(db => p.warehouseRepository.verifiedRecipient(created.id, ids.found, ids.owner, db, undefined)), false);

  const transfer = await services.custodyRequestService.createRequest({ postId: ids.found, claimId: created.id, roomId,
    handoverPointId: f.point, reason: "Receive the physical item", idempotencyKey: randomUUID() }, ids.finder);
  const receipt = await services.custodyRequestService.confirmIntake(transfer.request.id, await f.evidence(transfer.request.id), ids.staff);
  assert.equal((await services.warehouseService.returnRecipients(receipt!.warehouseItemId!, ids.staff)).recipients.length, 0);
}));

test("chat images are private, idempotent and available to both consented participants, never outsiders", isolatedJourney, async () => withActorJourney(async f => {
  const check = await f.contactPhotos.analyze(f.ids.lost, f.ids.finder, f.image);
  const created = await f.claims.createClaim(f.ids.finder, { postId: f.ids.lost, contactCheckId: check.checkId!, requestKey: randomUUID() });
  const input = { content: "Current item photo", clientMessageId: randomUUID() };
  const sent = await f.claims.uploadChatImage(created.id, f.ids.finder, input, f.image);
  assert.equal(sent.messageType, "IMAGE");
  assert.equal((await f.claims.uploadChatImage(created.id, f.ids.finder, input, f.image)).id, sent.id);
  const evidenceId = sent.mediaUrl!.split("/").at(-1)!;
  assert.deepEqual((await f.claims.getEvidenceFile(created.id, evidenceId, f.ids.owner)).body, f.image.buffer);
  await assert.rejects(f.claims.getEvidenceFile(created.id, evidenceId, f.ids.outsider));
  await assert.rejects(f.claims.uploadChatImage(created.id, f.ids.outsider, input, f.image));
  await f.claims.uploadChatImage(created.id, f.ids.owner, { ...input, clientMessageId: randomUUID() }, f.image);
  await f.claims.uploadEvidence(created.id, f.ids.finder, { description: "Additional private photo" }, f.image);
  const list = await f.p.claimRepository.listMessages(created.room!.id, { limit: 100 });
  assert.equal(list.items.filter(message => message.messageType === "IMAGE").length, 3);
  assert.equal(list.items.filter(message => message.clientMessageId === input.clientMessageId).length, 1);
  await f.pool.execute("UPDATE claim_participants SET consent_status = 'DECLINED' WHERE claim_id = ? AND user_id = ?", [created.id, f.ids.finder]);
  await assert.rejects(f.claims.uploadChatImage(created.id, f.ids.finder, { ...input, clientMessageId: randomUUID() }, f.image));
}));
