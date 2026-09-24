import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type {
  LeasedNotificationEmail, NotificationEmailOutboxItem, NotificationEmailPreferences, NotificationEmailRepository
} from "../application/notification-email.repository.port.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface PreferenceRow extends RowDataPacket {
  user_id: string;
  chat_mode: NotificationEmailPreferences["chatMode"];
  claim_mode: NotificationEmailPreferences["claimMode"];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
  updated_at: Date | string;
}

interface OutboxRow extends RowDataPacket {
  id: string;
  notification_id: string;
  recipient_user_id: string;
  event_type: NotificationEmailOutboxItem["eventType"];
  entity_type: string;
  entity_id: string | null;
  room_id: string | null;
  delivery_mode: NotificationEmailOutboxItem["deliveryMode"];
  idempotency_key: string;
  attempt_count: number;
  email?: string;
  email_verified?: number;
  account_active?: number;
  notification_unread?: number;
  entity_accessible?: number;
}

function asIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function time(value: string | null) {
  return value ? value.slice(0, 5) : null;
}

function mapPreference(row: PreferenceRow): NotificationEmailPreferences {
  return {
    userId: row.user_id,
    chatMode: row.chat_mode,
    claimMode: row.claim_mode,
    quietHoursStart: time(row.quiet_hours_start),
    quietHoursEnd: time(row.quiet_hours_end),
    timezone: row.timezone,
    updatedAt: asIso(row.updated_at)
  };
}

function mapOutbox(row: OutboxRow): NotificationEmailOutboxItem {
  return {
    id: row.id,
    notificationId: row.notification_id,
    recipientUserId: row.recipient_user_id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    roomId: row.room_id,
    deliveryMode: row.delivery_mode,
    idempotencyKey: row.idempotency_key,
    attemptCount: Number(row.attempt_count)
  };
}

const outboxColumns = `o.id, o.notification_id, o.recipient_user_id, o.event_type, o.entity_type,
  o.entity_id, o.room_id, o.delivery_mode, o.idempotency_key, o.attempt_count`;

