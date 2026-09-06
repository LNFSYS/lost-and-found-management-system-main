import assert from "node:assert/strict";
import test from "node:test";
import { createClaimSchema, createMessageSchema, listMessagesQuerySchema, uploadEvidenceSchema } from "./claim.validator.js";

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

test("message pagination requires a composite timestamp and message cursor", () => {
  const parsed = listMessagesQuerySchema.parse({ before: "2026-09-05T08:00:00.000Z", beforeId: lostPostId, limit: 20 });
  assert.equal(parsed.beforeId, lostPostId);
  assert.throws(() => listMessagesQuerySchema.parse({ before: "2026-09-05T08:00:00.000Z", limit: 20 }));
  assert.throws(() => listMessagesQuerySchema.parse({ beforeId: lostPostId, limit: 20 }));
});
