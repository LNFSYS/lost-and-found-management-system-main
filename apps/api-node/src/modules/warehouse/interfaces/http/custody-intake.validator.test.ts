import assert from "node:assert/strict";
import test from "node:test";
import { cancelCustodyRequestSchema, listCustodyRequestsQuerySchema } from "./custody-request.validator.js";

test("awaiting-intake filter includes legacy requests without adding a lifecycle status", () => {
  assert.equal(listCustodyRequestsQuerySchema.parse({ status: "AWAITING_INTAKE" }).status, "AWAITING_INTAKE");
  assert.equal(listCustodyRequestsQuerySchema.parse({ status: "ACCEPTED" }).status, "ACCEPTED");
});

test("Finder cancellation needs a nonempty reason", () => {
  assert.equal(cancelCustodyRequestSchema.safeParse({}).success, false);
  assert.equal(cancelCustodyRequestSchema.safeParse({ reason: "  " }).success, false);
  assert.equal(cancelCustodyRequestSchema.parse({ reason: "Không thể mang tới quầy" }).reason, "Không thể mang tới quầy");
});
