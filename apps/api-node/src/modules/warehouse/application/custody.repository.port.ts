import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { CustodyReason, CustodyRequestStatus } from "../domain/warehouse-policy.js";

export interface CustodyRequestRecord {
  id: string;
  postId: string;
  postTitle?: string;
  finderId: string;
  finderName?: string;
  finderContact?: string;
  claimId: string | null;
  status: CustodyRequestStatus;
  reason: CustodyReason;
  reasonNotes: string | null;
  proposedHandoverPointId: string | null;
  proposedHandoverPointName?: string | null;
  proposedTime: string | null;
  confirmedHandoverPointId: string | null;
  confirmedHandoverPointName?: string | null;
  assignedHandlerId: string | null;
  assignedHandlerName?: string | null;
  warehouseItemId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustodyRequestLogRecord {
  id: string;
  custodyRequestId: string;
  actorId: string;
  actorName?: string;
  action: "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED" | "COMMENTED";
  fromStatus: string | null;
  toStatus: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CustodyRepository {
  createCustodyRequest(
    data: {
      id: string;
      postId: string;
      finderId: string;
      claimId?: string | null;
      status: CustodyRequestStatus;
      reason: CustodyReason;
      reasonNotes?: string | null;
      proposedHandoverPointId?: string | null;
      proposedTime?: Date | null;
      idempotencyKey?: string | null;
    },
    db?: TransactionContext
  ): Promise<void>;

  findCustodyRequestById(id: string, db?: TransactionContext): Promise<CustodyRequestRecord | null>;

  lockCustodyRequestById(id: string, db: TransactionContext): Promise<void>;

  findClaimPostId(claimId: string): Promise<string | null>;

  findClaimantId(claimId: string): Promise<string | null>;

  findActivePendingRequestByPost(postId: string, db?: TransactionContext): Promise<CustodyRequestRecord | null>;

  findByIdempotencyKey(finderId: string, idempotencyKey: string, db?: TransactionContext): Promise<CustodyRequestRecord | null>;

  listCustodyRequests(query: {
    status?: CustodyRequestStatus | "ALL";
    finderId?: string;
    postId?: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: CustodyRequestRecord[] }>;

  updateCustodyRequest(
    id: string,
    data: {
      status?: CustodyRequestStatus;
      confirmedHandoverPointId?: string | null;
      assignedHandlerId?: string | null;
      warehouseItemId?: string | null;
    },
    db?: TransactionContext
  ): Promise<void>;

  createCustodyLog(
    data: {
      id: string;
      custodyRequestId: string;
      actorId: string;
      action: "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED" | "COMMENTED";
      fromStatus?: string | null;
      toStatus?: string | null;
      notes?: string | null;
    },
    db?: TransactionContext
  ): Promise<void>;

  listCustodyLogs(custodyRequestId: string): Promise<CustodyRequestLogRecord[]>;

  findPostDetailsForIntake(postId: string, db?: TransactionContext): Promise<{
    id: string;
    userId: string;
    title: string;
    description: string;
    categoryId: string | null;
    areaId: string | null;
    buildingId: string | null;
    roomText: string | null;
    handoverPointId: string | null;
    contactInfo: string | null;
    status: string;
    type: string;
  } | null>;

  updatePostStatus(postId: string, status: string, db?: TransactionContext): Promise<boolean>;

  findStaffAndAdminUserIds(): Promise<string[]>;
}
