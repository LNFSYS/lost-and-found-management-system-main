import assert from "node:assert/strict";
import test from "node:test";
import { createContactPhotoUseCases } from "./contact-photo.use-cases.js";
import type { ContactPhotoCheck, ContactPhotoRepository } from "./contact-photo.repository.port.js";
import type { ClaimRepository } from "./claim.repository.port.js";
import type { MatchingRepository, MatchCandidate } from "../../matching/application/index.js";
import { scoreContactPhoto } from "../../matching/application/index.js";
import { fakeTransaction, createTestClaimUseCases } from "../../../test/use-case-fixtures.js";
import { unexpectedPort } from "../../../test/unexpected-port.js";
import type { PrivateMediaStorage } from "../../../shared/application/media-storage.port.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { createDirectMessageSchema } from "../interfaces/http/claim.validator.js";

const actor = "11111111-1111-4111-8111-111111111111";
const postId = "22222222-2222-4222-8222-222222222222";
const checkId = "33333333-3333-4333-8333-333333333333";
const claimId = "44444444-4444-4444-8444-444444444444";
const revision = "2026-10-01T00:00:00.000Z";
const db = {} as TransactionContext;
const photo = { buffer: Buffer.from([0xff,0xd8,0xff,0xe0]), size: 4, mimetype: "image/jpeg" };
const target: MatchCandidate = { id: postId, userId: "owner", type: "LOST", status: "OPEN", visibilityMode: "PUBLIC",
  title: "Black leather wallet", text: "Black leather wallet silver zipper", imageText: "black leather silver zipper", ocrText: "ABC",
  categoryId: "wallet", parentCategoryId: "bags", areaId: null, buildingId: null, roomText: null, customLocation: null, lostFoundAt: null };
const observation = { title: "Black leather wallet", description: "silver zipper", categoryId: "wallet", visualAttributes: ["black","leather","silver","zipper"], visibleText: ["ABC"] };

function setup() {
  const repository = unexpectedPort<ContactPhotoRepository>("contact checks");
  const claims = unexpectedPort<ClaimRepository>("claims");
  const matching = unexpectedPort<MatchingRepository>("matching");
  const storage = unexpectedPort<PrivateMediaStorage>("private storage");
  let row: ContactPhotoCheck | null = { id: checkId, actorId: actor, postId, postRevision: revision, score: .91, model: "fixture",
    storageRef: "private://contact-photo", publicId: checkId, format: "jpg", bytes: 4, expiresAt: new Date(Date.now()+60000).toISOString(), claimId: null };
  let currentRevision: string | null = revision, approval = false, saved = 0, created = 0, removed = 0;
  let confidence = .9, providerFails = false, forbidden = false;
  const evidence: unknown[] = [], audit: unknown[] = [];
  repository.revision = async () => currentRevision;
  repository.lock = async () => row;
  repository.create = async input => { created++; row = { ...input, claimId: null }; };
  repository.consume = async (_id,id) => { if (row) row.claimId = id; approval = true; };
  repository.conversation = async () => ({ postId, ownerId: "owner", type: "LOST", categoryName: "Ví / bóp", parentName: null });
  repository.hasApproval = async () => approval;
  matching.findCandidate = async () => target;
  storage.save = async () => { saved++; return { secureUrl: "private://contact-photo", publicId: checkId }; };
  storage.remove = async () => { removed++; };
  claims.createEvidence = async input => { evidence.push(input); };
  claims.writeAudit = async input => { audit.push(input); };
  const service = createContactPhotoUseCases({ repository, claims, matching, mediaStorage: storage, transaction: fakeTransaction, id: () => checkId,
    authorizeTarget: async () => { if (forbidden) throw new Error("Unauthorized target"); },
    imageAnalysis: { analyzePostImages: async () => {
      if (providerFails) throw new Error("Provider unavailable");
      return { ...observation, suggestedCategory: { id: "wallet", name: "Wallet", parentId: "bags" }, confidence, warnings: [], assistedBy: "fixture", model: "fixture", imageCount: 1 };
    } } });
  return { repository, service, evidence, audit, setRow(value: ContactPhotoCheck | null) { row = value; }, getRow: () => row!,
    setRevision(value: string | null) { currentRevision = value; }, setConfidence(value: number) { confidence = value; },
    failProvider() { providerFails = true; }, denyTarget() { forbidden = true; }, stats: () => ({ saved,created,removed }) };
}

test("contact scoring reuses matching signals without trusting photo location or time", () => {
  assert.ok(scoreContactPhoto(target,observation) > .6);
  assert.ok(scoreContactPhoto(target,{ title: "Red bicycle", description: "steel frame wheels", categoryId: "bicycle", visualAttributes: ["red","wheels"], visibleText: [] }) <= .6);
});

