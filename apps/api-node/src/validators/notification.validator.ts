import { z } from "zod";

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid()
});

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});
