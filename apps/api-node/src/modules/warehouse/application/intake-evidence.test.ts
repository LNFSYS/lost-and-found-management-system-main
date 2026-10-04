import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fakeTransaction, warehouseRepository, createTestWarehouseUseCases } from "../../../test/use-case-fixtures.js";
import { intakeFingerprint, prepareIntakeEvidence, serializeWarehouseImage, validateIntakeEvidence } from "./intake-evidence.js";
import { createWarehouseItemSchema } from "../interfaces/http/warehouse.validator.js";
import { intakeCustodyRequestSchema } from "../interfaces/http/custody-request.validator.js";

const input = { intakeKey: randomUUID(), intakeImageIds: [randomUUID()], receivedQuantity: 1, accessories: "No accessories", physicalReviewConfirmed: true as const };
const image = { id: input.intakeImageIds[0]!, provenance: "INTAKE" as const, uploaderId: "staff", uploadedAt: new Date().toISOString(), capturedAt: null, postId: null, intakeKey: input.intakeKey, returnId: null, storageRef: "private://secret", format: "jpg" };
const session = { id: input.intakeKey, actorId: "staff", custodyRequestId: null, warehouseItemId: null, requestPayload: null, createdAt: new Date().toISOString() };
const repository = { ...warehouseRepository, lockIntakeSession: async () => session, listIntakeImages: async () => [image] };

test("intake requires Staff evidence, quantity and explicit accessory observations", () => {
  validateIntakeEvidence(input);
  for (const change of [{ intakeImageIds: [] }, { intakeImageIds: Array(6).fill(randomUUID()) }, { intakeImageIds: [image.id,image.id] }, { receivedQuantity: 0 }, { receivedQuantity: 1.5 }, { accessories: " " }]) assert.throws(() => validateIntakeEvidence({ ...input, ...change }));
  assert.equal(createWarehouseItemSchema.safeParse({ itemName: "Fixture", handoverPointId: randomUUID(), conditionNotes: "Good" }).success,false);
  assert.equal(intakeCustodyRequestSchema.safeParse({ conditionNotes: "Good" }).success,false);
});
test("intake refuses another actor, a source photo, a wrong request or stale draft", async () => {
  const payload = intakeFingerprint(input);
  await fakeTransaction(async db => {
    assert.equal(await prepareIntakeEvidence(repository,input,"staff",null,payload,db),null);
    await assert.rejects(prepareIntakeEvidence(repository,input,"other",null,payload,db));
    await assert.rejects(prepareIntakeEvidence(repository,input,"staff","wrong",payload,db));
    await assert.rejects(prepareIntakeEvidence(repository,{ ...input, intakeImageIds: [randomUUID()] },"staff",null,payload,db));
    await assert.rejects(prepareIntakeEvidence({ ...repository, listIntakeImages: async () => [{ ...image, uploadedAt: new Date(Date.now()-73*3600000).toISOString() }] },input,"staff",null,payload,db));
  });
});
test("confirmed intake replays only identical payload despite MySQL JSON key order", async () => {
  const payload = intakeFingerprint({ ...input, itemName: "Fixture" });
  const complete = { ...repository, lockIntakeSession: async () => ({ ...session, warehouseItemId: "item", requestPayload: JSON.stringify({ itemName: "Fixture", ...input }) }) };
  await fakeTransaction(async db => {
    assert.equal(await prepareIntakeEvidence(complete,input,"staff",null,payload,db),"item");
    await assert.rejects(prepareIntakeEvidence(complete,input,"staff",null,intakeFingerprint({ ...input, itemName: "Changed" }),db));
  });
});
test("image serialization exposes provenance but no storage reference or public URL", () => {
  const result = serializeWarehouseImage(image);
  assert.equal(result.provenance,"INTAKE");
  assert.ok(result.url.startsWith("/staff/warehouse-images/"));
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("unattached private intake images are visible only to uploader", async () => {
  const service = createTestWarehouseUseCases({ warehouseRepository: { ...repository, isStaff: async () => true, findWarehouseImage: async () => image },
    proofStorage: { save: async () => ({ secureUrl: "private", publicId: "private" }), remove: async () => {}, resolve: async () => ({ body: Buffer.from("photo"), contentType: "image/jpeg" }) } });
  await assert.rejects(service.getImage(image.id,"INTAKE","another-staff"));
  assert.equal((await service.getImage(image.id,"INTAKE","staff")).body.toString(),"photo");
});
