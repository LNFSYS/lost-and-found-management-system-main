export type { CustodyRequestStatus, CustodyIntakeType } from "../domain/custody-request-policy.js";
import type { IntakeEvidenceInput, IntakeReconciliationInput } from "./intake-evidence.dto.js";

export type CreateCustodyRequestInput = {
  claimId?: string | null | undefined;
  roomId?: string | null | undefined;
  postId?: string | null | undefined;
  reason?: string | null | undefined;
  handoverPointId?: string | null | undefined;
  intakeType?: "CUSTODY_TRANSFER" | "WALK_IN" | undefined;
  idempotencyKey?: string | undefined;
};

export type AcceptCustodyRequestInput = {
  handoverPointId: string;
  confirmedHandoverAt?: Date | null | undefined;
  reason?: string | null | undefined;
};

export type RejectCustodyRequestInput = {
  reason: string;
};

export type CancelCustodyRequestInput = {
  reason?: string | null | undefined;
};

export type IntakeCustodyRequestInput = IntakeEvidenceInput & IntakeReconciliationInput & {
  conditionNotes: string;
  storageCode?: string | null | undefined;
  confirmedHandoverAt?: Date | null | undefined;
};

export type ListCustodyRequestsQuery = {
  status?: "AWAITING_INTAKE" | "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED" | undefined;
  page: number;
  pageSize: number;
};
