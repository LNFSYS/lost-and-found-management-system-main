import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { pool } from "../config/db.js";
import { id } from "../utils/security.js";

export type ClaimStatus = "PENDING" | "CONVERSATION_OPEN" | "NEED_MORE_INFO" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type FinderDecision = "PENDING" | "ACCEPTED" | "DECLINED";
export type ParticipantRole = "CLAIMANT" | "FINDER";
export type ConsentStatus = "PENDING" | "ACCEPTED" | "DECLINED";

type Queryable = Pick<PoolConnection, "execute">;

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

interface VerificationQuestionRow extends RowDataPacket {
  id: string;
  prompt: string;
  question_type: "TEXT" | "MASKED_SERIAL" | "MULTIPLE_CHOICE" | "VISUAL_DETAIL";
  options_json: string | string[] | null;
  privacy_level: "PRIVATE" | "HIGHLY_PRIVATE";
  expected_answer_hash: string;
  post_category_name: string | null;
}

interface VerificationAuditRow extends RowDataPacket {
  id: string;
  actor_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  metadata_json: string | null;
  created_at: Date | string;
}

interface AuditColumnRow extends RowDataPacket {
  Field: string;
  Null: "YES" | "NO";
  Default: unknown;
  Extra: string;
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJsonObject(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isOptionalVerificationSchemaError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_FIELD_ERROR";
}

type AuditValue = string | number | null;

function auditValue(value: unknown): AuditValue | undefined {
  return typeof value === "string" || typeof value === "number" || value === null ? value : undefined;
}

function auditColumnValue(field: string, input: { actorId: string; action: string; fromStatus?: ClaimStatus | null; toStatus?: ClaimStatus | null; metadata?: Record<string, unknown> }): AuditValue | undefined {
  const normalized = field.toLowerCase();
  const metadata = input.metadata ?? {};
  if (normalized.includes("reason") || normalized.includes("rationale") || normalized === "note") return auditValue(metadata.reason) ?? auditValue(metadata.note) ?? input.action;
  if (normalized.includes("idempotency") || normalized.includes("request_key")) return auditValue(metadata.idempotencyKey) ?? `${input.action}:${input.actorId}`;
  if (normalized.includes("actor") || normalized.includes("user") || normalized.includes("author") || normalized.includes("created_by")) return input.actorId;
  if (normalized.includes("event_type") || normalized.includes("action_type") || normalized === "decision" || normalized === "outcome") return input.action;
  if (normalized === "status" || normalized.endsWith("_status")) return input.toStatus ?? input.fromStatus ?? input.action;
  if (normalized === "source" || normalized === "source_system") return "NODE";
  return undefined;
}

async function writeAuditWithExistingColumns(input: {
  claimId: string;
  actorId: string;
  action: string;
  fromStatus?: ClaimStatus | null;
  toStatus?: ClaimStatus | null;
  metadata?: Record<string, unknown>;
}, queryable: Queryable, auditId: string) {
  const [rows] = await queryable.execute<AuditColumnRow[]>("SHOW COLUMNS FROM claim_audit_events");
  const available = new Map(rows.map((row) => [row.Field.toLowerCase(), row]));
  const valuesByColumn: Record<string, AuditValue | undefined> = {
    id: auditId,
    claim_id: input.claimId,
    actor_id: input.actorId,
    action: input.action,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    metadata_json: input.metadata ? JSON.stringify(input.metadata) : null
  };
  const fields: string[] = [];
  const values: AuditValue[] = [];
  const expressions: string[] = [];
  for (const row of rows) {
    const field = row.Field;
    const key = field.toLowerCase();
    if (row.Extra.toLowerCase().includes("auto_increment") || (row.Null === "YES" && row.Default !== null)) continue;
    let value = valuesByColumn[key];
    if (value === undefined) value = auditColumnValue(field, input);
    if (value === undefined && (key.includes("created_at") || key.includes("updated_at") || key.includes("timestamp") || key.endsWith("_time"))) {
      fields.push(`\`${field}\``);
      expressions.push("UTC_TIMESTAMP()");
      continue;
    }
    if (value === undefined && row.Null === "NO" && row.Default === null) throw new Error(`Cannot safely populate required claim audit column ${field}`);
    if (value === undefined) continue;
    fields.push(`\`${field}\``);
    expressions.push("?");
    values.push(value);
  }
  await queryable.execute(`INSERT INTO claim_audit_events (${fields.join(", ")}) VALUES (${expressions.join(", ")})`, values);
}

async function writeMessageWithExistingColumns(input: { id: string; roomId: string; senderId: string; content: string; clientMessageId?: string }, queryable: Queryable) {
  const [rows] = await queryable.execute<AuditColumnRow[]>("SHOW COLUMNS FROM chat_messages");
  const valuesByColumn: Record<string, AuditValue | undefined> = {
    id: input.id,
    room_id: input.roomId,
    sender_id: input.senderId,
    client_message_id: input.clientMessageId ?? null,
    content: input.content,
    media_url: null,
    media_public_id: input.id,
    message_type: "TEXT",
    is_read: 0,
    read_at: null
  };
  const fields: string[] = [];
  const values: AuditValue[] = [];
  const expressions: string[] = [];
  for (const row of rows) {
    const field = row.Field;
    const key = field.toLowerCase();
    if (row.Extra.toLowerCase().includes("auto_increment") || (row.Null === "YES" && row.Default !== null)) continue;
    let value = valuesByColumn[key];
    if (value === undefined) {
      const normalized = key.replace(/[^a-z0-9]/g, "");
      if (normalized.includes("sender") || normalized.includes("user") || normalized.includes("author")) value = input.senderId;
      else if (normalized.includes("room")) value = input.roomId;
      else if (normalized.includes("message") && normalized.includes("type")) value = "TEXT";
      else if (normalized.includes("idempotency") || normalized.includes("clientid")) value = input.clientMessageId ?? input.id;
      else if (normalized.includes("publicid") || normalized.includes("mediaid")) value = input.id;
    }
    if (value === undefined && (key.includes("created_at") || key.includes("updated_at") || key.includes("timestamp") || key.endsWith("_time"))) {
      fields.push(`\`${field}\``);
      expressions.push("UTC_TIMESTAMP()");
      continue;
    }
    if (value === undefined && row.Null === "NO" && row.Default === null) throw new Error(`Cannot safely populate required chat message column ${field}`);
    if (value === undefined) continue;
    fields.push(`\`${field}\``);
    expressions.push("?");
    values.push(value);
  }
  await queryable.execute(`INSERT INTO chat_messages (${fields.join(", ")}) VALUES (${expressions.join(", ")})`, values);
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

const claimSelect = `SELECT
  c.id, c.lost_post_id, c.post_id AS found_post_id, c.claimant_id,
  found.user_id AS finder_id, c.status, c.finder_decision, c.description,
  c.approximate_lost_at, c.approximate_location, c.rejection_reason,
  c.more_info_request, c.accepted_at, c.rejected_at, c.cancelled_at,
  c.created_at, c.updated_at,
  claimant.full_name AS claimant_name, claimant.email AS claimant_email,
  finder.full_name AS finder_name, finder.email AS finder_email,
  lost.title AS lost_title, found.title AS found_title, room.id AS room_id
FROM claims c
INNER JOIN posts found ON found.id = c.post_id
INNER JOIN users claimant ON claimant.id = c.claimant_id
INNER JOIN users finder ON finder.id = found.user_id
LEFT JOIN posts lost ON lost.id = c.lost_post_id
LEFT JOIN chat_rooms room ON room.claim_id = c.id`;

const messageSelect = `SELECT m.id, m.room_id, m.sender_id, m.client_message_id, m.content,
  m.media_url, m.message_type, m.is_read, m.read_at, m.created_at,
  u.full_name AS sender_name
FROM chat_messages m INNER JOIN users u ON u.id = m.sender_id`;

const legacyMessageSelect = `SELECT m.id, m.room_id, m.sender_id, NULL AS client_message_id, m.content,
  m.media_url, m.message_type, m.is_read, m.read_at, m.created_at,
  u.full_name AS sender_name
FROM chat_messages m INNER JOIN users u ON u.id = m.sender_id`;

const evidenceSelect = `SELECT e.id, e.claim_id, e.uploaded_by, e.secure_url, e.public_id,
  e.media_format, e.media_bytes, e.evidence_type, e.description, e.created_at,
  u.full_name AS uploader_name
FROM claim_evidence e INNER JOIN users u ON u.id = e.uploaded_by`;

export const claimRepository = {
  async findMatchPairForUpdate(lostPostId: string, foundPostId: string, suggestionThreshold: number, connection: Queryable) {
    const [rows] = await connection.execute<MatchPairRow[]>(
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
    const [rows] = await queryable.execute<ClaimRow[]>(`${claimSelect} WHERE c.id = ? LIMIT 1`, [claimId]);
    return rows[0] ? mapClaim(rows[0]) : null;
  },

  async findByIdForUpdate(claimId: string, queryable: Queryable) {
    const [rows] = await queryable.execute<ClaimRow[]>(`${claimSelect} WHERE c.id = ? LIMIT 1 FOR UPDATE`, [claimId]);
    return rows[0] ? mapClaim(rows[0]) : null;
  },

  async findByRequestKey(userId: string, requestKey: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<ClaimRow[]>(`${claimSelect} WHERE c.claimant_id = ? AND c.request_key = ? LIMIT 1`, [userId, requestKey]);
    return rows[0] ? mapClaim(rows[0]) : null;
  },

  async findByPair(lostPostId: string, foundPostId: string, claimantId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<ClaimRow[]>(
      `${claimSelect} WHERE c.lost_post_id = ? AND c.post_id = ? AND c.claimant_id = ?
       ORDER BY c.created_at DESC LIMIT 1`,
      [lostPostId, foundPostId, claimantId]
    );
    return rows[0] ? mapClaim(rows[0]) : null;
  },

  async findFoundCategory(foundPostId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<Array<RowDataPacket & { category_name: string | null }>>(
      `SELECT c.name AS category_name
       FROM posts p LEFT JOIN item_categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.type = 'FOUND' LIMIT 1`,
      [foundPostId]
    );
    return rows[0]?.category_name ?? null;
  },

  async listVerificationQuestions(claimId: string, queryable: Queryable = pool) {
    try {
      const [rows] = await queryable.execute<VerificationQuestionRow[]>(
        `SELECT q.id, q.prompt, q.question_type, q.options_json, q.privacy_level,
            q.expected_answer_hash, c.name AS post_category_name
         FROM claim_verification_assignments a
         INNER JOIN item_verification_questions q ON q.id = a.question_id AND q.status = 'APPROVED'
         INNER JOIN claims cl ON cl.id = a.claim_id
         INNER JOIN posts p ON p.id = cl.post_id
         LEFT JOIN item_categories c ON c.id = p.category_id
         WHERE a.claim_id = ? ORDER BY a.assigned_at ASC, q.id ASC`,
        [claimId]
      );
      return rows.map((row) => ({
        id: row.id,
        prompt: row.prompt,
        questionType: row.question_type,
        options: row.options_json ? (typeof row.options_json === "string" ? (() => { try { return JSON.parse(row.options_json as string) as string[]; } catch { return undefined; } })() : row.options_json) : undefined,
        privacyLevel: row.privacy_level,
        expectedAnswerHash: row.expected_answer_hash,
        categoryName: row.post_category_name
      }));
    } catch (error) {
      if (isOptionalVerificationSchemaError(error)) return [];
      throw error;
    }
  },

  async listClaimAuditEvents(claimId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<VerificationAuditRow[]>(
      `SELECT id, actor_id, action, from_status, to_status, metadata_json, created_at
       FROM claim_audit_events WHERE claim_id = ? ORDER BY created_at ASC, id ASC`,
      [claimId]
    );
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      metadata: parseJsonObject(row.metadata_json),
      createdAt: iso(row.created_at)!
    }));
  },

