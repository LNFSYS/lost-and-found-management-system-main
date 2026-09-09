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
  returnRoutes.get("/:appointmentId/feedback/eligibility", (req, res, next) => returnFeedbackController.getEligibility(req, res).catch(next));
  returnRoutes.post("/:appointmentId/feedback", (req, res, next) => returnFeedbackController.submit(req, res).catch(next));
  return returnRoutes;
}
