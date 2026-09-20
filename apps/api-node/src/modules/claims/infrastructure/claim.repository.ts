import type { ClaimAuditEventRecord, ClaimRepository, ClaimStatus, ConsentStatus, FinderDecision, ParticipantRole } from "../application/claim.repository.port.js";

export type { ClaimRepository, ClaimStatus, ConsentStatus, FinderDecision, ParticipantRole } from "../application/claim.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { ResultSetHeader, RowDataPacket } from "mysql2";

import type { PoolConnection } from "mysql2/promise";

import { id } from "../../../shared/infrastructure/security.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface ClaimRow extends RowDataPacket {
  id: string;
  lost_post_id: string | null;
  found_post_id: string;
  claimant_id: string;
  finder_id: string;
  status: ClaimStatus;
  finder_decision: FinderDecision;
  description: string | null;
  approximate_lost_at: Date | string | null;
  approximate_location: string | null;
  rejection_reason: string | null;
  more_info_request: string | null;
  accepted_at: Date | string | null;
  rejected_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  claimant_name: string;
  claimant_email: string;
  finder_name: string;
  finder_email: string;
  lost_title: string | null;
  found_title: string;
  room_id: string | null;
}

interface ParticipantRow extends RowDataPacket {
  claim_id: string;
  user_id: string;
  participant_role: ParticipantRole;
  consent_status: ConsentStatus;
  joined_at: Date | string | null;
  full_name: string;
}

interface MessageRow extends RowDataPacket {
  id: string;
  room_id: string;
  sender_id: string;
  client_message_id: string | null;
  content: string | null;
  media_url: string | null;
  message_type: "TEXT" | "IMAGE" | "SYSTEM";
  is_read: number;
  read_at: Date | string | null;
  created_at: Date | string;
  sender_name: string;
}

interface EvidenceRow extends RowDataPacket {
  id: string;
  claim_id: string;
  uploaded_by: string;
  secure_url: string;
  public_id: string;
  media_format: string | null;
  media_bytes: number | null;
  evidence_type: "OWNERSHIP_PROOF" | "ADDITIONAL_DOC" | "PHOTO";
  description: string | null;
  created_at: Date | string;
  uploader_name: string;
}

interface RoomRow extends RowDataPacket {
  id: string;
  claim_id: string;
  escalated_at: Date | string | null;
  escalated_by: string | null;
  escalation_reason: string | null;
  created_at: Date | string;
}

interface VerificationContextRow extends RowDataPacket {
  found_post_id: string;
  category_name: string;
  parent_category_name: string | null;
}

interface ClaimItemContextRow extends RowDataPacket {
  found_post_id: string;
  title: string;
  category_name: string | null;
  visibility_mode: "PUBLIC" | "PRIVATE_DETAILS";
  area_name: string | null;
  building_name: string | null;
  room_text: string | null;
  custom_location: string | null;
  handover_point_name: string | null;
  media_id: string | null;
}

interface ConversationSummaryRow extends RowDataPacket {
  claim_id: string;
  last_message: string | null;
  last_message_at: Date | string | null;
  unread_count: number | string;
  custody_escalated: number;
}

interface VerificationQuestionRow extends RowDataPacket {
  id: string;
  claim_id: string;
  post_id: string;
  prompt: string;
  question_type: "TEXT" | "MASKED_SERIAL" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL";
  source_signal: string;
  expected_answer_hash: string;
  options_json: string | string[] | null;
  privacy_level: "PRIVATE" | "HIGHLY_PRIVATE";
  status: "DRAFT" | "APPROVED" | "DISABLED";
  assigned_at: Date | string;
  answered_by: string | null;
  is_match: number | null;
  attempt_count: number | null;
  last_attempt_at: Date | string | null;
  answered_at: Date | string | null;
}

interface ClaimAuditRow extends RowDataPacket {
  id: string;
  claim_id: string;
  actor_id: string;
  action: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus | null;
  metadata_json: string | Record<string, unknown> | null;
  created_at: Date | string;
}

interface MatchPairRow extends RowDataPacket {
  lost_post_id: string;
  found_post_id: string;
  claimant_id: string;
  finder_id: string;
  total_score: number;
  score_tier: string;
}

