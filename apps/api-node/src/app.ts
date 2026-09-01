import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./controllers/auth.controller.js";
import { env } from "./config/env.js";
import { pool } from "./config/db.js";
import { isOriginAllowed, parseAllowedOrigins } from "./config/cors.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { configRoutes } from "./routes/config.routes.js";
import { postRoutes } from "./routes/post.routes.js";
import { staffRoutes } from "./routes/staff.routes.js";
import { handoverRoutes } from "./routes/handover.routes.js";

interface AppDependencies {
  checkReadiness?: () => Promise<void>;
}

export function createApp({ checkReadiness = async () => { await pool.query("SELECT 1"); } }: AppDependencies = {}) {
  const app = express();
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
  app.use("/api/staff", staffRoutes);
  app.use("/api/handover-points", handoverRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", (_request, response) => response.status(404).json({ message: "Không tìm thấy endpoint" }));
  app.use(errorHandler);
  return app;
}
