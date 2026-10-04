import type { NotificationEmailQueue, NotificationRecord, NotificationRepository } from "../../notifications/application/index.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { CustodyRequestRepository } from "./custody-request.repository.port.js";

export interface CustodyNotifications {
  notificationRepository?: NotificationRepository;
  notificationEmailQueue?: NotificationEmailQueue;
  publishCustodyNotification?: (userId: string, notification: NotificationRecord) => Promise<void>;
}

export function custodyNotifications(options: CustodyNotifications, repository: CustodyRequestRepository) {
  return {
    async record(input: { id: string; postId: string | null; claimId: string | null; requesterId: string; event: string; }, db: TransactionContext) {
      const deliveries: Array<{ userId: string; notification: NotificationRecord }> = [];
      if (!options.notificationRepository) return deliveries;
      const recipients = await repository.notificationRecipients(input.postId, input.claimId, input.requesterId, db);
      for (const userId of recipients) {
        const canReadCustody = userId === input.requesterId || await repository.isStaff(userId, db);
        const notification = await options.notificationRepository.create({ userId,
          type: input.event === "CREATED" ? "CUSTODY_REQUEST_CREATED" : input.event === "OVERDUE" ? "CUSTODY_OVERDUE" : "CUSTODY_UPDATED",
          title: input.event === "CREATED" ? "Custody: chờ tiếp nhận" : `Custody: ${input.event}`,
          body: input.event === "CREATED" ? "Yêu cầu đã vào hàng đợi. Mang vật phẩm đến điểm bàn giao trong giờ làm việc; không cần chờ duyệt." : input.event === "INTAKED" ? "Staff đã tiếp nhận vật phẩm thực tế. Tiếp nhận không phải xác minh quyền sở hữu." : "Yêu cầu bàn giao vật phẩm đã được cập nhật. Đăng nhập để xem chi tiết.",
          entityType: canReadCustody ? "CUSTODY_REQUEST" : input.claimId ? "CLAIM" : "POST", entityId: canReadCustody ? input.id : input.claimId ?? input.postId, dedupeKey: `custody:${input.id}:${input.event}:${userId}`
        }, db);
        if (!notification) continue;
        await options.notificationEmailQueue?.enqueue({ notification, recipientUserId: userId, eventType: input.event === "OVERDUE" ? "OVERDUE" : "CUSTODY" }, db);
        deliveries.push({ userId, notification });
      }
      return deliveries;
    },
    async publish(deliveries: Array<{ userId: string; notification: NotificationRecord }>) {
      for (const delivery of deliveries) await options.publishCustodyNotification?.(delivery.userId, delivery.notification);
    }
  };
}
