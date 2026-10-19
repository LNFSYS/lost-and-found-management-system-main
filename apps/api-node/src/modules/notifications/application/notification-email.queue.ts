import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { NotificationRecord } from "./notification.repository.port.js";
import type {
  EmailOutboxMode, NotificationEmailEvent, NotificationEmailMode, NotificationEmailRepository
} from "./notification-email.repository.port.js";
import { defaultChannelPreferences } from "./notification-channels.js";

export interface NotificationEmailQueue {
  enqueue(input: {
    notification: NotificationRecord;
    recipientUserId: string;
    eventType: NotificationEmailEvent;
    roomId?: string | null;
  }, queryable: TransactionContext): Promise<void>;
  cancelForNotification(userId: string, notificationId: string): Promise<number>;
  cancelForRoom(userId: string, roomId: string): Promise<number>;
  cancelForUser(userId: string): Promise<number>;
}

function channelsFor(preferences: { chatMode: NotificationEmailMode; claimMode: NotificationEmailMode; categories?: import("./notification-email.repository.port.js").NotificationChannelPreferences; }, eventType: NotificationEmailEvent) {
  return preferences.categories ?? defaultChannelPreferences(preferences.chatMode, preferences.claimMode);
}

export function createNotificationEmailQueue(options: {
  repository: NotificationEmailRepository;
  id: () => string;
  chatDelayMinutes: number;
  digestDelayMinutes: number;
  now?: () => Date;
}): NotificationEmailQueue {
  const now = options.now ?? (() => new Date());
  const chatDelayMinutes = Math.min(10, Math.max(5, Math.trunc(options.chatDelayMinutes)));
  const digestDelayMinutes = Math.min(1_440, Math.max(15, Math.trunc(options.digestDelayMinutes)));

  return {
    async enqueue(input, queryable) {
      const preferences = await options.repository.getPreferences(input.recipientUserId, queryable);
      const preference = channelsFor(preferences, input.eventType)[input.eventType];
      if (preference.emailMode !== "DISABLED") {
        const mode = preference.emailMode;
        const startedAt = now();
        const dueAt = new Date(startedAt.getTime() + (mode === "DELAYED_UNREAD"
          ? chatDelayMinutes
          : mode === "DIGEST" ? digestDelayMinutes : 0) * 60_000);
        await options.repository.enqueue({
          id: options.id(),
          notificationId: input.notification.id,
          recipientUserId: input.recipientUserId,
          eventType: input.eventType,
          entityType: input.notification.entityType ?? "NOTIFICATION",
          entityId: input.notification.entityId,
          roomId: input.roomId ?? null,
          deliveryMode: mode as EmailOutboxMode,
          idempotencyKey: `notification-email:${input.notification.id}`,
          dueAt
        }, queryable);
      }
      if (preference.pushEnabled) await options.repository.enqueuePush?.({
        notificationId: input.notification.id, recipientUserId: input.recipientUserId, roomId: input.roomId
      }, queryable);
    },
    cancelForNotification: (userId, notificationId) => options.repository.cancelForNotification(userId, notificationId),
    cancelForRoom: (userId, roomId) => options.repository.cancelForRoom(userId, roomId),
    cancelForUser: (userId) => options.repository.cancelForUser(userId)
  };
}
