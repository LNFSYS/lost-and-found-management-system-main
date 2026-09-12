import type { Request, Response } from "express";
import type { NotificationUseCases } from "../../application/notification.use-cases.js";
import { listNotificationsQuerySchema, notificationIdParamSchema } from "./notification.validator.js";

export function createNotificationController({ notificationService }: {
  notificationService: NotificationUseCases;
}) {
  const notificationController = {
    async list(request: Request, response: Response) {
      const { limit } = listNotificationsQuerySchema.parse(request.query);
      response.json(await notificationService.list(request.auth!.sub, limit));
    },

    async markRead(request: Request, response: Response) {
      const { notificationId } = notificationIdParamSchema.parse(request.params);
      response.json(await notificationService.markRead(request.auth!.sub, notificationId));
    },

    async markAllRead(request: Request, response: Response) {
      response.json(await notificationService.markAllRead(request.auth!.sub));
    }
  };
  return notificationController;
}
export type NotificationController = ReturnType<typeof createNotificationController>;
