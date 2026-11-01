import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { ReturnFeedbackController } from "./return-feedback.controller.js";

export function createReturnRoutes({ returnFeedbackController, auth }: {
  returnFeedbackController: ReturnFeedbackController;
  auth: AuthMiddleware;
}) {
  const { requireAuth } = auth;
  const returnRoutes = Router();
  returnRoutes.use(requireAuth);
  returnRoutes.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); res.vary("Authorization"); next(); });
  returnRoutes.get("/completed", (req, res, next) => returnFeedbackController.listCompleted(req, res).catch(next));
  returnRoutes.get("/:appointmentId/feedback/eligibility", (req, res, next) => returnFeedbackController.getEligibility(req, res).catch(next));
  returnRoutes.post("/:appointmentId/feedback", (req, res, next) => returnFeedbackController.submit(req, res).catch(next));
  return returnRoutes;
}