test("a server-approved photo stores a private expiring check, not an ownership decision", async () => {
  const f = setup();
  const result = await f.service.analyze(postId,actor,photo);
  assert.equal(result.approved,true);
  assert.equal(result.checkId,checkId);
  assert.ok(result.score > .6);
  assert.ok(Date.parse(result.expiresAt!) > Date.now()+29*60000);
  assert.deepEqual(f.stats(),{ saved: 1, created: 1, removed: 0 });
  assert.equal(f.evidence.length,0);
  assert.equal(f.audit.length,0);
  assert.equal(JSON.stringify(result).includes("private://"),false);
});

test("provider failure, uncertain analysis, invalid files and authorization fail without granting contact", async () => {
  const f = setup(); f.setConfidence(.59);
  assert.equal((await f.service.analyze(postId,actor,photo)).approved,false);
  f.failProvider();
  await assert.rejects(f.service.analyze(postId,actor,photo),/Provider unavailable/);
  await assert.rejects(f.service.analyze(postId,actor,{ ...photo, buffer: Buffer.from("not an image") }));
  await assert.rejects(f.service.analyze(postId,actor,{ ...photo, size: 6*1024*1024 }));
  f.denyTarget();
  await assert.rejects(f.service.analyze(postId,actor,photo),/Unauthorized/);
  assert.deepEqual(f.stats(),{ saved: 0, created: 0, removed: 0 });
});

test("eligibility is strict above 60 percent and bound to actor, post, revision and expiry", async () => {
  const f = setup(), valid = { ...f.getRow() };
  await assert.rejects(f.service.requireEligible(undefined,postId,actor,db));
  for (const changes of [{ score: .6 }, { actorId: "other" }, { postId: "other" }, { postRevision: "stale" },
    { expiresAt: new Date(Date.now()-1).toISOString() }, { claimId: "another conversation" }]) {
    f.setRow({ ...valid, ...changes });
    await assert.rejects(f.service.requireEligible(checkId,postId,actor,db,claimId));
  }
  f.setRow({ ...valid, score: .60001 });
  assert.equal((await f.service.requireEligible(checkId,postId,actor,db)).score,.60001);
  f.setRevision(null);
  await assert.rejects(f.service.requireEligible(checkId,postId,actor,db));
  f.setRow(null);
  await assert.rejects(f.service.requireEligible(checkId,postId,actor,db));
});

test("attaching and replaying proof grants only that conversation and never accepts ownership", async () => {
  const f = setup();
  await f.service.attach(checkId,postId,actor,claimId,db);
  f.setRow({ ...f.getRow(), expiresAt: new Date(Date.now()-1000).toISOString() });
  await f.service.attach(checkId,postId,actor,claimId,db);
  assert.equal(f.evidence.length,1);
  assert.equal(f.audit.length,1);
  assert.equal((f.audit[0] as { action: string }).action,"CONTACT_PHOTO_MATCHED");
  assert.equal((f.audit[0] as { metadata: { purpose: string } }).metadata.purpose,"COMMUNICATION_ONLY");
  assert.equal((await f.service.state(claimId,actor))?.approved,true);
  assert.ok((await f.service.state(claimId,actor))!.questions.length > 0);
  await assert.rejects(f.service.attach(checkId,postId,actor,"another",db));
});

test("legacy LOST senders remain gated while the LOST owner and FOUND conversations are unaffected", async () => {
  const f = setup();
  await assert.rejects(f.service.requireSender(claimId,actor,db));
  await f.service.requireSender(claimId,"owner",db);
  assert.equal((await f.service.state(claimId,actor))?.approved,false);
  assert.equal((await f.service.state(claimId,"owner"))?.required,false);
  f.repository.conversation = async () => ({ postId, ownerId: "owner", type: "FOUND", categoryName: "Wallet", parentName: null });
  await f.service.requireSender(claimId,actor,db);
  assert.equal(await f.service.state(claimId,actor),null);
});

test("a changed post during provider analysis removes the private draft instead of approving it", async () => {
  const f = setup(); let revisions = 0;
  f.repository.revision = async () => ++revisions === 1 ? revision : "changed";
  await assert.rejects(f.service.analyze(postId,actor,photo));
  assert.deepEqual(f.stats(),{ saved: 1, created: 0, removed: 1 });
});

test("client approval flags and scores cannot bypass either LOST conversation creation route", async () => {
  const parsed = createDirectMessageSchema.parse({ postId, content: "Hello", approved: true, score: 1 });
  assert.equal("approved" in parsed,false);
  assert.equal("score" in parsed,false);
  const repository = unexpectedPort<ClaimRepository>("closed contact gate");
  repository.findClaimablePostForUpdate = async () => ({ id: postId, ownerId: "owner", type: "LOST" });
  repository.findByFoundPostForClaimant = async () => null;
  const service = createTestClaimUseCases({ claimRepository: repository });
  await assert.rejects(service.createDirectMessage(actor,parsed), /chưa sẵn sàng/);
  await assert.rejects(service.createClaim(actor,{ postId }), /chưa sẵn sàng/);
});
