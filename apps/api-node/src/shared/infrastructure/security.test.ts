import assert from "node:assert/strict";
import test from "node:test";
import { hashToken, normalizeEmail, randomOtp, randomToken } from "./security.js";

test("normalizes email and creates non-plaintext token hashes", () => {
  assert.equal(normalizeEmail("  Test@Example.COM "), "test@example.com");
  assert.notEqual(hashToken("secret"), "secret");
  assert.equal(hashToken("secret").length, 64);
});

test("creates a six-digit OTP and high-entropy refresh token", () => {
  assert.match(randomOtp(), /^\d{6}$/);
  assert.ok(randomToken().length >= 60);
});
