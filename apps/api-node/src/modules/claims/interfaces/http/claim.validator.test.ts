import assert from "node:assert/strict";
import test from "node:test";
import {
  answerVerificationQuestionSchema, claimDecisionSchema, createClaimSchema, createDirectMessageSchema, createMessageSchema, listClaimsQuerySchema,
  listMessagesQuerySchema, sendVerificationQuestionSchema, uploadEvidenceSchema, verificationDecisionSchema
} from "./claim.validator.js";

const lostPostId = "11111111-1111-4111-8111-111111111111";
const foundPostId = "22222222-2222-4222-8222-222222222222";

test("claim input accepts either a direct post or a matched pair", () => {
  const direct = createClaimSchema.parse({ postId: foundPostId });
  assert.equal(direct.postId, foundPostId);
  const input = createClaimSchema.parse({ lostPostId, foundPostId, requestKey: "claim-2026-09-03-1" });
  assert.equal(input.lostPostId, lostPostId);
  assert.throws(() => createClaimSchema.parse({ lostPostId, foundPostId, requestKey: "<script>" }));
  assert.throws(() => createClaimSchema.parse({ lostPostId: "not-a-uuid", foundPostId }));
  assert.throws(() => createClaimSchema.parse({ foundPostId }));
  assert.throws(() => createClaimSchema.parse({ postId: foundPostId, lostPostId, foundPostId }));
});

test("messages and evidence descriptions reject oversized input", () => {
  assert.equal(createMessageSchema.parse({ content: "Xin chào" }).content, "Xin chào");
  assert.throws(() => createMessageSchema.parse({ content: "x".repeat(5001) }));
  assert.equal(uploadEvidenceSchema.parse({ description: "Ảnh mặt sau" }).description, "Ảnh mặt sau");
  assert.throws(() => uploadEvidenceSchema.parse({ description: "x".repeat(256) }));
});

test("the first direct message must include both a post and non-empty content", () => {
  const message = createDirectMessageSchema.parse({ postId: foundPostId, content: "Xin chào", clientMessageId: "direct-message-1" });
  assert.equal(message.postId, foundPostId);
  assert.throws(() => createDirectMessageSchema.parse({ postId: foundPostId, content: " " }));
  assert.throws(() => createDirectMessageSchema.parse({ content: "Xin chào" }));
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

test("verification writes require bounded input and an idempotency key", () => {
  const key = "verification-request-1";
  assert.equal(claimDecisionSchema.parse({ decision: "ACCEPT", note: "Open private room", idempotencyKey: key }).decision, "ACCEPT");
  assert.throws(() => claimDecisionSchema.parse({ decision: "ACCEPT", note: "Open private room" }));
  assert.equal(sendVerificationQuestionSchema.parse({
    templateId: "phone-device", templateVersion: 1, promptKey: "case-accessory",
    prompt: "Ốp lưng có đặc điểm riêng nào?", idempotencyKey: key
  }).templateVersion, 1);
  assert.throws(() => answerVerificationQuestionSchema.parse({ answer: "x" }));
  assert.equal(verificationDecisionSchema.parse({
    decision: "VERIFY_FOR_MEETUP", reason: "Hai câu trả lời phù hợp", idempotencyKey: key
  }).decision, "VERIFY_FOR_MEETUP");
});
