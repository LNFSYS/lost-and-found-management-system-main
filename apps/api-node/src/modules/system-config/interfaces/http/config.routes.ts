import { Router } from "express";
import type { SystemConfigController } from "./system-config.controller.js";

export function createConfigRoutes({ systemConfigController }: {
  systemConfigController: SystemConfigController;
}) {
  const configRoutes = Router();
  configRoutes.get("/public", (req, res, next) => systemConfigController.getPublicConfig(req, res).catch(next));
  return configRoutes;
}
