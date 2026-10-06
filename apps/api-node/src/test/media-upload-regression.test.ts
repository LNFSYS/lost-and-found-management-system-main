import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadIdentity } from "../shared/infrastructure/media-uploads.js";
import type { MediaUploads } from "../shared/application/media-upload.js";
import { recordTransactionOutcome, type TransactionRunner } from "../shared/application/transaction.js";
import type { PrivateMediaStorage } from "../shared/application/media-storage.port.js";
import { createContactPhotoUseCases } from "../modules/claims/application/contact-photo.use-cases.js";
import type { ContactPhotoRepository } from "../modules/claims/application/contact-photo.repository.port.js";
import type { PostRecord } from "../modules/posts/application/post.repository.port.js";
import { unexpectedPort } from "./unexpected-port.js";
import { createTestWarehouseUseCases, createTestPostUseCases, createTestClaimUseCases, createTestAuthUseCases,
  warehouseRepository, postRepository, claimRepository, matchingRepository } from "./use-case-fixtures.js";

const actor = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const key = "33333333-3333-4333-8333-333333333333";
const file = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]), size: 4, mimetype: "image/jpeg" };
type Kind = "INTAKE" | "PROOF" | "POST" | "EVIDENCE" | "CONTACT" | "AVATAR";
type Fault = "INSERT_ACK" | "COMMIT_ACK" | "UNKNOWN_READ" | "ROLLED_BACK" | "STORAGE" | "NONE";

// Repository doubles retain committed rows independently of the rejected API promise.
function fixture(kind: Kind, initialFault: Fault) {
  let fault = initialFault, row: any = null, pending: any = null, readsFail = false;
  let saves = 0, writes = 0, removed = 0;
  const assets = new Set<string>();
  const logs: string[] = [];
  const error = Object.assign(new Error("lost acknowledgement"), { code: "ECONNRESET" });
  const read = async () => { if (readsFail) throw new Error("authoritative read unavailable"); return row; };
  async function insert(input: any) {
    writes++; pending = input;
    if (fault === "INSERT_ACK") { row = pending; throw error; }
    if (fault === "ROLLED_BACK") throw error;
  }
  const transaction: TransactionRunner = async work => {
    pending = null;
    try {
      const value = await work({} as Parameters<Parameters<TransactionRunner>[0]>[0]);
      if (pending !== null) row = pending;
      if (fault === "COMMIT_ACK" || fault === "UNKNOWN_READ") { readsFail = fault === "UNKNOWN_READ"; throw error; }
      return value;
    } catch (reason) {
      if (fault === "ROLLED_BACK") { row = null; recordTransactionOutcome(reason, "ROLLED_BACK"); }
      throw reason;
    }
  };
  const uploads: MediaUploads = { run: (scope, bytes, work) => work({ id: uploadIdentity(scope, bytes), canCompensate: async () => true }) };
  const logger = { warn: (message: unknown) => logs.push(String(message)) };
  const storage: PrivateMediaStorage = {
    save: async (_owner, id) => {
      saves++;
      if (fault === "STORAGE") throw new Error("asset provider unavailable");
      assets.add(id);
      return { secureUrl: id, publicId: id };
    },
    resolve: async ref => { assert.ok(assets.has(ref), "Referenced asset must still exist"); return { body: file.buffer, contentType: "image/jpeg" }; },
    remove: async ref => { removed++; assets.delete(ref); }
  };
  let upload: () => Promise<unknown>;
  if (kind === "INTAKE" || kind === "PROOF") {
    const repository = { ...warehouseRepository, isStaff: async () => true,
      findIntakeImage: read, findWarehouseImage: read, findProof: read,
      openIntakeSession: async () => {}, lockIntakeSession: async () => ({ actorId: actor, custodyRequestId: null, warehouseItemId: null, createdAt: new Date().toISOString() }),
      listIntakeImages: async () => [],
      createIntakeImage: async (input: any) => insert({ ...input, uploaderId: input.actorId }), createProof: insert,
      findItemById: async () => ({ id: target, status: "STORED" }), lockItemForUpdate: async () => ({ id: target, status: "STORED" }) };
    const service = createTestWarehouseUseCases({ uploads, logger, withTransaction: transaction, proofStorage: storage, warehouseRepository: repository as any });
    upload = kind === "INTAKE" ? () => service.uploadIntakeImage({ intakeKey: key }, file, actor) : () => service.uploadProof(target, file, actor);
  } else if (kind === "POST") {
    const post = { id: target, userId: actor, ownerName: "Fixture", type: "FOUND", status: "OPEN", visibilityMode: "PUBLIC",
      title: "Keys", description: "Fixture", categoryId: null, areaId: null, buildingId: null, media: [] } as unknown as PostRecord;
    const service = createTestPostUseCases({ uploads, logger, withTransaction: transaction, mediaStorage: storage,
      postRepository: { ...postRepository, findOwnedById: async () => post, lockOwnedPostForMedia: async () => post, countMedia: async () => 0,
        findMedia: read, createMedia: async input => insert({ ...input, ownerId: actor }) } });
    upload = () => service.uploadMedia(target, actor, { mediaKind: "ITEM" }, file, { sub: actor, email: "fixture@example.invalid", roles: ["USER"], sessionVersion: 0 });
  } else if (kind === "EVIDENCE") {
    const claim = { id: target, claimantId: actor, status: "CONVERSATION_OPEN" };
    const service = createTestClaimUseCases({ uploads, logger, withTransaction: transaction, mediaStorage: storage,
      claimRepository: { ...claimRepository, findById: async () => claim, findByIdForUpdate: async () => claim,
        findParticipant: async () => ({ role: "CLAIMANT", consentStatus: "ACCEPTED" }), findRoomByClaim: async () => ({ id: key }),
        findEvidence: read, writeAudit: async () => {}, createEvidence: async (input: any) => insert({ ...input, uploadedBy: { id: actor, fullName: "Fixture" } }) } as any });
    upload = () => service.uploadEvidence(target, actor, {}, file);
  } else if (kind === "CONTACT") {
    const repository = unexpectedPort<ContactPhotoRepository>("contact upload regression");
    repository.revision = async () => "2026-10-05T00:00:00Z";
    repository.findById = read; repository.create = insert;
    const service = createContactPhotoUseCases({ uploads, logger, transaction, repository, claims: claimRepository,
      matching: { ...matchingRepository, findCandidate: async () => ({ id: target, userId: "owner", type: "LOST", status: "OPEN", visibilityMode: "PUBLIC",
        title: "Keys", text: "Keys", imageText: "keys", ocrText: "", categoryId: "keys", parentCategoryId: null,
        areaId: null, buildingId: null, roomText: null, customLocation: null, lostFoundAt: null }) },
      authorizeTarget: async () => {}, id: () => key, mediaStorage: storage,
      imageAnalysis: { analyzePostImages: async () => ({ title: "Keys", description: "Keys", visualAttributes: ["keys"], visibleText: [],
        suggestedCategory: { id: "keys", name: "Keys", parentId: null }, confidence: .99, warnings: [], imageCount: 1, assistedBy: "fixture", model: "fixture" }) } });
    upload = () => service.analyze(target, actor, file);
  } else {
    const user = { id: actor, status: "ACTIVE", roles: ["USER"] } as any;
    const service = createTestAuthUseCases({ uploads, logger, withTransaction: transaction,
      userRepository: { findById: async () => user } as any,
      avatarRepository: { findAvatarById: read, updateAvatar: async (_user, input) => { await insert(input); return user; } },
      avatarStorage: { upload: async input => {
        const saved = await storage.save(actor, input.publicId!, "jpg", input.buffer);
        return { publicId: `lnfs/avatars/${saved.publicId}`, assetId: null, version: 1, format: "jpg", resourceType: "image", bytes: 4 };
      }, destroy: ref => storage.remove(ref.replace("lnfs/avatars/", "")), download: input => storage.resolve(input.publicId.replace("lnfs/avatars/", "")) } });
    upload = () => service.updateAvatar(actor, file);
  }
  return { upload, retry: () => { fault = "NONE"; readsFail = false; return upload(); }, stats: () => ({ saves, writes, removed, assets: assets.size }), logs };
}

