import type { SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { NotificationRepository } from "../../notifications/application/notification.repository.port.js";
import type { RowDataPacket } from "mysql2";

export interface RetentionAlertSchedulerOptions {
  db: SqlExecutor;
  notificationRepository: NotificationRepository;
  id: () => string;
}

interface UserRow extends RowDataPacket {
  id: string;
}

interface OverdueCandidateRow extends RowDataPacket {
  id: string;
  item_name: string;
  storage_code: string | null;
  retention_deadline: Date | string | null;
  status: string;
  legal_hold_count: number;
  days_overdue: number | null;
}

export function createRetentionAlertScheduler(options: RetentionAlertSchedulerOptions) {
  const { db, notificationRepository } = options;

  async function findStaffAndAdminUserIds(): Promise<string[]> {
    const [rows] = await db.execute<UserRow[]>(
      `SELECT id FROM users WHERE role IN ('STAFF', 'ADMIN') AND status = 'ACTIVE'`
    );
    return rows.map((r: UserRow) => r.id);
  }

  return {
    async scanAndAlertOverdue(): Promise<{ scannedCount: number; alertedCount: number }> {
      // 1. Find items that are overdue or nearing retention deadline (< 7 days) and still in active custody
      const [items] = await db.execute<OverdueCandidateRow[]>(
        `SELECT
          wi.id,
          wi.item_name,
          wi.storage_code,
          wi.retention_deadline,
          wi.status,
          wi.legal_hold_count,
          DATEDIFF(NOW(), wi.retention_deadline) AS days_overdue
        FROM warehouse_items wi
        WHERE wi.status IN ('RECEIVED', 'STORED')
          AND wi.retention_deadline IS NOT NULL
          AND wi.retention_deadline <= DATE_ADD(NOW(), INTERVAL 7 DAY)
        LIMIT 100`
      );

      if (items.length === 0) return { scannedCount: 0, alertedCount: 0 };

      const recipientIds = await findStaffAndAdminUserIds();
      if (recipientIds.length === 0) return { scannedCount: items.length, alertedCount: 0 };

      let alertedCount = 0;
      const todayStr = new Date().toISOString().slice(0, 10);

      for (const item of items) {
        const daysOverdue = Number(item.days_overdue ?? 0);
        const isOverdue = daysOverdue >= 0;
        const holdText = item.legal_hold_count > 0 ? " [Đang có Legal Hold]" : "";

        const title = isOverdue
          ? `Cảnh báo quá hạn lưu kho: ${item.item_name}`
          : `Nhắc nhở sắp hết hạn lưu kho: ${item.item_name}`;

        const body = isOverdue
          ? `Vật phẩm "${item.item_name}" (Vị trí: ${item.storage_code ?? "Chưa rõ"}) đã quá hạn lưu kho ${daysOverdue} ngày.${holdText} Vui lòng kiểm tra và xử lý.`
          : `Vật phẩm "${item.item_name}" (Vị trí: ${item.storage_code ?? "Chưa rõ"}) sẽ hết hạn lưu kho trong vài ngày tới.${holdText}`;

        for (const userId of recipientIds) {
          const dedupeKey = `retention-alert:${item.id}:${todayStr}:${userId}`;
          const sent = await notificationRepository.create({
            userId,
            type: "RETENTION_OVERDUE_ALERT",
            title,
            body,
            entityType: "WAREHOUSE_ITEM",
            entityId: item.id,
            dedupeKey
          });
          if (sent) alertedCount++;
        }
      }

      return { scannedCount: items.length, alertedCount };
    }
  };
}