interface ClaimablePostRow extends RowDataPacket {
  id: string;
  owner_id: string;
  type: "LOST" | "FOUND";
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapClaim(row: ClaimRow) {
  return {
    id: row.id,
    lostPostId: row.lost_post_id,
    foundPostId: row.found_post_id,
    claimantId: row.claimant_id,
    finderId: row.finder_id,
    status: row.status,
    finderDecision: row.finder_decision,
    description: row.description,
    approximateLostAt: iso(row.approximate_lost_at),
    approximateLocation: row.approximate_location,
    rejectionReason: row.rejection_reason,
    moreInfoRequest: row.more_info_request,
    acceptedAt: iso(row.accepted_at),
    rejectedAt: iso(row.rejected_at),
    cancelledAt: iso(row.cancelled_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    claimant: { id: row.claimant_id, fullName: row.claimant_name, email: row.claimant_email },
    finder: { id: row.finder_id, fullName: row.finder_name, email: row.finder_email },
    posts: {
      lost: row.lost_post_id ? { id: row.lost_post_id, title: row.lost_title } : null,
      found: { id: row.found_post_id, title: row.found_title }
    },
    roomId: row.room_id
  };
}

function mapParticipant(row: ParticipantRow) {
  return {
    claimId: row.claim_id,
    userId: row.user_id,
    role: row.participant_role,
    consentStatus: row.consent_status,
    joinedAt: iso(row.joined_at),
    fullName: row.full_name
  };
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    roomId: row.room_id,
    sender: { id: row.sender_id, fullName: row.sender_name },
    clientMessageId: row.client_message_id,
    content: row.content,
    messageType: row.message_type,
    isRead: row.is_read === 1,
    readAt: iso(row.read_at),
    createdAt: iso(row.created_at)!
  };
}

function mapEvidence(row: EvidenceRow) {
  return {
    id: row.id,
    claimId: row.claim_id,
    uploadedBy: { id: row.uploaded_by, fullName: row.uploader_name },
    mediaFormat: row.media_format,
    mediaBytes: row.media_bytes === null ? null : Number(row.media_bytes),
    evidenceType: row.evidence_type,
    description: row.description,
    createdAt: iso(row.created_at)!,
    url: `/api/claims/${row.claim_id}/evidence/${row.id}`
  };
}

function parseJsonObject(value: string | Record<string, unknown> | null) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseStringArray(value: string | string[] | null) {
  if (!value) return null;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function mapVerificationQuestion(row: VerificationQuestionRow) {
  return {
    id: row.id,
    claimId: row.claim_id,
    postId: row.post_id,
    prompt: row.prompt,
    questionType: row.question_type,
    sourceSignal: row.source_signal,
    expectedAnswerHash: row.expected_answer_hash,
    options: parseStringArray(row.options_json),
    privacyLevel: row.privacy_level,
    status: row.status,
    assignedAt: iso(row.assigned_at)!,
    answer: row.answered_by && row.answered_at && row.last_attempt_at ? {
      answeredBy: row.answered_by,
      isMatch: row.is_match === 1 ? true : (row.is_match === null ? null : false),
      attemptCount: Number(row.attempt_count ?? 0),
      lastAttemptAt: iso(row.last_attempt_at)!,
      answeredAt: iso(row.answered_at)!
    } : null
  };
}

function mapAuditEvent(row: ClaimAuditRow): ClaimAuditEventRecord {
  return {
    id: row.id,
    claimId: row.claim_id,
    actorId: row.actor_id,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    metadata: parseJsonObject(row.metadata_json),
    createdAt: iso(row.created_at)!
  };
}

const claimSelect = `SELECT
  c.id, c.lost_post_id, c.post_id AS found_post_id,
  CASE
    WHEN c.lost_post_id IS NULL AND found.type = 'LOST' THEN found.user_id
    WHEN c.lost_post_id IS NULL AND found.type = 'FOUND' THEN COALESCE((
      SELECT cp.user_id FROM claim_participants cp
      WHERE cp.claim_id = c.id AND cp.user_id <> found.user_id LIMIT 1
    ), c.claimant_id)
    ELSE c.claimant_id
  END AS claimant_id,
  CASE
    WHEN c.lost_post_id IS NULL AND found.type = 'LOST' THEN COALESCE((
      SELECT cp.user_id FROM claim_participants cp
      WHERE cp.claim_id = c.id AND cp.user_id <> found.user_id LIMIT 1
    ), c.claimant_id)
    ELSE found.user_id
  END AS finder_id,
  c.status, c.finder_decision, c.description,
  c.approximate_lost_at, c.approximate_location, c.rejection_reason,
  c.more_info_request, c.accepted_at, c.rejected_at, c.cancelled_at,
  c.created_at, c.updated_at,
  claimant.full_name AS claimant_name, claimant.email AS claimant_email,
  finder.full_name AS finder_name, finder.email AS finder_email,
  lost.title AS lost_title, found.title AS found_title, room.id AS room_id
FROM claims c
INNER JOIN posts found ON found.id = c.post_id
INNER JOIN users claimant ON claimant.id = CASE
  WHEN c.lost_post_id IS NULL AND found.type = 'LOST' THEN found.user_id
  WHEN c.lost_post_id IS NULL AND found.type = 'FOUND' THEN COALESCE((SELECT cp.user_id FROM claim_participants cp WHERE cp.claim_id = c.id AND cp.user_id <> found.user_id LIMIT 1), c.claimant_id)
  ELSE c.claimant_id END
INNER JOIN users finder ON finder.id = CASE
  WHEN c.lost_post_id IS NULL AND found.type = 'LOST' THEN COALESCE((SELECT cp.user_id FROM claim_participants cp WHERE cp.claim_id = c.id AND cp.user_id <> found.user_id LIMIT 1), c.claimant_id)
  ELSE found.user_id END
LEFT JOIN posts lost ON lost.id = c.lost_post_id
LEFT JOIN chat_rooms room ON room.claim_id = c.id`;

const messageSelect = `SELECT m.id, m.room_id, m.sender_id, m.client_message_id, m.content,
  m.media_url, m.message_type, m.is_read, m.read_at, m.created_at,
  u.full_name AS sender_name
FROM chat_messages m INNER JOIN users u ON u.id = m.sender_id`;

const evidenceSelect = `SELECT e.id, e.claim_id, e.uploaded_by, e.secure_url, e.public_id,
  e.media_format, e.media_bytes, e.evidence_type, e.description, e.created_at,
  u.full_name AS uploader_name
FROM claim_evidence e INNER JOIN users u ON u.id = e.uploaded_by`;

const verificationQuestionSelect = `SELECT
  q.id, assignment.claim_id, q.post_id, q.prompt, q.question_type, q.source_signal,
  q.expected_answer_hash, q.options_json, q.privacy_level, q.status, assignment.assigned_at,
  answer.answered_by, answer.is_match, answer.attempt_count, answer.last_attempt_at, answer.answered_at
FROM claim_verification_assignments assignment
INNER JOIN item_verification_questions q ON q.id = assignment.question_id
LEFT JOIN claim_verification_answers answer
  ON answer.claim_id = assignment.claim_id AND answer.question_id = assignment.question_id`;

const auditSelect = `SELECT id, claim_id, actor_id, action, from_status, to_status, metadata_json, created_at
FROM claim_audit_events`;

export function createClaimRepository(pool: SqlExecutor) {

  const claimRepository = {
    async findClaimablePostForUpdate(postId: string, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<ClaimablePostRow[]>(
        `SELECT id, user_id AS owner_id, type
       FROM posts
       WHERE id = ? AND deleted_at IS NULL
         AND status IN ('OPEN', 'MATCHED')
       LIMIT 1 FOR UPDATE`,
        [postId]
      );
      const post = rows[0];
      return post ? { id: post.id, ownerId: post.owner_id, type: post.type } : null;
    },

    async findMatchPairForUpdate(lostPostId: string, foundPostId: string, suggestionThreshold: number, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<MatchPairRow[]>(
        `SELECT lost.id AS lost_post_id, found.id AS found_post_id,
          lost.user_id AS claimant_id, found.user_id AS finder_id,
          mr.total_score, mr.score_tier
       FROM posts lost
       INNER JOIN posts found ON found.id = ?
       INNER JOIN match_results mr ON mr.lost_post_id = lost.id AND mr.found_post_id = found.id
       WHERE lost.id = ? AND lost.type = 'LOST' AND found.type = 'FOUND'
         AND lost.deleted_at IS NULL AND found.deleted_at IS NULL
         AND lost.status IN ('OPEN', 'MATCHED') AND found.status IN ('OPEN', 'MATCHED')
         AND mr.total_score >= ?
       LIMIT 1 FOR UPDATE` ,
        [foundPostId, lostPostId, suggestionThreshold]
      );
      return rows[0] ?? null;
    },

    async findById(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimRow[]>(`${claimSelect} WHERE c.id = ? LIMIT 1`, [claimId]);
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async findByIdForUpdate(claimId: string, queryable: Queryable) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimRow[]>(`${claimSelect} WHERE c.id = ? LIMIT 1 FOR UPDATE`, [claimId]);
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async findByRequestKey(userId: string, requestKey: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimRow[]>(`${claimSelect} WHERE c.claimant_id = ? AND c.request_key = ? LIMIT 1`, [userId, requestKey]);
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async findByFoundPostForClaimant(foundPostId: string, claimantId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimRow[]>(
        `${claimSelect} WHERE c.post_id = ? AND c.claimant_id = ?
       ORDER BY c.created_at DESC LIMIT 1`,
        [foundPostId, claimantId]
      );
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async createClaim(input: {
      id: string;
      lostPostId: string | undefined;
      foundPostId: string;
      claimantId: string;
      status: ClaimStatus;
      finderDecision: FinderDecision;
      requestKey?: string;
      description?: string;
      approximateLostAt?: Date;
      approximateLocation?: string;
    }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO claims (
        id, lost_post_id, post_id, claimant_id, request_key, status, finder_decision,
        description, approximate_lost_at, approximate_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.id, input.lostPostId ?? null, input.foundPostId, input.claimantId, input.requestKey ?? null, input.status, input.finderDecision,
        input.description ?? null, input.approximateLostAt ?? null, input.approximateLocation ?? null]
      );
    },

    async addParticipant(input: { claimId: string; userId: string; role: ParticipantRole; consentStatus: ConsentStatus; }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO claim_participants (claim_id, user_id, participant_role, consent_status, joined_at)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 'ACCEPTED' THEN UTC_TIMESTAMP() ELSE NULL END)`,
        [input.claimId, input.userId, input.role, input.consentStatus, input.consentStatus]
      );
    },

    async updateParticipantConsent(claimId: string, userId: string, consentStatus: ConsentStatus, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `UPDATE claim_participants SET consent_status = ?, joined_at = CASE WHEN ? = 'ACCEPTED' THEN COALESCE(joined_at, UTC_TIMESTAMP()) ELSE joined_at END WHERE claim_id = ? AND user_id = ?`,
        [consentStatus, consentStatus, claimId, userId]
      );
    },

    async findParticipant(claimId: string, userId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ParticipantRow[]>(
        `SELECT cp.claim_id, cp.user_id,
          CASE WHEN c.lost_post_id IS NULL AND post.type = 'LOST'
            THEN CASE WHEN cp.user_id = post.user_id THEN 'CLAIMANT' ELSE 'FINDER' END
            ELSE cp.participant_role END AS participant_role,
          cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
       INNER JOIN claims c ON c.id = cp.claim_id
       INNER JOIN posts post ON post.id = c.post_id
       WHERE cp.claim_id = ? AND cp.user_id = ? LIMIT 1`,
        [claimId, userId]
      );
      return rows[0] ? mapParticipant(rows[0]) : null;
    },

    async findVerificationContext(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<VerificationContextRow[]>(
        `SELECT found.id AS found_post_id, category.name_normalized AS category_name,
          parent.name_normalized AS parent_category_name
         FROM claims c
         INNER JOIN posts found ON found.id = c.post_id
         INNER JOIN item_categories category ON category.id = found.category_id
         LEFT JOIN item_categories parent ON parent.id = category.parent_id
         WHERE c.id = ? LIMIT 1`,
        [claimId]
      );
      const row = rows[0];
      return row ? {
        foundPostId: row.found_post_id,
        categoryName: row.category_name,
        parentCategoryName: row.parent_category_name
      } : null;
    },

    async findClaimItemContext(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimItemContextRow[]>(
        `SELECT found.id AS found_post_id, found.title, category.name AS category_name,
          found.visibility_mode, area.name AS area_name, building.name AS building_name,
          found.room_text, found.custom_location, handover.name AS handover_point_name,
          (SELECT media.id FROM post_media media
           WHERE media.post_id = found.id AND media.media_kind = 'ITEM'
           ORDER BY media.sort_order ASC, media.created_at ASC, media.id ASC LIMIT 1) AS media_id
         FROM claims c
         INNER JOIN posts found ON found.id = c.post_id
         LEFT JOIN item_categories category ON category.id = found.category_id
         LEFT JOIN campus_areas area ON area.id = found.area_id
         LEFT JOIN campus_buildings building ON building.id = found.building_id
         LEFT JOIN handover_points handover ON handover.id = found.handover_point_id
         WHERE c.id = ? LIMIT 1`,
        [claimId]
      );
      const row = rows[0];
      return row ? {
        foundPostId: row.found_post_id,
        title: row.title,
        categoryName: row.category_name,
        visibilityMode: row.visibility_mode,
        areaName: row.area_name,
        buildingName: row.building_name,
        roomText: row.room_text,
        customLocation: row.custom_location,
        handoverPointName: row.handover_point_name,
        mediaId: row.media_id
      } : null;
    },

    async listParticipants(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ParticipantRow[]>(
        `SELECT cp.claim_id, cp.user_id,
          CASE WHEN c.lost_post_id IS NULL AND post.type = 'LOST'
            THEN CASE WHEN cp.user_id = post.user_id THEN 'CLAIMANT' ELSE 'FINDER' END
            ELSE cp.participant_role END AS participant_role,
          cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
       INNER JOIN claims c ON c.id = cp.claim_id
       INNER JOIN posts post ON post.id = c.post_id
       WHERE cp.claim_id = ? ORDER BY cp.participant_role`,
        [claimId]
      );
      return rows.map(mapParticipant);
    },

    async listParticipantsForClaims(claimIds: string[]) {
      if (!claimIds.length) return new Map<string, ReturnType<typeof mapParticipant>[]>();
      const placeholders = claimIds.map(() => "?").join(", ");
      const [rows] = await pool.execute<ParticipantRow[]>(
        `SELECT cp.claim_id, cp.user_id,
          CASE WHEN c.lost_post_id IS NULL AND post.type = 'LOST'
            THEN CASE WHEN cp.user_id = post.user_id THEN 'CLAIMANT' ELSE 'FINDER' END
            ELSE cp.participant_role END AS participant_role,
          cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
       INNER JOIN claims c ON c.id = cp.claim_id
       INNER JOIN posts post ON post.id = c.post_id
       WHERE cp.claim_id IN (${placeholders}) ORDER BY cp.claim_id, cp.participant_role`,
        claimIds
      );
      const participants = new Map<string, ReturnType<typeof mapParticipant>[]>();
      for (const row of rows) {
        const item = mapParticipant(row);
        participants.set(item.claimId, [...(participants.get(item.claimId) ?? []), item]);
      }
      return participants;
    },

    async listConversationSummaries(claimIds: string[], userId: string) {
      if (!claimIds.length) return new Map<string, { lastMessage: string | null; lastMessageAt: string | null; unreadCount: number; custodyEscalated: boolean }>();
      const placeholders = claimIds.map(() => "?").join(", ");
      const [rows] = await pool.execute<ConversationSummaryRow[]>(
        `SELECT c.id AS claim_id,
          (SELECT message.content FROM chat_rooms room
           INNER JOIN chat_messages message ON message.room_id = room.id
           WHERE room.claim_id = c.id AND message.deleted_at IS NULL
           ORDER BY message.sequence DESC LIMIT 1) AS last_message,
          (SELECT message.created_at FROM chat_rooms room
           INNER JOIN chat_messages message ON message.room_id = room.id
           WHERE room.claim_id = c.id AND message.deleted_at IS NULL
           ORDER BY message.sequence DESC LIMIT 1) AS last_message_at,
          (SELECT COUNT(*) FROM chat_rooms room
           INNER JOIN chat_messages message ON message.room_id = room.id
           WHERE room.claim_id = c.id AND message.sender_id <> ? AND message.is_read = FALSE
             AND message.deleted_at IS NULL) AS unread_count,
          EXISTS(SELECT 1 FROM chat_rooms room WHERE room.claim_id = c.id AND room.escalated_at IS NOT NULL) AS custody_escalated
         FROM claims c WHERE c.id IN (${placeholders})`,
        [userId, ...claimIds]
      );
      return new Map(rows.map((row) => [row.claim_id, {
        lastMessage: row.last_message,
        lastMessageAt: iso(row.last_message_at),
        unreadCount: Number(row.unread_count),
        custodyEscalated: row.custody_escalated === 1
      }]));
    },

    async listForUser(userId: string, query: { page: number; pageSize: number; }) {
      const page = Math.max(1, Math.trunc(query.page));
      const limit = Math.min(50, Math.max(1, Math.trunc(query.pageSize)));
      const offset = (page - 1) * limit;
      const [rows] = await pool.execute<ClaimRow[]>(
        `${claimSelect}
       INNER JOIN claim_participants visible_participant
         ON visible_participant.claim_id = c.id AND visible_participant.user_id = ?
       ORDER BY c.updated_at DESC, c.id DESC LIMIT ${limit + 1} OFFSET ${offset}`,
        [userId]
      );
      const [countRows] = await pool.execute<Array<RowDataPacket & { total: number; }>>(
        `SELECT COUNT(*) AS total FROM claims c
       INNER JOIN claim_participants visible_participant
         ON visible_participant.claim_id = c.id AND visible_participant.user_id = ?`,
        [userId]
      );
      return {
        total: Number(countRows[0]?.total ?? 0),
        page,
        pageSize: limit,
        hasMore: rows.length > limit,
        items: rows.slice(0, limit).map(mapClaim)
      };
    },

    async updateFinderDecision(input: {
      claimId: string;
      status: ClaimStatus;
      finderDecision: FinderDecision;
      note?: string;
      acceptedAt?: boolean;
      rejectedAt?: boolean;
    }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `UPDATE claims SET status = ?, finder_decision = ?,
          more_info_request = ?,
          rejection_reason = ?,
          accepted_at = CASE WHEN ? THEN UTC_TIMESTAMP() WHEN ? THEN NULL ELSE accepted_at END,
          rejected_at = CASE WHEN ? THEN UTC_TIMESTAMP() WHEN ? THEN NULL ELSE rejected_at END,
          cancelled_at = NULL,
          updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
        [input.status, input.finderDecision,
        input.status === "NEED_MORE_INFO" ? input.note ?? null : null,
        input.status === "REJECTED" ? input.note ?? null : null,
        input.acceptedAt ? 1 : 0, input.status !== "ACCEPTED" ? 1 : 0,
        input.rejectedAt ? 1 : 0, input.status !== "REJECTED" ? 1 : 0,
        input.claimId]
      );
    },

    async updateFinderParticipant(claimId: string, userId: string, status: ConsentStatus, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `UPDATE claim_participants SET consent_status = ?, joined_at = CASE WHEN ? = 'ACCEPTED' THEN UTC_TIMESTAMP() ELSE joined_at END
       WHERE claim_id = ? AND user_id = ? AND participant_role = 'FINDER'`,
        [status, status, claimId, userId]
      );
    },

    async withdrawClaim(claimId: string, claimantId: string, queryable: Queryable) {
      const [result] = await sqlExecutor(queryable).execute<ResultSetHeader>(
        `UPDATE claims SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND claimant_id = ? AND status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO')`,
        [claimId, claimantId]
      );
      return result.affectedRows > 0;
    },

    async findRoomByClaim(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<RoomRow[]>(
        "SELECT id, claim_id, escalated_at, escalated_by, escalation_reason, created_at FROM chat_rooms WHERE claim_id = ? LIMIT 1",
        [claimId]
      );
      const room = rows[0];
      return room ? {
        id: room.id,
        claimId: room.claim_id,
        escalatedAt: iso(room.escalated_at),
        escalatedBy: room.escalated_by,
        escalationReason: room.escalation_reason,
        createdAt: iso(room.created_at)!
      } : null;
    },

    async createRoom(claimId: string, queryable: Queryable) {
      const roomId = id();
      await sqlExecutor(queryable).execute("INSERT INTO chat_rooms (id, claim_id) VALUES (?, ?)", [roomId, claimId]);
      return { id: roomId, claimId };
    },

    async createVerificationQuestion(input, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO item_verification_questions
          (id, post_id, prompt, question_type, source_signal, expected_answer_hash, weight, privacy_level, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 0.500, ?, 'DRAFT', ?)`,
        [input.id, input.postId, input.prompt, input.questionType, input.sourceSignal, input.expectedAnswerHash,
          input.privacyLevel, input.createdBy]
      );
    },

    async assignVerificationQuestion(claimId: string, questionId: string, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        "INSERT INTO claim_verification_assignments (claim_id, question_id) VALUES (?, ?)",
        [claimId, questionId]
      );
    },

    async listVerificationQuestions(claimId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<VerificationQuestionRow[]>(
        `${verificationQuestionSelect} WHERE assignment.claim_id = ? ORDER BY assignment.assigned_at ASC, q.id ASC`,
        [claimId]
      );
      return rows.map(mapVerificationQuestion);
    },

    async findVerificationQuestion(claimId: string, questionId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<VerificationQuestionRow[]>(
        `${verificationQuestionSelect} WHERE assignment.claim_id = ? AND q.id = ? LIMIT 1`,
        [claimId, questionId]
      );
      return rows[0] ? mapVerificationQuestion(rows[0]) : null;
    },

    async saveVerificationAnswer(input, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO claim_verification_answers
          (id, claim_id, question_id, answered_by, is_match, attempt_count, last_attempt_at, answered_at)
         VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE answered_by = VALUES(answered_by), is_match = VALUES(is_match),
           attempt_count = attempt_count + 1, last_attempt_at = UTC_TIMESTAMP(), answered_at = UTC_TIMESTAMP()`,
        [input.id, input.claimId, input.questionId, input.answeredBy, input.isMatch === null ? null : (input.isMatch ? 1 : 0)]
      );
    },

    async markRoomEscalated(input, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `UPDATE chat_rooms SET escalated_at = UTC_TIMESTAMP(), escalated_by = ?, escalation_reason = ?
         WHERE claim_id = ?`,
        [input.actorId, input.reason, input.claimId]
      );
    },

