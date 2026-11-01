import { Router } from "express";
import type { AuthMiddleware } from "../../../../shared/interfaces/http/auth.middleware.js";
import type { NotificationController } from "./notification.controller.js";

export function createNotificationRoutes({ notificationController, auth }: {
  notificationController: NotificationController;
  auth: AuthMiddleware;
}) {
  const { requireAuth } = auth;
  const notificationRoutes = Router();
  notificationRoutes.use(requireAuth);
  notificationRoutes.use((_request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Vary", "Authorization");
    next();
  });
  notificationRoutes.get("/preferences", (request, response, next) => notificationController.getEmailPreferences(request, response).catch(next));
  notificationRoutes.put("/preferences", (request, response, next) => notificationController.updateEmailPreferences(request, response).catch(next));
  notificationRoutes.get("/push/status", (request, response, next) => notificationController.getPushStatus(request, response).catch(next));
  notificationRoutes.post("/push/subscriptions", (request, response, next) => notificationController.registerPushSubscription(request, response).catch(next));
  notificationRoutes.delete("/push/subscriptions", (request, response, next) => notificationController.removePushSubscription(request, response).catch(next));
  notificationRoutes.get("/", (request, response, next) => notificationController.list(request, response).catch(next));
  notificationRoutes.post("/read-all", (request, response, next) => notificationController.markAllRead(request, response).catch(next));
  notificationRoutes.post("/:notificationId/read", (request, response, next) => notificationController.markRead(request, response).catch(next));
  return notificationRoutes;
}
