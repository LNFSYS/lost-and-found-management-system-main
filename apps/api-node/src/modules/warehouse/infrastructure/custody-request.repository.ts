import type { RowDataPacket } from "mysql2";
import { createHash } from "node:crypto";
import { custodyFingerprint } from "../application/custody-fingerprint.js";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { CustodyIntakeType, CustodyRequestStatus } from "../application/custody-request.dto.js";
import type {
  CustodyRequest,
  CustodyRequestAuditEntry,
  CustodyRequestLock,
  CustodyRequestRepository
} from "../application/custody-request.repository.port.js";

type DbExecutor = SqlExecutor | TransactionContext;

interface CustodyRequestRow extends RowDataPacket {
  id: string;
  claim_id: string | null;
  room_id: string | null;
  post_id: string | null;
  requester_id: string;
  requester_name: string | null;
  handler_id: string | null;
  handler_name: string | null;
  status: CustodyRequestStatus;
  intake_type: CustodyIntakeType;
  reason: string | null;
  request_payload: string | unknown[] | null;
  rejection_reason: string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  handover_point_address: string | null;
  confirmed_handover_at: Date | string | null;
  warehouse_item_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  post_title: string | null;
}

interface CustodyRequestLockRow extends RowDataPacket {
  id: string;
  claim_id: string | null;
  room_id: string | null;
  post_id: string | null;
  requester_id: string;
  status: CustodyRequestStatus;
  intake_type: CustodyIntakeType;
  handover_point_id: string | null;
  warehouse_item_id: string | null;
}

interface AuditRow extends RowDataPacket {
  id: string;
  custody_request_id: string;
  actor_id: string;
  actor_name: string | null;
  action: string;
  from_status: string | null;
  to_status: string;
  metadata: string | Record<string, unknown> | null;
  created_at: Date | string;
}

interface CountRow extends RowDataPacket { total: number | string; }
interface StatusCountRow extends RowDataPacket { status: CustodyRequestStatus; cnt: number | string; }

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

const requestSelect = `SELECT cr.id, cr.claim_id, cr.room_id, cr.post_id,
  cr.requester_id, ru.full_name AS requester_name,
  cr.handler_id, hu.full_name AS handler_name,
  cr.status, cr.intake_type, cr.reason, cr.request_payload, cr.rejection_reason,
  cr.handover_point_id, hp.name AS handover_point_name, hp.address AS handover_point_address,
  cr.confirmed_handover_at, cr.warehouse_item_id,
  cr.created_at, cr.updated_at,
  p.title AS post_title
  FROM custody_requests cr
  INNER JOIN users ru ON ru.id = cr.requester_id
  LEFT JOIN users hu ON hu.id = cr.handler_id
  LEFT JOIN handover_points hp ON hp.id = cr.handover_point_id
  LEFT JOIN posts p ON p.id = cr.post_id`;

function mapRequest(row: CustodyRequestRow): CustodyRequest {
  return {
    id: row.id,
    claimId: row.claim_id,
    roomId: row.room_id,
    postId: row.post_id,
    requester: { id: row.requester_id, fullName: row.requester_name },
    handler: row.handler_id ? { id: row.handler_id, fullName: row.handler_name } : null,
    status: row.status,
    intakeType: row.intake_type,
    reason: row.reason,
    requestHash: typeof row.request_payload === "string" ? row.request_payload : row.request_payload ? JSON.stringify(row.request_payload) : null,
    rejectionReason: row.rejection_reason,
    handoverPoint: row.handover_point_id
      ? { id: row.handover_point_id, name: row.handover_point_name, address: row.handover_point_address }
      : null,
    confirmedHandoverAt: iso(row.confirmed_handover_at),
    warehouseItemId: row.warehouse_item_id,
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
    post: row.post_id ? { id: row.post_id, title: row.post_title } : null
  };
}

function mapAudit(row: AuditRow): CustodyRequestAuditEntry {
  let metadata: Record<string, unknown> | null = null;
  if (row.metadata) {
    try { metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata; } catch { metadata = null; }
  }
  return {
    id: row.id,
    custodyRequestId: row.custody_request_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    metadata,
    createdAt: iso(row.created_at) ?? ""
  };
}