    async clearRoomEscalation(claimId: string, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        "UPDATE chat_rooms SET escalated_at = NULL, escalated_by = NULL, escalation_reason = NULL WHERE claim_id = ?",
        [claimId]
      );
    },

    async hasActiveAppointment(claimId: string, queryable: Queryable) {
      const [rows] = await sqlExecutor(queryable).execute<Array<RowDataPacket & { total: number | string }>>(
        "SELECT COUNT(*) AS total FROM return_appointments WHERE claim_id = ? AND status IN ('PENDING', 'ACCEPTED', 'RESCHEDULED')",
        [claimId]
      );
      return Number(rows[0]?.total ?? 0) > 0;
    },

    async findAuditByIdempotencyKey(claimId: string, actorId: string, idempotencyKey: string, queryable: Queryable) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimAuditRow[]>(
        `${auditSelect} WHERE claim_id = ? AND actor_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.idempotencyKey')) = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [claimId, actorId, idempotencyKey]
      );
      return rows[0] ? mapAuditEvent(rows[0]) : null;
    },

    async listVerificationAuditEvents(claimId: string, queryable: Queryable = pool) {
      const actions = [
        "CONVERSATION_OPENED", "QUESTION_SENT", "ANSWER_SUBMITTED", "MORE_INFO_REQUESTED", "VERIFICATION_ACCEPTED",
        "VERIFICATION_DECLINED", "CUSTODY_ESCALATED", "VERIFICATION_DECISION_CORRECTED"
      ];
      const placeholders = actions.map(() => "?").join(", ");
      const [rows] = await sqlExecutor(queryable).execute<ClaimAuditRow[]>(
        `${auditSelect} WHERE claim_id = ? AND action IN (${placeholders}) ORDER BY created_at ASC, id ASC`,
        [claimId, ...actions]
      );
      return rows.map(mapAuditEvent);
    },

    async listRoomsForUser(userId: string) {
      const [rows] = await pool.execute<ClaimRow[]>(
        `${claimSelect}
       INNER JOIN claim_participants room_participant
         ON room_participant.claim_id = c.id AND room_participant.user_id = ? AND room_participant.consent_status = 'ACCEPTED'
       WHERE room.id IS NOT NULL AND c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED')
       ORDER BY room.created_at DESC`,
        [userId]
      );
      return rows.map(mapClaim);
    },

    async findRoomForParticipant(roomId: string, userId: string, queryable: Queryable = pool) {
      const [rows] = await sqlExecutor(queryable).execute<ClaimRow[]>(
        `${claimSelect}
       INNER JOIN chat_rooms authorized_room ON authorized_room.claim_id = c.id AND authorized_room.id = ?
       INNER JOIN claim_participants room_participant
         ON room_participant.claim_id = c.id AND room_participant.user_id = ? AND room_participant.consent_status = 'ACCEPTED'
       WHERE c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') LIMIT 1`,
        [roomId, userId]
      );
      return rows[0] ? mapClaim(rows[0]) : null;
    },

    async createMessage(input: { roomId: string; senderId: string; content: string; clientMessageId?: string; }, queryable: Queryable) {
      const executor = sqlExecutor(queryable);
      const [sequenceRows] = await executor.execute<(RowDataPacket & { sequence: number })[]>(
        "SELECT next_sequence AS sequence FROM chat_rooms WHERE id = ? LIMIT 1 FOR UPDATE",
        [input.roomId]
      );
      const sequence = sequenceRows[0]?.sequence;
      if (sequence === undefined) return null;
      if (input.clientMessageId) {
        const [existing] = await executor.execute<MessageRow[]>(
          `${messageSelect} WHERE m.room_id = ? AND m.sender_id = ? AND m.client_message_id = ? LIMIT 1`,
          [input.roomId, input.senderId, input.clientMessageId]
        );
        if (existing[0]) return mapMessage(existing[0]);
      }
      const [advanced] = await executor.execute<ResultSetHeader>(
        "UPDATE chat_rooms SET next_sequence = next_sequence + 1 WHERE id = ?",
        [input.roomId]
      );
      if (advanced.affectedRows !== 1) return null;
      const messageId = id();
      await executor.execute(
        `INSERT INTO chat_messages (id, room_id, sequence, sender_id, client_message_id, content, message_type)
       VALUES (?, ?, ?, ?, ?, ?, 'TEXT')
       ON DUPLICATE KEY UPDATE id = id`,
        [messageId, input.roomId, Number(sequence), input.senderId, input.clientMessageId ?? null, input.content]
      );
      const [rows] = await executor.execute<MessageRow[]>(
        `${messageSelect} WHERE m.id = ? OR (m.room_id = ? AND m.sender_id = ? AND m.client_message_id = ?) LIMIT 1`,
        [messageId, input.roomId, input.senderId, input.clientMessageId ?? null]
      );
      return rows[0] ? mapMessage(rows[0]) : null;
    },

    async listMessages(roomId: string, query: { before?: Date; beforeId?: string; limit: number; }) {
      const limit = Math.min(100, Math.max(1, query.limit));
      const [rows] = await pool.execute<MessageRow[]>(
        `${messageSelect} WHERE m.room_id = ? ${query.before ? "AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))" : ""}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit + 1}`,
        query.before ? [roomId, query.before, query.before, query.beforeId!] : [roomId]
      );
      const hasMore = rows.length > limit;
      const items = rows.slice(0, limit).reverse().map(mapMessage);
      const oldest = items[0];
      return {
        items,
        hasMore,
        nextCursor: hasMore && oldest ? { before: oldest.createdAt, beforeId: oldest.id } : null
      };
    },

    async markMessagesRead(roomId: string, readerId: string) {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE chat_messages SET is_read = TRUE, read_at = COALESCE(read_at, UTC_TIMESTAMP()),
          delivery_status = 'READ'
         WHERE room_id = ? AND sender_id <> ? AND is_read = FALSE`,
        [roomId, readerId]
      );
      return result.affectedRows;
    },

    async listEvidence(claimId: string) {
      const [rows] = await pool.execute<EvidenceRow[]>(`${evidenceSelect} WHERE e.claim_id = ? ORDER BY e.created_at ASC, e.id ASC`, [claimId]);
      return rows.map(mapEvidence);
    },

    async createEvidence(input: {
      id: string;
      claimId: string;
      uploadedBy: string;
      secureUrl: string;
      publicId: string;
      mediaFormat: string;
      mediaBytes: number;
      description?: string;
    }, queryable: Queryable) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO claim_evidence (id, claim_id, uploaded_by, secure_url, public_id, media_format, media_bytes, evidence_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PHOTO', ?)`,
        [input.id, input.claimId, input.uploadedBy, input.secureUrl, input.publicId, input.mediaFormat, input.mediaBytes, input.description ?? null]
      );
    },

    async findEvidence(claimId: string, evidenceId: string) {
      const [rows] = await pool.execute<EvidenceRow[]>(`${evidenceSelect} WHERE e.claim_id = ? AND e.id = ? LIMIT 1`, [claimId, evidenceId]);
      const row = rows[0];
      return row ? { ...mapEvidence(row), secureUrl: row.secure_url, publicId: row.public_id, mediaFormat: row.media_format } : null;
    },

    async writeAudit(input: {
      eventId?: string;
      claimId: string;
      actorId: string;
      action: string;
      fromStatus?: ClaimStatus | null;
      toStatus?: ClaimStatus | null;
      metadata?: Record<string, unknown>;
    }, queryable: Queryable = pool) {
      await sqlExecutor(queryable).execute(
        `INSERT INTO claim_audit_events (id, claim_id, actor_id, action, from_status, to_status, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [input.eventId ?? id(), input.claimId, input.actorId, input.action, input.fromStatus ?? null, input.toStatus ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null]
      );
    }
  } satisfies ClaimRepository;

  return claimRepository;

}
