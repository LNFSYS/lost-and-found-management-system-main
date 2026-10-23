import assert from "node:assert/strict";
import test from "node:test";
import { retrieveIllustrationContext } from "./illustration-context.js";

test("retrieval uses the selected category and physical item description, with Vietnamese diacritics", () => {
  assert.equal(retrieveIllustrationContext("Ví / bóp", "Ví da màu đen hình chữ nhật có khóa kéo")?.id, "wallet");
  assert.equal(retrieveIllustrationContext("Laptop", "Mất Macbook màu xám có sticker trắng")?.id, "computer");
  assert.equal(retrieveIllustrationContext("Điện thoại", "iPhone màu tím có ốp trong suốt")?.id, "phone");
  assert.equal(retrieveIllustrationContext("Ví/bóp", "Ví, chất liệu da đen với khóa bạc")?.id, "wallet");
});
test("retrieval rejects unrelated creative prompts and mismatched categories", () => {
  assert.equal(retrieveIllustrationContext("Ví / bóp", "Vẽ một khu rừng vào buổi sáng"), null);
  assert.equal(retrieveIllustrationContext("Ví / bóp", "Điện thoại màu đen bị mất"), null);
  assert.equal(retrieveIllustrationContext("Unknown category", "Ví da màu đen"), null);
});
