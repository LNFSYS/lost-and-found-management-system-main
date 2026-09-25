import type { CustodyReason, CustodyRequestStatus } from "../domain/warehouse-policy.js";

export interface CreateCustodyRequestInput {
  postId: string;
  claimId?: string | null;
  reason: CustodyReason;
  reasonNotes?: string | null;
  proposedHandoverPointId?: string | null;
  proposedTime?: Date | null;
  idempotencyKey?: string | null;
}

export interface ListCustodyRequestsQuery {
  status?: CustodyRequestStatus | "ALL";
  finderId?: string;
  postId?: string;
  page: number;
  pageSize: number;
}

export interface AcceptCustodyRequestInput {
  confirmedHandoverPointId: string;
  assignedHandlerId?: string | null;
  notes?: string | null;
}

export interface RejectCustodyRequestInput {
  reason: string;
}

export interface CancelCustodyRequestInput {
  reason: string;
}

export interface ConfirmStaffIntakeInput {
  conditionNotes: string;
  storageCode?: string | null;
  handoverPointId?: string | null;
  areaId?: string | null;
  buildingId?: string | null;
  roomText?: string | null;
  receivedAt?: Date;
  idempotencyKey?: string | null;
}
