import { Router } from "express";
import { returnFeedbackController } from "../controllers/return-feedback.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const returnRoutes = Router();

returnRoutes.use(requireAuth);
returnRoutes.get("/:appointmentId/feedback/eligibility", (req, res, next) => returnFeedbackController.getEligibility(req, res).catch(next));
returnRoutes.post("/:appointmentId/feedback", (req, res, next) => returnFeedbackController.submit(req, res).catch(next));
