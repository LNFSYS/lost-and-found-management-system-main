import jwt from "jsonwebtoken";
import { createAdminCatalogController } from "../modules/admin/interfaces/http/admin-catalog.controller.js";
import { createAdminReportingController } from "../modules/admin/interfaces/http/admin-reporting.controller.js";
import { createAdminUserController } from "../modules/admin/interfaces/http/admin-user.controller.js";
import { createAdminRoutes } from "../modules/admin/interfaces/http/admin.routes.js";
import { createHandoverRoutes } from "../modules/admin/interfaces/http/handover.routes.js";
import { createAuthController } from "../modules/auth/interfaces/http/auth.controller.js";
import { createAuthRoutes } from "../modules/auth/interfaces/http/auth.routes.js";
import { createClaimController } from "../modules/claims/interfaces/http/claim.controller.js";
import { createClaimRoutes } from "../modules/claims/interfaces/http/claim.routes.js";
import { createNotificationController } from "../modules/notifications/interfaces/http/notification.controller.js";
import { createNotificationRoutes } from "../modules/notifications/interfaces/http/notification.routes.js";
import { createPostController } from "../modules/posts/interfaces/http/post.controller.js";
import { createPostRoutes } from "../modules/posts/interfaces/http/post.routes.js";
import { createReturnFeedbackController } from "../modules/returns/interfaces/http/return-feedback.controller.js";
import { createReturnRoutes } from "../modules/returns/interfaces/http/return.routes.js";
import { createAdminConfigRoutes } from "../modules/system-config/interfaces/http/admin-config.routes.js";
import { createConfigRoutes } from "../modules/system-config/interfaces/http/config.routes.js";
import { createSystemConfigController } from "../modules/system-config/interfaces/http/system-config.controller.js";
import { createStaffRoutes } from "../modules/warehouse/interfaces/http/staff.routes.js";
import { createWarehouseController } from "../modules/warehouse/interfaces/http/warehouse.controller.js";
import type { AccessTokenPayload } from "../shared/domain/auth.js";
import { env } from "../shared/infrastructure/config/env.js";
import { refreshCookieOptions } from "../shared/interfaces/http/auth-cookie.js";
import { createAuthMiddleware } from "../shared/interfaces/http/auth.middleware.js";
import type { ApplicationServices } from "./services.js";

export function createHttpRoutes(services: ApplicationServices) {
  const auth = createAuthMiddleware({ authService: services.authService, verifyAccessToken: (token) => jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload });
  const adminCatalogController = createAdminCatalogController({ adminCatalogService: services.adminCatalogService });
  const adminReportingController = createAdminReportingController({ adminReportingService: services.adminReportingService });
  const adminUserController = createAdminUserController({ adminUserService: services.adminUserService });
  const authController = createAuthController({ authService: services.authService, refreshCookieOptions: (expiresAt) => refreshCookieOptions(env.cookieSecure, expiresAt), accessTokenExpiresIn: env.jwtAccessExpiresIn });
  const claimController = createClaimController({ claimService: services.claimService });
  const notificationController = createNotificationController({ notificationService: services.notificationService });
  const postController = createPostController({ postService: services.postService, geminiImageService: services.geminiImageService });
  const returnFeedbackController = createReturnFeedbackController({ returnFeedbackService: services.returnFeedbackService });
  const systemConfigController = createSystemConfigController({ systemConfigService: services.systemConfigService });
  const warehouseController = createWarehouseController({ warehouseService: services.warehouseService });
  return {
    adminRoutes: createAdminRoutes({ adminCatalogController, adminReportingController, adminUserController, auth }),
    handoverRoutes: createHandoverRoutes({ adminCatalogController }),
    authRoutes: createAuthRoutes({ authController, auth }),
    claimRoutes: createClaimRoutes({ claimController, auth }),
    notificationRoutes: createNotificationRoutes({ notificationController, auth }),
    postRoutes: createPostRoutes({ postController, auth }),
    returnRoutes: createReturnRoutes({ returnFeedbackController, auth }),
    adminConfigRoutes: createAdminConfigRoutes({ systemConfigController, auth }),
    configRoutes: createConfigRoutes({ systemConfigController }),
    staffRoutes: createStaffRoutes({ warehouseController, auth }),
  };
}
