import assert from "node:assert/strict";
import test from "node:test";
import { returnWarehouseItemSchema, verifyCustodyClaimSchema } from "./warehouse.validator.js";

const directReturn = {
  receiverName: "Trần Thế Lượng",
  receiverIdentity: "CCCD-012345678901",
  receiverPhone: "0359123456",
  proofImage: "00000000-0000-4000-8000-000000000000"
};

test("accepts an in-person return without an account or claim", () => {
  const parsed = returnWarehouseItemSchema.parse(directReturn);
  assert.equal(parsed.claimId, undefined);
  assert.equal(parsed.recipientId, undefined);
  assert.equal(parsed.receiverName, directReturn.receiverName);
});

test("normalizes empty claim fields from direct-return forms", () => {
  const parsed = returnWarehouseItemSchema.parse({ ...directReturn, claimId: "", recipientId: "" });
  assert.equal(parsed.claimId, null);
  assert.equal(parsed.recipientId, null);
});

test("requires claim and recipient ids together when linking an online claim", () => {
  assert.throws(() => returnWarehouseItemSchema.parse({ ...directReturn, claimId: "00000000-0000-4000-8000-000000000001" }));
});

test("custody verification requires explicit confirmation, actual recipient and a bounded reason", () => {
  const input = { claimId: directReturn.proofImage, recipientId: directReturn.proofImage, verified: true, reason: "Checked unique private features at desk" };
  assert.equal(verifyCustodyClaimSchema.parse(input).verified, true);
  assert.throws(() => verifyCustodyClaimSchema.parse({ ...input, verified: false }));
  assert.throws(() => verifyCustodyClaimSchema.parse({ ...input, reason: "ok" }));
  assert.throws(() => verifyCustodyClaimSchema.parse({ ...input, reason: "x".repeat(1001) }));
});
