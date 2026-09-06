import { Router } from "express";
import { notificationController } from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const notificationRoutes = Router();

notificationRoutes.use(requireAuth);
notificationRoutes.use((_request, response, next) => {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Vary", "Authorization");
  next();
});
notificationRoutes.get("/", (request, response, next) => notificationController.list(request, response).catch(next));
notificationRoutes.post("/read-all", (request, response, next) => notificationController.markAllRead(request, response).catch(next));
notificationRoutes.post("/:notificationId/read", (request, response, next) => notificationController.markRead(request, response).catch(next));
