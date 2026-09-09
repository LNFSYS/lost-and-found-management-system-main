import { randomUUID } from "node:crypto";
import type { TransactionContext, TransactionRunner } from "../shared/application/transaction.js";
import type { PrivateMediaStorage } from "../shared/application/media-storage.port.js";
import type { AuthSecurity } from "../modules/auth/application/auth-security.port.js";
import type { AvatarStorage } from "../modules/auth/application/avatar-storage.port.js";
import type { EmailDelivery } from "../modules/auth/application/email.port.js";
import type { ImageAnalyzer } from "../modules/posts/application/image-analyzer.port.js";
import { createImageAnalysisUseCases } from "../modules/posts/application/image-analysis.use-cases.js";
import { unexpectedPort } from "./unexpected-port.js";
import type { AdminAuditRepository } from "../modules/admin/application/admin-audit.repository.port.js";
import type { AdminCatalogRepository } from "../modules/admin/application/admin-catalog.repository.port.js";
import type { AdminReportingRepository } from "../modules/admin/application/admin-reporting.repository.port.js";
import type { AdminUserRepository } from "../modules/admin/application/admin-user.repository.port.js";
import type { AuthRepository } from "../modules/auth/application/auth.repository.port.js";
import type { ClaimRepository } from "../modules/claims/application/claim.repository.port.js";
import type { MatchingRepository } from "../modules/matching/application/matching.repository.port.js";
import type { NotificationRepository } from "../modules/notifications/application/notification.repository.port.js";
import type { PostRepository } from "../modules/posts/application/post.repository.port.js";
import type { ReturnFeedbackRepository } from "../modules/returns/application/return-feedback.repository.port.js";
import type { SystemConfigRepository } from "../modules/system-config/application/system-config.repository.port.js";
import type { UserRepository } from "../modules/auth/application/user.repository.port.js";
import type { WarehouseRepository } from "../modules/warehouse/application/warehouse.repository.port.js";
import { createNotificationUseCases, type NotificationDependencies } from "../modules/notifications/application/notification.use-cases.js";
import { createSystemConfigUseCases, type SystemConfigDependencies } from "../modules/system-config/application/system-config.use-cases.js";
import { createAdminUserUseCases, type AdminUserDependencies } from "../modules/admin/application/admin-user.use-cases.js";
import { createAdminReportingUseCases, type AdminReportingDependencies } from "../modules/admin/application/admin-reporting.use-cases.js";
import { createAdminCatalogUseCases, type AdminCatalogDependencies } from "../modules/admin/application/admin-catalog.use-cases.js";
import { createWarehouseUseCases, type WarehouseDependencies } from "../modules/warehouse/application/warehouse.use-cases.js";
import { createReturnFeedbackUseCases, type ReturnFeedbackDependencies } from "../modules/returns/application/return-feedback.use-cases.js";
import { createMatchingUseCases, type MatchingDependencies } from "../modules/matching/application/matching.use-cases.js";
import { createPostUseCases, type PostDependencies } from "../modules/posts/application/post.use-cases.js";
import { createClaimUseCases, type ClaimDependencies } from "../modules/claims/application/claim.use-cases.js";
import { createAuthUseCases, type AuthDependencies } from "../modules/auth/application/auth.use-cases.js";

