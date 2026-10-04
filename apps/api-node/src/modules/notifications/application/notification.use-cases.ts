import { AppError } from "../../../shared/domain/app-error.js";
import type { NotificationEmailQueue } from "./notification-email.queue.js";
import type { NotificationEmailPreferences, NotificationEmailRepository } from "./notification-email.repository.port.js";
import type { NotificationRecord, NotificationRepository } from "./notification.repository.port.js";

function safeLimit(value: number | undefined) {
  return Math.min(50, Math.max(1, Math.trunc(value ?? 20)));
}

export interface NotificationDependencies {
  notificationRepository: NotificationRepository;
  notificationEmailRepository?: NotificationEmailRepository;
  notificationEmailQueue?: NotificationEmailQueue;
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
      return { preferences: await emailPreferencesRepository().updatePreferences(userId, input) };
    }
  };
  return notificationService;
}

export type NotificationUseCases = ReturnType<typeof createNotificationUseCases>;
