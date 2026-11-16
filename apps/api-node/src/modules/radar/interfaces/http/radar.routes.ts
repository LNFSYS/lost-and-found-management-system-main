import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { RadarController } from "./radar.controller.js";

export function createRadarRoutes({ radarController, auth }: {
  radarController: RadarController;
  auth: AuthMiddleware;
}) {
  const router = Router();
  router.use(auth.requireAuth, auth.requireAnyRole("ADMIN", "STAFF"));
  router.get("/analytics", (req, res, next) => radarController.getAnalytics(req, res).catch(next));
  router.post("/alerts/:id/acknowledge", (req, res, next) => radarController.acknowledgeAlert(req, res).catch(next));
  return router;
}
