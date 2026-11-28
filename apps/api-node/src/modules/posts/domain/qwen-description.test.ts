import test from "node:test";
import assert from "node:assert/strict";
import { coherentDescription, polishedDescription, sentenceCase, resolveQwenCategory, uniqueEvidence } from "./qwen-description.js";

test("duplicate sentences across images are removed while distinct details survive", () => {
  assert.equal(coherentDescription(["Balo xanh đậm. Có ba sọc trắng.", "  Balo xanh đậm.\nCó túi khóa kéo phía trước."]),
    "Balo xanh đậm. Có ba sọc trắng. Có túi khóa kéo phía trước.");
  assert.deepEqual(uniqueEvidence(["xanh đậm", " Xanh   đậm ", "đen"]), ["xanh đậm", "đen"]);
  assert.equal(coherentDescription(["Balo xanh.Balo xanh."]), "Balo xanh.");
});

test("backpack maps only to a unique existing Vietnamese category", () => {
  assert.equal(resolveQwenCategory(["backpack", "ba lô"], ["Balo", "Ví / bóp"]), "Balo");
  assert.equal(resolveQwenCategory(["backpack"], ["Ví / bóp"]), "");
  assert.equal(resolveQwenCategory(["bag"], ["Balo", "Túi xách"]), "");
  assert.equal(resolveQwenCategory(["backpack", "wallet"], ["Balo", "Ví / bóp"]), "");
  assert.equal(resolveQwenCategory(["wallet"], ["Ví / bóp"]), "Ví / bóp");
});

test("phone autofill handles uppercase Vietnamese D in the live catalog", () => {
  for (const objectName of ["phone", "Điện thoại", "ĐIỆN THOẠI", "điện thoại màu đỏ"]) {
    assert.equal(resolveQwenCategory([objectName], ["Điện thoại", "Balo"]), "Điện thoại");
  }
});

test("thermos names resolve to the existing water-bottle category without matching arbitrary bottles", () => {
  for (const name of ["bình giữ nhiệt", "bình giữ nhiệt màu xám", "BÌNH NƯỚC", "thermos", "vacuum flask", "water bottle"]) {
    assert.equal(resolveQwenCategory([name], ["Bình nước", "Balo"]), "Bình nước");
  }
  assert.equal(resolveQwenCategory(["medicine bottle"], ["Bình nước"]), "");
  assert.equal(resolveQwenCategory(["thermos"], ["Balo"]), "");
});

test("fluent descriptions capitalize sentence starts and retain logo casing", () => {
  assert.equal(sentenceCase("  bình màu xám. có logo adidas và chữ USB-C."), "Bình màu xám. Có logo adidas và chữ USB-C.");
  assert.equal(polishedDescription(["bình màu xám có nắp vặn."], "bình", ["xám"], ["nắp vặn"]), "Bình màu xám có nắp vặn.");
});

test("multi-view fallback joins observed details and drops speculative uses", () => {
  const result = polishedDescription([
    "bình màu xám. Đặc điểm nhìn thấy: có nắp; có thể dùng để giữ nhiệt.",
    "bình màu xám. có thể dùng làm đồ chơi."
  ], "bình", ["xám", "xám"], ["có nắp vặn", "có logo adidas", "có nắp vặn", "có thể dùng để uống nước", "có thể dùng làm đồ chơi"]);
  assert.equal(result, "Bình màu xám, có nắp vặn và logo adidas.");
  assert.equal(polishedDescription(["có thể dùng để uống nước"], "bình", ["xám"], ["được làm bằng nhôm", "có nắp vặn"]),
    "Bình màu xám, có chất liệu nhôm và nắp vặn.");
});

test("phone screenshot regression removes repeated subjects and equivalent rim details", () => {
  const features = ["điện thoại có viền đỏ", "điện thoại có màn hình đen", "một chiếc điện thoại có màu đỏ",
    "một chiếc điện thoại có logo Apple ở mặt sau", "một chiếc điện thoại có camera ở mặt sau",
    "một chiếc điện thoại có vết mòn ở mặt sau", "một chiếc điện thoại màu đỏ đang được cầm bằng tay",
    "điện thoại có viền màu đỏ"];
  const result = polishedDescription([features.join(", ")], "điện thoại", ["đỏ"], features);
  assert.equal(result, "Điện thoại màu đỏ, có viền đỏ, màn hình đen, logo Apple ở mặt sau, camera ở mặt sau và vết mòn ở mặt sau.");
  assert.equal(result.match(/điện thoại/giu)?.length, 1);
  assert.ok(result.length <= 500);
});

test("similar features with different numbers or positions are not merged", () => {
  const result = polishedDescription(["có thể dùng để chụp ảnh"], "điện thoại", [],
    ["điện thoại có camera ở mặt sau", "điện thoại có camera ở mặt trước", "có chữ A12", "có chữ A13"]);
  for (const detail of ["camera ở mặt sau", "camera ở mặt trước", "A12", "A13"]) assert.ok(result.includes(detail));
});

test("multi-view surface clauses form one sentence and retain literal OCR", () => {
  const result = polishedDescription(["Chai nước màu trắng.", "Chai nước có nắp."], "Chai nước", ["trắng"],
    ["chữ “LOCK&LOCK”", "Có nắp màu đen", "Bề mặt nhẵn", "Bề mặt có vết trầy", "Bề mặt nhẵn"]);
  assert.equal(result, "Chai nước màu trắng, có chữ “LOCK&LOCK” và nắp màu đen. Bề mặt nhẵn và có vết trầy.");
});
