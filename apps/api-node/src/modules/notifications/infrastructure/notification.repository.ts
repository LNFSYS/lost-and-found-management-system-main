import type { NotificationRecord, NotificationRepository, NotificationType } from "../application/notification.repository.port.js";

export type { NotificationRecord, NotificationRepository, NotificationType } from "../application/notification.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { ResultSetHeader, RowDataPacket } from "mysql2";

import type { PoolConnection } from "mysql2/promise";

import { id } from "../../../shared/infrastructure/security.js";

interface NotificationRow extends RowDataPacket {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: number;
  read_at: Date | string | null;
  created_at: Date | string;
}

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    isRead: row.is_read === 1,
    readAt: iso(row.read_at),
    createdAt: iso(row.created_at)!
  };
}

const notificationSelect = `SELECT n.id, n.type, n.title, n.body,
  n.entity_type, n.entity_id, n.is_read, n.read_at, n.created_at
FROM notifications n`;

export function createNotificationRepository(pool: SqlExecutor) {

  const notificationRepository = {
    async create(input: {
      userId: string;
      type: NotificationType;
      title: string;
      body?: string | null;
      entityType?: string | null;
      entityId?: string | null;
      dedupeKey?: string | null;
    }, queryable: Queryable = pool) {
      const notificationId = id();
      await sqlExecutor(queryable).execute(
        `INSERT INTO notifications
        (id, user_id, type, title, body, entity_type, entity_id, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
        [notificationId, input.userId, input.type, input.title, input.body ?? null,
          input.entityType ?? null, input.entityId ?? null, input.dedupeKey ?? null]
      );

      const [rows] = await sqlExecutor(queryable).execute<NotificationRow[]>(
        `${notificationSelect} WHERE n.user_id = ? AND ${input.dedupeKey ? "n.dedupe_key = ?" : "n.id = ?"} LIMIT 1`,
        [input.userId, input.dedupeKey ?? notificationId]
      );
      return rows[0] ? mapNotification(rows[0]) : null;
    },

    async listForUser(userId: string, limit = 20) {
      const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
      const [rows] = await pool.execute<NotificationRow[]>(
        `${notificationSelect} WHERE n.user_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT ${safeLimit}`,
        [userId]
      );
      return rows.map(mapNotification);
    },

    async countUnreadForUser(userId: string) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = FALSE",
        [userId]
      );
      return Number(rows[0]?.total ?? 0);
    },

    async markRead(userId: string, notificationId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, UTC_TIMESTAMP())
       WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );
      return result.affectedRows > 0;
    },

    async markAllRead(userId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notifications SET is_read = TRUE, read_at = COALESCE(read_at, UTC_TIMESTAMP())
       WHERE user_id = ? AND is_read = FALSE`,
        [userId]
      );
      return result.affectedRows;
    }
  } satisfies NotificationRepository;

  return notificationRepository;

}