export const adminAuditRepository = unexpectedPort<AdminAuditRepository>("adminAuditRepository");
export const adminCatalogRepository = unexpectedPort<AdminCatalogRepository>("adminCatalogRepository");
export const adminReportingRepository = unexpectedPort<AdminReportingRepository>("adminReportingRepository");
export const adminUserRepository = unexpectedPort<AdminUserRepository>("adminUserRepository");
export const authRepository = unexpectedPort<AuthRepository>("authRepository");
export const claimRepository = unexpectedPort<ClaimRepository>("claimRepository");
export const matchingRepository = unexpectedPort<MatchingRepository>("matchingRepository");
export const notificationRepository = unexpectedPort<NotificationRepository>("notificationRepository");
export const postRepository = unexpectedPort<PostRepository>("postRepository");
export const returnFeedbackRepository = unexpectedPort<ReturnFeedbackRepository>("returnFeedbackRepository");
export const systemConfigRepository = unexpectedPort<SystemConfigRepository>("systemConfigRepository");
export const userRepository = unexpectedPort<UserRepository>("userRepository");
export const warehouseRepository = unexpectedPort<WarehouseRepository>("warehouseRepository");
export const fakeTransaction: TransactionRunner = (work) => work(Object.freeze({}) as TransactionContext);
export const fakeMediaStorage = unexpectedPort<PrivateMediaStorage>("private media storage");
export const fakeAvatarStorage = unexpectedPort<AvatarStorage>("avatar storage");
export const fakeEmail = unexpectedPort<EmailDelivery>("email delivery");
export const fakeSecurity: AuthSecurity = {
  id: randomUUID, randomOtp: () => "123456", randomToken: () => "test-refresh-token",
  hashToken: (value) => `test-hash:${value}`, hashPassword: async (value) => `test-password:${value}`,
  comparePassword: async (value, hash) => hash === `test-password:${value}`, signAccessToken: () => "test-access-token"
};
export function createTestNotificationUseCases(overrides: Partial<NotificationDependencies> = {}) { return createNotificationUseCases({ notificationRepository: notificationRepository, ...overrides }); }
export const notificationService = createTestNotificationUseCases();
export function createTestSystemConfigUseCases(overrides: Partial<SystemConfigDependencies> = {}) { return createSystemConfigUseCases({ repository: systemConfigRepository, auditRepository: adminAuditRepository, transaction: fakeTransaction, idFactory: randomUUID, ...overrides }); }
export const systemConfigService = createTestSystemConfigUseCases();
export function createTestAdminUserUseCases(overrides: Partial<AdminUserDependencies> = {}) { return createAdminUserUseCases({ repository: adminUserRepository, auditRepository: adminAuditRepository, transaction: fakeTransaction, idFactory: randomUUID, hashPassword: fakeSecurity.hashPassword, ...overrides }); }
export const adminUserService = createTestAdminUserUseCases();
export function createTestAdminReportingUseCases(overrides: Partial<AdminReportingDependencies> = {}) { return createAdminReportingUseCases({ repository: adminReportingRepository, auditRepository: adminAuditRepository, transaction: fakeTransaction, idFactory: randomUUID, clock: () => new Date(), ...overrides }); }
export const adminReportingService = createTestAdminReportingUseCases();
export function createTestAdminCatalogUseCases(overrides: Partial<AdminCatalogDependencies> = {}) { return createAdminCatalogUseCases({ adminCatalogRepository: adminCatalogRepository, id: randomUUID, ...overrides }); }
export const adminCatalogService = createTestAdminCatalogUseCases();
export function createTestWarehouseUseCases(overrides: Partial<WarehouseDependencies> = {}) { return createWarehouseUseCases({ warehouseRepository: warehouseRepository, withTransaction: fakeTransaction, id: randomUUID, ...overrides }); }
export const warehouseService = createTestWarehouseUseCases();
export function createTestReturnFeedbackUseCases(overrides: Partial<ReturnFeedbackDependencies> = {}) { return createReturnFeedbackUseCases({ repository: returnFeedbackRepository, adminAuditRepository: adminAuditRepository, runInTransaction: fakeTransaction, id: randomUUID, ...overrides }); }
export const returnFeedbackService = createTestReturnFeedbackUseCases();
export function createTestMatchingUseCases(overrides: Partial<MatchingDependencies> = {}) { return createMatchingUseCases({ matchingRepository: matchingRepository, postRepository: postRepository, ...overrides }); }
export const matchingService = createTestMatchingUseCases();
export function createTestPostUseCases(overrides: Partial<PostDependencies> = {}) { return createPostUseCases({ postRepository: postRepository, matchingRepository: matchingRepository, matchingService: matchingService, withTransaction: fakeTransaction, id: randomUUID, mediaStorage: fakeMediaStorage, logger: { warn() {} }, ...overrides }); }
export const postService = createTestPostUseCases();
export function createTestClaimUseCases(overrides: Partial<ClaimDependencies> = {}) { return createClaimUseCases({ claimRepository: claimRepository, matchingRepository: matchingRepository, notificationRepository: notificationRepository, withTransaction: fakeTransaction, id: randomUUID, mediaStorage: fakeMediaStorage, ...overrides }); }
export const claimService = createTestClaimUseCases();
export function createTestAuthUseCases(overrides: Partial<AuthDependencies> = {}) { return createAuthUseCases({ authRepository: authRepository, userRepository: userRepository, avatarStorage: fakeAvatarStorage, security: fakeSecurity, policy: { refreshTokenDays: 30, otpTtlMinutes: 10, otpMaxAttempts: 5 }, emailService: fakeEmail, withTransaction: fakeTransaction, logger: { warn() {} }, ...overrides }); }
export const authService = createTestAuthUseCases();
export const geminiImageService = createImageAnalysisUseCases({ postRepository, analyzer: unexpectedPort<ImageAnalyzer>("image analyzer") });
export const testServices = { notificationService, systemConfigService, adminUserService, adminReportingService, adminCatalogService, warehouseService, returnFeedbackService, matchingService, postService, claimService, authService, geminiImageService };
