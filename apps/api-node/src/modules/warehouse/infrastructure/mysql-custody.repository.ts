import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type {
  CustodyRepository,
  CustodyRequestLogRecord,
  CustodyRequestRecord
} from "../application/custody.repository.port.js";
import type { CustodyReason, CustodyRequestStatus } from "../domain/warehouse-policy.js";

interface CustodyRequestRow extends RowDataPacket {
  id: string;
  post_id: string;
  post_title: string | null;
  finder_id: string;
  finder_name: string | null;
  finder_contact: string | null;
  claim_id: string | null;
  status: CustodyRequestStatus;
  reason: CustodyReason;
  reason_notes: string | null;
  proposed_handover_point_id: string | null;
  proposed_handover_point_name: string | null;
  proposed_time: Date | string | null;
  confirmed_handover_point_id: string | null;
  confirmed_handover_point_name: string | null;
  assigned_handler_id: string | null;
  assigned_handler_name: string | null;
  warehouse_item_id: string | null;
  idempotency_key: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface CustodyLogRow extends RowDataPacket {
  id: string;
  custody_request_id: string;
  actor_id: string;
  actor_name: string | null;
  action: "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "INTAKED" | "COMMENTED";
  from_status: string | null;
  to_status: string | null;
  notes: string | null;
  created_at: Date | string;
}

interface UserRow extends RowDataPacket {
  id: string;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapCustodyRow(row: CustodyRequestRow): CustodyRequestRecord {
  return {
    id: row.id,
    postId: row.post_id,
    postTitle: row.post_title ?? undefined,
    finderId: row.finder_id,
    finderName: row.finder_name ?? undefined,
    finderContact: row.finder_contact ?? undefined,
    claimId: row.claim_id,
    status: row.status,
    reason: row.reason,
    reasonNotes: row.reason_notes,
    proposedHandoverPointId: row.proposed_handover_point_id,
    proposedHandoverPointName: row.proposed_handover_point_name,
    proposedTime: toIsoString(row.proposed_time),
    confirmedHandoverPointId: row.confirmed_handover_point_id,
    confirmedHandoverPointName: row.confirmed_handover_point_name,
    assignedHandlerId: row.assigned_handler_id,
    assignedHandlerName: row.assigned_handler_name,
    warehouseItemId: row.warehouse_item_id,
    idempotencyKey: row.idempotency_key,
    createdAt: toIsoString(row.created_at)!,
    updatedAt: toIsoString(row.updated_at)!
  };
}

export function createMySqlCustodyRepository(pool: SqlExecutor): CustodyRepository {
  const runner = (custom?: TransactionContext): SqlExecutor => sqlExecutor(custom ?? pool);

  return {
    async createCustodyRequest(data, custom) {
      await runner(custom).execute(
        `INSERT INTO custody_requests (
          id, post_id, finder_id, claim_id, status, reason, reason_notes,
          proposed_handover_point_id, proposed_time, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.postId,
          data.finderId,
          data.claimId ?? null,
          data.status,
          data.reason,
          data.reasonNotes ?? null,
          data.proposedHandoverPointId ?? null,
          data.proposedTime ?? null,
          data.idempotencyKey ?? null
        ]
      );
    },

    async findCustodyRequestById(id, custom) {
      const [rows] = await runner(custom).execute<CustodyRequestRow[]>(
        `SELECT
          cr.*,
          p.title AS post_title,
          u.full_name AS finder_name,
          p.contact_info AS finder_contact,
          hp_prop.name AS proposed_handover_point_name,
          hp_conf.name AS confirmed_handover_point_name,
          h.full_name AS assigned_handler_name
        FROM custody_requests cr
        INNER JOIN posts p ON p.id = cr.post_id
        INNER JOIN users u ON u.id = cr.finder_id
        LEFT JOIN handover_points hp_prop ON hp_prop.id = cr.proposed_handover_point_id
        LEFT JOIN handover_points hp_conf ON hp_conf.id = cr.confirmed_handover_point_id
        LEFT JOIN users h ON h.id = cr.assigned_handler_id
        WHERE cr.id = ?`,
        [id]
      );
      return rows[0] ? mapCustodyRow(rows[0]) : null;
    },

    async lockCustodyRequestById(id, custom) {
      await runner(custom).execute(`SELECT id FROM custody_requests WHERE id = ? FOR UPDATE`, [id]);
    },

    async findClaimPostId(claimId) {
      const [rows] = await runner().execute<RowDataPacket[]>(
        `SELECT post_id FROM claims WHERE id = ?`, [claimId]
      );
      return rows[0]?.post_id ?? null;
    },

    async findClaimantId(claimId) {
      const [rows] = await runner().execute<RowDataPacket[]>(
        `SELECT claimant_id FROM claims WHERE id = ?`, [claimId]
      );
      return rows[0]?.claimant_id ?? null;
    },

    async findActivePendingRequestByPost(postId, custom) {
      const [rows] = await runner(custom).execute<CustodyRequestRow[]>(
        `SELECT
          cr.*,
          p.title AS post_title,
          u.full_name AS finder_name,
          p.contact_info AS finder_contact,
          hp_prop.name AS proposed_handover_point_name,
          hp_conf.name AS confirmed_handover_point_name,
          h.full_name AS assigned_handler_name
        FROM custody_requests cr
        INNER JOIN posts p ON p.id = cr.post_id
        INNER JOIN users u ON u.id = cr.finder_id
        LEFT JOIN handover_points hp_prop ON hp_prop.id = cr.proposed_handover_point_id
        LEFT JOIN handover_points hp_conf ON hp_conf.id = cr.confirmed_handover_point_id
        LEFT JOIN users h ON h.id = cr.assigned_handler_id
        WHERE cr.post_id = ? AND cr.status IN ('PENDING', 'ACCEPTED')
        ORDER BY cr.created_at DESC LIMIT 1`,
        [postId]
      );
      return rows[0] ? mapCustodyRow(rows[0]) : null;
    },

    async findByIdempotencyKey(finderId, idempotencyKey, custom) {
      const [rows] = await runner(custom).execute<CustodyRequestRow[]>(
        `SELECT
          cr.*,
          p.title AS post_title,
          u.full_name AS finder_name,
          p.contact_info AS finder_contact,
          hp_prop.name AS proposed_handover_point_name,
          hp_conf.name AS confirmed_handover_point_name,
          h.full_name AS assigned_handler_name
        FROM custody_requests cr
        INNER JOIN posts p ON p.id = cr.post_id
        INNER JOIN users u ON u.id = cr.finder_id
        LEFT JOIN handover_points hp_prop ON hp_prop.id = cr.proposed_handover_point_id
        LEFT JOIN handover_points hp_conf ON hp_conf.id = cr.confirmed_handover_point_id
        LEFT JOIN users h ON h.id = cr.assigned_handler_id
        WHERE cr.finder_id = ? AND cr.idempotency_key = ?
        LIMIT 1`,
        [finderId, idempotencyKey]
      );
      return rows[0] ? mapCustodyRow(rows[0]) : null;
    },

    async listCustodyRequests(query) {
      const conditions: string[] = [];
      const params: any[] = [];

      if (query.status && query.status !== "ALL") {
        conditions.push("cr.status = ?");
        params.push(query.status);
      }
      if (query.finderId) {
        conditions.push("cr.finder_id = ?");
        params.push(query.finderId);
      }
      if (query.postId) {
        conditions.push("cr.post_id = ?");
        params.push(query.postId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await runner().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM custody_requests cr ${whereClause}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);

      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await runner().execute<CustodyRequestRow[]>(
        `SELECT
          cr.*,
          p.title AS post_title,
          u.full_name AS finder_name,
          p.contact_info AS finder_contact,
          hp_prop.name AS proposed_handover_point_name,
          hp_conf.name AS confirmed_handover_point_name,
          h.full_name AS assigned_handler_name
        FROM custody_requests cr
        INNER JOIN posts p ON p.id = cr.post_id
        INNER JOIN users u ON u.id = cr.finder_id
        LEFT JOIN handover_points hp_prop ON hp_prop.id = cr.proposed_handover_point_id
        LEFT JOIN handover_points hp_conf ON hp_conf.id = cr.confirmed_handover_point_id
        LEFT JOIN users h ON h.id = cr.assigned_handler_id
        ${whereClause}
        ORDER BY cr.created_at DESC
        LIMIT ${Number(query.pageSize)} OFFSET ${Number(offset)}`,
        params
      );

      return {
        total,
        items: rows.map(mapCustodyRow)
      };
    },

    async updateCustodyRequest(id, data, custom) {
      const updates: string[] = [];
      const params: any[] = [];

      if (data.status) {
        updates.push("status = ?");
        params.push(data.status);
      }
      if (data.confirmedHandoverPointId !== undefined) {
        updates.push("confirmed_handover_point_id = ?");
        params.push(data.confirmedHandoverPointId);
      }
      if (data.assignedHandlerId !== undefined) {
        updates.push("assigned_handler_id = ?");
        params.push(data.assignedHandlerId);
      }
      if (data.warehouseItemId !== undefined) {
        updates.push("warehouse_item_id = ?");
        params.push(data.warehouseItemId);
      }

      if (updates.length === 0) return;

      params.push(id);
      await runner(custom).execute(
        `UPDATE custody_requests SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    },

    async createCustodyLog(data, custom) {
      await runner(custom).execute(
        `INSERT INTO custody_request_logs (
          id, custody_request_id, actor_id, action, from_status, to_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.id,
          data.custodyRequestId,
          data.actorId,
          data.action,
          data.fromStatus ?? null,
          data.toStatus ?? null,
          data.notes ?? null
        ]
      );
    },

    async listCustodyLogs(custodyRequestId) {
      const [rows] = await runner().execute<CustodyLogRow[]>(
        `SELECT
          crl.*,
          u.full_name AS actor_name
        FROM custody_request_logs crl
        INNER JOIN users u ON u.id = crl.actor_id
        WHERE crl.custody_request_id = ?
        ORDER BY crl.created_at ASC`,
        [custodyRequestId]
      );

      return rows.map((row: CustodyLogRow) => ({
        id: row.id,
        custodyRequestId: row.custody_request_id,
        actorId: row.actor_id,
        actorName: row.actor_name ?? undefined,
        action: row.action,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        notes: row.notes,
        createdAt: toIsoString(row.created_at)!
      }));
    },

    async findPostDetailsForIntake(postId, custom) {
      const [rows] = await runner(custom).execute<RowDataPacket[]>(
        `SELECT
          id, user_id, title, description, category_id, area_id, building_id,
          room_text, handover_point_id, contact_info, status, type
        FROM posts WHERE id = ? AND type = 'FOUND' AND deleted_at IS NULL`,
        [postId]
      );
      if (!rows[0]) return null;
      return {
        id: rows[0].id,
        userId: rows[0].user_id,
        title: rows[0].title,
        description: rows[0].description,
        categoryId: rows[0].category_id,
        areaId: rows[0].area_id,
        buildingId: rows[0].building_id,
        roomText: rows[0].room_text,
        handoverPointId: rows[0].handover_point_id,
        contactInfo: rows[0].contact_info,
        status: rows[0].status,
        type: rows[0].type
      };
    },

    async updatePostStatus(postId, status, custom) {
      const [result] = await runner(custom).execute<ResultSetHeader>(
        `UPDATE posts SET status = ? WHERE id = ? AND type = 'FOUND'
         AND deleted_at IS NULL AND status IN ('OPEN', 'MATCHED')`,
        [status, postId]
      );
      return result.affectedRows === 1;
    },

    async findStaffAndAdminUserIds() {
      const [rows] = await runner().execute<UserRow[]>(
        `SELECT DISTINCT u.id FROM users u
         INNER JOIN user_roles ur ON ur.user_id = u.id
         WHERE ur.role_code IN ('STAFF', 'ADMIN') AND u.status = 'ACTIVE'`
      );
      return rows.map((r: UserRow) => r.id);
    }
  };
}
