import type { AppointmentStatus, ReputationScoreRecord, ReturnAppointmentForFeedback, ReturnFeedbackRecord, ReturnFeedbackRepository, ReturnFeedbackStatus } from "../application/return-feedback.repository.port.js";

export type { AppointmentStatus, ReputationScoreRecord, ReturnAppointmentForFeedback, ReturnFeedbackRecord, ReturnFeedbackRepository, ReturnFeedbackStatus } from "../application/return-feedback.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { PoolConnection } from "mysql2/promise";

import type { RowDataPacket } from "mysql2";

import type { ActivitySummary } from "../../../shared/domain/auth.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface AppointmentRow extends RowDataPacket {
  id: string;
  claim_id: string;
  post_id: string;
  status: AppointmentStatus;
  completed_at: Date | string | null;
  finder_confirmed_at: Date | string | null;
  owner_confirmed_at: Date | string | null;
  custody_authorized_at: Date | string | null;
  claimant_id: string;
  claimant_name: string;
  finder_id: string;
  finder_name: string;
  post_title: string;
}

interface FeedbackRow extends RowDataPacket {
  id: string;
  appointment_id: string;
  claim_id: string;
  post_id: string;
  reviewer_id: string;
  reviewer_name: string | null;
  target_user_id: string;
  target_name: string | null;
  idempotency_key: string | null;
  rating: number;
  comment: string | null;
  is_negative: 0 | 1 | boolean;
  status: ReturnFeedbackStatus;
  created_at: Date | string;
}

interface ReputationRow extends RowDataPacket {
  total_points: number;
  level: ActivitySummary["reputation"]["level"];
  updated_at: Date | string | null;
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapAppointment(row: AppointmentRow): ReturnAppointmentForFeedback {
  return {
    id: row.id,
    claimId: row.claim_id,
    postId: row.post_id,
    status: row.status,
    completedAt: iso(row.completed_at),
    finderConfirmedAt: iso(row.finder_confirmed_at),
    ownerConfirmedAt: iso(row.owner_confirmed_at),
    custodyAuthorizedAt: iso(row.custody_authorized_at),
    claimantId: row.claimant_id,
    claimantName: row.claimant_name,
    finderId: row.finder_id,
    finderName: row.finder_name,
    postTitle: row.post_title
  };
}

function mapFeedback(row: FeedbackRow): ReturnFeedbackRecord {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    claimId: row.claim_id,
    postId: row.post_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    targetUserId: row.target_user_id,
    targetName: row.target_name,
    idempotencyKey: row.idempotency_key,
    rating: Number(row.rating),
    comment: row.comment,
    isNegative: Boolean(row.is_negative),
    status: row.status,
    createdAt: iso(row.created_at)!
  };
}

const feedbackSelect = `SELECT rf.id, rf.appointment_id, rf.claim_id, rf.post_id, rf.reviewer_id,
    reviewer.full_name AS reviewer_name, rf.target_user_id, target.full_name AS target_name,
    rf.idempotency_key, rf.rating, rf.comment, rf.is_negative, rf.status, rf.created_at
  FROM return_feedback rf
  LEFT JOIN users reviewer ON reviewer.id = rf.reviewer_id
  LEFT JOIN users target ON target.id = rf.target_user_id`;

export function createReturnFeedbackRepository(pool: SqlExecutor) {

  const returnFeedbackRepository = {
    async findAppointmentForFeedback(appointmentId: string, connection: Queryable = pool, forUpdate = false) {
      const [rows] = await sqlExecutor(connection).execute<AppointmentRow[]>(
        `SELECT ra.id, ra.claim_id, ra.post_id, ra.status, ra.completed_at,
              ra.finder_confirmed_at, ra.owner_confirmed_at, ra.custody_authorized_at,
              c.claimant_id, claimant.full_name AS claimant_name,
              p.user_id AS finder_id, finder.full_name AS finder_name,
              p.title AS post_title
       FROM return_appointments ra
       INNER JOIN claims c ON c.id = ra.claim_id
       INNER JOIN posts p ON p.id = ra.post_id
       INNER JOIN users claimant ON claimant.id = c.claimant_id
       INNER JOIN users finder ON finder.id = p.user_id
       WHERE ra.id = ?
       LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
        [appointmentId]
      );
      return rows[0] ? mapAppointment(rows[0]) : null;
    },

    async listFeedbackForAppointment(appointmentId: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<FeedbackRow[]>(`${feedbackSelect} WHERE rf.appointment_id = ? ORDER BY rf.created_at DESC`, [appointmentId]);
      return rows.map(mapFeedback);
    },

    async findFeedbackByReviewer(appointmentId: string, reviewerId: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<FeedbackRow[]>(`${feedbackSelect} WHERE rf.appointment_id = ? AND rf.reviewer_id = ? LIMIT 1`, [appointmentId, reviewerId]);
      return rows[0] ? mapFeedback(rows[0]) : null;
    },

    async findFeedbackByIdempotency(appointmentId: string, reviewerId: string, idempotencyKey: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<FeedbackRow[]>(`${feedbackSelect} WHERE rf.appointment_id = ? AND rf.reviewer_id = ? AND rf.idempotency_key = ? LIMIT 1`, [appointmentId, reviewerId, idempotencyKey]);
      return rows[0] ? mapFeedback(rows[0]) : null;
    },

    async createFeedback(input: {
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
    }, connection: Queryable = pool) {
      await sqlExecutor(connection).execute(
        `INSERT INTO return_feedback
       (id, appointment_id, claim_id, post_id, reviewer_id, target_user_id, idempotency_key, rating, comment, is_negative)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.id, input.appointmentId, input.claimId, input.postId, input.reviewerId, input.targetUserId, input.idempotencyKey, input.rating, input.comment, input.isNegative]
      );
    },

    async findFeedbackById(feedbackId: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<FeedbackRow[]>(`${feedbackSelect} WHERE rf.id = ? LIMIT 1`, [feedbackId]);
      return rows[0] ? mapFeedback(rows[0]) : null;
    },

    async getReputationForUpdate(userId: string, connection: Queryable = pool): Promise<ReputationScoreRecord> {
      const [rows] = await sqlExecutor(connection).execute<ReputationRow[]>(
        "SELECT total_points, level, updated_at FROM reputation_scores WHERE user_id = ? LIMIT 1 FOR UPDATE",
        [userId]
      );
      const row = rows[0];
      return {
        userId,
        totalPoints: Number(row?.total_points ?? 0),
        level: row?.level ?? "NEW",
        updatedAt: iso(row?.updated_at ?? null)
      };
    },

    async upsertReputationScore(input: { id: string; userId: string; totalPoints: number; level: ReputationScoreRecord["level"]; }, connection: Queryable = pool) {
      await sqlExecutor(connection).execute(
        `INSERT INTO reputation_scores (id, user_id, total_points, level)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE total_points = VALUES(total_points), level = VALUES(level)`,
        [input.id, input.userId, input.totalPoints, input.level]
      );
    },

    async createReputationLog(input: { id: string; userId: string; delta: number; reason: string; entityType: string; entityId: string; }, connection: Queryable = pool) {
      await sqlExecutor(connection).execute(
        `INSERT INTO reputation_logs (id, user_id, delta, reason, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [input.id, input.userId, input.delta, input.reason, input.entityType, input.entityId]
      );
    }
  } satisfies ReturnFeedbackRepository;

  return returnFeedbackRepository;

}
