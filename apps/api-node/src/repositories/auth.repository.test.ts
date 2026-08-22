import assert from "node:assert/strict";
import test from "node:test";
import type { PoolConnection } from "mysql2/promise";
import { authRepository } from "./auth.repository.js";

function recordingExecutor() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const queryable = {
    async execute(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      return [[], []];
    }
  } as unknown as Pick<PoolConnection, "execute">;
  return { calls, queryable };
}

test("registration OTP persists a non-default maximum attempt count", async () => {
  const { calls, queryable } = recordingExecutor();
  await authRepository.createRegistrationOtp({
    id: "otp-id",
    email: "student@example.com",
    otpHash: "hash",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    maxAttempts: 3
  }, queryable);

  assert.match(calls[0].sql, /max_attempts/);
  assert.equal(calls[0].values.at(-1), 3);
});

test("password reset OTP persists a non-default maximum attempt count", async () => {
  const { calls, queryable } = recordingExecutor();
  await authRepository.createPasswordReset({
    id: "reset-id",
    userId: "user-id",
    tokenHash: "hash",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    maxAttempts: 7
  }, queryable);

  assert.match(calls[0].sql, /max_attempts/);
  assert.equal(calls[0].values.at(-1), 7);
});
