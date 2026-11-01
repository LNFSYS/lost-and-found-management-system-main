import {
  notificationCategories,
  type NotificationChannelPreferences,
  type NotificationEmailMode
} from "./notification-email.repository.port.js";

export function defaultChannelPreferences(chatMode: NotificationEmailMode, claimMode: NotificationEmailMode): NotificationChannelPreferences {
  return Object.fromEntries(notificationCategories.map((category) => [category, {
    inAppEnabled: true,
    pushEnabled: false,
    emailMode: category === "CHAT" ? chatMode : claimMode
  }])) as NotificationChannelPreferences;
}

export function normalizeChannelPreferences(value: unknown, chatMode: NotificationEmailMode, claimMode: NotificationEmailMode): NotificationChannelPreferences {
  const fallback = defaultChannelPreferences(chatMode, claimMode);
  const parsed = typeof value === "string" ? (() => {
    try { return JSON.parse(value) as unknown; } catch { return null; }
  })() : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
  const record = parsed as Record<string, unknown>;
  for (const category of notificationCategories) {
    const input = record[category];
    if (!input || typeof input !== "object" || Array.isArray(input)) continue;
    const preference = input as Record<string, unknown>;
    fallback[category] = {
      inAppEnabled: typeof preference.inAppEnabled === "boolean" ? preference.inAppEnabled : fallback[category].inAppEnabled,
      pushEnabled: typeof preference.pushEnabled === "boolean" ? preference.pushEnabled : fallback[category].pushEnabled,
      emailMode: ["IMMEDIATE", "DELAYED_UNREAD", "DIGEST", "DISABLED"].includes(String(preference.emailMode))
        ? preference.emailMode as NotificationEmailMode
        : fallback[category].emailMode
    };
  }
  return fallback;
}

export function categoryForNotificationType(type: string) {
  if (type === "CHAT_MESSAGE_RECEIVED") return "CHAT" as const;
  if (type === "MATCH_FOUND") return "MATCH" as const;
  if (type === "APPOINTMENT_HANDOVER_UPDATED" || type.startsWith("RETURN_")) return "HANDOVER" as const;
  if (type.startsWith("APPOINTMENT_")) return "APPOINTMENT" as const;
  if (type.startsWith("CUSTODY_")) return "CUSTODY" as const;
  if (type.startsWith("WAREHOUSE_")) return "OVERDUE" as const;
  if (type === "FEEDBACK_RECEIVED") return "FEEDBACK" as const;
  return "CLAIM" as const;
}
