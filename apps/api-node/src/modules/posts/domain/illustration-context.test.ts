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

test("the explicit other-items category retrieves a supported item from its description", () => {
  const description = "BÌnh nước thương hiệu LocknLock, màu trắng kem, có nắp màu đen, 500ml, dài cỡ 20cm";
  for (const category of ["Vật dụng khác", "vat dung khac"]) {
    assert.equal(retrieveIllustrationContext(category, description)?.id, "bottle");
    assert.equal(retrieveIllustrationContext(category, "Ví vải đen nhỏ gọn")?.id, "wallet");
    assert.equal(retrieveIllustrationContext(category, "Vẽ lâu đài trên trời"), null);
    assert.equal(retrieveIllustrationContext(category, "Màu trắng kem, nắp đen, 500ml"), null);
  }
  assert.equal(retrieveIllustrationContext("Bình nước", description)?.id, "bottle");
  assert.equal(retrieveIllustrationContext("Ví / bóp", description), null);
  assert.equal(retrieveIllustrationContext("Danh mục khác chưa hỗ trợ", description), null);
});
