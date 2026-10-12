import type { TransactionContext } from "../../../shared/application/transaction.js";
export type NotificationType =
  | "MATCH_FOUND"
  | "CLAIM_REQUEST_RECEIVED"
  | "CLAIM_ACCEPTED"
  | "CLAIM_MORE_INFO_REQUESTED"
  | "CLAIM_REJECTED"
  | "CLAIM_WITHDRAWN"
  | "CLAIM_ESCALATED"
  | "CUSTODY_REQUEST_CREATED"
  | "CUSTODY_ACCEPTED"
  | "CUSTODY_REJECTED"
  | "CUSTODY_CANCELLED"
  | "CUSTODY_INTAKED"
  | "CUSTODY_RETURNED"
  | "CUSTODY_VERIFIED"
  | "CUSTODY_RESERVED"
  | "CUSTODY_RESERVATION_RELEASED"
  | "CUSTODY_MOVED"
  | "CUSTODY_STATUS_CHANGED"
  | "CUSTODY_LEGAL_HOLD"
  | "CUSTODY_DISPOSITION_REQUESTED"
  | "CUSTODY_DISPOSITION_APPROVED"
  | "CUSTODY_DISPOSITION_COMPLETED"
  | "CUSTODY_UPDATED"
  | "CUSTODY_OVERDUE"
  | "WAREHOUSE_OVERDUE"
  | "WAREHOUSE_DUE_SOON"
  | "CHAT_MESSAGE_RECEIVED"
  | "APPOINTMENT_PROPOSED"
  | "APPOINTMENT_ACCEPTED"
  | "APPOINTMENT_REJECTED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_REMINDER"
  | "APPOINTMENT_NO_SHOW"
  | "APPOINTMENT_HANDOVER_UPDATED"
  | "RETURN_COMPLETED"
  | "APPOINTMENT_UPDATED"
  | "RETURN_UPDATED";

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
