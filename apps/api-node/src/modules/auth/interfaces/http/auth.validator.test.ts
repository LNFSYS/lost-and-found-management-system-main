import assert from "node:assert/strict";
import test from "node:test";
import { registerSchema, resetPasswordSchema } from "./auth.validator.js";

test("register rejects malformed OTP and short password", () => {
  const result = registerSchema.safeParse({ email: "a@example.com", otp: "12", password: "short", fullName: "An" });
  assert.equal(result.success, false);
});

test("reset password accepts a valid OTP payload", () => {
  const result = resetPasswordSchema.safeParse({ email: "a@example.com", token: "123456", newPassword: "12345678" });
  assert.equal(result.success, true);
});
