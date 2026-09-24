import type { TransactionContext } from "../../../shared/application/transaction.js";

export type NotificationEmailMode = "IMMEDIATE" | "DELAYED_UNREAD" | "DIGEST" | "DISABLED";
export type EmailOutboxMode = Exclude<NotificationEmailMode, "DISABLED">;
export type NotificationEmailEvent = "CHAT" | "CLAIM" | "APPOINTMENT" | "HANDOVER" | "CUSTODY" | "OVERDUE" | "FEEDBACK";

export interface NotificationEmailPreferences {
  userId: string;
  chatMode: NotificationEmailMode;
  claimMode: NotificationEmailMode;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  updatedAt: string;
}

export interface NotificationEmailOutboxItem {
  id: string;
  notificationId: string;
  recipientUserId: string;
  eventType: NotificationEmailEvent;
  entityType: string;
  entityId: string | null;
  roomId: string | null;
  deliveryMode: EmailOutboxMode;
  idempotencyKey: string;
  attemptCount: number;
}

export interface LeasedNotificationEmail extends NotificationEmailOutboxItem {
  email: string;
  emailVerified: boolean;
  accountActive: boolean;
  notificationUnread: boolean;
  entityAccessible: boolean;
}

export interface NotificationEmailRepository {
  getPreferences(userId: string, queryable?: TransactionContext): Promise<NotificationEmailPreferences>;
  updatePreferences(userId: string, input: Omit<NotificationEmailPreferences, "userId" | "updatedAt">): Promise<NotificationEmailPreferences>;
  enqueue(input: Omit<NotificationEmailOutboxItem, "attemptCount"> & { dueAt: Date; }, queryable: TransactionContext): Promise<void>;
  cancelForNotification(userId: string, notificationId: string): Promise<number>;
  cancelForRoom(userId: string, roomId: string): Promise<number>;
  cancelForUser(userId: string): Promise<number>;
  claimDue(input: { limit: number; leaseToken: string; leaseSeconds: number; }): Promise<NotificationEmailOutboxItem[]>;
  claimCoalesced(input: { item: NotificationEmailOutboxItem; leaseToken: string; leaseSeconds: number; }): Promise<void>;
  listLease(leaseToken: string): Promise<LeasedNotificationEmail[]>;
  markSent(leaseToken: string): Promise<void>;
  cancelLease(leaseToken: string): Promise<void>;
  deferLease(leaseToken: string, dueAt: Date): Promise<void>;
  releaseLeaseForRetry(input: { leaseToken: string; dueAt: Date; errorCode: string; }): Promise<void>;
}
