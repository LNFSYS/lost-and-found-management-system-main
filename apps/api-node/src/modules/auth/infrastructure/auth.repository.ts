import type { AuthRepository } from "../application/auth.repository.port.js";

export type { AuthRepository, OtpRow, RefreshRow, ResetRow } from "../application/auth.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { PoolConnection } from "mysql2/promise";

import type { RowDataPacket } from "mysql2";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface OtpRow extends RowDataPacket { id: string; otp_hash: string; attempt_count: number; max_attempts: number; expires_at: Date; consumed_at: Date | null; }

interface ResetRow extends RowDataPacket { id: string; token_hash: string; attempt_count: number; max_attempts: number; expires_at: Date; consumed_at: Date | null; }

interface RefreshRow extends RowDataPacket { id: string; user_id: string; expires_at: Date; revoked_at: Date | null; }

export function createAuthRepository(pool: SqlExecutor) {

  const authRepository = {
    async invalidateRegistrationOtps(email: string) {
      await pool.execute("UPDATE email_otps SET consumed_at = UTC_TIMESTAMP() WHERE normalized_email = ? AND purpose = 'REGISTER' AND consumed_at IS NULL", [email]);
    },
    async createRegistrationOtp(input: { id: string; email: string; otpHash: string; expiresAt: Date; maxAttempts: number; }, queryable: Queryable = pool) {
      await sqlExecutor(queryable).execute("INSERT INTO email_otps (id, normalized_email, otp_hash, purpose, expires_at, max_attempts) VALUES (?, ?, ?, 'REGISTER', ?, ?)", [input.id, input.email, input.otpHash, input.expiresAt, input.maxAttempts]);
    },
    async findLatestRegistrationOtpForUpdate(email: string, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<OtpRow[]>("SELECT * FROM email_otps WHERE normalized_email = ? AND purpose = 'REGISTER' ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [email]);
      return rows[0] ?? null;
    },
    async consumeRegistrationOtp(id: string, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE email_otps SET consumed_at = UTC_TIMESTAMP() WHERE id = ? AND consumed_at IS NULL", [id]);
    },
    async recordRegistrationOtpFailure(id: string, queryable: Queryable = pool) {
      await sqlExecutor(queryable).execute(
        "UPDATE email_otps SET attempt_count = LEAST(attempt_count + 1, max_attempts) WHERE id = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()",
        [id]
      );
    },
    async invalidatePasswordResets(userId: string) {
      await pool.execute("UPDATE password_reset_tokens SET consumed_at = UTC_TIMESTAMP() WHERE user_id = ? AND consumed_at IS NULL", [userId]);
    },
    async createPasswordReset(input: { id: string; userId: string; tokenHash: string; expiresAt: Date; maxAttempts: number; }, queryable: Queryable = pool) {
      await sqlExecutor(queryable).execute("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, max_attempts) VALUES (?, ?, ?, ?, ?)", [input.id, input.userId, input.tokenHash, input.expiresAt, input.maxAttempts]);
    },
    async findLatestPasswordResetForUpdate(userId: string, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<ResetRow[]>("SELECT * FROM password_reset_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [userId]);
      return rows[0] ?? null;
    },
    async consumePasswordReset(id: string, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE password_reset_tokens SET consumed_at = UTC_TIMESTAMP() WHERE id = ? AND consumed_at IS NULL", [id]);
    },
    async recordPasswordResetFailure(id: string, queryable: Queryable = pool) {
      await sqlExecutor(queryable).execute(
        "UPDATE password_reset_tokens SET attempt_count = LEAST(attempt_count + 1, max_attempts) WHERE id = ? AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP()",
        [id]
      );
    },
    async createRefreshToken(input: { id: string; userId: string; tokenHash: string; expiresAt: Date; userAgent?: string; ipAddress?: string; }, connection: Queryable = pool) {
      await sqlExecutor(connection).execute("INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)", [input.id, input.userId, input.tokenHash, input.expiresAt, input.userAgent ?? null, input.ipAddress ?? null]);
    },
    async findRefreshForUpdate(tokenHash: string, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<RefreshRow[]>("SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ? LIMIT 1 FOR UPDATE", [tokenHash]);
      return rows[0] ?? null;
    },
    async revokeRefresh(id: string, connection: Queryable, replacementId?: string) {
      await sqlExecutor(connection).execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(), replaced_by_token_id = ? WHERE id = ? AND revoked_at IS NULL", [replacementId ?? null, id]);
    },
    async revokeRefreshByHash(tokenHash: string) {
      await pool.execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE token_hash = ? AND revoked_at IS NULL", [tokenHash]);
    }
  } satisfies AuthRepository;

  return authRepository;

}