  async findAuditByIdempotency(claimId: string, actorId: string, idempotencyKey: string, queryable: Queryable = pool) {
    try {
      const [rows] = await queryable.execute<VerificationAuditRow[]>(
        `SELECT id, actor_id, action, from_status, to_status, metadata_json, created_at
         FROM claim_audit_events
         WHERE claim_id = ? AND actor_id = ?
           AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.idempotencyKey')) = ?
         ORDER BY created_at DESC, id DESC LIMIT 1`,
        [claimId, actorId, idempotencyKey]
      );
      const row = rows[0];
      return row ? {
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        metadata: parseJsonObject(row.metadata_json),
        createdAt: iso(row.created_at)!
      } : null;
    } catch (error) {
      if (isOptionalVerificationSchemaError(error)) return null;
      throw error;
    }
  },

  async recordVerificationAnswer(input: { claimId: string; questionId: string; answeredBy: string; isMatch: boolean }, queryable: Queryable) {
    try {
      await queryable.execute(
        `INSERT INTO claim_verification_answers
          (id, claim_id, question_id, answered_by, is_match, attempt_count, last_attempt_at, answered_at)
         VALUES (?, ?, ?, ?, ?, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE
           answered_by = VALUES(answered_by), is_match = VALUES(is_match),
           attempt_count = LEAST(attempt_count + 1, 65535),
           last_attempt_at = UTC_TIMESTAMP(), answered_at = UTC_TIMESTAMP()`,
        [id(), input.claimId, input.questionId, input.answeredBy, input.isMatch ? 1 : 0]
      );
    } catch (error) {
      if (!isOptionalVerificationSchemaError(error)) throw error;
    }
  },

