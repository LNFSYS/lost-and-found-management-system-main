import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { ActivitySummary } from "../../../shared/domain/auth.js";

export type ReturnFeedbackStatus = "NEW" | "REVIEWED" | "FLAGGED" | "DISMISSED";

export type AppointmentStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "RESCHEDULED";

export interface ReturnAppointmentForFeedback {
  id: string;
  claimId: string;
  postId: string;
  status: AppointmentStatus;
  completedAt: string | null;
  finderConfirmedAt: string | null;
  ownerConfirmedAt: string | null;
  custodyAuthorizedAt: string | null;
  claimantId: string;
  claimantName: string;
  finderId: string;
  finderName: string;
  postTitle: string;
}

export interface ReturnFeedbackRecord {
  id: string;
  appointmentId: string;
  claimId: string;
  postId: string;
  reviewerId: string;
  reviewerName: string | null;
  targetUserId: string;
  targetName: string | null;
  idempotencyKey: string | null;
  rating: number;
  comment: string | null;
  isNegative: boolean;
  status: ReturnFeedbackStatus;
  createdAt: string;
}

export interface ReputationScoreRecord {
  userId: string;
  totalPoints: number;
  level: ActivitySummary["reputation"]["level"];
  updatedAt: string | null;
}

export interface ReturnFeedbackRepository {
  findAppointmentForFeedback(appointmentId: string, connection?: TransactionContext, forUpdate?: boolean): Promise<ReturnAppointmentForFeedback | null>;
  listFeedbackForAppointment(appointmentId: string, connection?: TransactionContext): Promise<ReturnFeedbackRecord[]>;
  findFeedbackByReviewer(appointmentId: string, reviewerId: string, connection?: TransactionContext): Promise<ReturnFeedbackRecord | null>;
  findFeedbackByIdempotency(appointmentId: string, reviewerId: string, idempotencyKey: string, connection?: TransactionContext): Promise<ReturnFeedbackRecord | null>;
  createFeedback(input: {
    id: string;
    appointmentId: string;
    claimId: string;
    postId: string;
    reviewerId: string;
    targetUserId: string;
    idempotencyKey: string | null;
    rating: number;
    comment: string | null;
    isNegative: boolean;
  }, connection?: TransactionContext): Promise<void>;
  findFeedbackById(feedbackId: string, connection?: TransactionContext): Promise<ReturnFeedbackRecord | null>;
  getReputationForUpdate(userId: string, connection?: TransactionContext): Promise<ReputationScoreRecord>;
  upsertReputationScore(input: {
    id: string;
    userId: string;
    totalPoints: number;
    level: ReputationScoreRecord["level"];
  }, connection?: TransactionContext): Promise<void>;
  createReputationLog(input: {
    id: string;
    userId: string;
    delta: number;
    reason: string;
    entityType: string;
    entityId: string;
  }, connection?: TransactionContext): Promise<void>;
}
