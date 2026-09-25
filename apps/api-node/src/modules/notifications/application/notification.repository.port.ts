import type { TransactionContext } from "../../../shared/application/transaction.js";
export type NotificationType =
  | "CLAIM_REQUEST_RECEIVED"
  | "CLAIM_ACCEPTED"
  | "CLAIM_MORE_INFO_REQUESTED"
  | "CLAIM_REJECTED"
  | "CLAIM_WITHDRAWN"
  | "CHAT_MESSAGE_RECEIVED"
  | "APPOINTMENT_UPDATED"
  | "RETURN_UPDATED"
  | "CUSTODY_REQUESTED"
  | "CUSTODY_ACCEPTED"
  | "CUSTODY_REJECTED"
  | "CUSTODY_INTAKED"
  | "RETENTION_OVERDUE_ALERT"
  | "LEGAL_HOLD_APPLIED"
  | "DISPOSITION_ORDER_APPROVED"
  | "DISPOSITION_COMPLETED";

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationRepository {
  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    dedupeKey?: string | null;
  }, queryable?: TransactionContext): Promise<NotificationRecord | null>;
  listForUser(userId: string, limit?: number): Promise<NotificationRecord[]>;
  countUnreadForUser(userId: string): Promise<number>;
  markRead(userId: string, notificationId: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
}