  async createClaim(input: {
    id: string;
    lostPostId: string;
    foundPostId: string;
    claimantId: string;
    requestKey?: string;
    description?: string;
    approximateLostAt?: Date;
    approximateLocation?: string;
  }, queryable: Queryable) {
    await queryable.execute(
      `INSERT INTO claims (
        id, lost_post_id, post_id, claimant_id, request_key, status, finder_decision,
        description, approximate_lost_at, approximate_location
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', 'PENDING', ?, ?, ?)`,
      [input.id, input.lostPostId, input.foundPostId, input.claimantId, input.requestKey ?? null,
        input.description ?? null, input.approximateLostAt ?? null, input.approximateLocation ?? null]
    );
  },

  async addParticipant(input: { claimId: string; userId: string; role: ParticipantRole; consentStatus: ConsentStatus }, queryable: Queryable) {
    await queryable.execute(
      `INSERT INTO claim_participants (claim_id, user_id, participant_role, consent_status, joined_at)
       VALUES (?, ?, ?, ?, CASE WHEN ? = 'ACCEPTED' THEN UTC_TIMESTAMP() ELSE NULL END)`,
      [input.claimId, input.userId, input.role, input.consentStatus, input.consentStatus]
    );
  },

  async findParticipant(claimId: string, userId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<ParticipantRow[]>(
      `SELECT cp.claim_id, cp.user_id, cp.participant_role, cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
       WHERE cp.claim_id = ? AND cp.user_id = ? LIMIT 1`,
      [claimId, userId]
    );
    return rows[0] ? mapParticipant(rows[0]) : null;
  },

