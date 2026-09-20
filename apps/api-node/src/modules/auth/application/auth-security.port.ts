import type { AccessTokenPayload } from "../../../shared/domain/auth.js";

export interface AuthSecurity {
  id(): string;
  randomOtp(): string;
  randomToken(): string;
  hashToken(value: string): string;
  hashPassword(value: string): Promise<string>;
  comparePassword(value: string, hash: string): Promise<boolean>;
  signAccessToken(payload: AccessTokenPayload): string;
}

export interface SessionPolicy {
  refreshTokenDays: number;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
}
