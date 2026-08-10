import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./controllers/auth.controller.js";
import { env } from "./config/env.js";
import { authRoutes } from "./routes/auth.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true, methods: ["GET", "POST", "PATCH"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.get("/api/health", (_request, response) => response.json({ status: "ok", service: "lnfs-auth-api" }));
  app.use("/api/auth", authRoutes);
  app.use(errorHandler);
  return app;
}
