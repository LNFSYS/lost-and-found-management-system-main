import type { PoolConnection } from "mysql2/promise";
import assert from "node:assert/strict";
import test from "node:test";
import { authRepository } from "../../../test/persistence-fixtures.js";

function recordingExecutor() {
  const calls: Array<{ sql: string; values: unknown[]; }> = [];
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

test("OTP failure updates are capped and cannot mutate expired or consumed rows", async () => {
  const { queryable, calls } = recordingExecutor();

  await authRepository.recordRegistrationOtpFailure("otp-id", queryable);
  await authRepository.recordPasswordResetFailure("reset-id", queryable);

  assert.equal(calls.length, 2);
  for (const statement of calls) {
    assert.match(statement.sql, /LEAST\(attempt_count \+ 1, max_attempts\)/);
    assert.match(statement.sql, /consumed_at IS NULL/);
    assert.match(statement.sql, /expires_at > UTC_TIMESTAMP\(\)/);
  }
  assert.deepEqual(calls[0].values, ["otp-id"]);
  assert.deepEqual(calls[1].values, ["reset-id"]);
});
