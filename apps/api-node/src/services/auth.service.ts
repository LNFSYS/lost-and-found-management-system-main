import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { RowDataPacket } from "mysql2";
import { env } from "../config/env.js";
import { withTransaction } from "../config/db.js";
import { authRepository, type OtpRow, type ResetRow } from "../repositories/auth.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import type { AccessTokenPayload, AudienceRole, User } from "../types/auth.js";
import { HttpError } from "../utils/http-error.js";
import { hashToken, id, normalizeEmail, randomOtp, randomToken } from "../utils/security.js";
import type { ForgotPasswordInput, LoginInput, RegisterInput, RequestOtpInput, ResetPasswordInput, UpdateProfileInput } from "../validators/auth.validator.js";
import { emailService } from "./email.service.js";

type SessionMeta = { userAgent?: string; ipAddress?: string };
type AuthResult = { user: User; accessToken: string; refreshToken: string; refreshExpiresAt: Date };

function publicUser(user: User): User { return user; }

export function isAccessSessionValid(user: (User & { sessionVersion: number }) | null, payload: AccessTokenPayload) {
  return Boolean(user && user.status === "ACTIVE" && user.sessionVersion === payload.sessionVersion);
}

function signAccessToken(user: User & { sessionVersion: number }) {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email, roles: user.roles, sessionVersion: user.sessionVersion };
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.jwtAccessExpiresIn } as SignOptions);
}

function isUsable(row: { consumed_at: Date | null; expires_at: Date; attempt_count: number; max_attempts: number }) {
  return !row.consumed_at && row.expires_at.getTime() > Date.now() && row.attempt_count < row.max_attempts;
}

async function issueSession(user: User & { sessionVersion: number }, meta: SessionMeta, connection?: Parameters<typeof authRepository.createRefreshToken>[1]): Promise<AuthResult> {
  const refreshToken = randomToken();
  const refreshExpiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);
  await authRepository.createRefreshToken({ id: id(), userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt, ...meta }, connection);
  return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken, refreshExpiresAt };
}

async function validateRegistrationOtp(email: string, otp: string, connection: Parameters<typeof authRepository.findLatestRegistrationOtpForUpdate>[1]) {
  const row = await authRepository.findLatestRegistrationOtpForUpdate(email, connection);
  if (!row || !isUsable(row)) throw new HttpError(400, "OTP không hợp lệ hoặc đã hết hạn");
  if (!(await bcrypt.compare(otp, row.otp_hash))) {
    await authRepository.recordRegistrationOtpFailure(row.id, connection);
    throw new HttpError(400, "OTP không hợp lệ hoặc đã hết hạn");
  }
  return row;
}

