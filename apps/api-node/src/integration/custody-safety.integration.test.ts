import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { createPersistence } from "../main/persistence.js";
import { runMigrations } from "../migrations/migration-runner.js";
import type { MigrationPool } from "../migrations/migration-state.js";
import { createCustodyRequestUseCases } from "../modules/warehouse/application/custody-request.use-cases.js";
import { createWarehouseUseCases } from "../modules/warehouse/application/warehouse.use-cases.js";
import { createNotificationEmailQueue } from "../modules/notifications/application/notification-email.queue.js";
import { createNotificationEmailWorker } from "../modules/notifications/application/notification-email.worker.js";
import { createPrivateMediaStorage } from "../shared/infrastructure/private-media-storage.js";
import { createServices } from "../main/services.js";
import { createApp } from "../main/app.js";
import { pool as defaultPool } from "../main/database.js";
import { createAuthSecurity } from "../modules/auth/infrastructure/auth-security.js";
import { env } from "../shared/infrastructure/config/env.js";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { preflightMigrations } from "../migrations/migration-preflight.js";
import { createContactPhotoUseCases } from "../modules/claims/application/contact-photo.use-cases.js";
import { createClaimUseCases } from "../modules/claims/application/claim.use-cases.js";

after(async () => { await defaultPool.end(); });

