import type { Logger } from "../../../shared/application/logger.port.js";
import { coordinateUpload, persistUpload, type MediaUploads } from "../../../shared/application/media-upload.js";
import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { AccessTokenPayload, ActivitySummary, AudienceRole, User } from "../../../shared/domain/auth.js";
import { validateAvatarUpload } from "../../../shared/domain/media.js";
import { normalizeEmail } from "../../../shared/domain/text.js";
import type { ImageUpload } from "../../../shared/domain/upload.js";
import { isAccessSessionValid, isUsable } from "../domain/session-policy.js";
import type { AuthSecurity, SessionPolicy } from "./auth-security.port.js";
import type { ForgotPasswordInput, LoginInput, RegisterInput, RequestOtpInput, ResetPasswordInput, UpdateProfileInput } from "./auth.dto.js";
import type { AuthRepository } from "./auth.repository.port.js";
import type { AvatarStorage } from "./avatar-storage.port.js";
import type { EmailDelivery } from "./email.port.js";
import type { UserRepository } from "./user.repository.port.js";

type SessionMeta = { userAgent?: string; ipAddress?: string; };

type AuthResult = { user: User; accessToken: string; refreshToken: string; refreshExpiresAt: Date; };

type AvatarFile = { body: Buffer; contentType: string; updatedAt: string | null; };

function publicUser(user: User): User { return user; }

class InvalidCredentialAttemptError extends AppError {
  constructor(public readonly credentialId: string, message: string) {
    super("bad_request", message);
  }
}

