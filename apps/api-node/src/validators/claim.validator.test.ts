import assert from "node:assert/strict";
import test from "node:test";
import { createClaimSchema, createMessageSchema, uploadEvidenceSchema } from "./claim.validator.js";

const lostPostId = "11111111-1111-4111-8111-111111111111";
const foundPostId = "22222222-2222-4222-8222-222222222222";

test("claim input requires a pair of UUID posts and bounds optional idempotency keys", () => {
  const input = createClaimSchema.parse({ lostPostId, foundPostId, requestKey: "claim-2026-09-03-1" });
  assert.equal(input.lostPostId, lostPostId);
  assert.throws(() => createClaimSchema.parse({ lostPostId, foundPostId, requestKey: "<script>" }));
  assert.throws(() => createClaimSchema.parse({ lostPostId: "not-a-uuid", foundPostId }));
});

test("messages and evidence descriptions reject oversized input", () => {
  assert.equal(createMessageSchema.parse({ content: "Xin chào" }).content, "Xin chào");
  assert.throws(() => createMessageSchema.parse({ content: "x".repeat(5001) }));
  assert.equal(uploadEvidenceSchema.parse({ description: "Ảnh mặt sau" }).description, "Ảnh mặt sau");
  assert.throws(() => uploadEvidenceSchema.parse({ description: "x".repeat(256) }));
});
