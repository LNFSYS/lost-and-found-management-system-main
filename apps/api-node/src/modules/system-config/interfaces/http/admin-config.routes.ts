import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { SystemConfigController } from "./system-config.controller.js";

export function createAdminConfigRoutes({ systemConfigController, auth }: {
  systemConfigController: SystemConfigController;
  auth: AuthMiddleware;
}) {
  const { requireAnyRole, requireAuth } = auth;
  const adminConfigRoutes = Router();
  adminConfigRoutes.use(requireAuth, requireAnyRole("ADMIN"));
  adminConfigRoutes.get("/", (req, res, next) => systemConfigController.listConfigs(req, res).catch(next));
  adminConfigRoutes.post("/", (req, res, next) => systemConfigController.createConfig(req, res).catch(next));
  adminConfigRoutes.get("/:id/history", (req, res, next) => systemConfigController.listHistory(req, res).catch(next));
  adminConfigRoutes.get("/:id", (req, res, next) => systemConfigController.getConfig(req, res).catch(next));
  adminConfigRoutes.patch("/:id", (req, res, next) => systemConfigController.updateConfig(req, res).catch(next));
  adminConfigRoutes.delete("/:id", (req, res, next) => systemConfigController.deleteConfig(req, res).catch(next));
  return adminConfigRoutes;
}
