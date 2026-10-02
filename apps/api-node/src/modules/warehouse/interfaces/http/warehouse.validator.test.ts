import assert from "node:assert/strict";
import test from "node:test";
import { returnWarehouseItemSchema } from "./warehouse.validator.js";

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

test("requires claim and recipient ids together when linking an online claim", () => {
  assert.throws(() => returnWarehouseItemSchema.parse({ ...directReturn, claimId: "00000000-0000-4000-8000-000000000001" }));
});
