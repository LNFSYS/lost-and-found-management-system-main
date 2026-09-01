import { Router } from "express";
import { systemConfigController } from "../controllers/system-config.controller.js";

export const configRoutes = Router();

configRoutes.get("/public", (req, res, next) => systemConfigController.getPublicConfig(req, res).catch(next));
