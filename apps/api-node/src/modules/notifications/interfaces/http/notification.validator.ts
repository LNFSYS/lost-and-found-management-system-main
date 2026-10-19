import { z } from "zod";

export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid()
});

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const deliveryModeSchema = z.enum(["IMMEDIATE", "DELAYED_UNREAD", "DIGEST", "DISABLED"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Quiet-hours time must use HH:mm");
const channelSchema = z.object({
  inAppEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  emailMode: deliveryModeSchema
}).strict();

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } }, "Push endpoint must use HTTPS"),
  p256dh: z.string().min(40).max(160).regex(/^[A-Za-z0-9_-]+$/)
    .refine((value) => { const decoded = Buffer.from(value, "base64url"); return decoded.length === 65 && decoded[0] === 4; }, "Invalid P-256 push key"),
  auth: z.string().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/)
    .refine((value) => Buffer.from(value, "base64url").length === 16, "Invalid push authentication secret")
}).strict();

export const pushSubscriptionDeleteSchema = z.object({
  endpoint: z.string().url().max(2048).refine((value) => { try { return new URL(value).protocol === "https:"; } catch { return false; } }, "Push endpoint must use HTTPS")
}).strict();

export const updateNotificationEmailPreferencesSchema = z.object({
  chatMode: deliveryModeSchema,
  claimMode: deliveryModeSchema,
  categories: z.object({
    CHAT: channelSchema,
    CLAIM: channelSchema,
    MATCH: channelSchema,
    APPOINTMENT: channelSchema,
    HANDOVER: channelSchema,
    CUSTODY: channelSchema,
    OVERDUE: channelSchema,
    FEEDBACK: channelSchema
  }).strict().optional(),
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