  async listParticipants(claimId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<ParticipantRow[]>(
      `SELECT cp.claim_id, cp.user_id, cp.participant_role, cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
       WHERE cp.claim_id = ? ORDER BY cp.participant_role`,
      [claimId]
    );
    return rows.map(mapParticipant);
  },

  async listParticipantsForClaims(claimIds: string[]) {
    if (!claimIds.length) return new Map<string, ReturnType<typeof mapParticipant>[]>();
    const placeholders = claimIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<ParticipantRow[]>(
      `SELECT cp.claim_id, cp.user_id, cp.participant_role, cp.consent_status, cp.joined_at, u.full_name
       FROM claim_participants cp INNER JOIN users u ON u.id = cp.user_id
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

  async listForUser(userId: string, query: { page: number; pageSize: number }) {
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
    const [countRows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
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
    await queryable.execute(
      `UPDATE claims SET status = ?, finder_decision = ?,
          more_info_request = ?,
          rejection_reason = ?,
          accepted_at = CASE WHEN ? THEN UTC_TIMESTAMP() ELSE accepted_at END,
          rejected_at = CASE WHEN ? THEN UTC_TIMESTAMP() ELSE rejected_at END,
          updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [input.status, input.finderDecision,
        input.status === "NEED_MORE_INFO" ? input.note ?? null : null,
        input.status === "REJECTED" ? input.note ?? null : null,
        input.acceptedAt ? 1 : 0, input.rejectedAt ? 1 : 0, input.claimId]
    );
  },

