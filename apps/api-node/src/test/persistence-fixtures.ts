import type { Pool } from "mysql2/promise";
import { createPersistence } from "../main/persistence.js";
import { unexpectedPort } from "./unexpected-port.js";
export const pool = unexpectedPort<Pool>("SQL driver");
export const { adminAuditRepository, adminCatalogRepository, adminReportingRepository, adminUserRepository, authRepository, claimRepository, matchingRepository, notificationRepository, postRepository, returnFeedbackRepository, systemConfigRepository, userRepository, warehouseRepository } = createPersistence(pool);
