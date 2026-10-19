import { AppError } from "../../../shared/domain/app-error.js";
import type { NotificationEmailQueue } from "./notification-email.queue.js";
import type { NotificationEmailPreferences, NotificationEmailRepository } from "./notification-email.repository.port.js";
import type { NotificationRecord, NotificationRepository } from "./notification.repository.port.js";
import { defaultChannelPreferences } from "./notification-channels.js";

function safeLimit(value: number | undefined) {
  return Math.min(50, Math.max(1, Math.trunc(value ?? 20)));
}

export interface NotificationDependencies {
  notificationRepository: NotificationRepository;
  notificationEmailRepository?: NotificationEmailRepository;
  notificationEmailQueue?: NotificationEmailQueue;
  pushPublicKey?: string | null;
}
export function createNotificationUseCases(options: NotificationDependencies) {
  const { notificationRepository, notificationEmailRepository, notificationEmailQueue } = options;

  function emailPreferencesRepository() {
    if (!notificationEmailRepository) throw new AppError("unavailable", "Notification email preferences are unavailable");
    return notificationEmailRepository;
  }

  const notificationService = {
    async list(userId: string, limit?: number): Promise<{ items: NotificationRecord[]; unreadTotal: number; }> {
      const [items, unreadTotal] = await Promise.all([
        notificationRepository.listForUser(userId, safeLimit(limit)),
        notificationRepository.countUnreadForUser(userId)
      ]);
      return { items, unreadTotal };
    },

    async markRead(userId: string, notificationId: string) {
      if (!await notificationRepository.markRead(userId, notificationId)) {
        throw new AppError("not_found", "Thông báo không tồn tại");
      }
      await notificationEmailQueue?.cancelForNotification(userId, notificationId);
      return { read: true };
    },

    async markAllRead(userId: string) {
      const count = await notificationRepository.markAllRead(userId);
      await notificationEmailQueue?.cancelForUser(userId);
      return { read: true, count };
    },

    async getEmailPreferences(userId: string) {
      return { preferences: await emailPreferencesRepository().getPreferences(userId) };
    },

    async updateEmailPreferences(userId: string, input: Omit<NotificationEmailPreferences, "userId" | "updatedAt">) {
      const categories = input.categories ?? defaultChannelPreferences(input.chatMode, input.claimMode);
      if (!options.pushPublicKey && Object.values(categories).some((preference) => preference.pushEnabled)) {
        throw new AppError("unavailable", "Browser push is not configured on this server");
      }
      return { preferences: await emailPreferencesRepository().updatePreferences(userId, {
        ...input, categories, chatMode: categories.CHAT.emailMode, claimMode: categories.CLAIM.emailMode
      }) };
    },

    getPushStatus() {
      return { enabled: Boolean(options.pushPublicKey), publicKey: options.pushPublicKey ?? null };
    },

    async registerPushSubscription(userId: string, input: { endpoint: string; p256dh: string; auth: string; }) {
      if (!options.pushPublicKey) throw new AppError("unavailable", "Browser push is not configured on this server");
      const repository = emailPreferencesRepository();
      if (!repository.savePushSubscription) throw new AppError("unavailable", "Browser push subscriptions are unavailable");
      await repository.savePushSubscription({ ...input, userId });
      return { registered: true };
    },

    async removePushSubscription(userId: string, endpoint: string) {
      const repository = emailPreferencesRepository();
      await repository.deletePushSubscription?.(userId, endpoint);
      return { removed: true };
    }
  };
  return notificationService;
}

export type NotificationUseCases = ReturnType<typeof createNotificationUseCases>;
