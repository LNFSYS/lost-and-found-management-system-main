import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema, resetPasswordSchema } from "./auth.validator.js";

test("register rejects malformed OTP and short password", () => {
  const result = registerSchema.safeParse({ email: "a@example.com", otp: "12", password: "short", fullName: "An" });
  assert.equal(result.success, false);
});

test("reset password accepts a valid payload with strong password", () => {
  const result = resetPasswordSchema.safeParse({ email: "a@example.com", token: "123456", newPassword: "SecureP@ss123" });
  assert.equal(result.success, true);
});

test("register and reset password reject weak passwords like 12345678 or purely letters/numbers", () => {
  assert.equal(registerSchema.safeParse({ email: "a@example.com", otp: "123456", password: "12345678", fullName: "An" }).success, false);
  assert.equal(registerSchema.safeParse({ email: "a@example.com", otp: "123456", password: "password", fullName: "An" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ email: "a@example.com", token: "123456", newPassword: "12345678" }).success, false);
});
