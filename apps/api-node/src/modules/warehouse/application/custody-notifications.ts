import type { NotificationEmailQueue, NotificationRecord, NotificationRepository, NotificationType } from "../../notifications/application/index.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { CustodyRequestRepository } from "./custody-request.repository.port.js";

export interface CustodyNotifications {
  notificationRepository?: NotificationRepository;
  notificationEmailQueue?: NotificationEmailQueue;
  publishCustodyNotification?: (userId: string, notification: NotificationRecord) => Promise<void>;
}

function eventCopy(event: string): { type: NotificationType; title: string; body: string } {
  if (event === "CREATED") return { type: "CUSTODY_REQUEST_CREATED", title: "Custody: đã vào hàng đợi tiếp nhận", body: "Yêu cầu đã vào hàng đợi. Mang vật phẩm đến điểm bàn giao trong giờ làm việc; không cần chờ duyệt." };
  if (event === "ACCEPTED") return { type: "CUSTODY_ACCEPTED", title: "Custody: Staff đã xác nhận yêu cầu", body: "Staff đã xác nhận điểm bàn giao. Theo dõi lịch và hướng dẫn trong yêu cầu custody." };
  if (event === "REJECTED") return { type: "CUSTODY_REJECTED", title: "Custody: yêu cầu bị từ chối", body: "Staff đã từ chối yêu cầu custody. Mở yêu cầu để xem trạng thái và lý do." };
  if (event === "CANCELLED") return { type: "CUSTODY_CANCELLED", title: "Custody: yêu cầu đã được hủy", body: "Yêu cầu custody đã được hủy trước khi tiếp nhận vật phẩm." };
  if (event === "INTAKED") return { type: "CUSTODY_INTAKED", title: "Custody: Staff đã tiếp nhận vật phẩm", body: "Staff đã xác nhận tiếp nhận vật phẩm thực tế. Việc tiếp nhận không xác minh quyền sở hữu." };
  if (event === "RETURNED") return { type: "CUSTODY_RETURNED", title: "Custody: vật phẩm đã được bàn giao", body: "Hồ sơ ghi nhận vật phẩm đã được trả cho người nhận đã xác minh." };
  if (event === "OVERDUE") return { type: "CUSTODY_OVERDUE", title: "Custody: yêu cầu đã quá hạn", body: "Yêu cầu custody cần được kiểm tra và xử lý." };
  if (event.startsWith("VERIFIED:")) return { type: "CUSTODY_VERIFIED", title: "Custody: Staff đã xác minh claim", body: "Staff đã ghi nhận kết quả đối chiếu claim tại quầy tiếp nhận." };
  if (event === "RESERVED") return { type: "CUSTODY_RESERVED", title: "Custody: vật phẩm đã được giữ cho claim", body: "Vật phẩm đã được giữ cho người nhận có claim được xác minh." };
  if (event === "RESERVATION_RELEASED") return { type: "CUSTODY_RESERVATION_RELEASED", title: "Custody: đã giải phóng lượt giữ", body: "Lượt giữ vật phẩm cho claim đã được giải phóng để tiếp tục xử lý theo quy trình kho." };
  if (event === "MOVED") return { type: "CUSTODY_MOVED", title: "Custody: vị trí vật phẩm đã thay đổi", body: "Thông tin lưu giữ của vật phẩm vừa được cập nhật." };
  if (event === "DISPOSITION_REQUESTED") return { type: "CUSTODY_DISPOSITION_REQUESTED", title: "Custody: đã đề nghị xử lý vật phẩm", body: "Một lệnh xử lý vật phẩm đang chờ phê duyệt theo quy trình kho." };
  if (event === "DISPOSITION_APPROVED") return { type: "CUSTODY_DISPOSITION_APPROVED", title: "Custody: lệnh xử lý đã được phê duyệt", body: "Lệnh xử lý đã được phê duyệt và sẽ được thực hiện theo quy trình kho." };
  if (event.startsWith("DISPOSITION_COMPLETED:")) return { type: "CUSTODY_DISPOSITION_COMPLETED", title: "Custody: quy trình xử lý đã hoàn tất", body: "Trạng thái lưu giữ của vật phẩm đã kết thúc theo lệnh xử lý đã phê duyệt." };
  if (event === "LEGAL_HOLD_PLACED" || event === "LEGAL_HOLD_RELEASED") return {
    type: "CUSTODY_LEGAL_HOLD",
    title: event === "LEGAL_HOLD_PLACED" ? "Custody: vật phẩm được đặt legal hold" : "Custody: legal hold đã được gỡ",
    body: "Trạng thái giữ pháp lý của vật phẩm đã thay đổi. Các thao tác trả hoặc xử lý sẽ tuân theo trạng thái mới."
  };
  return { type: "CUSTODY_STATUS_CHANGED", title: "Custody: trạng thái vật phẩm đã cập nhật", body: "Trạng thái lưu giữ của vật phẩm vừa được cập nhật." };
}

export function custodyNotifications(options: CustodyNotifications, repository: CustodyRequestRepository) {
  return {
    async record(input: { id: string; postId: string | null; claimId: string | null; requesterId: string; event: string; }, db: TransactionContext) {
      const deliveries: Array<{ userId: string; notification: NotificationRecord }> = [];
      if (!options.notificationRepository) return deliveries;
      const recipients = await repository.notificationRecipients(input.postId, input.claimId, input.requesterId, db);
      const copy = eventCopy(input.event);
      for (const userId of recipients) {
        const canReadCustody = userId === input.requesterId || await repository.isStaff(userId, db);
        const notification = await options.notificationRepository.create({
          userId,
          type: copy.type,
          title: copy.title,
          body: copy.body,
          entityType: canReadCustody ? "CUSTODY_REQUEST" : input.claimId ? "CLAIM" : "POST",
          entityId: canReadCustody ? input.id : input.claimId ?? input.postId,
          dedupeKey: `custody:${input.id}:${input.event}:${userId}`
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
