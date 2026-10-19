import type { TransactionContext } from "../../../shared/application/transaction.js";

export type NotificationEmailMode = "IMMEDIATE" | "DELAYED_UNREAD" | "DIGEST" | "DISABLED";
export type EmailOutboxMode = Exclude<NotificationEmailMode, "DISABLED">;
export type NotificationEmailEvent = "CHAT" | "CLAIM" | "MATCH" | "APPOINTMENT" | "HANDOVER" | "CUSTODY" | "OVERDUE" | "FEEDBACK";
export const notificationCategories = ["CHAT", "CLAIM", "MATCH", "APPOINTMENT", "HANDOVER", "CUSTODY", "OVERDUE", "FEEDBACK"] as const;
export type NotificationCategory = typeof notificationCategories[number];

export interface NotificationChannelPreference {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailMode: NotificationEmailMode;
}

export type NotificationChannelPreferences = Record<NotificationCategory, NotificationChannelPreference>;

export interface NotificationEmailPreferences {
  userId: string;
  chatMode: NotificationEmailMode;
  claimMode: NotificationEmailMode;
  categories?: NotificationChannelPreferences;
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
  renewLease(leaseToken: string, leaseSeconds: number): Promise<boolean>;
  markSent(leaseToken: string): Promise<void>;
  cancelLease(leaseToken: string, errorCode?: string): Promise<void>;
  deferLease(leaseToken: string, dueAt: Date): Promise<void>;
  releaseLeaseForRetry(input: { leaseToken: string; dueAt: Date; errorCode: string; }): Promise<void>;
  enqueuePush?(input: { notificationId: string; recipientUserId: string; roomId?: string | null; }, queryable: TransactionContext): Promise<void>;
  claimPushDue?(input: { limit: number; leaseToken: string; leaseSeconds: number; }): Promise<LeasedNotificationPush[]>;
  markPushSent?(leaseToken: string, outboxId: string): Promise<void>;
  releasePushForRetry?(input: { leaseToken: string; outboxId: string; dueAt: Date; errorCode: string; }): Promise<void>;
  cancelPushLease?(leaseToken: string, outboxId: string, errorCode?: string): Promise<void>;
  cancelPendingPush?(userId: string, notificationId: string): Promise<void>;
  getPushSubscriptions?(userId: string): Promise<NotificationPushSubscription[]>;
  savePushSubscription?(input: NotificationPushSubscriptionInput): Promise<void>;
  deletePushSubscription?(userId: string, endpoint: string): Promise<void>;
}

export interface NotificationPushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface NotificationPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface LeasedNotificationPush {
  id: string;
  notificationId: string;
  recipientUserId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  attemptCount: number;
}
