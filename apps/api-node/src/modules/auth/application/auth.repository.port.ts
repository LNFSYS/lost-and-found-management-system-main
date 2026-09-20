import type { TransactionContext } from "../../../shared/application/transaction.js";
export interface OtpRow {
  id: string;
  otp_hash: string;
  attempt_count: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
}

export interface ResetRow {
  id: string;
  token_hash: string;
  attempt_count: number;
  max_attempts: number;
  expires_at: Date;
  consumed_at: Date | null;
}

export interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface AuthRepository {
  invalidateRegistrationOtps(email: string): Promise<void>;
  createRegistrationOtp(input: {
    id: string;
    email: string;
    otpHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }, queryable?: TransactionContext): Promise<void>;
  findLatestRegistrationOtpForUpdate(email: string, connection: TransactionContext): Promise<OtpRow>;
  consumeRegistrationOtp(id: string, connection: TransactionContext): Promise<void>;
  recordRegistrationOtpFailure(id: string, queryable?: TransactionContext): Promise<void>;
  invalidatePasswordResets(userId: string): Promise<void>;
  createPasswordReset(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    maxAttempts: number;
  }, queryable?: TransactionContext): Promise<void>;
  findLatestPasswordResetForUpdate(userId: string, connection: TransactionContext): Promise<ResetRow>;
  consumePasswordReset(id: string, connection: TransactionContext): Promise<void>;
  recordPasswordResetFailure(id: string, queryable?: TransactionContext): Promise<void>;
  createRefreshToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }, connection?: TransactionContext): Promise<void>;
  findRefreshForUpdate(tokenHash: string, connection: TransactionContext): Promise<RefreshRow>;
  revokeRefresh(id: string, connection: TransactionContext, replacementId?: string): Promise<void>;
  revokeRefreshByHash(tokenHash: string): Promise<void>;
}
