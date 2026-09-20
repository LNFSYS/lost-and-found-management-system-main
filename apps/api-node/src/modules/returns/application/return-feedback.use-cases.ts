import type { TransactionRunner } from "../../../shared/application/transaction.js";
import { AppError } from "../../../shared/domain/app-error.js";
import type { AccessTokenPayload, ActivitySummary } from "../../../shared/domain/auth.js";
import type { AdminAuditRepository } from "../../admin/application/index.js";
import type { ReturnFeedbackInput } from "./return-feedback.dto.js";
import type { ReturnAppointmentForFeedback, ReturnFeedbackRecord, ReturnFeedbackRepository } from "./return-feedback.repository.port.js";

export interface ReturnFeedbackEligibility {
  appointmentId: string;
  eligible: boolean;
  reason: string | null;
  returnStatus: ReturnAppointmentForFeedback["status"];
  completedAt: string | null;
  dualConfirmed: boolean;
  custodyAuthorized: boolean;
  currentUserFeedback: ReturnFeedbackRecord | null;
  feedbackCount: number;
  participants: {
    claimant: { id: string; fullName: string; };
    finder: { id: string; fullName: string; };
  };
}

function isAdmin(viewer: AccessTokenPayload) {
  return viewer.roles.includes("ADMIN");
}

function isParticipant(appointment: ReturnAppointmentForFeedback, userId: string) {
  return appointment.claimantId === userId || appointment.finderId === userId;
}

function targetUserId(appointment: ReturnAppointmentForFeedback, reviewerId: string) {
  if (reviewerId === appointment.claimantId) return appointment.finderId;
  if (reviewerId === appointment.finderId) return appointment.claimantId;
  return null;
}

function returnEligibilityReason(appointment: ReturnAppointmentForFeedback) {
  if (appointment.status !== "COMPLETED") return "Return chua hoan tat nen chua the gui feedback";
  if (!appointment.completedAt) return "Return chua co thoi diem hoan tat hop le";
  const dualConfirmed = Boolean(appointment.finderConfirmedAt && appointment.ownerConfirmedAt);
  const custodyAuthorized = Boolean(appointment.custodyAuthorizedAt);
  if (!dualConfirmed && !custodyAuthorized) return "Can dual confirmation tu hai ben hoac custody outcome duoc uy quyen";
  return null;
}

function pointsForRating(rating: number) {
  if (rating >= 5) return 6;
  if (rating === 4) return 4;
  if (rating === 3) return 1;
  if (rating === 2) return -1;
  return -3;
}

function levelForPoints(points: number): ActivitySummary["reputation"]["level"] {
  if (points >= 60) return "EXCELLENT";
  if (points >= 25) return "RELIABLE";
  if (points >= 8) return "TRUSTED";
  return "NEW";
}

function responseFeedback(feedback: ReturnFeedbackRecord) {
  return {
    id: feedback.id,
    appointmentId: feedback.appointmentId,
    reviewer: { id: feedback.reviewerId, fullName: feedback.reviewerName },
    target: { id: feedback.targetUserId, fullName: feedback.targetName },
    rating: feedback.rating,
    comment: feedback.comment,
    isNegative: feedback.isNegative,
    status: feedback.status,
    createdAt: feedback.createdAt
  };
}

