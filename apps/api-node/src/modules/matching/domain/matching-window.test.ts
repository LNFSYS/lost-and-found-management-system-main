import assert from "node:assert/strict";
import test from "node:test";
import { resolveSensitivityMatchingWindow, classifySensitivityLevel } from "./matching-window.js";

test("resolveSensitivityMatchingWindow returns 180 for S1 items (CCCD, Thẻ SV, Bằng lái, Laptop, Điện thoại)", () => {
  assert.equal(resolveSensitivityMatchingWindow({ title: "Nhặt được CCCD mang tên Nguyễn Văn A" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Rơi thẻ sinh viên FPTU" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Bằng lái xe B2" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Quên laptop ThinkPad tại thư viện" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "iPhone 13 Pro Max màu xanh" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ text: "Trong túi có điện thoại Samsung và giấy phép lái xe" }), 180);
});

test("resolveSensitivityMatchingWindow returns 180 for S2 items (Thẻ ngân hàng, Ví tiền, Máy tính bảng)", () => {
  assert.equal(resolveSensitivityMatchingWindow({ title: "Rơi ví tiền da màu nâu", categoryName: "Ví & Thẻ" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Thẻ ngân hàng Vietcombank" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "iPad Air 5 rơi tại phòng 302" }), 180);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Bóp tiền rơi ở căng tin" }), 180);
});

test("resolveSensitivityMatchingWindow returns 90 for S0 items (Áo khoác, bình nước, mũ, balo, ô dù)", () => {
  assert.equal(resolveSensitivityMatchingWindow({ title: "Nhặt được bình nước Lock&Lock màu đen" }), 90);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Áo khoác gió Uniqlo để quên tại sảnh Alpha" }), 90);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Mũ bảo hiểm FPT", text: "để ở xe máy tầng hầm" }), 90);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Balo học sinh màu xám không có đồ quý giá" }), 90);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Cây dù / ô che mưa màu xanh lá" }), 90);
  assert.equal(resolveSensitivityMatchingWindow({ title: "Sách giáo trình toán cao cấp" }), 90);
});

test("classifySensitivityLevel accurately tags S0 vs S1_S2", () => {
  assert.equal(classifySensitivityLevel({ title: "Bình giữ nhiệt" }), "S0");
  assert.equal(classifySensitivityLevel({ title: "Thẻ ATM Techcombank" }), "S1_S2");
});