test("isolated MySQL custody: authorization, concurrency, lifecycle, proof and notifications", { skip: process.env.LNFS_DB_INTEGRATION !== "1" }, async t => {
  const host = process.env.LNFS_TEST_DB_HOST;
  if (host !== "127.0.0.1" || !process.env.LNFS_TEST_DB_NAME?.endsWith("_test")) throw new Error("Only explicit isolated loopback *_test databases allowed");
  const config = { host, port: Number(process.env.LNFS_TEST_DB_PORT), user: process.env.LNFS_TEST_DB_USER, password: process.env.LNFS_TEST_DB_PASSWORD, multipleStatements: true, timezone: "Z", connectionLimit: 8 };
  const name = `lnfs_custody_${randomUUID().replaceAll("-", "")}_test`;
  const admin = mysql.createPool(config);
  await admin.query(`CREATE DATABASE \`${name}\``);
  const pool = mysql.createPool({ ...config, database: name });
  const uploadDir = await mkdtemp(path.join(os.tmpdir(), "lnfs-private-proof-"));
  try {
    await runMigrations({ directory: fileURLToPath(new URL("../migrations/", import.meta.url)), pool: pool as unknown as MigrationPool, log: () => {} });
    const p = createPersistence(pool);
    const ids = { finder: randomUUID(), owner: randomUUID(), outsider: randomUUID(), staff: randomUUID(), approver: randomUUID(), found: randomUUID(), lost: randomUUID(), claim: randomUUID(), room: randomUUID() };
    for (const user of [ids.finder,ids.owner,ids.outsider,ids.staff,ids.approver]) {
      await pool.execute("INSERT INTO users (id,email,normalized_email,password_hash,full_name,email_verified_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP())", [user,`${user}@example.invalid`,`${user}@example.invalid`,"test-only","Fixture"]);
      await pool.execute("INSERT INTO user_roles (user_id,role_code) VALUES (?,?)", [user,ids.approver === user ? "ADMIN" : ids.staff === user ? "STAFF" : "STUDENT"]);
    }
    const [points] = await pool.query<RowDataPacket[]>("SELECT id FROM handover_points WHERE is_active = TRUE LIMIT 1");
    const point = String(points[0].id);
    const [categories] = await pool.query<RowDataPacket[]>("SELECT id FROM item_categories WHERE name LIKE '%Chìa%' LIMIT 1");
    const categoryId = categories[0]?.id ? String(categories[0].id) : randomUUID();
    if (!categories.length) await pool.execute("INSERT INTO item_categories (id,name,name_normalized) VALUES (?,'Chìa khóa','chia khoa')", [categoryId]);
    for (const [post,user,type] of [[ids.found,ids.finder,"FOUND"],[ids.lost,ids.owner,"LOST"]]) await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,?,'Keys','keys','Fixture keys','fixture keys',?)", [post,user,type,categoryId]);
    await pool.execute("INSERT INTO claims (id,post_id,claimant_id,status,finder_decision) VALUES (?,?,?,'CONVERSATION_OPEN','ACCEPTED')", [ids.claim,ids.found,ids.owner]);
    await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'), (?,?,'CLAIMANT','ACCEPTED')", [ids.claim,ids.finder,ids.claim,ids.owner]);
    await pool.execute("INSERT INTO chat_rooms (id,claim_id) VALUES (?,?)", [ids.room,ids.claim]);
    const queue = createNotificationEmailQueue({ repository: p.notificationEmailRepository, id: randomUUID, chatDelayMinutes: 5, digestDelayMinutes: 15 });
    const delivery = { notificationRepository: p.notificationRepository, notificationEmailQueue: queue };
    const custody = createCustodyRequestUseCases({ custodyRequestRepository: p.custodyRequestRepository, warehouseRepository: p.warehouseRepository, ...delivery, withTransaction: p.transaction, id: randomUUID });
    const warehouse = createWarehouseUseCases({ warehouseRepository: p.warehouseRepository, custodyRequestRepository: p.custodyRequestRepository, proofStorage: createPrivateMediaStorage({ uploadDir, namespace: "warehouse-proof", invalidPathMessage: "Invalid", notFoundMessage: "Missing" }), ...delivery, withTransaction: p.transaction, id: randomUUID });
    async function evidence(custodyRequestId?: string) {
      const intakeKey = randomUUID();
      const buffer = Buffer.from([0xff,0xd8,0xff,0xe0]);
      const image = await warehouse.uploadIntakeImage({ intakeKey, ...(custodyRequestId ? { custodyRequestId } : {}) }, { buffer, size: buffer.length, mimetype: "image/jpeg" }, ids.staff);
      return { intakeKey, intakeImageIds: [image.id], receivedQuantity: 1, accessories: "No accessories", physicalReviewConfirmed: true as const };
    }
    const input = { postId: ids.found, claimId: ids.claim, roomId: ids.room, handoverPointId: point, reason: "Private note never belongs in notifications", idempotencyKey: "a".repeat(190) };
    await t.test("rejects forged, empty, LOST and cross-user idempotent requests", async () => {
      await assert.rejects(custody.createRequest(input, ids.outsider));
      await assert.rejects(custody.createRequest({}, ids.finder));
      await assert.rejects(custody.createRequest({ ...input, intakeType: "WALK_IN" }, ids.finder));
      await assert.rejects(custody.createRequest({ ...input, postId: ids.lost }, ids.owner));
      await assert.rejects(custody.createRequest({ ...input, roomId: randomUUID() }, ids.finder));
    });
    const [first,second] = await Promise.all([custody.createRequest(input,ids.finder),custody.createRequest(input,ids.finder)]);
    assert.equal(first.request.id,second.request.id);
    await assert.rejects(custody.createRequest({ ...input, reason: "Different" },ids.finder));
    await assert.rejects(custody.getRequest(first.request.id,ids.outsider));
    await t.test("cancel releases room escalation; request can be recreated", async () => {
      await pool.execute("UPDATE chat_rooms SET escalated_at = UTC_TIMESTAMP() WHERE id = ?", [ids.room]);
      await custody.cancelRequest(first.request.id,{ reason: "Finder cancelled" },ids.finder);
      const [rows] = await pool.query<RowDataPacket[]>("SELECT escalated_at FROM chat_rooms WHERE id = ?", [ids.room]);
      assert.equal(rows[0].escalated_at,null);
    });
    const next = await custody.createRequest({ ...input, idempotencyKey: "new-request-key" },ids.finder);
    assert.equal(next.request.status, "PENDING");
    assert.equal((await custody.createRequest({ ...input, idempotencyKey: "new-request-key" },ids.finder)).request.id, next.request.id);
    const intakeEvidence = await evidence(next.request.id);
    await t.test("opening reconciliation is read-only and forged/source evidence cannot confirm receipt", async () => {
      const sourceImageId = randomUUID();
      await pool.execute("INSERT INTO post_media (id,post_id,secure_url,public_id,resource_type,format,bytes,media_kind) VALUES (?,?,?,'source','image','jpg',4,'ITEM')", [sourceImageId,ids.found,"private://source-test"]);
      const context = await custody.getIntakeContext(next.request.id,ids.staff);
      assert.equal(context.images[0]?.provenance,"SOURCE_POST");
      assert.equal(context.post.description,"Fixture keys");
      const [unreceived] = await pool.query<RowDataPacket[]>("SELECT id FROM warehouse_items WHERE post_id = ?", [ids.found]);
      assert.equal(unreceived.length,0);
      await assert.rejects(custody.getIntakeContext(next.request.id,ids.outsider));
      await assert.rejects(custody.confirmIntake(next.request.id,{ ...intakeEvidence, intakeImageIds: [sourceImageId], conditionNotes: "Good" },ids.staff));
      await assert.rejects(custody.confirmIntake(next.request.id,{ ...intakeEvidence, conditionNotes: "Good" },ids.approver));
      await assert.rejects(custody.confirmIntake(next.request.id,{ ...intakeEvidence, intakeImageIds: [], conditionNotes: "Good" },ids.staff));
    });
    await assert.rejects(custody.confirmIntake(next.request.id,{ ...intakeEvidence, conditionNotes: "Good", confirmedHandoverAt: new Date(Date.now()+3600000) },ids.staff));
    const receivedAt = new Date(Date.now()-60000);
    const intakePayload = { ...intakeEvidence, itemName: "Keys reconciled", description: "Observed at intake", conditionNotes: "Good", confirmedHandoverAt: receivedAt };
    const [intake,retry] = await Promise.all([custody.confirmIntake(next.request.id,intakePayload,ids.staff),custody.confirmIntake(next.request.id,intakePayload,ids.staff)]);
    await assert.rejects(custody.confirmIntake(next.request.id,{ ...intakePayload, accessories: "Changed" },ids.staff));
    assert.equal(intake?.warehouseItemId,retry?.warehouseItemId);
    const itemId = intake!.warehouseItemId!;
    const [items] = await pool.query<RowDataPacket[]>("SELECT * FROM warehouse_items WHERE post_id = ?", [ids.found]);
    assert.equal(items.length,1);
    assert.equal(items[0].status,"RECEIVED");
    assert.equal(items[0].item_name,"Keys reconciled");
    assert.equal((await custody.getIntakeContext(next.request.id,ids.staff)).post.description,"Fixture keys");
    const receiptItem = await p.warehouseRepository.findItemById(itemId);
    assert.equal(receiptItem?.receivedQuantity,1);
    assert.equal(receiptItem?.accessories,"No accessories");
    assert.equal(receiptItem?.thumbnail?.provenance,"INTAKE");
    assert.deepEqual((await warehouse.listImages(itemId,ids.staff)).images.map(image => image.provenance).sort(),["INTAKE","SOURCE_POST"]);
    await assert.rejects(warehouse.listImages(itemId,ids.outsider));
    assert.equal((items[0].retention_deadline.getTime()-items[0].received_at.getTime())/86400000,120);
    const [post] = await pool.query<RowDataPacket[]>("SELECT status FROM posts WHERE id = ?", [ids.found]);
    assert.equal(post[0].status,"OPEN");
    await assert.rejects(custody.cancelRequest(next.request.id,{},ids.finder));
    for (const status of ["RETURNED","CLAIMED","DISPOSED","DONATED","TRANSFERRED"] as const) await assert.rejects(warehouse.updateItem(itemId,{ status },ids.staff));
    await assert.rejects(warehouse.updateItem(itemId,{ status: "EXPIRED" },ids.staff));
    await t.test("canonical verified return uses private proof and opens existing feedback contract", async () => {
      const historyId = randomUUID();
      await pool.execute("INSERT INTO claim_audit_events (id,claim_id,actor_id,action,metadata_json) VALUES (?,?,?,'CUSTODY_ESCALATED',?)", [historyId,ids.claim,ids.finder,JSON.stringify({ decision: "ESCALATE_TO_CUSTODY" })]);
      assert.equal((await warehouse.returnClaimReviews(itemId,ids.staff)).claims[0].verified,false);
      const verification = { claimId: ids.claim, recipientId: ids.owner, verified: true, reason: "Checked private key engraving and recipient ID in person" };
      await assert.rejects(warehouse.verifyCustodyClaim(itemId,verification,ids.finder));
      await warehouse.legalHold(itemId,true,"Review pending",ids.approver);
      await assert.rejects(warehouse.verifyCustodyClaim(itemId,verification,ids.staff));
      await warehouse.legalHold(itemId,false,"Review cleared",ids.approver);
      await Promise.all([warehouse.verifyCustodyClaim(itemId,verification,ids.staff),warehouse.verifyCustodyClaim(itemId,verification,ids.staff)]);
      const [history] = await pool.query<RowDataPacket[]>("SELECT id,actor_id,action FROM claim_audit_events WHERE claim_id = ?", [ids.claim]);
      assert.ok(history.some(e => e.id === historyId && e.actor_id === ids.finder && e.action === "CUSTODY_ESCALATED"));
      assert.equal(history.filter(e => e.action === "STAFF_CUSTODY_VERIFIED").length,1);
      const [claimState] = await pool.query<RowDataPacket[]>("SELECT status,finder_decision FROM claims WHERE id = ?", [ids.claim]);
      assert.equal(claimState[0].status,"ACCEPTED");
      assert.equal(claimState[0].finder_decision,"ACCEPTED");
      assert.equal((await warehouse.returnRecipients(itemId,ids.staff)).recipients[0].recipientId,ids.owner);
      await warehouse.reserveItem(itemId,ids.claim,ids.owner,ids.staff);
      const buffer = Buffer.from([0xff,0xd8,0xff,0xe0]);
      const proof = await warehouse.uploadProof(itemId,{ buffer, size: buffer.length, mimetype: "image/jpeg" },ids.staff);
      assert.ok(!proof.url.includes("data:") && !proof.url.includes("cloudinary"));
      await assert.rejects(warehouse.getProof(proof.id,ids.outsider));
      assert.equal((await warehouse.getProof(proof.id,ids.staff)).body.length,4);
      const reportId = randomUUID();
      await p.transaction(db => p.reportRepository.create({ id: reportId, reporterId: ids.owner, target: { entityType: "CHAT", entityId: ids.room, sourceType: "MESSAGE", sourceId: randomUUID(), title: "Fixture", status: "ACCEPTED" }, reason: "Return dispute", details: null, idempotencyKey: randomUUID(), requestHash: "fixture" },db));
      await assert.rejects(warehouse.returnItem(itemId,{ claimId: ids.claim, recipientId: ids.owner, receiverName: "Fixture", receiverIdentity: "verified", receiverPhone: "0123456789", proofImage: proof.id },ids.staff));
      assert.equal((await p.warehouseRepository.findItemById(itemId))?.status,"CLAIMED");
      assert.equal((await p.warehouseRepository.findProof(proof.id,undefined))?.attached,false);
      await pool.execute("UPDATE reports SET status = 'REVIEWED' WHERE id = ?", [reportId]);
      const returned = await warehouse.returnItem(itemId,{ claimId: ids.claim, recipientId: ids.owner, receiverName: "Fixture", receiverIdentity: "verified", receiverPhone: "0123456789", proofImage: proof.id },ids.staff);
      assert.equal(returned?.status,"RETURNED");
      assert.equal((await warehouse.returnItem(itemId,{ claimId: ids.claim, recipientId: ids.owner, receiverName: "Fixture", receiverIdentity: "verified", receiverPhone: "0123456789", proofImage: proof.id },ids.staff))?.status,"RETURNED");
      await assert.rejects(warehouse.returnItem(itemId,{ claimId: ids.claim, recipientId: ids.outsider, receiverName: "Fixture", receiverIdentity: "verified", receiverPhone: "0123456789", proofImage: proof.id },ids.staff));
      const [completed] = await pool.query<RowDataPacket[]>("SELECT appointment_id FROM warehouse_completed_returns WHERE warehouse_item_id = ?", [itemId]);
      const feedback = await p.returnFeedbackRepository.findAppointmentForFeedback(String(completed[0].appointment_id));
      assert.equal(feedback?.status,"COMPLETED");
      assert.ok(feedback?.custodyAuthorizedAt);
      assert.equal(feedback?.claimantId,ids.owner);
      assert.equal(feedback?.finderId,ids.finder);
      assert.equal((await custody.createRequest({ ...input, idempotencyKey: "new-request-key" },ids.finder)).request.id,next.request.id);
      await assert.rejects(custody.createRequest({ ...input, idempotencyKey: "new-request-key", reason: "Changed after completion" },ids.finder));
    });
    const [messages] = await pool.query<RowDataPacket[]>("SELECT n.body,n.type,o.event_type FROM notifications n LEFT JOIN notification_email_outbox o ON o.notification_id = n.id WHERE n.entity_type = 'CUSTODY_REQUEST'");
    assert.ok(messages.length >= 8);
    assert.ok(messages.every(n => !String(n.body).includes(input.reason)));
    assert.ok(messages.filter(n => n.event_type).every(n => n.event_type === "CUSTODY"));
    await t.test("an expired undisposed walk-in can be returned with private evidence, but not under legal hold", async () => {
      const expired = await warehouse.createItem({ ...await evidence(), itemName: "Expired fixture", handoverPointId: point, conditionNotes: "Good", receivedAt: new Date(Date.now()-200*86400000) },ids.staff);
      await warehouse.updateItem(expired.id,{ status: "EXPIRED" },ids.staff);
      await assert.rejects(warehouse.updateItem(expired.id,{ status: "RETURNED" },ids.staff));
      const proof = await warehouse.uploadProof(expired.id,{ buffer: Buffer.from([0xff,0xd8,0xff,0xe0]), size: 4, mimetype: "image/jpeg" },ids.staff);
      const input = { receiverName: "Offline owner", receiverIdentity: "ID-123456", receiverPhone: "0359123456", proofImage: proof.id };
      await warehouse.legalHold(expired.id,true,"Check pending",ids.approver);
      await assert.rejects(warehouse.returnItem(expired.id,input,ids.staff));
      assert.equal((await p.warehouseRepository.findProof(proof.id,undefined))?.attached,false);
      await warehouse.legalHold(expired.id,false,"Check cleared",ids.approver);
      assert.equal((await warehouse.returnItem(expired.id,input,ids.staff))?.status,"RETURNED");
      assert.ok((await warehouse.listLogs(expired.id)).some(log => log.fromStatus === "EXPIRED" && log.toStatus === "RETURNED"));
    });
    await t.test("disposition requires separate Admin approval and rechecks legal hold, retention and disputes", async () => {
      await pool.execute("INSERT INTO user_roles (user_id,role_code) VALUES (?,'ADMIN')", [ids.finder]);
      const record = await warehouse.createItem({ ...await evidence(), itemName: "Unclaimed fixture", handoverPointId: point, conditionNotes: "Good", receivedAt: new Date(Date.now()-200*86400000) },ids.staff);
      await assert.rejects(warehouse.legalHold(record.id,true,"test hold",ids.staff));
      const approval = await warehouse.requestDisposition(record.id,"DONATED","No claim after retention",ids.approver);
      await assert.rejects(warehouse.executeDisposition(approval.approvalId,ids.staff));
      await assert.rejects(warehouse.approveDisposition(approval.approvalId,ids.staff));
      await assert.rejects(warehouse.approveDisposition(approval.approvalId,ids.approver));
      await warehouse.approveDisposition(approval.approvalId,ids.finder);
      await warehouse.legalHold(record.id,true,"test hold",ids.approver);
      await assert.rejects(warehouse.executeDisposition(approval.approvalId,ids.staff));
      assert.equal((await p.warehouseRepository.findItemById(record.id))?.status,"RECEIVED");
      assert.ok((await warehouse.listLogs(record.id)).some(log => log.note?.startsWith("DISPOSITION_DENIED")));
      await warehouse.legalHold(record.id,false,"released",ids.approver);
      await assert.rejects(warehouse.executeDisposition(approval.approvalId,ids.staff));
      const buffer = Buffer.from([0xff,0xd8,0xff,0xe0]);
      const proof = await warehouse.uploadProof(record.id,{ buffer, size: buffer.length, mimetype: "image/jpeg" },ids.staff);
      const disputePost = randomUUID(), disputeClaim = randomUUID(), disputeRoom = randomUUID(), reportId = randomUUID();
      await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized) VALUES (?,?,'FOUND','Fixture','fixture','Fixture','fixture')", [disputePost,ids.finder]);
      await pool.execute("UPDATE warehouse_items SET post_id = ? WHERE id = ?", [disputePost,record.id]);
      await pool.execute("INSERT INTO claims (id,post_id,claimant_id,status) VALUES (?,?,?,'CANCELLED')", [disputeClaim,disputePost,ids.owner]);
      await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'FINDER','ACCEPTED'), (?,?,'CLAIMANT','ACCEPTED')", [disputeClaim,ids.finder,disputeClaim,ids.owner]);
      await pool.execute("INSERT INTO chat_rooms (id,claim_id) VALUES (?,?)", [disputeRoom,disputeClaim]);
      await p.transaction(db => p.reportRepository.create({ id: reportId, reporterId: ids.owner, target: { entityType: "CHAT", entityId: disputeRoom, sourceType: "MESSAGE", sourceId: randomUUID(), title: "Fixture", status: "CANCELLED" }, reason: "Unresolved dispute", details: null, idempotencyKey: randomUUID(), requestHash: "fixture" },db));
      await assert.rejects(warehouse.executeDisposition(approval.approvalId,ids.staff,[proof.id]));
      assert.equal((await p.warehouseRepository.findItemById(record.id))?.status,"RECEIVED");
      await pool.execute("UPDATE reports SET status = 'REVIEWED' WHERE id = ?", [reportId]);
      await warehouse.executeDisposition(approval.approvalId,ids.staff,[proof.id]);
      await warehouse.executeDisposition(approval.approvalId,ids.staff);
      assert.equal((await p.warehouseRepository.findItemById(record.id))?.status,"DONATED");
      const fresh = await warehouse.createItem({ ...await evidence(), itemName: "Fresh", handoverPointId: point, conditionNotes: "Good" },ids.staff);
      const freshApproval = await warehouse.requestDisposition(fresh.id,"DISPOSED","Fresh fixture",ids.approver);
      await warehouse.approveDisposition(freshApproval.approvalId,ids.finder);
      await assert.rejects(warehouse.executeDisposition(freshApproval.approvalId,ids.staff));
    });
    await t.test("real HTTP matching keeps inactive history, hides own LOST and preserves history on refresh", async httpTest => {
      const source = randomUUID(), ownLost = randomUUID(), inactive = randomUUID(), deleted = randomUUID(), hidden = randomUUID();
      await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized) VALUES (?,?,'FOUND','Fixture','fixture','Fixture','fixture')", [source,ids.finder]);
      await pool.execute("UPDATE posts SET category_id = ? WHERE id = ?", [categoryId,source]);
      for (const [post,user,status,deletedAt] of [[ownLost,ids.finder,"OPEN",null],[inactive,ids.owner,"RESOLVED",null],[deleted,ids.owner,"OPEN",new Date()],[hidden,ids.owner,"HIDDEN",null]]) {
        await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,status,deleted_at) VALUES (?,?,'LOST','Fixture','fixture','Fixture','fixture',?,?)", [post,user,status,deletedAt]);
        await pool.execute("INSERT INTO match_results (id,lost_post_id,found_post_id,total_score) VALUES (?,?,?,0.7)", [randomUUID(),post,source]);
      }
      const services = createServices(p,{ ...env, uploadDir, cloudinary: { cloudName: null, apiKey: null, apiSecret: null } });
      const contactPhotos = createContactPhotoUseCases({ repository: p.contactPhotoRepository, claims: p.claimRepository, matching: p.matchingRepository,
        authorizeTarget: postId => services.postService.getPost(postId), transaction: p.transaction, id: randomUUID,
        mediaStorage: createPrivateMediaStorage({ uploadDir, namespace: "claim-evidence", invalidPathMessage: "Invalid", notFoundMessage: "Missing" }),
        imageAnalysis: { analyzePostImages: async () => ({ title: "Keys", description: "Fixture", suggestedCategory: { id: categoryId, name: "Chìa khóa", parentId: null },
          visualAttributes: [], visibleText: [], confidence: .95, model: "isolated-fixture", assistedBy: "fixture", warnings: [], imageCount: 1 }) } });
      const gatedClaims = createClaimUseCases({ claimRepository: p.claimRepository, matchingRepository: p.matchingRepository, notificationRepository: p.notificationRepository,
        warehouseRepository: p.warehouseRepository, custodyRequestRepository: p.custodyRequestRepository, contactPhotos,
        withTransaction: p.transaction, id: randomUUID, hashIdempotencyPayload: createAuthSecurity(env).hashToken,
        mediaStorage: createPrivateMediaStorage({ uploadDir, namespace: "claim-evidence", invalidPathMessage: "Invalid", notFoundMessage: "Missing" }), logger: { warn() {} } });
      const token = createAuthSecurity(env).signAccessToken({ sub: ids.finder, email: `${ids.finder}@example.invalid`, roles: ["STUDENT","ADMIN"], sessionVersion: 0 });
      const server = createApp({ services: { ...services, claimService: gatedClaims }, checkReadiness: async () => {} }).listen(0,"127.0.0.1");
      await once(server,"listening");
      try {
        const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/posts/${source}/matches`,{ headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status,200);
        const payload = await response.json() as { results: Array<{ candidate: { id: string; status: string; } }> };
        assert.deepEqual(payload.results.map(result => result.candidate.id),[inactive]);
        assert.equal(payload.results[0].candidate.status,"RESOLVED");
        for (const [userId,role] of [[ids.finder,"ADMIN"],[ids.staff,"STAFF"],[ids.approver,"ADMIN"]]) {
          const reviewToken = createAuthSecurity(env).signAccessToken({ sub: userId, email: `${userId}@example.invalid`, roles: [role as "STAFF" | "ADMIN"], sessionVersion: 0 });
          const review = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/posts/${source}/matches?page=1&pageSize=1`,{ headers: { Authorization: `Bearer ${reviewToken}` } });
          assert.equal(review.status,200);
          const page = await review.json() as { total: number; hasMore: boolean; results: Array<{ candidate: { id: string } }> };
          assert.equal(page.total,1);
          assert.equal(page.hasMore,false);
          assert.deepEqual(page.results.map(result => result.candidate.id),[inactive]);
        }
        await services.matchingService.runForPost(source);
        assert.ok((await p.matchingRepository.listForPost(source,0.45)).some(match => match.lostPostId === inactive));
        const direct = await services.claimService.createDirectMessage(ids.owner,{ postId: ownLost, content: "Test", sourceFoundPostId: source }).catch(() => null);
        assert.equal(direct,null);
        const targetLost = randomUUID();
        await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,'LOST','Keys','keys','Fixture','fixture',?)", [targetLost,ids.owner,categoryId]);
        await httpTest.test("real HTTP photo gate binds the sender and keeps ownership verification separate", async () => {
          const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
          const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
          const message = { postId: targetLost, content: "Synthetic message", sourceFoundPostId: source, clientMessageId: randomUUID() };
          const blocked = await fetch(`${base}/claims/direct-messages`,{ method: "POST", headers, body: JSON.stringify({ ...message, approved: true, score: 1 }) });
          assert.equal(blocked.status,409);
          const [before] = await pool.query<RowDataPacket[]>("SELECT id FROM claims WHERE post_id = ?", [targetLost]);
          assert.equal(before.length,0);
          const form = new FormData(); form.set("postId",targetLost); form.set("file",new Blob([new Uint8Array([0xff,0xd8,0xff,0xe0])],{ type: "image/jpeg" }),"fixture.jpg");
          const check = await fetch(`${base}/claims/contact-photo-checks`,{ method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
          assert.equal(check.status,200);
          const approval = await check.json() as { checkId: string; approved: boolean; score: number; questions: string[] };
          assert.equal(approval.approved,true); assert.ok(approval.score > .6);
          assert.equal(approval.questions.length,3);
          await assert.rejects(gatedClaims.createDirectMessage(ids.outsider,{ postId: targetLost, content: "Forged", contactCheckId: approval.checkId }));
          const created = await fetch(`${base}/claims/direct-messages`,{ method: "POST", headers, body: JSON.stringify({ ...message, contactCheckId: approval.checkId }) });
          assert.equal(created.status,201);
          const conversation = await created.json() as { claim: { id: string; status: string; contactPhoto: { approved: boolean; questions: string[] }; appointmentEligible: boolean } };
          assert.equal(conversation.claim.status,"CONVERSATION_OPEN");
          assert.equal(conversation.claim.appointmentEligible,false);
          assert.equal(conversation.claim.contactPhoto.approved,true);
          assert.deepEqual(conversation.claim.contactPhoto.questions,[]);
          await gatedClaims.createDirectMessage(ids.finder,{ ...message, contactCheckId: approval.checkId });
          const [proof] = await pool.query<RowDataPacket[]>("SELECT evidence_type,description FROM claim_evidence WHERE claim_id = ?", [conversation.claim.id]);
          assert.equal(proof.length,1); assert.equal(proof[0].evidence_type,"PHOTO");
          const [events] = await pool.query<RowDataPacket[]>("SELECT action FROM claim_audit_events WHERE claim_id = ?", [conversation.claim.id]);
          assert.equal(events.filter(e => e.action === "CONTACT_PHOTO_MATCHED").length,1);
          assert.equal(events.some(e => e.action === "VERIFICATION_ACCEPTED" || e.action === "STAFF_CUSTODY_VERIFIED"),false);
          const [messages] = await pool.query<RowDataPacket[]>("SELECT m.id,m.message_type,m.media_url FROM chat_messages m JOIN chat_rooms r ON r.id = m.room_id WHERE r.claim_id = ?", [conversation.claim.id]);
          assert.equal(messages.length,2);
          assert.equal(messages.filter(row => row.message_type === "IMAGE").length, 1);
          assert.ok(messages.find(row => row.message_type === "IMAGE")!.media_url.startsWith("/api/claims/"));
          const imageKey = randomUUID();
          let imageMessageId: string | null = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            const imageForm = new FormData(); imageForm.set("content", "Current condition photo");
            imageForm.set("file", new Blob([new Uint8Array([0xff,0xd8,0xff,0xe0])], { type: "image/jpeg" }), "chat.jpg");
            const upload = await fetch(`${base}/claims/${conversation.claim.id}/messages/images`, { method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": imageKey }, body: imageForm });
            assert.equal(upload.status, 201);
            const sent = await upload.json() as { id: string; messageType: string; mediaUrl: string };
            assert.equal(sent.messageType, "IMAGE");
            if (imageMessageId) assert.equal(sent.id, imageMessageId);
            imageMessageId = sent.id;
            const delivery = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${sent.mediaUrl}`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(delivery.status, 200);
            assert.equal((await delivery.arrayBuffer()).byteLength, 4);
          }
          const legacy = randomUUID(), legacyRoom = randomUUID();
          await pool.execute("INSERT INTO claims (id,post_id,claimant_id,status,finder_decision) VALUES (?,?,?,'CONVERSATION_OPEN','ACCEPTED')", [legacy,ids.lost,ids.outsider]);
          await pool.execute("INSERT INTO claim_participants (claim_id,user_id,participant_role,consent_status) VALUES (?,?,'CLAIMANT','ACCEPTED'), (?,?,'FINDER','ACCEPTED')", [legacy,ids.outsider,legacy,ids.owner]);
          await pool.execute("INSERT INTO chat_rooms (id,claim_id) VALUES (?,?)", [legacyRoom,legacy]);
          assert.equal((await gatedClaims.getClaim(legacy,ids.outsider)).canSend,false);
          await assert.rejects(gatedClaims.sendMessage(legacy,ids.outsider,{ content: "Legacy bypass" }));
          assert.equal((await gatedClaims.getClaim(legacy,ids.owner)).canSend,true);
          const context = await p.claimRepository.findVerificationContext(conversation.claim.id);
          assert.equal(context?.foundPostId,source);
        });
        const conversation = (await gatedClaims.listClaims(ids.finder,{ page: 1, pageSize: 50 })).items.find(c => c.foundPostId === targetLost)!;
        const context = await p.claimRepository.findVerificationContext(conversation.id);
        assert.equal(context?.foundPostId,source);
        assert.equal(conversation.finderId,ids.finder);
        assert.equal(conversation.claimantId,ids.owner);
        await httpTest.test("direct LOST custody uses the consumed Finder photo without inventing a FOUND source", async () => {
          const unlinkedLost = randomUUID();
          await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,'LOST','Keys','keys','Fixture','fixture',?)", [unlinkedLost,ids.owner,categoryId]);
          const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
          const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
          const form = new FormData();
          form.set("postId",unlinkedLost);
          form.set("file",new Blob([new Uint8Array([0xff,0xd8,0xff,0xe0])],{ type: "image/jpeg" }),"fixture.jpg");
          const check = await fetch(`${base}/claims/contact-photo-checks`,{ method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
          assert.equal(check.status,200);
          const approval = await check.json() as { checkId: string };
          const created = await fetch(`${base}/claims/direct-messages`,{ method: "POST", headers,
            body: JSON.stringify({ postId: unlinkedLost, content: "Contact without a FOUND post", clientMessageId: randomUUID(), contactCheckId: approval.checkId }) });
          assert.equal(created.status,201);
          const direct = await created.json() as { claim: { id: string; canSend: boolean; item: { categoryName: string } } };
          assert.equal(direct.claim.canSend,true);
          const [category] = await pool.query<RowDataPacket[]>("SELECT name FROM item_categories WHERE id = ?", [categoryId]);
          assert.equal(direct.claim.item.categoryName,category[0].name);
          assert.equal((await p.claimRepository.findVerificationContext(direct.claim.id))?.foundPostId,unlinkedLost);
          for (const [actor,role] of [[ids.finder,"FINDER"],[ids.owner,"CLAIMANT"]]) {
            const participantToken = createAuthSecurity(env).signAccessToken({ sub: actor, email: `${actor}@example.invalid`, roles: ["STUDENT"], sessionVersion: 0 });
            const verification = await fetch(`${base}/claims/${direct.claim.id}/verification`,{ headers: { Authorization: `Bearer ${participantToken}` } });
            assert.equal(verification.status,200);
            const state = await verification.json() as { participantRole: string; appointmentEligible: boolean; policy: { answeredCount: number; minimumAnswers: number } };
            assert.equal(state.participantRole,role);
            assert.equal(state.appointmentEligible,false);
            assert.equal(state.policy.answeredCount,0);
            assert.equal(state.policy.minimumAnswers,1);
          }
          const templates = await fetch(`${base}/claims/${direct.claim.id}/verification/templates`,{ headers });
          assert.equal(templates.status,200);
          const transfer = await fetch(`${base}/claims/${direct.claim.id}/verification/decision`,{ method: "POST",
            headers: { ...headers, "Idempotency-Key": randomUUID() }, body: JSON.stringify({ decision: "ESCALATE_TO_CUSTODY", reason: "No physical FOUND source", handoverPointId: point }) });
          assert.equal(transfer.status,200);
          const [requests] = await pool.query<RowDataPacket[]>("SELECT id,post_id,requester_id,warehouse_item_id FROM custody_requests WHERE claim_id = ?", [direct.claim.id]);
          assert.equal(requests.length,1);
          assert.equal(requests[0].post_id,null);
          assert.equal(requests[0].requester_id,ids.finder);
          assert.equal(requests[0].warehouse_item_id,null);
          const [source] = await pool.query<RowDataPacket[]>("SELECT post_id,source_found_post_id FROM claims WHERE id = ?", [direct.claim.id]);
          assert.equal(source[0].post_id,unlinkedLost);
          assert.equal(source[0].source_found_post_id,null);
          assert.equal((await gatedClaims.getVerification(direct.claim.id,ids.finder)).status,"CONVERSATION_OPEN");
          await pool.execute("UPDATE posts SET visibility_mode = 'PRIVATE_DETAILS', custom_location = 'Private desk' WHERE id = ?", [unlinkedLost]);
          await pool.execute("INSERT INTO post_media (id,post_id,secure_url,public_id,resource_type,format,bytes,media_kind) VALUES (?,?,?,'source','image','jpg',4,'ITEM')", [randomUUID(),unlinkedLost,"private://source-test"]);
          const ownerItem = (await gatedClaims.getClaim(direct.claim.id,ids.owner)).item;
          const finderItem = (await gatedClaims.getClaim(direct.claim.id,ids.finder)).item;
          assert.equal(ownerItem?.locationLabel,"Private desk");
          assert.ok(ownerItem?.imageUrl);
          assert.equal(finderItem?.locationLabel,null);
          assert.equal(finderItem?.imageUrl,null);
        });
      } finally {
        await new Promise<void>((resolve,reject) => {
          server.close(error => error ? reject(error) : resolve());
          server.closeAllConnections();
        });
      }
    });
    await t.test("outbox failure rolls back business event and reminders never mutate warehouse state", async () => {
      const found = randomUUID();
      await pool.execute("INSERT INTO posts (id,user_id,type,title,title_normalized,description,description_normalized,category_id) VALUES (?,?,'FOUND','Fixture','fixture','Fixture','fixture',?)", [found,ids.outsider,categoryId]);
      const failing = createCustodyRequestUseCases({ custodyRequestRepository: p.custodyRequestRepository, warehouseRepository: p.warehouseRepository,
        notificationRepository: p.notificationRepository, notificationEmailQueue: { ...queue, enqueue: async () => { throw new Error("Injected outbox failure"); } }, withTransaction: p.transaction, id: randomUUID });
      await assert.rejects(failing.createRequest({ postId: found, handoverPointId: point },ids.outsider), /Injected outbox failure/);
      const [failed] = await pool.query<RowDataPacket[]>("SELECT id FROM custody_requests WHERE post_id = ?", [found]);
      assert.equal(failed.length,0);
      const request = await custody.createRequest({ postId: found, handoverPointId: point, idempotencyKey: input.idempotencyKey },ids.outsider);
      await custody.acceptRequest(request.request.id,{ handoverPointId: point },ids.staff);
      const intake = await custody.confirmIntake(request.request.id,{ ...await evidence(request.request.id), conditionNotes: "Good", confirmedHandoverAt: new Date(Date.now()-200*86400000) },ids.staff);
      const proof = await warehouse.uploadProof(intake!.warehouseItemId!,{ buffer: Buffer.from([0xff,0xd8,0xff,0xe0]), size: 4, mimetype: "image/jpeg" },ids.staff);
      await pool.execute("UPDATE warehouse_private_proofs SET created_at = UTC_TIMESTAMP() - INTERVAL 4 DAY WHERE id = ?", [proof.id]);
      await warehouse.runMaintenance();
      await warehouse.runMaintenance();
      assert.equal((await p.warehouseRepository.findItemById(intake!.warehouseItemId!))?.status,"RECEIVED");
      await assert.rejects(warehouse.getProof(proof.id,ids.staff));
      const [notifications] = await pool.query<RowDataPacket[]>("SELECT user_id,COUNT(*) AS total FROM notifications WHERE type = 'CUSTODY_OVERDUE' AND entity_id = ? GROUP BY user_id", [request.request.id]);
      assert.ok(notifications.length > 0);
      assert.ok(notifications.every(row => Number(row.total) === 1));
    });
    await t.test("two email workers cannot reclaim a slow or expired SMTP attempt", async () => {
      await pool.execute("UPDATE notification_email_outbox SET status = 'CANCELLED'");
      const enqueue = async () => {
        const outboxId = randomUUID();
        await p.transaction(async db => {
          const n = await p.notificationRepository.create({ userId: ids.owner, type: "CUSTODY_UPDATED", title: "Fixture", entityType: "POST", entityId: ids.found },db);
          await p.notificationEmailRepository.enqueue({ id: outboxId, notificationId: n!.id, recipientUserId: ids.owner, eventType: "CUSTODY", entityType: "POST", entityId: ids.found, roomId: null, deliveryMode: "IMMEDIATE", idempotencyKey: outboxId, dueAt: new Date(Date.now()-1000) },db);
        });
        return outboxId;
      };
      const outboxId = await enqueue();
      let sends = 0;
      let start!: () => void, finish!: () => void;
      const started = new Promise<void>(resolve => { start = resolve; });
      const blocked = new Promise<void>(resolve => { finish = resolve; });
      const options = { repository: p.notificationEmailRepository, emailDelivery: { send: async () => { sends++; start(); await blocked; return {}; } }, id: randomUUID, frontendUrl: "https://lnfs.example.invalid", logger: { warn() {} }, leaseSeconds: 3 };
      const first = createNotificationEmailWorker(options).runOnce(1);
      try {
        await started;
        await new Promise(resolve => setTimeout(resolve,4000));
        await createNotificationEmailWorker(options).runOnce(1);
        assert.equal(sends,1);
      } finally { finish(); await first; }
      const [sent] = await pool.query<RowDataPacket[]>("SELECT status FROM notification_email_outbox WHERE id = ?", [outboxId]);
      assert.equal(sent[0].status,"SENT");
      const expiredId = await enqueue(), oldToken = randomUUID();
      await p.notificationEmailRepository.claimDue({ limit: 1, leaseToken: oldToken, leaseSeconds: 3 });
      await pool.execute("UPDATE notification_email_outbox SET lease_expires_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?", [expiredId]);
      assert.deepEqual(await p.notificationEmailRepository.claimDue({ limit: 1, leaseToken: randomUUID(), leaseSeconds: 3 }),[]);
      assert.equal(await p.notificationEmailRepository.renewLease(oldToken,3),false);
      await p.notificationEmailRepository.markSent(oldToken);
      await p.notificationEmailRepository.releaseLeaseForRetry({ leaseToken: oldToken, dueAt: new Date(), errorCode: "EAUTH" });
      const [expired] = await pool.query<RowDataPacket[]>("SELECT status,last_error_code FROM notification_email_outbox WHERE id = ?", [expiredId]);
      assert.equal(expired[0].status,"CANCELLED");
      assert.equal(expired[0].last_error_code,"SMTP_LEASE_EXPIRED_UNCERTAIN");
    });
    await t.test("recovered legacy 053 is not an alias and unknown checksums stay blocked", async () => {
      const version = "053_custody_and_guarded_disposition.sql";
      const checksum = "63b1268a45409de6b4b12eb7473a3e5254459bd9da0e4db1c0c3497d9e4c4eef";
      await pool.execute("INSERT INTO schema_migrations (version,checksum) VALUES (?,?)", [version,checksum]);
      await pool.execute("DELETE FROM schema_migrations WHERE version = '053_custody_requests.sql'");
      await pool.execute("DELETE FROM schema_migration_attempts WHERE version = '053_custody_requests.sql'");
      const preflight = await preflightMigrations({ directory: fileURLToPath(new URL("../migrations/",import.meta.url)), pool: pool as unknown as MigrationPool });
      assert.ok(preflight.pending.includes("053_custody_requests.sql"));
      assert.equal(preflight.warnings.length,1);
      await runMigrations({ directory: fileURLToPath(new URL("../migrations/",import.meta.url)), pool: pool as unknown as MigrationPool, log: () => {} });
      const [rows] = await pool.query<RowDataPacket[]>("SELECT checksum FROM schema_migrations WHERE version = ?", [version]);
      assert.equal(rows[0].checksum,checksum);
      await pool.execute("UPDATE schema_migrations SET checksum = ? WHERE version = ?", ["f".repeat(64),version]);
      await assert.rejects(preflightMigrations({ directory: fileURLToPath(new URL("../migrations/",import.meta.url)), pool: pool as unknown as MigrationPool }));
    });
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE \`${name}\``);
    await admin.end();
    await rm(uploadDir,{ recursive: true, force: true });
  }
});
