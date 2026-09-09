import type { Pool } from "mysql2/promise";
import { createAdminAuditRepository } from "../modules/admin/infrastructure/admin-audit.repository.js";
import { createAdminCatalogRepository } from "../modules/admin/infrastructure/admin-catalog.repository.js";
import { createAdminReportingRepository } from "../modules/admin/infrastructure/admin-reporting.repository.js";
import { createAdminUserRepository } from "../modules/admin/infrastructure/admin-user.repository.js";
import { createAuthRepository } from "../modules/auth/infrastructure/auth.repository.js";
import { createUserRepository } from "../modules/auth/infrastructure/user.repository.js";
import { createClaimRepository } from "../modules/claims/infrastructure/claim.repository.js";
import { createMatchingRepository } from "../modules/matching/infrastructure/matching.repository.js";
import { createNotificationRepository } from "../modules/notifications/infrastructure/notification.repository.js";
import { createPostRepository } from "../modules/posts/infrastructure/post.repository.js";
import { createReturnFeedbackRepository } from "../modules/returns/infrastructure/return-feedback.repository.js";
import { createSystemConfigRepository } from "../modules/system-config/infrastructure/system-config.repository.js";
import { createWarehouseRepository } from "../modules/warehouse/infrastructure/warehouse.repository.js";
import { runInTransaction } from "../shared/infrastructure/config/db.js";
import { createTransactionRunner, type SqlTransactionRunner } from "../shared/infrastructure/transaction-context.js";
export function createPersistence(database: Pool) {
  const sqlTransaction: SqlTransactionRunner = async (work) => {
    const connection = await database.getConnection();
    try { return await runInTransaction(connection, work); } finally { connection.release(); }
  };
  return {
    transaction: createTransactionRunner(sqlTransaction),
    adminAuditRepository: createAdminAuditRepository(database),
    adminCatalogRepository: createAdminCatalogRepository(database),
    adminReportingRepository: createAdminReportingRepository(database),
    adminUserRepository: createAdminUserRepository(database),
    authRepository: createAuthRepository(database),
    claimRepository: createClaimRepository(database),
    matchingRepository: createMatchingRepository(database, sqlTransaction),
    notificationRepository: createNotificationRepository(database),
    postRepository: createPostRepository(database),
    returnFeedbackRepository: createReturnFeedbackRepository(database),
    systemConfigRepository: createSystemConfigRepository(database),
    userRepository: createUserRepository(database),
    warehouseRepository: createWarehouseRepository(database),
  };
}
export type Persistence = ReturnType<typeof createPersistence>;
