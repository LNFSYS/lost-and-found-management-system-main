import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { createHash } from "node:crypto";
import { id } from "../../../shared/infrastructure/security.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type {
  LeasedNotificationEmail, LeasedNotificationPush, NotificationEmailOutboxItem, NotificationEmailPreferences, NotificationEmailRepository,
  NotificationPushSubscriptionInput
} from "../application/notification-email.repository.port.js";
import { normalizeChannelPreferences } from "../application/notification-channels.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface PreferenceRow extends RowDataPacket {
  user_id: string;
  chat_mode: NotificationEmailPreferences["chatMode"];
  claim_mode: NotificationEmailPreferences["claimMode"];
  channel_preferences: unknown;
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

interface PushOutboxRow extends RowDataPacket {
  id: string;
  notification_id: string;
  recipient_user_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  attempt_count: number;
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
    categories: normalizeChannelPreferences(row.channel_preferences, row.chat_mode, row.claim_mode),
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
        `SELECT user_id, chat_mode, claim_mode, channel_preferences, TIME_FORMAT(quiet_hours_start, '%H:%i') AS quiet_hours_start,
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
          (user_id, chat_mode, claim_mode, channel_preferences, quiet_hours_start, quiet_hours_end, timezone)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE chat_mode = VALUES(chat_mode), claim_mode = VALUES(claim_mode),
           channel_preferences = VALUES(channel_preferences), quiet_hours_start = VALUES(quiet_hours_start),
           quiet_hours_end = VALUES(quiet_hours_end), timezone = VALUES(timezone)`,
        [userId, input.chatMode, input.claimMode, JSON.stringify(input.categories ?? normalizeChannelPreferences(null, input.chatMode, input.claimMode)),
          input.quietHoursStart, input.quietHoursEnd, input.timezone]
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

