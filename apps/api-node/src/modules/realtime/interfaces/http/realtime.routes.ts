import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { RealtimeController } from "./realtime.controller.js";

export function createRealtimeRoutes({ realtimeController, auth }: {
  realtimeController: RealtimeController;
  auth: AuthMiddleware;
}) {
  const router = Router();
  router.get("/", auth.requireAuth, (req, res, next) => realtimeController.connect(req, res).catch(next));
  return router;
}
