import assert from "node:assert/strict";
import test from "node:test";
import { claimDecisionSchema, createClaimSchema, createMessageSchema, listClaimsQuerySchema, listMessagesQuerySchema, uploadEvidenceSchema, verificationAnswerSchema, verificationQuestionSchema, verificationReviewSchema } from "./claim.validator.js";

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

test("claim list query bounds page size", () => {
  assert.deepEqual(listClaimsQuerySchema.parse({ page: 2, pageSize: 25 }), { page: 2, pageSize: 25 });
  assert.throws(() => listClaimsQuerySchema.parse({ page: 1, pageSize: 51 }));
});

test("verification mutations require an idempotency key and safe rationale", () => {
  const base = { idempotencyKey: "verify-2026-1" };
  assert.equal(claimDecisionSchema.parse({ decision: "OPEN_CONVERSATION", note: "Mở phòng để hỏi thêm", ...base }).decision, "OPEN_CONVERSATION");
  assert.throws(() => claimDecisionSchema.parse({ decision: "VERIFY_FOR_MEETUP", ...base }));
  assert.equal(verificationQuestionSchema.parse({ questionKey: "accessory", prompt: "Mô tả phụ kiện riêng", templateId: "electronics-ownership", templateVersion: 1, ...base }).templateVersion, 1);
  assert.equal(verificationAnswerSchema.parse({ questionKey: "accessory", answer: "Ốp màu đen", ...base }).answer, "Ốp màu đen");
  assert.equal(verificationReviewSchema.parse({ questionKey: "accessory", result: "PASS", confidence: 0.8, reason: "Chi tiết phù hợp", ...base }).result, "PASS");
});
