import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { isOriginAllowed, parseAllowedOrigins } from "../shared/infrastructure/config/cors.js";
import { env } from "../shared/infrastructure/config/env.js";
import { errorHandler } from "../shared/interfaces/http/error-handler.js";
import { pool } from "./database.js";
import { createHttpRoutes } from "./http.js";
import { services as defaultServices } from "./runtime.js";
import type { ApplicationServices } from "./services.js";

interface AppDependencies {
  services?: ApplicationServices;
  checkReadiness?: () => Promise<void>;
}

export function createApp({ services = defaultServices, checkReadiness = async () => { await pool.query("SELECT 1"); } }: AppDependencies = {}) {
  const app = express();
  const { adminRoutes, handoverRoutes, authRoutes, claimRoutes, notificationRoutes, postRoutes, returnRoutes, adminConfigRoutes, configRoutes, staffRoutes } = createHttpRoutes(services);
  const allowedOrigins = parseAllowedOrigins(env.frontendUrl);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins, env.nodeEnv)),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"]
  }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "lnfs-auth-api" }));
  app.get("/api/ready", async (_request, response) => {
    try {
      await checkReadiness();
      response.json({ status: "ready", service: "lnfs-auth-api" });
    } catch {
      response.status(503).json({ status: "unavailable", message: "Dịch vụ chưa sẵn sàng" });
    }
  });
  app.use("/api/config", configRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/returns", returnRoutes);
  app.use("/api/claims", claimRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/staff", staffRoutes);
  app.use("/api/handover-points", handoverRoutes);
  app.use("/api/admin/configs", adminConfigRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", (_request, response) => response.status(404).json({ message: "Không tìm thấy endpoint" }));
  app.use(errorHandler);
  return app;
}