async function validateResetToken(userId: string, token: string, connection: Parameters<typeof authRepository.findLatestPasswordResetForUpdate>[1]) {
  const row = await authRepository.findLatestPasswordResetForUpdate(userId, connection);
  if (!row || !isUsable(row)) throw new HttpError(400, "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
  if (!(await bcrypt.compare(token, row.token_hash))) {
    await authRepository.recordPasswordResetFailure(row.id, connection);
    throw new HttpError(400, "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
  }
  return row;
}

export const authService = {
  async requestRegistrationOtp(input: RequestOtpInput) {
    const normalizedEmail = normalizeEmail(input.email);
    if (await userRepository.findByEmail(normalizedEmail)) throw new HttpError(409, "Email đã được đăng ký");
    const otp = randomOtp();
    await authRepository.invalidateRegistrationOtps(normalizedEmail);
    await authRepository.createRegistrationOtp({ id: id(), email: normalizedEmail, otpHash: await bcrypt.hash(otp, env.bcryptSaltRounds), expiresAt: new Date(Date.now() + env.otpTtlMinutes * 60_000), maxAttempts: env.otpMaxAttempts });
    await emailService.sendRegistrationOtp(input.email.trim(), otp);
    return { delivered: true, expiresInMinutes: env.otpTtlMinutes };
  },

  async register(input: RegisterInput, meta: SessionMeta) {
    const normalizedEmail = normalizeEmail(input.email);
    return withTransaction(async (connection) => {
      if (await userRepository.findByEmail(normalizedEmail, connection)) throw new HttpError(409, "Email đã được đăng ký");
      const otpRow = await validateRegistrationOtp(normalizedEmail, input.otp, connection);
      const userId = id();
      await userRepository.create({ id: userId, email: input.email.trim(), normalizedEmail, passwordHash: await bcrypt.hash(input.password, env.bcryptSaltRounds), fullName: input.fullName.trim(), studentCode: input.studentCode?.trim(), phoneNumber: input.phoneNumber?.trim() }, connection);
      await userRepository.assignRole(userId, "USER", connection);
      await userRepository.assignRole(userId, input.audienceRole as AudienceRole, connection);
      await authRepository.consumeRegistrationOtp(otpRow.id, connection);
      const user = await userRepository.findById(userId, connection);
      if (!user) throw new HttpError(500, "Không thể tạo tài khoản");
      return issueSession(user, meta, connection);
    });
  },

  async login(input: LoginInput, meta: SessionMeta) {
    const record = await userRepository.findAuthByEmail(normalizeEmail(input.email));
    if (!record || record.user.status !== "ACTIVE" || !(await bcrypt.compare(input.password, record.passwordHash))) {
      throw new HttpError(401, "Email hoặc mật khẩu không đúng");
    }
    await userRepository.updateLastLogin(record.user.id);
    return issueSession(record.user, meta);
  },

  async refresh(refreshToken: string | undefined, meta: SessionMeta) {
    if (!refreshToken) throw new HttpError(401, "Phiên đăng nhập không hợp lệ");
    return withTransaction(async (connection) => {
      const previous = await authRepository.findRefreshForUpdate(hashToken(refreshToken), connection);
      if (!previous || previous.revoked_at || previous.expires_at.getTime() <= Date.now()) throw new HttpError(401, "Phiên đăng nhập không hợp lệ");
      const user = await userRepository.findById(previous.user_id, connection);
      if (!user || user.status !== "ACTIVE") throw new HttpError(401, "Phiên đăng nhập không hợp lệ");
      const next = await issueSession(user, meta, connection);
      const [newToken] = await connection.execute<Array<RowDataPacket & { id: string }>>("SELECT id FROM refresh_tokens WHERE token_hash = ?", [hashToken(next.refreshToken)]);
      await authRepository.revokeRefresh(previous.id, connection, newToken[0]?.id);
      return next;
    });
  },

  async logout(refreshToken: string | undefined) {
    if (refreshToken) await authRepository.revokeRefreshByHash(hashToken(refreshToken));
  },

  async requestPasswordReset(input: ForgotPasswordInput) {
    const record = await userRepository.findAuthByEmail(normalizeEmail(input.email));
    if (!record || record.user.status !== "ACTIVE") return { delivered: true };
    const token = randomOtp();
    await authRepository.invalidatePasswordResets(record.user.id);
    await authRepository.createPasswordReset({ id: id(), userId: record.user.id, tokenHash: await bcrypt.hash(token, env.bcryptSaltRounds), expiresAt: new Date(Date.now() + env.otpTtlMinutes * 60_000), maxAttempts: env.otpMaxAttempts });
    await emailService.sendPasswordResetOtp(record.user.email, token);
    return { delivered: true };
  },

  async resetPassword(input: ResetPasswordInput) {
    const normalizedEmail = normalizeEmail(input.email);
    return withTransaction(async (connection) => {
      const record = await userRepository.findAuthByEmail(normalizedEmail, connection);
      if (!record || record.user.status !== "ACTIVE") throw new HttpError(400, "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
      const resetRow = await validateResetToken(record.user.id, input.token, connection);
      await authRepository.consumePasswordReset(resetRow.id, connection);
      await userRepository.updatePasswordAndInvalidateSessions(record.user.id, await bcrypt.hash(input.newPassword, env.bcryptSaltRounds), connection);
      return { reset: true };
    });
  },

  async getCurrentUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.status !== "ACTIVE") throw new HttpError(401, "Phiên đăng nhập không hợp lệ");
    return publicUser(user);
  },

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const updated = await userRepository.updateProfile(userId, input);
    if (!updated) throw new HttpError(404, "Không tìm thấy tài khoản");
    return publicUser(updated);
  },

  async validateAccessSession(payload: AccessTokenPayload) {
    const user = await userRepository.findById(payload.sub);
    return isAccessSessionValid(user, payload);
  }
};