  async updateFinderParticipant(claimId: string, userId: string, status: ConsentStatus, queryable: Queryable) {
    await queryable.execute(
      `UPDATE claim_participants SET consent_status = ?, joined_at = CASE WHEN ? = 'ACCEPTED' THEN UTC_TIMESTAMP() ELSE joined_at END
       WHERE claim_id = ? AND user_id = ? AND participant_role = 'FINDER'`,
      [status, status, claimId, userId]
    );
  },

  async withdrawClaim(claimId: string, claimantId: string, queryable: Queryable) {
    const [result] = await queryable.execute<ResultSetHeader>(
      `UPDATE claims SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND claimant_id = ? AND status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO')`,
      [claimId, claimantId]
    );
    return result.affectedRows > 0;
  },

  async findRoomByClaim(claimId: string, queryable: Queryable = pool) {
    const [rows] = await queryable.execute<RoomRow[]>("SELECT id, claim_id, created_at FROM chat_rooms WHERE claim_id = ? LIMIT 1", [claimId]);
    const room = rows[0];
    return room ? { id: room.id, claimId: room.claim_id, createdAt: iso(room.created_at)! } : null;
  },

  async createRoom(claimId: string, queryable: Queryable) {
    const roomId = id();
    await queryable.execute("INSERT INTO chat_rooms (id, claim_id) VALUES (?, ?)", [roomId, claimId]);
    return { id: roomId, claimId };
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
    const [rows] = await queryable.execute<ClaimRow[]>(
      `${claimSelect}
       INNER JOIN chat_rooms authorized_room ON authorized_room.claim_id = c.id AND authorized_room.id = ?
       INNER JOIN claim_participants room_participant
         ON room_participant.claim_id = c.id AND room_participant.user_id = ? AND room_participant.consent_status = 'ACCEPTED'
       WHERE c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') LIMIT 1`,
      [roomId, userId]
    );
    return rows[0] ? mapClaim(rows[0]) : null;
  },

