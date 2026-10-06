import assert from "node:assert/strict";
import test from "node:test";
import { contactPhotoQuestions } from "./contact-photo-questions.js";

test("three image-derived suggestions ask about features without disclosing private answers", () => {
  const phone = contactPhotoQuestions({ title: "Phone", visualAttributes: ["triple camera", "scratch", "PIN 1234"] });
  const wallet = contactPhotoQuestions({ title: "Wallet", visualAttributes: ["leather", "zipper"] });
  assert.equal(phone.length, 3); assert.equal(wallet.length, 3);
  assert.match(phone[0], /camera/); assert.match(phone[1], /trầy/);
  assert.match(wallet[0], /ngăn/);
  assert.ok(phone.every(question => !question.includes("1234")));
  assert.notDeepEqual(phone, wallet);
});