for (const kind of ["INTAKE", "PROOF", "POST", "EVIDENCE", "CONTACT", "AVATAR"] as const) {
  for (const fault of ["INSERT_ACK", "COMMIT_ACK", "UNKNOWN_READ", "ROLLED_BACK", "STORAGE"] as const) {
    test(`${kind}: ${fault} retains referenced assets and retries without duplicate persistence`, async () => {
      const f = fixture(kind, fault);
      if (fault === "INSERT_ACK" || fault === "COMMIT_ACK") await f.upload();
      else await assert.rejects(f.upload());
      assert.equal(f.stats().removed, fault === "ROLLED_BACK" ? 1 : 0);
      assert.equal(f.stats().assets, ["STORAGE", "ROLLED_BACK"].includes(fault) ? 0 : 1);
      if (fault === "UNKNOWN_READ") {
        assert.equal(f.logs.length, 1);
        assert.match(f.logs[0]!, /media_upload_review_required/);
      }
      if (["INSERT_ACK", "COMMIT_ACK", "UNKNOWN_READ"].includes(fault)) {
        await f.retry();
        assert.deepEqual(f.stats(), { saves: 1, writes: 1, removed: 0, assets: 1 });
      }
    });
  }
}

test("upload identity is scoped to actor, target, metadata and bytes", () => {
  const id = uploadIdentity('["INTAKE","actor","session"]', file.buffer);
  assert.equal(id, uploadIdentity('["INTAKE","actor","session"]', file.buffer));
  assert.notEqual(id, uploadIdentity('["INTAKE","other","session"]', file.buffer));
  assert.notEqual(id, uploadIdentity('["INTAKE","actor","other"]', file.buffer));
  assert.notEqual(id, uploadIdentity('["INTAKE","actor","session"]', Buffer.from("other")));
});