export interface ReturnFeedbackDependencies {
  repository: ReturnFeedbackRepository;
  adminAuditRepository: AdminAuditRepository;
  runInTransaction: TransactionRunner;
  id: () => string;
}
export function createReturnFeedbackUseCases(options: ReturnFeedbackDependencies) {
  const { repository, adminAuditRepository, runInTransaction, id } = options;

  const returnFeedbackService = {
    async getEligibility(appointmentId: string, viewer: AccessTokenPayload): Promise<ReturnFeedbackEligibility> {
      const appointment = await repository.findAppointmentForFeedback(appointmentId);
      if (!appointment) throw new AppError("not_found", "Khong tim thay return appointment");
      const participant = isParticipant(appointment, viewer.sub);
      if (!participant && !isAdmin(viewer)) throw new AppError("forbidden", "Ban khong co quyen xem feedback cua return nay");
      if (!participant && isAdmin(viewer)) {
        await adminAuditRepository.record({
          id: id(),
          actorId: viewer.sub,
          action: "READ_RETURN_FEEDBACK_ELIGIBILITY",
          targetType: "RETURN_APPOINTMENT",
          targetId: appointment.id,
          beforeState: null,
          afterState: null,
          reason: "Admin read-only return feedback access"
        });
      }

      const [feedbackList, currentUserFeedback] = await Promise.all([
        repository.listFeedbackForAppointment(appointmentId),
        participant ? repository.findFeedbackByReviewer(appointmentId, viewer.sub) : Promise.resolve(null)
      ]);
      const reason = returnEligibilityReason(appointment);
      return {
        appointmentId,
        eligible: participant && !reason && !currentUserFeedback,
        reason: currentUserFeedback ? "Ban da gui feedback cho return nay" : reason,
        returnStatus: appointment.status,
        completedAt: appointment.completedAt,
        dualConfirmed: Boolean(appointment.finderConfirmedAt && appointment.ownerConfirmedAt),
        custodyAuthorized: Boolean(appointment.custodyAuthorizedAt),
        currentUserFeedback,
        feedbackCount: feedbackList.length,
        participants: {
          claimant: { id: appointment.claimantId, fullName: appointment.claimantName },
          finder: { id: appointment.finderId, fullName: appointment.finderName }
        }
      };
    },

    async submitFeedback(appointmentId: string, input: ReturnFeedbackInput, viewer: AccessTokenPayload) {
      const idempotencyKey = input.idempotencyKey ?? null;
      return runInTransaction(async (connection) => {
        // Lock before any consistent read so a concurrent retry sees the committed feedback.
        const appointment = await repository.findAppointmentForFeedback(appointmentId, connection, true);
        if (!appointment) throw new AppError("not_found", "Khong tim thay return appointment");
        if (!isParticipant(appointment, viewer.sub)) throw new AppError("forbidden", "Chi participant cua return moi duoc gui feedback");
        if (idempotencyKey) {
          const existing = await repository.findFeedbackByIdempotency(appointmentId, viewer.sub, idempotencyKey, connection);
          if (existing) return { feedback: responseFeedback(existing), reputationEventCreated: false, idempotent: true };
        }

        const reason = returnEligibilityReason(appointment);
        if (reason) throw new AppError("conflict", reason);

        const targetId = targetUserId(appointment, viewer.sub);
        if (!targetId || targetId === viewer.sub) throw new AppError("conflict", "Khong the tu cong diem uy tin cho chinh minh");
        const duplicate = await repository.findFeedbackByReviewer(appointmentId, viewer.sub, connection);
        if (duplicate) throw new AppError("conflict", "Ban da gui feedback cho return nay");

        const feedbackId = id();
        const delta = pointsForRating(input.rating);
        await repository.createFeedback({
          id: feedbackId,
          appointmentId: appointment.id,
          claimId: appointment.claimId,
          postId: appointment.postId,
          reviewerId: viewer.sub,
          targetUserId: targetId,
          idempotencyKey,
          rating: input.rating,
          comment: input.comment,
          isNegative: input.rating <= 2
        }, connection);

        const currentScore = await repository.getReputationForUpdate(targetId, connection);
        const nextPoints = currentScore.totalPoints + delta;
        await repository.upsertReputationScore({ id: id(), userId: targetId, totalPoints: nextPoints, level: levelForPoints(nextPoints) }, connection);
        await repository.createReputationLog({
          id: id(),
          userId: targetId,
          delta,
          reason: `RETURN_FEEDBACK_RATING_${input.rating}`,
          entityType: "RETURN_FEEDBACK",
          entityId: feedbackId
        }, connection);

        const created = await repository.findFeedbackById(feedbackId, connection);
        if (!created) throw new AppError("internal", "Khong the doc lai feedback vua tao");
        return { feedback: responseFeedback(created), reputationEventCreated: true, idempotent: false };
      });
    }
  };
  return returnFeedbackService;
}

export type ReturnFeedbackUseCases = ReturnType<typeof createReturnFeedbackUseCases>;
