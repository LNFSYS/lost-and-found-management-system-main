import { z } from "zod";

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid()
});

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const deliveryModeSchema = z.enum(["IMMEDIATE", "DELAYED_UNREAD", "DIGEST", "DISABLED"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Quiet-hours time must use HH:mm");

export const updateNotificationEmailPreferencesSchema = z.object({
  chatMode: deliveryModeSchema,
  claimMode: deliveryModeSchema,
  quietHoursStart: timeSchema.nullable(),
  quietHoursEnd: timeSchema.nullable(),
  timezone: z.string().trim().min(1).max(64)
}).superRefine((value, context) => {
  if ((value.quietHoursStart === null) !== (value.quietHoursEnd === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Set both quiet-hours boundaries, or neither", path: ["quietHoursStart"] });
  }
  try { new Intl.DateTimeFormat("en-US", { timeZone: value.timezone }); } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid timezone", path: ["timezone"] });
  }
});
