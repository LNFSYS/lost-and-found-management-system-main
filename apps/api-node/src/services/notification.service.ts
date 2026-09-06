import { notificationRepository, type NotificationRecord } from "../repositories/notification.repository.js";
import { HttpError } from "../utils/http-error.js";

function safeLimit(value: number | undefined) {
  return Math.min(50, Math.max(1, Math.trunc(value ?? 20)));
}

export const notificationService = {
  async list(userId: string, limit?: number): Promise<{ items: NotificationRecord[]; unreadTotal: number }> {
    const [items, unreadTotal] = await Promise.all([
      notificationRepository.listForUser(userId, safeLimit(limit)),
      notificationRepository.countUnreadForUser(userId)
    ]);
    return { items, unreadTotal };
  },

  async markRead(userId: string, notificationId: string) {
    if (!await notificationRepository.markRead(userId, notificationId)) {
      throw new HttpError(404, "Thông báo không tồn tại");
    }
    return { read: true };
  },

  async markAllRead(userId: string) {
    return { read: true, count: await notificationRepository.markAllRead(userId) };
  }
};