    async enqueuePush(input: { notificationId: string; recipientUserId: string; roomId?: string | null; }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO notification_push_outbox (id, notification_id, recipient_user_id, subscription_id, room_id)
         SELECT UUID(), ?, ?, s.id, ? FROM notification_push_subscriptions s WHERE s.user_id = ?
         ON DUPLICATE KEY UPDATE id = id`,
        [input.notificationId, input.recipientUserId, input.roomId ?? null, input.recipientUserId]
      );
    },

    async getPushSubscriptions(userId: string) {
      const [rows] = await pool.execute<PushOutboxRow[]>(
        `SELECT id AS subscription_id, endpoint, p256dh_key, auth_key FROM notification_push_subscriptions WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );
      return rows.map((row) => ({ endpoint: row.endpoint, p256dh: row.p256dh_key, auth: row.auth_key }));
    },

    async savePushSubscription(input: NotificationPushSubscriptionInput) {
      const endpointHash = createHash("sha256").update(input.endpoint).digest("hex");
      await pool.execute(
        `INSERT INTO notification_push_subscriptions (id, user_id, endpoint_hash, endpoint, p256dh_key, auth_key)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), endpoint = VALUES(endpoint),
           p256dh_key = VALUES(p256dh_key), auth_key = VALUES(auth_key)`,
        [id(), input.userId, endpointHash, input.endpoint, input.p256dh, input.auth]
      );
    },

    async deletePushSubscription(userId: string, endpoint: string) {
      const endpointHash = createHash("sha256").update(endpoint).digest("hex");
      await pool.execute("DELETE FROM notification_push_subscriptions WHERE user_id = ? AND endpoint_hash = ?", [userId, endpointHash]);
    },

    async claimPushDue(input: { limit: number; leaseToken: string; leaseSeconds: number; }) {
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(input.limit)));
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(),
          last_error_code = 'PUSH_LEASE_EXPIRED_UNCERTAIN', lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND (lease_expires_at IS NULL OR lease_expires_at <= UTC_TIMESTAMP())`
      );
      const [candidates] = await pool.execute<PushOutboxRow[]>(
        `SELECT id FROM notification_push_outbox WHERE status = 'PENDING' AND due_at <= UTC_TIMESTAMP()
         ORDER BY due_at ASC, created_at ASC LIMIT ${safeLimit}`
      );
      const claimedIds: string[] = [];
      for (const candidate of candidates) {
        const [result] = await pool.execute<ResultSetHeader>(
          `UPDATE notification_push_outbox SET status = 'PROCESSING', lease_token = ?,
            lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = attempt_count + 1
           WHERE id = ? AND status = 'PENDING' AND due_at <= UTC_TIMESTAMP()`,
          [input.leaseToken, input.leaseSeconds, candidate.id]
        );
        if (result.affectedRows) claimedIds.push(candidate.id);
      }
      if (!claimedIds.length) return [] as LeasedNotificationPush[];
      const [rows] = await pool.execute<PushOutboxRow[]>(
        `SELECT o.id, o.notification_id, o.recipient_user_id, o.subscription_id, s.endpoint, s.p256dh_key, s.auth_key,
          o.attempt_count
         FROM notification_push_outbox o
         JOIN notification_push_subscriptions s ON s.id = o.subscription_id AND s.user_id = o.recipient_user_id
         JOIN notifications n ON n.id = o.notification_id AND n.user_id = o.recipient_user_id AND n.is_read = FALSE
         LEFT JOIN notification_email_preferences p ON p.user_id = o.recipient_user_id
         WHERE o.status = 'PROCESSING' AND o.lease_token = ? AND o.lease_expires_at > UTC_TIMESTAMP()
           AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(p.channel_preferences, CONCAT('$.', CASE
             WHEN n.type = 'CHAT_MESSAGE_RECEIVED' THEN 'CHAT'
             WHEN n.type = 'MATCH_FOUND' THEN 'MATCH'
             WHEN n.type = 'APPOINTMENT_HANDOVER_UPDATED' OR n.type LIKE 'RETURN_%' THEN 'HANDOVER'
             WHEN n.type LIKE 'APPOINTMENT_%' THEN 'APPOINTMENT'
             WHEN n.type LIKE 'CUSTODY_%' THEN 'CUSTODY'
             WHEN n.type LIKE 'WAREHOUSE_%' THEN 'OVERDUE'
             WHEN n.type = 'FEEDBACK_RECEIVED' THEN 'FEEDBACK'
             ELSE 'CLAIM' END, '.pushEnabled'))), 'false') = 'true'`,
        [input.leaseToken]
      );
      const leased = rows.map((row) => ({ id: row.id, notificationId: row.notification_id, recipientUserId: row.recipient_user_id,
        subscriptionId: row.subscription_id, endpoint: row.endpoint, p256dh: row.p256dh_key, auth: row.auth_key,
        attemptCount: Number(row.attempt_count) }));
      const leasedIds = new Set(leased.map((item) => item.id));
      const staleIds = claimedIds.filter((claimedId) => !leasedIds.has(claimedId));
      for (const staleId of staleIds) await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), lease_token = NULL, lease_expires_at = NULL
         WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?`, [staleId, input.leaseToken]
      );
      return leased;
    },

    async markPushSent(leaseToken: string, outboxId: string) {
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'SENT', sent_at = UTC_TIMESTAMP(), lease_token = NULL, lease_expires_at = NULL
         WHERE id = ? AND status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [outboxId, leaseToken]
      );
    },

    async releasePushForRetry(input: { leaseToken: string; outboxId: string; dueAt: Date; errorCode: string; }) {
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'PENDING', due_at = ?, last_error_code = ?, lease_token = NULL, lease_expires_at = NULL
         WHERE id = ? AND status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [input.dueAt, input.errorCode, input.outboxId, input.leaseToken]
      );
    },

    async cancelPushLease(leaseToken: string, outboxId: string, errorCode?: string) {
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          last_error_code = COALESCE(?, last_error_code), lease_token = NULL, lease_expires_at = NULL
         WHERE id = ? AND status = 'PROCESSING' AND lease_token = ?`,
        [errorCode ?? null, outboxId, leaseToken]
      );
    },

    async cancelPendingPush(userId: string, notificationId: string) {
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL WHERE recipient_user_id = ? AND notification_id = ? AND status = 'PENDING'`,
        [userId, notificationId]
      );
    },

    async cancelForNotification(userId: string, notificationId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND notification_id = ? AND status IN ('PENDING', 'PROCESSING')`,
        [userId, notificationId]
      );
      await notificationEmailRepository.cancelPendingPush(userId, notificationId);
      return result.affectedRows;
    },

    async cancelForRoom(userId: string, roomId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND room_id = ? AND event_type = 'CHAT' AND status IN ('PENDING', 'PROCESSING')`,
        [userId, roomId]
      );
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL
         WHERE recipient_user_id = ? AND room_id = ? AND status = 'PENDING'`,
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
      await pool.execute(
        `UPDATE notification_push_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          lease_token = NULL, lease_expires_at = NULL WHERE recipient_user_id = ? AND status = 'PENDING'`, [userId]
      );
      return result.affectedRows;
    },

    async claimDue(input: { limit: number; leaseToken: string; leaseSeconds: number; }) {
      const safeLimit = Math.min(100, Math.max(1, Math.trunc(input.limit)));
      // SMTP may already have accepted an expired worker's message. Never reclaim
      // PROCESSING deliveries without a provider-side idempotency contract.
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(),
          last_error_code = 'SMTP_LEASE_EXPIRED_UNCERTAIN', lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND (lease_expires_at IS NULL OR lease_expires_at <= UTC_TIMESTAMP())`
      );
      const [candidates] = await pool.execute<OutboxRow[]>(
        `SELECT ${outboxColumns} FROM notification_email_outbox o
         WHERE o.status = 'PENDING' AND o.due_at <= UTC_TIMESTAMP()
         ORDER BY o.due_at ASC, o.created_at ASC LIMIT ${safeLimit}`
      );
      const claimed: NotificationEmailOutboxItem[] = [];
      for (const candidate of candidates) {
        const [result] = await pool.execute<ResultSetHeader>(
          `UPDATE notification_email_outbox SET status = 'PROCESSING', lease_token = ?,
            lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), attempt_count = attempt_count + 1
           WHERE id = ? AND status = 'PENDING' AND due_at <= UTC_TIMESTAMP()`,
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
           WHERE recipient_user_id = ? AND event_type = ? AND delivery_mode = 'DIGEST'
             AND status = 'PENDING' AND due_at <= UTC_TIMESTAMP()`,
          [input.leaseToken, input.leaseSeconds, item.recipientUserId, item.eventType]
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
          CASE WHEN o.event_type = 'MATCH' THEN o.entity_type = 'POST_MATCH' AND EXISTS (
              SELECT 1 FROM match_results mr
              JOIN posts lost_post ON lost_post.id = mr.lost_post_id
              JOIN posts found_post ON found_post.id = mr.found_post_id
              WHERE n.dedupe_key = CONCAT('matching:', mr.id, ':', o.recipient_user_id)
                AND mr.total_score >= 0.6 AND lost_post.user_id <> found_post.user_id
                AND lost_post.type = 'LOST' AND found_post.type = 'FOUND'
                AND lost_post.deleted_at IS NULL AND found_post.deleted_at IS NULL
                AND lost_post.status IN ('OPEN','MATCHED') AND found_post.status IN ('OPEN','MATCHED')
                AND ((lost_post.id = o.entity_id AND lost_post.user_id = o.recipient_user_id)
                  OR (found_post.id = o.entity_id AND found_post.user_id = o.recipient_user_id))
                AND NOT EXISTS(SELECT 1 FROM match_suggestion_dismissals d WHERE d.match_id = mr.id
                  AND d.user_id = o.recipient_user_id AND d.source_post_id = o.entity_id))
            WHEN o.entity_type = 'CUSTODY_REQUEST' THEN EXISTS (
              SELECT 1 FROM custody_requests cr WHERE cr.id = o.entity_id AND (cr.requester_id = o.recipient_user_id
                OR EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id = o.recipient_user_id AND ur.role_code IN ('STAFF','ADMIN'))))
            WHEN o.entity_type IN ('APPOINTMENT','APPOINTMENT_REMINDER') THEN EXISTS (
              SELECT 1 FROM return_appointments a JOIN claim_participants cp ON cp.claim_id=a.claim_id
              WHERE a.id=o.entity_id AND cp.user_id=o.recipient_user_id AND cp.consent_status='ACCEPTED'
                AND (o.entity_type='APPOINTMENT' OR (a.status='ACCEPTED' AND a.proposed_at>UTC_TIMESTAMP()
                  AND a.custody_authorized_at IS NULL
                  AND NOT EXISTS(SELECT 1 FROM custody_requests cr WHERE cr.claim_id=a.claim_id AND cr.status IN ('PENDING','ACCEPTED','INTAKED')))))
            WHEN o.entity_type <> 'CLAIM' THEN TRUE
            WHEN EXISTS (SELECT 1 FROM claim_participants cp WHERE cp.claim_id = o.entity_id AND cp.user_id = o.recipient_user_id) THEN TRUE
            ELSE FALSE END AS entity_accessible
         FROM notification_email_outbox o
         INNER JOIN notifications n ON n.id = o.notification_id
         INNER JOIN users u ON u.id = o.recipient_user_id
         WHERE o.status = 'PROCESSING' AND o.lease_token = ? AND o.lease_expires_at > UTC_TIMESTAMP()`,
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

    async renewLease(leaseToken, leaseSeconds) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE notification_email_outbox SET lease_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND)
         WHERE status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [leaseSeconds, leaseToken]
      );
      return result.affectedRows > 0;
    },

    async markSent(leaseToken: string) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'SENT', sent_at = UTC_TIMESTAMP(), lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [leaseToken]
      );
    },

    async cancelLease(leaseToken: string, errorCode?: string) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'CANCELLED', cancelled_at = COALESCE(cancelled_at, UTC_TIMESTAMP()),
          last_error_code = COALESCE(?, last_error_code), lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND lease_token = ?`,
        [errorCode ?? null, leaseToken]
      );
    },

    async deferLease(leaseToken: string, dueAt: Date) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'PENDING', due_at = ?, lease_token = NULL, lease_expires_at = NULL
         WHERE status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [dueAt, leaseToken]
      );
    },

    async releaseLeaseForRetry(input: { leaseToken: string; dueAt: Date; errorCode: string; }) {
      await pool.execute(
        `UPDATE notification_email_outbox SET status = 'PENDING', due_at = ?, last_error_code = ?,
          lease_token = NULL, lease_expires_at = NULL WHERE status = 'PROCESSING' AND lease_token = ? AND lease_expires_at > UTC_TIMESTAMP()`,
        [input.dueAt, input.errorCode, input.leaseToken]
      );
    }
  } satisfies NotificationEmailRepository;

  return notificationEmailRepository;
}
