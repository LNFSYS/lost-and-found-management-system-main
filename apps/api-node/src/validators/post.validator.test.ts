import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVietnameseText } from "../utils/text.js";
import { createPostSchema } from "./post.validator.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const basePost = {
  title: "Mat vi sinh vien",
  description: "Vi mau den co the sinh vien ben trong",
  categoryId: uuid,
  areaId: uuid,
  contactInfo: "email@example.com",
  lostFoundAt: new Date(Date.now() - 60_000).toISOString()
};

test("post rejects future incident time", () => {
  const result = createPostSchema.safeParse({
    ...basePost,
    type: "LOST",
    lostFoundAt: new Date(Date.now() + 60_000).toISOString()
  });
  assert.equal(result.success, false);
});

test("FOUND requires a handover point or valid storage location", () => {
  const result = createPostSchema.safeParse({
    ...basePost,
    type: "FOUND",
    areaId: undefined
  });
  assert.equal(result.success, false);
});

test("PRIVATE_DETAILS applies only to FOUND posts", () => {
  const result = createPostSchema.safeParse({
    ...basePost,
    type: "LOST",
    visibilityMode: "PRIVATE_DETAILS"
  });
  assert.equal(result.success, false);
});

test("normalizes Vietnamese search text without encoding-sensitive literals", () => {
  assert.equal(normalizeVietnameseText("Điện thoại đánh rơi"), "dien thoai danh roi");
});
