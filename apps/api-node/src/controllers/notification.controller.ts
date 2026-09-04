import type { Request, Response } from "express";
import { notificationService } from "../services/notification.service.js";
import { listNotificationsQuerySchema, notificationIdParamSchema } from "../validators/notification.validator.js";

export const notificationController = {
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
