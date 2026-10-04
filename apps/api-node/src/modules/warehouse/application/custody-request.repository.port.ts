import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { CustodyIntakeType, CustodyRequestStatus } from "./custody-request.dto.js";

export interface CustodyRequest {
  id: string;
  claimId: string | null;
  roomId: string | null;
  postId: string | null;
  requester: { id: string; fullName: string | null };
  handler: { id: string; fullName: string | null } | null;
  status: CustodyRequestStatus;
  intakeType: CustodyIntakeType;
  reason: string | null;
  requestHash?: string | null;
  rejectionReason: string | null;
  handoverPoint: { id: string; name: string | null; address: string | null } | null;
  confirmedHandoverAt: string | null;
  warehouseItemId: string | null;
  createdAt: string;
  updatedAt: string;
  post: { id: string; title: string | null; thumbnailId?: string | null } | null;
}

export interface CustodyRequestLock {
  id: string;
  claimId: string | null;
  postId: string | null;
  requesterId: string;
  roomId: string | null;
  status: CustodyRequestStatus;
  intakeType: CustodyIntakeType;
  handoverPointId: string | null;
  warehouseItemId: string | null;
}

export interface CustodyRequestAuditEntry {
  id: string;
  custodyRequestId: string;
  actorId: string;
  actorName: string | null;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CustodyRequestRepository {
  listRequests(input: {
    status?: CustodyRequestStatus | "AWAITING_INTAKE";
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: CustodyRequest[] }>;

  findById(id: string, db?: TransactionContext): Promise<CustodyRequest | null>;

  lockForUpdate(id: string, connection: TransactionContext): Promise<CustodyRequestLock | null>;

  findByIdempotencyKey(key: string, actorId: string, db?: TransactionContext): Promise<CustodyRequest | null>;

  findPendingByClaimId(claimId: string, db?: TransactionContext): Promise<CustodyRequest | null>;

  findActiveByPostId(postId: string, requesterId: string, db?: TransactionContext): Promise<CustodyRequest | null>;

  lockEligiblePost(postId: string, actorId: string, db: TransactionContext): Promise<boolean>;
  validateClaimLink(postId: string, actorId: string, claimId: string, roomId: string | null, db: TransactionContext): Promise<boolean>;
  hasWarehouseItem(postId: string, db: TransactionContext): Promise<boolean>;
  isStaff(actorId: string, db?: TransactionContext): Promise<boolean>;
  clearEscalation(claimId: string, db: TransactionContext): Promise<void>;
  notificationRecipients(postId: string | null, claimId: string | null, requesterId: string, db: TransactionContext): Promise<string[]>;

  createRequest(input: {
    id: string;
    claimId?: string | null;
    roomId?: string | null;
    postId?: string | null;
    requesterId: string;
    intakeType: CustodyIntakeType;
    reason?: string | null;
    handoverPointId?: string | null;
    idempotencyKey?: string | null;
  }, db?: TransactionContext): Promise<void>;

  updateStatus(id: string, input: {
    status: CustodyRequestStatus;
    handlerId?: string | null;
    handoverPointId?: string | null;
    confirmedHandoverAt?: Date | null;
    rejectionReason?: string | null;
    warehouseItemId?: string | null;
  }, db?: TransactionContext): Promise<void>;

  writeAudit(input: {
    id: string;
    custodyRequestId: string;
    actorId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    metadata?: Record<string, unknown> | null;
  }, db?: TransactionContext): Promise<void>;

  listAudit(custodyRequestId: string): Promise<CustodyRequestAuditEntry[]>;

  countByStatus(): Promise<Record<CustodyRequestStatus, number>>;
}
