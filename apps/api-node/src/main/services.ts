import { createAdminCatalogUseCases } from "../modules/admin/application/admin-catalog.use-cases.js";
import { createAdminReportingUseCases } from "../modules/admin/application/admin-reporting.use-cases.js";
import { createAdminUserUseCases } from "../modules/admin/application/admin-user.use-cases.js";
import { createAuthUseCases } from "../modules/auth/application/auth.use-cases.js";
import { createAuthSecurity } from "../modules/auth/infrastructure/auth-security.js";
import { createCloudinaryAvatarStorage } from "../modules/auth/infrastructure/cloudinary-avatar-storage.js";
import { createEmailDelivery } from "../modules/auth/infrastructure/email.service.js";
import { createClaimUseCases } from "../modules/claims/application/claim.use-cases.js";
import { createMatchingUseCases } from "../modules/matching/application/matching.use-cases.js";
import { createNotificationUseCases } from "../modules/notifications/application/notification.use-cases.js";
import { createNotificationEmailQueue } from "../modules/notifications/application/notification-email.queue.js";
import { createNotificationEmailWorker } from "../modules/notifications/application/notification-email.worker.js";
import { createSmtpNotificationEmailDelivery } from "../modules/notifications/infrastructure/notification-email.smtp.js";
import { createImageAnalysisUseCases } from "../modules/posts/application/image-analysis.use-cases.js";
import { createPostUseCases } from "../modules/posts/application/post.use-cases.js";
import { createGeminiImageAnalyzer } from "../modules/posts/infrastructure/gemini-image-analyzer.js";
import { createRealtimeUseCases } from "../modules/realtime/application/realtime.use-cases.js";
import { createReturnFeedbackUseCases } from "../modules/returns/application/return-feedback.use-cases.js";
import { createReportUseCases } from "../modules/reports/application/report.use-cases.js";
import { createSystemConfigUseCases } from "../modules/system-config/application/system-config.use-cases.js";
import { createCustodyUseCases } from "../modules/warehouse/application/custody-request.use-cases.js";
import { createDispositionUseCases } from "../modules/warehouse/application/disposition.use-cases.js";
import { createWarehouseUseCases } from "../modules/warehouse/application/warehouse.use-cases.js";
import { env } from "../shared/infrastructure/config/env.js";
import { createCloudinaryPrivateMediaStorage } from "../shared/infrastructure/cloudinary-private-media-storage.js";
import { createPrivateMediaStorage } from "../shared/infrastructure/private-media-storage.js";
import { id } from "../shared/infrastructure/security.js";
import type { Persistence } from "./persistence.js";

export function createServices(persistence: Persistence, config: typeof env = env) {
  const {
    transaction, adminAuditRepository, adminCatalogRepository, adminReportingRepository,
    adminUserRepository, authRepository, claimRepository, matchingRepository,
    notificationRepository, notificationEmailRepository, postRepository, returnFeedbackRepository, reportRepository,
    systemConfigRepository, userRepository, warehouseRepository, custodyRepository, dispositionRepository
  } = persistence;
  const security = createAuthSecurity(config);
  const avatarStorage = createCloudinaryAvatarStorage({ config: config.cloudinary });
  const emailService = createEmailDelivery(config);
  const postLocalMediaStorage = createPrivateMediaStorage({
    uploadDir: config.uploadDir,
    namespace: "post-media",
    invalidPathMessage: "Duong dan media khong hop le",
    notFoundMessage: "Media khong hop le"
  });
  const claimLocalMediaStorage = createPrivateMediaStorage({
    uploadDir: config.uploadDir,
    namespace: "claim-evidence",
    invalidPathMessage: "Đường dẫn evidence không hợp lệ",
    notFoundMessage: "Không tìm thấy evidence"
  });
  const postMediaStorage = createCloudinaryPrivateMediaStorage({
    config: config.cloudinary,
    namespace: "post-media",
    fallback: postLocalMediaStorage
  });
  const claimMediaStorage = createCloudinaryPrivateMediaStorage({
    config: config.cloudinary,
    namespace: "claim-evidence",
    fallback: claimLocalMediaStorage
  });
  const notificationEmailQueue = createNotificationEmailQueue({
    repository: notificationEmailRepository, id, chatDelayMinutes: config.notificationEmail.chatDelayMinutes,
    digestDelayMinutes: config.notificationEmail.digestDelayMinutes
  });
  const notificationEmailWorker = createNotificationEmailWorker({
    repository: notificationEmailRepository,
    emailDelivery: createSmtpNotificationEmailDelivery({ smtp: config.smtp }),
    id, frontendUrl: config.frontendUrl, logger: console
  });
  const notificationService = createNotificationUseCases({ notificationRepository, notificationEmailRepository, notificationEmailQueue });
  const systemConfigService = createSystemConfigUseCases({
    repository: systemConfigRepository, auditRepository: adminAuditRepository, transaction, idFactory: id
  });
  const adminUserService = createAdminUserUseCases({
    repository: adminUserRepository, auditRepository: adminAuditRepository,
    transaction, idFactory: id, hashPassword: security.hashPassword
  });
  const adminReportingService = createAdminReportingUseCases({
    repository: adminReportingRepository, auditRepository: adminAuditRepository,
    transaction, idFactory: id, clock: () => new Date()
  });
  const adminCatalogService = createAdminCatalogUseCases({ adminCatalogRepository, id });
  const warehouseService = createWarehouseUseCases({ warehouseRepository, withTransaction: transaction, id });
  const custodyService = createCustodyUseCases({
    custodyRepository,
    warehouseRepository,
    notificationRepository,
    withTransaction: transaction,
    id
  });
  const dispositionService = createDispositionUseCases({
    dispositionRepository,
    warehouseRepository,
    notificationRepository,
    withTransaction: transaction,
    id
  });
  const returnFeedbackService = createReturnFeedbackUseCases({
    repository: returnFeedbackRepository, adminAuditRepository, runInTransaction: transaction, id
  });
  const reportService = createReportUseCases({
    repository: reportRepository, transaction, id, hashPayload: security.hashToken
  });
  const matchingService = createMatchingUseCases({ matchingRepository, postRepository });
  const postService = createPostUseCases({
    postRepository, matchingRepository, matchingService,
    withTransaction: transaction, id, mediaStorage: postMediaStorage, logger: console
  });
  const realtimeService = createRealtimeUseCases({ claimRepository, id });
  const claimService = createClaimUseCases({
    claimRepository, matchingRepository, notificationRepository, notificationEmailQueue,
    realtimeNotifier: realtimeService,
    withTransaction: transaction, id, mediaStorage: claimMediaStorage,
    hashIdempotencyPayload: security.hashToken, logger: console,
    custodyRepository, warehouseRepository
  });
  const authService = createAuthUseCases({
    authRepository, userRepository, avatarStorage, security,
    policy: config, emailService, withTransaction: transaction, logger: console
  });
  const geminiImageService = createImageAnalysisUseCases({ postRepository, analyzer: createGeminiImageAnalyzer(config.gemini) });
  return {
    notificationService, notificationEmailWorker, systemConfigService, adminUserService, adminReportingService,
    adminCatalogService, warehouseService, custodyService, dispositionService, returnFeedbackService, matchingService,
    postService, claimService, realtimeService, reportService, authService, geminiImageService
  };
}
export type ApplicationServices = ReturnType<typeof createServices>;
