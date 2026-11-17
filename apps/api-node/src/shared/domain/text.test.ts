import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { maskContactInfo, maskEmail, maskPhone, normalizeEmail, normalizeVietnameseText } from "./text.js";

describe("Text and Contact Masking utilities", () => {
  it("normalizes Vietnamese text and email", () => {
    assert.equal(normalizeVietnameseText("  ĐIỆN THOẠI   iPhone 13  "), "dien thoai iphone 13");
    assert.equal(normalizeEmail("  User.Name@Example.COM "), "user.name@example.com");
  });

  it("masks Vietnamese phone numbers in text", () => {
    assert.equal(maskPhone("Liên hệ tôi qua 0987654321 nhé"), "Liên hệ tôi qua 098***321 nhé");
    assert.equal(maskPhone("SĐT: 035-912-3456"), "SĐT: 035***456");
    assert.equal(maskPhone("Số: +84912345678"), "Số: +8491***678");
  });

  it("masks email addresses in text", () => {
    assert.equal(maskEmail("Gửi mail về student@fpt.edu.vn"), "Gửi mail về st***@fpt.edu.vn");
    assert.equal(maskEmail("Liên hệ a@gmail.com"), "Liên hệ a***@gmail.com");
  });

  it("masks both phone and email in combined text", () => {
    const raw = "Nhặt được ví, liên hệ 0912345678 hoặc lostfound@fpt.edu.vn ngay";
    const masked = maskContactInfo(raw);
    assert.ok(masked);
    assert.ok(!masked.includes("0912345678"));
    assert.ok(!masked.includes("lostfound@fpt.edu.vn"));
    assert.ok(masked.includes("091***678"));
    assert.ok(masked.includes("lo***@fpt.edu.vn"));
  });

  it("handles null or undefined input safely", () => {
    assert.equal(maskContactInfo(null), null);
    assert.equal(maskContactInfo(undefined), null);
  });
});