export function createNotificationEmailRepository(pool: SqlExecutor) {
  const notificationEmailRepository = {
    async getPreferences(userId: string, queryable: Queryable = pool) {
      const executor = sqlExecutor(queryable);
      await executor.execute("INSERT IGNORE INTO notification_email_preferences (user_id) VALUES (?)", [userId]);
      const [rows] = await executor.execute<PreferenceRow[]>(
        `SELECT user_id, chat_mode, claim_mode, TIME_FORMAT(quiet_hours_start, '%H:%i') AS quiet_hours_start,
          TIME_FORMAT(quiet_hours_end, '%H:%i') AS quiet_hours_end, timezone, updated_at
         FROM notification_email_preferences WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      if (!rows[0]) throw new Error("Notification email preferences could not be initialized");
      return mapPreference(rows[0]);
    },

    async updatePreferences(userId: string, input: Omit<NotificationEmailPreferences, "userId" | "updatedAt">) {
      await pool.execute(
        `INSERT INTO notification_email_preferences
          (user_id, chat_mode, claim_mode, quiet_hours_start, quiet_hours_end, timezone)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE chat_mode = VALUES(chat_mode), claim_mode = VALUES(claim_mode),
           quiet_hours_start = VALUES(quiet_hours_start), quiet_hours_end = VALUES(quiet_hours_end), timezone = VALUES(timezone)`,
        [userId, input.chatMode, input.claimMode, input.quietHoursStart, input.quietHoursEnd, input.timezone]
      );
      return this.getPreferences(userId);
    },

    async enqueue(input: Omit<NotificationEmailOutboxItem, "attemptCount"> & { dueAt: Date; }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO notification_email_outbox
          (id, notification_id, recipient_user_id, event_type, entity_type, entity_id, room_id, delivery_mode, idempotency_key, due_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE id = id`,
        [input.id, input.notificationId, input.recipientUserId, input.eventType, input.entityType,
          input.entityId, input.roomId, input.deliveryMode, input.idempotencyKey, input.dueAt]
      );
    },

    async cancelForNotification(userId: string, notificationId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND notification_id = ? AND status IN ('PENDING', 'PROCESSING')`,
        [userId, notificationId]
      );
      return result.affectedRows;
    },

    async cancelForRoom(userId: string, roomId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND room_id = ? AND event_type = 'CHAT' AND status IN ('PENDING', 'PROCESSING')`,
        [userId, roomId]
      );
      return result.affectedRows;
    },

    async cancelForUser(userId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND status IN ('PENDING', 'PROCESSING')`,
        [userId]
      );
      return result.affectedRows;
    },

    async claimDue(input: { limit: number; leaseToken: string; leaseSeconds: number; }) {
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(input.limit)));
      const [candidates] = await pool.execute<OutboxRow[]>(
        `SELECT ${outboxColumns} FROM notification_email_outbox o
         WHERE (o.status = 'PENDING' AND o.due_at <= UTC_TIMESTAMP())
            OR (o.status = 'PROCESSING' AND o.lease_expires_at < UTC_TIMESTAMP())
         ORDER BY o.due_at ASC, o.created_at ASC LIMIT ${safeLimit}`
      );
      const claimed: NotificationEmailOutboxItem[] = [];
      for (const candidate of candidates) {
        const [result] = await pool.execute<ResultSetHeader>(
          `UPDATE notification_email_outbox SET status = 'PROCESSING', lease_token = ?,
            lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = attempt_count + 1
           WHERE id = ? AND ((status = 'PENDING' AND due_at <= UTC_TIMESTAMP())
             OR (status = 'PROCESSING' AND lease_expires_at < UTC_TIMESTAMP()))`,
          [input.leaseToken, input.leaseSeconds, candidate.id]
        );
        if (result.affectedRows) claimed.push({ ...mapOutbox(candidate), attemptCount: Number(candidate.attempt_count) + 1 });
      }
      return claimed;
    },

    async claimCoalesced(input: { item: NotificationEmailOutboxItem; leaseToken: string; leaseSeconds: number; }) {
      const { item } = input;
      if (item.deliveryMode === "DIGEST") {
        await pool.execute(
          `UPDATE notification_email_outbox SET status = 'PROCESSING', lease_token = ?,
            lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = attempt_count + 1
           WHERE recipient_user_id = ? AND delivery_mode = 'DIGEST' AND status = 'PENDING' AND due_at <= UTC_TIMESTAMP()`,
          [input.leaseToken, input.leaseSeconds, item.recipientUserId]
        );
      } else if (item.eventType === "CHAT" && item.roomId) {
        await pool.execute(
          `UPDATE notification_email_outbox SET status = 'PROCESSING', lease_token = ?,
            lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = attempt_count + 1
           WHERE recipient_user_id = ? AND event_type = 'CHAT' AND room_id = ? AND delivery_mode = ?
             AND status = 'PENDING' AND due_at <= UTC_TIMESTAMP()`,
          [input.leaseToken, input.leaseSeconds, item.recipientUserId, item.roomId, item.deliveryMode]
        );
      }
    },

    async listLease(leaseToken: string) {
      const [rows] = await pool.execute<OutboxRow[]>(
        `SELECT ${outboxColumns}, u.email, (u.email_verified_at IS NOT NULL) AS email_verified,
          (u.status = 'ACTIVE') AS account_active, (n.is_read = FALSE) AS notification_unread,
          CASE WHEN o.entity_type <> 'CLAIM' THEN TRUE
            WHEN EXISTS (SELECT 1 FROM claim_participants cp WHERE cp.claim_id = o.entity_id AND cp.user_id = o.recipient_user_id) THEN TRUE
            ELSE FALSE END AS entity_accessible
         FROM notification_email_outbox o
         INNER JOIN notifications n ON n.id = o.notification_id
         INNER JOIN users u ON u.id = o.recipient_user_id
         WHERE o.status = 'PROCESSING' AND o.lease_token = ?`,
        [leaseToken]
      );
      return rows.map((row) => ({
        ...mapOutbox(row),
        email: row.email!,
        emailVerified: Boolean(row.email_verified),
        accountActive: Boolean(row.account_active),
        notificationUnread: Boolean(row.notification_unread),
        entityAccessible: Boolean(row.entity_accessible)
      }));
    },

    async markSent(leaseToken: string) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'SENT', sent_at = UTC_TIMESTAMP(), lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND lease_token = ?`,
        [leaseToken]
      );
    },

    async cancelLease(leaseToken: string) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL WHERE status = 'PROCESSING' AND lease_token = ?`,
        [leaseToken]
      );
    },

    async deferLease(leaseToken: string, dueAt: Date) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'PENDING', due_at = ?, lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND lease_token = ?`,
        [dueAt, leaseToken]
      );
    },

    async releaseLeaseForRetry(input: { leaseToken: string; dueAt: Date; errorCode: string; }) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'PENDING', due_at = ?, last_error_code = ?,
          lease_token = NULL, lease_expires_at = NULL WHERE status = 'PROCESSING' AND lease_token = ?`,
        [input.dueAt, input.errorCode, input.leaseToken]
      );
    }
  } satisfies NotificationEmailRepository;

  return notificationEmailRepository;
}