export function createCustodyRequestRepository(pool: SqlExecutor) {
  const repository: CustodyRequestRepository = {
    async listRequests(input) {
      const pageSize = Math.max(1, Math.min(50, Number(input.pageSize) || 12));
      const page = Math.max(1, Number(input.page) || 1);
      const offset = (page - 1) * pageSize;
      const where: string[] = [];
      const values: string[] = [];
      if (input.status === "AWAITING_INTAKE") {
        where.push("cr.status IN ('PENDING','ACCEPTED')");
      } else if (input.status) {
        where.push("cr.status = ?");
        values.push(input.status);
      }
      const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const [rows] = await pool.execute<CustodyRequestRow[]>(
        `${requestSelect} ${whereClause} ORDER BY
          cr.status = 'PENDING' DESC,
          cr.status = 'ACCEPTED' DESC,
          cr.created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}`,
        values
      );
      const [countRows] = await pool.execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM custody_requests cr ${whereClause}`,
        values
      );
      return { total: Number(countRows[0]?.total ?? 0), items: rows.map(mapRequest) };
    },

    async findById(id, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<CustodyRequestRow[]>(
        `${requestSelect} WHERE cr.id = ? LIMIT 1`, [id]
      );
      return rows[0] ? mapRequest(rows[0]) : null;
    },

    async lockForUpdate(id, connection) {
      const [rows] = await sqlExecutor(connection).execute<CustodyRequestLockRow[]>(
        `SELECT id, claim_id, room_id, post_id, requester_id, status, intake_type, handover_point_id, warehouse_item_id
         FROM custody_requests WHERE id = ? LIMIT 1 FOR UPDATE`, [id]
      );
      if (!rows[0]) return null;
      const row = rows[0];
      return {
        id: row.id,
        claimId: row.claim_id,
        roomId: row.room_id,
        postId: row.post_id,
        requesterId: row.requester_id,
        status: row.status,
        intakeType: row.intake_type,
        handoverPointId: row.handover_point_id,
        warehouseItemId: row.warehouse_item_id
      } as CustodyRequestLock;
    },

    async findByIdempotencyKey(key, actorId, db) {
      const scoped = createHash("sha256").update(JSON.stringify(["custody:create", actorId, key])).digest("hex");
      const [rows] = await sqlExecutor(db ?? pool).execute<CustodyRequestRow[]>(
        `${requestSelect} WHERE cr.requester_id = ? AND cr.idempotency_key IN (?, ?) LIMIT 1`, [actorId, scoped, key]
      );
      return rows[0] ? mapRequest(rows[0]) : null;
    },

    async findPendingByClaimId(claimId, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<CustodyRequestRow[]>(
        `${requestSelect} WHERE cr.claim_id = ? AND cr.status IN ('PENDING','ACCEPTED') LIMIT 1`, [claimId]
      );
      return rows[0] ? mapRequest(rows[0]) : null;
    },

    async findActiveByPostId(postId, requesterId, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<CustodyRequestRow[]>(
        `${requestSelect} WHERE cr.post_id = ? AND cr.requester_id = ? AND cr.status NOT IN ('CANCELLED','REJECTED') ORDER BY cr.created_at DESC LIMIT 1`, [postId, requesterId]
      );
      return rows[0] ? mapRequest(rows[0]) : null;
    },

    async lockEligiblePost(postId, actorId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        "SELECT id FROM posts WHERE id = ? AND user_id = ? AND type = 'FOUND' AND status IN ('OPEN','MATCHED') AND deleted_at IS NULL FOR UPDATE", [postId, actorId]);
      return rows.length === 1;
    },

    async validateClaimLink(postId, actorId, claimId, roomId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        `SELECT c.id FROM claims c JOIN posts p ON p.id = COALESCE(c.source_found_post_id,c.post_id) AND p.type = 'FOUND'
         JOIN claim_participants cp ON cp.claim_id = c.id AND cp.user_id = ? AND cp.consent_status = 'ACCEPTED'
         LEFT JOIN chat_rooms r ON r.claim_id = c.id
         WHERE c.id = ? AND p.id = ? AND p.user_id = ? AND c.status IN ('PENDING','CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED')
         AND (? IS NULL OR r.id = ?) LIMIT 1`, [actorId, claimId, postId, actorId, roomId, roomId]);
      return rows.length === 1;
    },

    async hasWarehouseItem(postId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        "SELECT id FROM warehouse_items WHERE post_id = ? AND deleted_at IS NULL LIMIT 1", [postId]);
      return rows.length > 0;
    },

    async isStaff(actorId, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<RowDataPacket[]>(
        "SELECT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.user_id = ? AND ur.role_code IN ('STAFF','ADMIN') AND u.status = 'ACTIVE' LIMIT 1", [actorId]);
      return rows.length > 0;
    },

    async clearEscalation(claimId, db) {
      await sqlExecutor(db).execute("UPDATE chat_rooms SET escalated_at = NULL, escalated_by = NULL, escalation_reason = NULL WHERE claim_id = ?", [claimId]);
    },

    async notificationRecipients(postId, claimId, requesterId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        `SELECT ? AS id UNION SELECT cp.user_id AS id FROM claim_participants cp JOIN claims c ON c.id = cp.claim_id
         WHERE COALESCE(c.source_found_post_id,c.post_id) = ? AND (? IS NULL OR c.id = ?) AND cp.consent_status = 'ACCEPTED'
         UNION SELECT ur.user_id AS id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_code IN ('STAFF','ADMIN') AND u.status = 'ACTIVE'`, [requesterId, postId, claimId, claimId]);
      return [...new Set(rows.map(row => String(row.id)))];
    },

    async createRequest(input, db) {
      const key = input.idempotencyKey ? createHash("sha256").update(JSON.stringify(["custody:create", input.requesterId, input.idempotencyKey])).digest("hex") : null;
      await sqlExecutor(db ?? pool).execute(
        `INSERT INTO custody_requests (id, claim_id, room_id, post_id, requester_id, intake_type, reason, handover_point_id, idempotency_key, request_payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.claimId ?? null,
          input.roomId ?? null,
          input.postId ?? null,
          input.requesterId,
          input.intakeType,
          input.reason ?? null,
          input.handoverPointId ?? null,
          key,
          custodyFingerprint(input)
        ]
      );
    },

    async updateStatus(id, input, db) {
      const fields: string[] = ["status = ?"];
      const values: Array<string | Date | null> = [input.status];
      if (input.handlerId !== undefined) {
        fields.push("handler_id = ?");
        values.push(input.handlerId);
      }
      if (input.handoverPointId !== undefined) {
        fields.push("handover_point_id = ?");
        values.push(input.handoverPointId);
      }
      if (input.confirmedHandoverAt !== undefined) {
        fields.push("confirmed_handover_at = ?");
        values.push(input.confirmedHandoverAt);
      }
      if (input.rejectionReason !== undefined) {
        fields.push("rejection_reason = ?");
        values.push(input.rejectionReason);
      }
      if (input.warehouseItemId !== undefined) {
        fields.push("warehouse_item_id = ?");
        values.push(input.warehouseItemId);
      }
      values.push(id);
      await sqlExecutor(db ?? pool).execute(
        `UPDATE custody_requests SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
    },

    async writeAudit(input, db) {
      await sqlExecutor(db ?? pool).execute(
        `INSERT INTO custody_request_audit (id, custody_request_id, actor_id, action, from_status, to_status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.custodyRequestId,
          input.actorId,
          input.action,
          input.fromStatus ?? null,
          input.toStatus,
          input.metadata ? JSON.stringify(input.metadata) : null
        ]
      );
    },

    async listAudit(custodyRequestId) {
      const [rows] = await pool.execute<AuditRow[]>(
        `SELECT a.id, a.custody_request_id, a.actor_id, u.full_name AS actor_name,
                a.action, a.from_status, a.to_status, a.metadata, a.created_at
         FROM custody_request_audit a
         INNER JOIN users u ON u.id = a.actor_id
         WHERE a.custody_request_id = ?
         ORDER BY a.created_at ASC`,
        [custodyRequestId]
      );
      return rows.map(mapAudit);
    },

    async countByStatus() {
      const [rows] = await pool.execute<StatusCountRow[]>(
        "SELECT status, COUNT(*) AS cnt FROM custody_requests GROUP BY status"
      );
      const counts: Record<string, number> = {
        PENDING: 0, ACCEPTED: 0, REJECTED: 0, CANCELLED: 0, INTAKED: 0
      };
      for (const row of rows) counts[row.status] = Number(row.cnt);
      return counts as Record<CustodyRequestStatus, number>;
    }
  };

  return repository;
}