  async createMessage(input: { roomId: string; senderId: string; content: string; clientMessageId?: string }, queryable: Queryable) {
    const messageId = id();
    let legacy = false;
    try {
      await queryable.execute(
        `INSERT INTO chat_messages (id, room_id, sender_id, client_message_id, content, message_type)
         VALUES (?, ?, ?, ?, ?, 'TEXT')
         ON DUPLICATE KEY UPDATE id = id`,
        [messageId, input.roomId, input.senderId, input.clientMessageId ?? null, input.content]
      );
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
      if (code !== "ER_NO_DEFAULT_FOR_FIELD" && !isOptionalVerificationSchemaError(error)) throw error;
      legacy = isOptionalVerificationSchemaError(error);
      if (code === "ER_NO_DEFAULT_FOR_FIELD") {
        await writeMessageWithExistingColumns({ id: messageId, roomId: input.roomId, senderId: input.senderId, content: input.content, clientMessageId: input.clientMessageId }, queryable);
      } else {
        await queryable.execute(
          `INSERT INTO chat_messages (id, room_id, sender_id, content, message_type) VALUES (?, ?, ?, ?, 'TEXT')`,
          [messageId, input.roomId, input.senderId, input.content]
        );
      }
    }
    try {
      const [rows] = await queryable.execute<MessageRow[]>(
        `${legacy ? legacyMessageSelect : messageSelect} WHERE m.id = ?${legacy ? "" : " OR (m.room_id = ? AND m.sender_id = ? AND m.client_message_id = ?)"} LIMIT 1`,
        legacy ? [messageId] : [messageId, input.roomId, input.senderId, input.clientMessageId ?? null]
      );
      return rows[0] ? mapMessage(rows[0]) : null;
    } catch (error) {
      if (!isOptionalVerificationSchemaError(error)) throw error;
      const [rows] = await queryable.execute<MessageRow[]>(`${legacyMessageSelect} WHERE m.id = ? LIMIT 1`, [messageId]);
      return rows[0] ? mapMessage(rows[0]) : null;
    }
  },

  async findMessageByClientId(roomId: string, senderId: string, clientMessageId: string, queryable: Queryable = pool) {
    try {
      const [rows] = await queryable.execute<MessageRow[]>(
        `${messageSelect} WHERE m.room_id = ? AND m.sender_id = ? AND m.client_message_id = ? LIMIT 1`,
        [roomId, senderId, clientMessageId]
      );
      return rows[0] ? mapMessage(rows[0]) : null;
    } catch (error) {
      if (isOptionalVerificationSchemaError(error)) return null;
      throw error;
    }
  },

  async listMessages(roomId: string, query: { before?: Date; beforeId?: string; limit: number }) {
    const limit = Math.min(100, Math.max(1, query.limit));
    const suffix = ` WHERE m.room_id = ? ${query.before ? "AND (m.created_at < ? OR (m.created_at = ? AND m.id < ?))" : ""}
       ORDER BY m.created_at DESC, m.id DESC LIMIT ${limit + 1}`;
    let rows: MessageRow[];
    try {
      const [currentRows] = await pool.execute<MessageRow[]>(`${messageSelect}${suffix}`, query.before ? [roomId, query.before, query.before, query.beforeId!] : [roomId]);
      rows = currentRows;
    } catch (error) {
      if (!isOptionalVerificationSchemaError(error)) throw error;
      const [legacyRows] = await pool.execute<MessageRow[]>(`${legacyMessageSelect}${suffix}`, query.before ? [roomId, query.before, query.before, query.beforeId!] : [roomId]);
      rows = legacyRows;
    }
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).reverse().map(mapMessage);
    const oldest = items[0];
    return {
      items,
      hasMore,
      nextCursor: hasMore && oldest ? { before: oldest.createdAt, beforeId: oldest.id } : null
    };
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
    await queryable.execute(
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
    claimId: string;
    actorId: string;
    action: string;
    fromStatus?: ClaimStatus | null;
    toStatus?: ClaimStatus | null;
    metadata?: Record<string, unknown>;
  }, queryable: Queryable = pool) {
    const auditId = id();
    try {
      await queryable.execute(
        `INSERT INTO claim_audit_events (id, claim_id, actor_id, action, from_status, to_status, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [auditId, input.claimId, input.actorId, input.action, input.fromStatus ?? null, input.toStatus ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null]
      );
    } catch (error) {
      const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
      if (code !== "ER_NO_DEFAULT_FOR_FIELD" && !isOptionalVerificationSchemaError(error)) throw error;
      await writeAuditWithExistingColumns(input, queryable, auditId);
    }
  }
};
