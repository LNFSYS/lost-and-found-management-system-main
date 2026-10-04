import assert from "node:assert/strict";
import test from "node:test";
import { submitReportSchema } from "./report.validator.js";

const valid = {
  targetType: "POST", targetId: "11111111-1111-4111-8111-111111111111",
  reason: "Nội dung không phù hợp", details: "Mô tả ngắn", idempotencyKey: "retry-key-123"
};

test("report input accepts bounded supported target data", () => {
  assert.equal(submitReportSchema.parse(valid).targetType, "POST");
});

test("report input rejects unsupported targets, HTML and oversized evidence text", () => {
  assert.equal(submitReportSchema.safeParse({ ...valid, targetType: "USER" }).success, false);
  assert.equal(submitReportSchema.safeParse({ ...valid, details: "<script>alert(1)</script>" }).success, false);
  assert.equal(submitReportSchema.safeParse({ ...valid, details: "x".repeat(1001) }).success, false);
});