export interface AuthDependencies {
  uploads?: MediaUploads;
  authRepository: AuthRepository;
  userRepository: UserRepository;
  avatarStorage: AvatarStorage;
  security: AuthSecurity;
  policy: SessionPolicy;
  emailService: EmailDelivery;
  withTransaction: TransactionRunner;
  logger: Logger;
  avatarRepository?: Pick<UserRepository, "findAvatarById" | "updateAvatar">;
}
export function createAuthUseCases(options: AuthDependencies) {
  const { authRepository, userRepository, avatarStorage, security, policy, emailService, withTransaction } = options;
  const { id, hashToken, randomOtp, randomToken } = security;
  const avatarRepository = options.avatarRepository ?? userRepository;
  function signAccessToken(user: User & { sessionVersion: number; }) {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, roles: user.roles, sessionVersion: user.sessionVersion };
    return security.signAccessToken(payload);
  }

  async function issueSession(user: User & { sessionVersion: number; }, meta: SessionMeta, connection?: Parameters<typeof authRepository.createRefreshToken>[1], refreshTokenId = id()): Promise<AuthResult> {
    const refreshToken = randomToken();
    const refreshExpiresAt = new Date(Date.now() + policy.refreshTokenDays * 24 * 60 * 60 * 1000);
    await authRepository.createRefreshToken({ id: refreshTokenId, userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: refreshExpiresAt, ...meta }, connection);
    return { user: publicUser(user), accessToken: signAccessToken(user), refreshToken, refreshExpiresAt };
  }

  async function validateRegistrationOtp(email: string, otp: string, connection: Parameters<typeof authRepository.findLatestRegistrationOtpForUpdate>[1]) {
    const row = await authRepository.findLatestRegistrationOtpForUpdate(email, connection);
    if (!row || !isUsable(row)) throw new AppError("bad_request", "OTP không hợp lệ hoặc đã hết hạn");
    if (!(await security.comparePassword(otp, row.otp_hash))) {
      throw new InvalidCredentialAttemptError(row.id, "OTP không hợp lệ hoặc đã hết hạn");
    }
    return row;
  }

  async function validateResetToken(userId: string, token: string, connection: Parameters<typeof authRepository.findLatestPasswordResetForUpdate>[1]) {
    const row = await authRepository.findLatestPasswordResetForUpdate(userId, connection);
    if (!row || !isUsable(row)) throw new AppError("bad_request", "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    if (!(await security.comparePassword(token, row.token_hash))) {
      throw new InvalidCredentialAttemptError(row.id, "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
    }
    return row;
  }

  const authService = {
    async requestRegistrationOtp(input: RequestOtpInput) {
      const normalizedEmail = normalizeEmail(input.email);
      if (await userRepository.findByEmail(normalizedEmail)) throw new AppError("conflict", "Email đã được đăng ký");
      const otp = randomOtp();
      await authRepository.invalidateRegistrationOtps(normalizedEmail);
      await authRepository.createRegistrationOtp({ id: id(), email: normalizedEmail, otpHash: await security.hashPassword(otp), expiresAt: new Date(Date.now() + policy.otpTtlMinutes * 60_000), maxAttempts: policy.otpMaxAttempts });
      await emailService.sendRegistrationOtp(input.email.trim(), otp);
      return { delivered: true, expiresInMinutes: policy.otpTtlMinutes };
    },

    async register(input: RegisterInput, meta: SessionMeta) {
      const normalizedEmail = normalizeEmail(input.email);
      try {
        return await withTransaction(async (connection) => {
          if (await userRepository.findByEmail(normalizedEmail, connection)) throw new AppError("conflict", "Email đã được đăng ký");
          const otpRow = await validateRegistrationOtp(normalizedEmail, input.otp, connection);
          const userId = id();
          await userRepository.create({ id: userId, email: input.email.trim(), normalizedEmail, passwordHash: await security.hashPassword(input.password), fullName: input.fullName.trim(), studentCode: input.studentCode?.trim(), phoneNumber: input.phoneNumber?.trim() }, connection);
          await userRepository.assignRole(userId, "USER", connection);
          await userRepository.assignRole(userId, input.audienceRole as AudienceRole, connection);
          await authRepository.consumeRegistrationOtp(otpRow.id, connection);
          const user = await userRepository.findById(userId, connection);
          if (!user) throw new AppError("internal", "Không thể tạo tài khoản");
          return issueSession(user, meta, connection);
        });
      } catch (error) {
        if (error instanceof InvalidCredentialAttemptError) {
          await authRepository.recordRegistrationOtpFailure(error.credentialId);
        }
        throw error;
      }
    },

    async login(input: LoginInput, meta: SessionMeta) {
      const record = await userRepository.findAuthByEmail(normalizeEmail(input.email));
      if (!record || record.user.status !== "ACTIVE" || !(await security.comparePassword(input.password, record.passwordHash))) {
        throw new AppError("unauthenticated", "Email hoặc mật khẩu không đúng");
      }
      await userRepository.updateLastLogin(record.user.id);
      return issueSession(record.user, meta);
    },

    async refresh(refreshToken: string | undefined, meta: SessionMeta) {
      if (!refreshToken) throw new AppError("unauthenticated", "Phiên đăng nhập không hợp lệ");
      return withTransaction(async (connection) => {
        const previous = await authRepository.findRefreshForUpdate(hashToken(refreshToken), connection);
        if (!previous || previous.revoked_at || previous.expires_at.getTime() <= Date.now()) throw new AppError("unauthenticated", "Phiên đăng nhập không hợp lệ");
        const user = await userRepository.findById(previous.user_id, connection);
        if (!user || user.status !== "ACTIVE") throw new AppError("unauthenticated", "Phiên đăng nhập không hợp lệ");
        const replacementId = id();
        const next = await issueSession(user, meta, connection, replacementId);
        await authRepository.revokeRefresh(previous.id, connection, replacementId);
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
      await authRepository.createPasswordReset({ id: id(), userId: record.user.id, tokenHash: await security.hashPassword(token), expiresAt: new Date(Date.now() + policy.otpTtlMinutes * 60_000), maxAttempts: policy.otpMaxAttempts });
      await emailService.sendPasswordResetOtp(record.user.email, token);
      return { delivered: true };
    },

    async resetPassword(input: ResetPasswordInput) {
      const normalizedEmail = normalizeEmail(input.email);
      try {
        return await withTransaction(async (connection) => {
          const record = await userRepository.findAuthByEmail(normalizedEmail, connection);
          if (!record || record.user.status !== "ACTIVE") throw new AppError("bad_request", "Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
          const resetRow = await validateResetToken(record.user.id, input.token, connection);
          await authRepository.consumePasswordReset(resetRow.id, connection);
          await userRepository.updatePasswordAndInvalidateSessions(record.user.id, await security.hashPassword(input.newPassword), connection);
          return { reset: true };
        });
      } catch (error) {
        if (error instanceof InvalidCredentialAttemptError) {
          await authRepository.recordPasswordResetFailure(error.credentialId);
        }
        throw error;
      }
    },

    async getCurrentUser(userId: string) {
      const user = await userRepository.findById(userId);
      if (!user || user.status !== "ACTIVE") throw new AppError("unauthenticated", "Phiên đăng nhập không hợp lệ");
      return publicUser(user);
    },

    async updateProfile(userId: string, input: UpdateProfileInput) {
      const updated = await userRepository.updateProfile(userId, input);
      if (!updated) throw new AppError("not_found", "Không tìm thấy tài khoản");
      return publicUser(updated);
    },

    async updateAvatar(userId: string, file: ImageUpload) {
      const image = validateAvatarUpload(file);
      return coordinateUpload(options.uploads, ["AVATAR", userId], file.buffer, id, async operation => {
        const previous = await avatarRepository.findAvatarById(userId);
        const publicId = `lnfs/avatars/${operation.id}`;
        if (options.uploads && previous?.publicId === publicId) {
          await avatarStorage.download({ publicId, version: previous.version, format: previous.format });
          const user = await userRepository.findById(userId);
          if (!user || user.status !== "ACTIVE") throw new AppError("unauthenticated", "Phiên đăng nhập không hợp lệ");
          return publicUser(user);
        }
        const uploaded = await avatarStorage.upload({ buffer: file.buffer, format: image.format,
          ...(options.uploads ? { publicId: operation.id } : {}) });
        let updated: User | null = null;
        await persistUpload({ operation, kind: "AVATAR", logger: options.logger,
          unreferenced: async () => (await avatarRepository.findAvatarById(userId))?.publicId !== uploaded.publicId,
          matches: async () => { const row = await avatarRepository.findAvatarById(userId); return row?.publicId === uploaded.publicId && row.version === uploaded.version; },
          remove: () => avatarStorage.destroy(uploaded.publicId),
          write: () => (operation.transaction ?? withTransaction)(async connection => {
            updated = await avatarRepository.updateAvatar(userId, {
              publicId: uploaded.publicId,
              assetId: uploaded.assetId,
              version: uploaded.version,
              format: uploaded.format,
              resourceType: uploaded.resourceType,
              size: uploaded.bytes
            }, connection);
            if (!updated) throw new AppError("not_found", "Khong tim thay tai khoan");
          })
        });
        if (!updated) updated = await userRepository.findById(userId);
        if (!updated) throw new AppError("unavailable", "Chưa thể đối soát ảnh đại diện; vui lòng thử lại");
        if (previous?.publicId && previous.publicId !== uploaded.publicId && await operation.canCompensate().catch(() => false)) {
          try {
            await avatarStorage.destroy(previous.publicId);
          } catch {
            options.logger.warn(JSON.stringify({ event: "media_upload_cleanup_required", kind: "AVATAR_PREVIOUS", operationId: operation.id }));
          }
        }
        return publicUser(updated);
      });
    },

    async getAvatarFile(userId: string): Promise<AvatarFile> {
      const avatar = await avatarRepository.findAvatarById(userId);
      if (!avatar) throw new AppError("not_found", "Chua co anh dai dien");
      const downloaded = await avatarStorage.download({ publicId: avatar.publicId, version: avatar.version, format: avatar.format });
      return { body: downloaded.body, contentType: downloaded.contentType, updatedAt: avatar.updatedAt };
    },

    async getActivitySummary(userId: string): Promise<ActivitySummary> {
      return userRepository.getActivitySummary(userId);
    },

    async validateAccessSession(payload: AccessTokenPayload) {
      const user = await userRepository.findById(payload.sub);
      return isAccessSessionValid(user, payload);
    }
  };
  return authService;
}

export type AuthUseCases = ReturnType<typeof createAuthUseCases>;
