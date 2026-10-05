import type { HandoverItemCount, StorageLogAction, WarehouseCatalog, WarehouseDashboardStats, WarehouseItem, WarehouseItemLock, WarehouseRepository, WarehouseStorageLog } from "../application/warehouse.repository.port.js";

export type { HandoverItemCount, StorageLogAction, WarehouseCatalog, WarehouseDashboardStats, WarehouseItem, WarehouseItemLock, WarehouseRepository, WarehouseStorageLog } from "../application/warehouse.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { claimantIdSql, finderIdSql } from "../../../shared/infrastructure/claim-identity-sql.js";

import type { RowDataPacket } from "mysql2";
import { randomUUID } from "node:crypto";

import type { PoolConnection } from "mysql2/promise";

import type { WarehouseStatus } from "../application/warehouse.dto.js";
import { createWarehouseIntakeRepository } from "./warehouse-intake.repository.js";

type DbExecutor = SqlExecutor | TransactionContext;

const verifiedClaimSql = `EXISTS(SELECT 1 FROM claim_audit_events e WHERE e.claim_id = c.id AND (
  (e.action IN ('VERIFICATION_ACCEPTED','VERIFICATION_DECISION_CORRECTED') AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.decision')) = 'VERIFY_FOR_MEETUP')
  OR (e.action = 'STAFF_CUSTODY_VERIFIED' AND JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.decision')) = 'VERIFY_FOR_CUSTODY_RETURN'
    AND EXISTS(SELECT 1 FROM warehouse_items wi WHERE wi.id = JSON_UNQUOTE(JSON_EXTRACT(e.metadata_json,'$.warehouseItemId'))
      AND wi.post_id = found.id AND wi.deleted_at IS NULL))
))`;

const returnClaimParticipantsSql = `FROM claims c
  JOIN posts identity_post ON identity_post.id = c.post_id
  JOIN posts found ON found.id = COALESCE(c.source_found_post_id,c.post_id) AND found.type = 'FOUND' AND found.deleted_at IS NULL
  JOIN claim_participants recipient ON recipient.claim_id = c.id AND recipient.user_id = ${claimantIdSql} AND recipient.user_id <> found.user_id AND recipient.consent_status = 'ACCEPTED'
  JOIN claim_participants finder ON finder.claim_id = c.id AND finder.user_id = found.user_id AND finder.user_id = ${finderIdSql} AND finder.consent_status = 'ACCEPTED'
  JOIN users u ON u.id = recipient.user_id AND u.status = 'ACTIVE'`;

const returnClaimReviewSql = `SELECT c.id AS claim_id,recipient.user_id AS recipient_id,u.full_name,c.description,c.status,
  (c.status = 'ACCEPTED' AND ${verifiedClaimSql}) AS verified ${returnClaimParticipantsSql}
  WHERE found.id = ? AND c.status IN ('CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED')`;

function mapClaimReview(row: RowDataPacket) {
  return { claimId: String(row.claim_id), recipientId: String(row.recipient_id), fullName: String(row.full_name ?? "Người nhận"), description: row.description ? String(row.description) : null, status: String(row.status), verified: Boolean(row.verified) };
}

interface WarehouseItemRow extends RowDataPacket {
  id: string;
  post_id: string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  handover_point_address: string | null;
  item_name: string;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  area_id: string | null;
  area_name: string | null;
  building_id: string | null;
  building_name: string | null;
  room_text: string | null;
  finder_user_id: string | null;
  finder_user_name: string | null;
  finder_name: string | null;
  finder_contact: string | null;
  status: WarehouseStatus;
  condition_notes: string | null;
  storage_code: string | null;
  received_at: Date | string;
  returned_at: Date | string | null;
  retention_deadline: Date | string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  log_count: number | string;
  received_quantity?: number | null;
  accessories?: string | null;
  thumbnail_id?: string | null;
  thumbnail_source?: "INTAKE" | "SOURCE_POST";
}

interface WarehouseItemLockRow extends RowDataPacket {
  id: string;
  post_id: string | null;
  handover_point_id: string;
  status: WarehouseStatus;
  condition_notes: string | null;
  storage_code: string | null;
  retention_deadline: Date | null;
  legal_hold: number;
  reserved_claim_id: string | null;
}

interface StorageLogRow extends RowDataPacket {
  id: string;
  warehouse_item_id: string | null;
  post_id: string | null;
  handover_point_id: string | null;
  handover_point_name: string | null;
  actor_id: string;
  actor_name: string | null;
  action: StorageLogAction;
  from_status: string | null;
  to_status: string | null;
  condition_notes: string | null;
  storage_code: string | null;
  note: string | null;
  created_at: Date | string;
}

interface StatsRow extends RowDataPacket {
  total_items: number | string | null;
  active_items: number | string | null;
  received_items: number | string | null;
  stored_items: number | string | null;
  returned_items: number | string | null;
  overdue_items: number | string | null;
}

interface HandoverCountRow extends RowDataPacket {
  handover_point_id: string;
  name: string;
  address: string;
  item_count: number | string | null;
  stored_count: number | string | null;
  overdue_count: number | string | null;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

interface CategoryNameRow extends RowDataPacket {
  id: string;
  name: string;
  parent_name: string | null;
}

interface BuildingRow extends RowDataPacket {
  id: string;
  area_id: string;
}

interface ConfigRow extends RowDataPacket {
  config_value: string;
}

const activeWarehouseStatusSql = "'PENDING_APPROVAL','RECEIVED','STORED','CLAIMED','EXPIRED'";

const itemSelect = `SELECT wi.id, wi.post_id, wi.handover_point_id, hp.name AS handover_point_name, hp.address AS handover_point_address,
  wi.item_name, wi.description, wi.category_id, c.name AS category_name,
  wi.area_id, a.name AS area_name, wi.building_id, b.name AS building_name, wi.room_text,
  wi.finder_user_id, fu.full_name AS finder_user_name, wi.finder_name, wi.finder_contact,
  wi.status, wi.condition_notes, wi.storage_code, wi.received_at, wi.returned_at, wi.retention_deadline,
  wi.created_by, cu.full_name AS created_by_name, wi.created_at, wi.updated_at,
  (SELECT COUNT(*) FROM storage_logs sl WHERE sl.warehouse_item_id = wi.id OR (wi.post_id IS NOT NULL AND sl.post_id = wi.post_id)) AS log_count,
  intake.received_quantity,intake.accessories,
  COALESCE((SELECT id FROM warehouse_intake_images WHERE intake_id = intake.id ORDER BY created_at,id LIMIT 1),
    (SELECT id FROM post_media WHERE post_id = wi.post_id AND media_kind = 'ITEM' ORDER BY sort_order,id LIMIT 1)) AS thumbnail_id,
  IF(EXISTS(SELECT 1 FROM warehouse_intake_images ii WHERE ii.intake_id = intake.id),'INTAKE','SOURCE_POST') AS thumbnail_source
  FROM warehouse_items wi
  LEFT JOIN handover_points hp ON hp.id = wi.handover_point_id
  LEFT JOIN item_categories c ON c.id = wi.category_id
  LEFT JOIN campus_areas a ON a.id = wi.area_id
  LEFT JOIN campus_buildings b ON b.id = wi.building_id
  LEFT JOIN users fu ON fu.id = wi.finder_user_id
  INNER JOIN users cu ON cu.id = wi.created_by
  LEFT JOIN warehouse_intake_sessions intake ON intake.warehouse_item_id = wi.id`;

function iso(value: Date | string | null) {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapItem(row: WarehouseItemRow): WarehouseItem {
  return {
    id: row.id,
    postId: row.post_id,
    handoverPoint: row.handover_point_id ? { id: row.handover_point_id, name: row.handover_point_name, address: row.handover_point_address } : null,
    itemName: row.item_name,
    description: row.description,
    category: row.category_id ? { id: row.category_id, name: row.category_name } : null,
    location: {
      area: row.area_id ? { id: row.area_id, name: row.area_name } : null,
      building: row.building_id ? { id: row.building_id, name: row.building_name } : null,
      roomText: row.room_text
    },
    finder: {
      userId: row.finder_user_id,
      userName: row.finder_user_name,
      name: row.finder_name,
      contact: row.finder_contact
    },
    status: row.status,
    conditionNotes: row.condition_notes,
    storageCode: row.storage_code,
    receivedAt: iso(row.received_at) ?? "",
    returnedAt: iso(row.returned_at),
    retentionDeadline: iso(row.retention_deadline),
    createdBy: { id: row.created_by, fullName: row.created_by_name },
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
    logCount: Number(row.log_count ?? 0),
    receivedQuantity: row.received_quantity ?? null,
    accessories: row.accessories ?? null,
    thumbnail: row.thumbnail_id ? { id: row.thumbnail_id, provenance: row.thumbnail_source ?? "SOURCE_POST" } : null
  };
}

function mapLog(row: StorageLogRow): WarehouseStorageLog {
  return {
    id: row.id,
    warehouseItemId: row.warehouse_item_id,
    postId: row.post_id,
    handoverPoint: row.handover_point_id ? { id: row.handover_point_id, name: row.handover_point_name } : null,
    actor: { id: row.actor_id, fullName: row.actor_name },
    action: row.action,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    conditionNotes: row.condition_notes,
    storageCode: row.storage_code,
    note: row.note,
    createdAt: iso(row.created_at) ?? ""
  };
}

function listWhere(input: { q?: string; status?: WarehouseStatus; handoverPointId?: string; }) {
  const where = ["wi.deleted_at IS NULL"];
  const values: Array<string> = [];
  if (input.status) {
    where.push("wi.status = ?");
    values.push(input.status);
  }
  if (input.handoverPointId) {
    where.push("wi.handover_point_id = ?");
    values.push(input.handoverPointId);
  }
  if (input.q) {
    where.push("(wi.item_name LIKE ? OR wi.description LIKE ? OR wi.storage_code LIKE ? OR wi.finder_name LIKE ?)");
    const term = `%${input.q}%`;
    values.push(term, term, term, term);
  }
  return { where: where.join(" AND "), values };
}

export function createWarehouseRepository(pool: SqlExecutor) {

  const warehouseRepository = {
    ...createWarehouseIntakeRepository(pool),
    async findItemByPostId(postId) {
      const [rows] = await pool.execute<RowDataPacket[]>("SELECT id,status FROM warehouse_items WHERE post_id = ? AND deleted_at IS NULL ORDER BY received_at DESC LIMIT 1", [postId]);
      return rows[0] ? { id: String(rows[0].id), status: rows[0].status as WarehouseStatus } : null;
    },
    async isAdmin(actorId, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<RowDataPacket[]>("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE u.id = ? AND u.status = 'ACTIVE' AND ur.role_code = 'ADMIN' LIMIT 1", [actorId]);
      return rows.length > 0;
    },
    async lockPhysicalPost(postId, db) {
      await sqlExecutor(db).execute("SELECT id FROM posts WHERE id = ? FOR UPDATE", [postId]);
    },
    async findCompletedReturn(itemId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT claim_id,recipient_id,recipient_name,recipient_identity,recipient_phone,authorized_by,proof_ids FROM warehouse_completed_returns WHERE warehouse_item_id = ?", [itemId]);
      const row = rows[0];
      return row ? {
        claimId: row.claim_id ? String(row.claim_id) : null,
        recipientId: row.recipient_id ? String(row.recipient_id) : null,
        receiverName: row.recipient_name ? String(row.recipient_name) : null,
        receiverIdentity: row.recipient_identity ? String(row.recipient_identity) : null,
        receiverPhone: row.recipient_phone ? String(row.recipient_phone) : null,
        actorId: String(row.authorized_by),
        proofIds: typeof row.proof_ids === "string" ? JSON.parse(row.proof_ids) : row.proof_ids as string[]
      } : null;
    },
    async listExpiredProofs(db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT id,storage_ref FROM warehouse_private_proofs WHERE attached_at IS NULL AND created_at < UTC_TIMESTAMP() - INTERVAL 72 HOUR LIMIT 50 FOR UPDATE");
      return rows.map(row => ({ id: String(row.id), storageRef: String(row.storage_ref) }));
    },
    async deleteUnusedProof(id, db) { await sqlExecutor(db).execute("DELETE FROM warehouse_private_proofs WHERE id = ? AND attached_at IS NULL", [id]); },
    async listOverdueRequests(db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(`SELECT cr.id,cr.post_id,cr.claim_id,cr.requester_id FROM custody_requests cr
        JOIN warehouse_items wi ON wi.id = cr.warehouse_item_id WHERE cr.status = 'INTAKED' AND wi.deleted_at IS NULL
        AND wi.status IN ('RECEIVED','STORED','CLAIMED','EXPIRED') AND wi.retention_deadline <= UTC_TIMESTAMP()
        AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.entity_type = 'CUSTODY_REQUEST' AND n.entity_id = cr.id AND n.type = 'CUSTODY_OVERDUE')
        ORDER BY wi.retention_deadline,cr.id LIMIT 100`);
      return rows.map(row => ({ id: String(row.id), postId: row.post_id as string | null, claimId: row.claim_id as string | null, requesterId: String(row.requester_id) }));
    },
    async isStaff(actorId, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<RowDataPacket[]>("SELECT ur.user_id FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.user_id = ? AND ur.role_code IN ('STAFF','ADMIN') AND u.status = 'ACTIVE' LIMIT 1", [actorId]);
      return rows.length > 0;
    },
    async lockFoundPost(postId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT id FROM posts WHERE id = ? AND type = 'FOUND' AND status IN ('OPEN','MATCHED') AND deleted_at IS NULL FOR UPDATE", [postId]);
      return rows.length === 1;
    },
    async hasItemForPost(postId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT id FROM warehouse_items WHERE post_id = ? AND deleted_at IS NULL LIMIT 1", [postId]);
      return rows.length > 0;
    },
    async hasBlockingCases(postId, db, completingClaimId) {
      if (!postId) return false;
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        `SELECT id FROM claims WHERE COALESCE(source_found_post_id,post_id) = ? AND status IN ('PENDING','CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED') AND (? IS NULL OR id <> ?)
         UNION SELECT a.id FROM return_appointments a JOIN claims c ON c.id = a.claim_id
         WHERE COALESCE(c.source_found_post_id,c.post_id) = ? AND a.status IN ('PENDING','ACCEPTED','RESCHEDULED') AND (? IS NULL OR c.id <> ?)
         UNION SELECT r.id FROM reports r WHERE r.status = 'PENDING' AND
           ((r.entity_type = 'POST' AND r.entity_id = ?) OR r.source_id IN (SELECT id FROM claims WHERE COALESCE(source_found_post_id,post_id) = ?)
            OR (r.entity_type = 'HANDOVER' AND r.entity_id IN (SELECT a.id FROM return_appointments a JOIN claims c ON c.id = a.claim_id WHERE COALESCE(c.source_found_post_id,c.post_id) = ?))
            OR (r.entity_type = 'CHAT' AND r.entity_id IN (SELECT room.id FROM chat_rooms room JOIN claims c ON c.id = room.claim_id WHERE COALESCE(c.source_found_post_id,c.post_id) = ?))) LIMIT 1`, [postId,completingClaimId ?? null,completingClaimId ?? null,postId,completingClaimId ?? null,completingClaimId ?? null,postId,postId,postId,postId]);
      return rows.length > 0;
    },
    async verifiedRecipient(claimId, postId, recipientId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(
        `SELECT c.id ${returnClaimParticipantsSql}
         WHERE recipient.user_id = ? AND c.id = ? AND found.id = ? AND c.status = 'ACCEPTED'
         AND ${verifiedClaimSql} LIMIT 1`, [recipientId,claimId,postId]);
      return rows.length === 1;
    },
    async listVerifiedRecipients(postId) {
      if (!postId) return [];
      const [rows] = await pool.execute<RowDataPacket[]>(`${returnClaimReviewSql} AND c.status = 'ACCEPTED' AND ${verifiedClaimSql}`, [postId]);
      return rows.map(row => ({ claimId: String(row.claim_id), recipientId: String(row.recipient_id), fullName: String(row.full_name ?? "Người nhận") }));
    },
    async listReturnClaimReviews(postId) {
      if (!postId) return [];
      const [rows] = await pool.execute<RowDataPacket[]>(`${returnClaimReviewSql} ORDER BY c.created_at,c.id`, [postId]);
      return rows.map(mapClaimReview);
    },
    async lockReturnClaim(claimId, postId, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(`${returnClaimReviewSql} AND c.id = ? FOR UPDATE`, [postId,claimId]);
      return rows[0] ? mapClaimReview(rows[0]) : null;
    },
    async recordStaffVerification(input, db) {
      const executor = sqlExecutor(db);
      await executor.execute("UPDATE claims SET status = 'ACCEPTED', accepted_at = COALESCE(accepted_at,UTC_TIMESTAMP()), updated_at = UTC_TIMESTAMP() WHERE id = ?", [input.claimId]);
      await executor.execute("INSERT INTO claim_audit_events (id,claim_id,actor_id,action,from_status,to_status,metadata_json) VALUES (?,?,?,'STAFF_CUSTODY_VERIFIED',?,'ACCEPTED',?)",
        [input.id,input.claimId,input.actorId,input.fromStatus,JSON.stringify({ decision: "VERIFY_FOR_CUSTODY_RETURN", warehouseItemId: input.itemId, recipientId: input.recipientId, reason: input.reason, verificationMode: "IN_PERSON" })]);
    },
    async reserve(itemId, claimId, db) {
      await sqlExecutor(db).execute("UPDATE warehouse_items SET reserved_claim_id = ? WHERE id = ?", [claimId,itemId]);
    },
    async completeReturn(input, db) {
      const executor = sqlExecutor(db);
      let appointmentId: string | null = null;
      if (input.claimId) {
        const [appointments] = await executor.execute<RowDataPacket[]>("SELECT id FROM return_appointments WHERE claim_id = ? AND status IN ('PENDING','ACCEPTED','RESCHEDULED') ORDER BY created_at DESC LIMIT 1 FOR UPDATE", [input.claimId]);
        appointmentId = appointments[0]?.id ? String(appointments[0].id) : randomUUID();
        if (!appointments.length) await executor.execute(
          "INSERT INTO return_appointments (id,claim_id,post_id,proposer_id,status,proposed_at) SELECT ?,c.id,COALESCE(c.source_found_post_id,c.post_id),?,'ACCEPTED',? FROM claims c WHERE c.id = ?",
          [appointmentId,input.actorId,input.completedAt,input.claimId]
        );
        await executor.execute("UPDATE return_appointments SET status = 'COMPLETED', completed_at = ?, custody_authorized_at = ?, custody_authorized_by = ? WHERE id = ?", [input.completedAt,input.completedAt,input.actorId,appointmentId]);
      }
      await executor.execute("INSERT INTO warehouse_completed_returns (id,warehouse_item_id,claim_id,appointment_id,recipient_id,recipient_name,recipient_phone,recipient_identity,authorized_by,proof_ids,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [input.id,input.itemId,input.claimId,appointmentId,input.recipientId,input.receiverName,input.receiverPhone,input.receiverIdentity,input.actorId,JSON.stringify(input.proofIds),input.completedAt]);
      if (input.claimId) {
        await executor.execute("UPDATE posts p JOIN claims c ON p.id IN (c.post_id,c.lost_post_id,c.source_found_post_id) SET p.status = 'RESOLVED', p.resolved_at = ?, p.updated_at = ? WHERE c.id = ? AND p.deleted_at IS NULL", [input.completedAt,input.completedAt,input.claimId]);
        await executor.execute("INSERT INTO claim_audit_events (id,claim_id,actor_id,action,from_status,to_status,metadata_json) VALUES (?,?,?,'CUSTODY_RETURN_COMPLETED','ACCEPTED','ACCEPTED',?)",
          [randomUUID(),input.claimId,input.actorId,JSON.stringify({ warehouseItemId: input.itemId, appointmentId, recipientId: input.recipientId })]);
      } else {
        await executor.execute("UPDATE posts p JOIN warehouse_items wi ON wi.post_id = p.id SET p.status = 'RESOLVED', p.resolved_at = ?, p.updated_at = ? WHERE wi.id = ? AND p.type = 'FOUND' AND p.deleted_at IS NULL", [input.completedAt,input.completedAt,input.itemId]);
      }
      return appointmentId;
    },
    async createProof(input) {
      await pool.execute("INSERT INTO warehouse_private_proofs (id,warehouse_item_id,uploaded_by,storage_ref,format,byte_size) VALUES (?,?,?,?,?,?)", [input.id,input.itemId,input.actorId,input.storageRef,input.format,input.bytes]);
    },
    async findProof(id, db) {
      const [rows] = await sqlExecutor(db ?? pool).execute<RowDataPacket[]>(`SELECT * FROM warehouse_private_proofs WHERE id = ? LIMIT 1${db ? " FOR UPDATE" : ""}`, [id]);
      const r = rows[0];
      return r ? { id: String(r.id), itemId: String(r.warehouse_item_id), actorId: String(r.uploaded_by), storageRef: String(r.storage_ref), format: String(r.format), attached: Boolean(r.attached_at) } : null;
    },
    async attachProof(id, db) { await sqlExecutor(db).execute("UPDATE warehouse_private_proofs SET attached_at = UTC_TIMESTAMP() WHERE id = ? AND attached_at IS NULL", [id]); },
    async createApproval(input, db) {
      await sqlExecutor(db).execute("INSERT INTO warehouse_action_approvals (id,warehouse_item_id,target_status,requested_by,reason) VALUES (?,?,?,?,?)", [input.id,input.itemId,input.target,input.actorId,input.reason]);
    },
    async lockApproval(id, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT * FROM warehouse_action_approvals WHERE id = ? FOR UPDATE", [id]);
      const r = rows[0];
      return r ? { id: String(r.id), itemId: String(r.warehouse_item_id), requesterId: String(r.requested_by), target: r.target_status as "DISPOSED" | "DONATED" | "TRANSFERRED", status: String(r.status) } : null;
    },
    async approveAction(id, actorId, db) { await sqlExecutor(db).execute("UPDATE warehouse_action_approvals SET status = 'APPROVED', approved_by = ?, approved_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'PENDING'", [actorId,id]); },
    async executeAction(id, db) { await sqlExecutor(db).execute("UPDATE warehouse_action_approvals SET status = 'EXECUTED', executed_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'APPROVED'", [id]); },
    async setLegalHold(itemId, held, db) { await sqlExecutor(db).execute("UPDATE warehouse_items SET legal_hold = ? WHERE id = ?", [held,itemId]); },
    async getCatalog(): Promise<WarehouseCatalog> {
      const [categoryRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string; parent_id: string | null; }>>(
        "SELECT id, name, parent_id FROM item_categories WHERE is_active = TRUE ORDER BY parent_id IS NOT NULL, sort_order, name"
      );
      const [areaRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string; }>>(
        "SELECT id, name FROM campus_areas WHERE is_active = TRUE ORDER BY sort_order, name"
      );
      const [buildingRows] = await pool.execute<Array<RowDataPacket & { id: string; area_id: string; name: string; }>>(
        "SELECT id, area_id, name FROM campus_buildings WHERE is_active = TRUE ORDER BY sort_order, name"
      );
      const [handoverRows] = await pool.execute<Array<RowDataPacket & { id: string; name: string; address: string; opening_hours: string | null; }>>(
        "SELECT id, name, address, opening_hours FROM handover_points WHERE is_active = TRUE ORDER BY name"
      );
      return {
        categories: categoryRows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id })),
        areas: areaRows.map((row) => ({ id: row.id, name: row.name })),
        buildings: buildingRows.map((row) => ({ id: row.id, areaId: row.area_id, name: row.name })),
        handoverPoints: handoverRows.map((row) => ({ id: row.id, name: row.name, address: row.address, openingHours: row.opening_hours }))
      };
    },

    async getStats(): Promise<WarehouseDashboardStats> {
      const [rows] = await pool.execute<StatsRow[]>(`SELECT
      COUNT(*) AS total_items,
      SUM(status IN (${activeWarehouseStatusSql})) AS active_items,
      SUM(status = 'RECEIVED') AS received_items,
      SUM(status = 'STORED') AS stored_items,
      SUM(status = 'RETURNED') AS returned_items,
      SUM(status IN (${activeWarehouseStatusSql}) AND retention_deadline IS NOT NULL AND retention_deadline < UTC_TIMESTAMP()) AS overdue_items
      FROM warehouse_items
      WHERE deleted_at IS NULL`);
      const row = rows[0];
      return {
        totalItems: Number(row?.total_items ?? 0),
        activeItems: Number(row?.active_items ?? 0),
        receivedItems: Number(row?.received_items ?? 0),
        storedItems: Number(row?.stored_items ?? 0),
        returnedItems: Number(row?.returned_items ?? 0),
        overdueItems: Number(row?.overdue_items ?? 0)
      };
    },

    async listHandoverCounts(): Promise<HandoverItemCount[]> {
      const [rows] = await pool.execute<HandoverCountRow[]>(`SELECT hp.id AS handover_point_id, hp.name, hp.address,
      COUNT(wi.id) AS item_count,
      SUM(wi.status = 'STORED') AS stored_count,
      SUM(wi.retention_deadline IS NOT NULL AND wi.retention_deadline < UTC_TIMESTAMP()) AS overdue_count
      FROM handover_points hp
      LEFT JOIN warehouse_items wi ON wi.handover_point_id = hp.id
        AND wi.deleted_at IS NULL
        AND wi.status IN (${activeWarehouseStatusSql})
      WHERE hp.is_active = TRUE
      GROUP BY hp.id, hp.name, hp.address
      ORDER BY hp.name`);
      return rows.map((row) => ({
        handoverPointId: row.handover_point_id,
        name: row.name,
        address: row.address,
        itemCount: Number(row.item_count ?? 0),
        storedCount: Number(row.stored_count ?? 0),
        overdueCount: Number(row.overdue_count ?? 0)
      }));
    },

    async listItems(input: { q?: string; status?: WarehouseStatus; handoverPointId?: string; page: number; pageSize: number; }) {
      const { where, values } = listWhere(input);
      const pageSize = Math.max(1, Math.min(50, Number(input.pageSize) || 12));
      const page = Math.max(1, Number(input.page) || 1);
      const offset = (page - 1) * pageSize;
      const [rows] = await pool.execute<WarehouseItemRow[]>(
        `${itemSelect} WHERE ${where}
      ORDER BY wi.received_at DESC, wi.id DESC
      LIMIT ${pageSize} OFFSET ${offset}`,
        values
      );
      const [countRows] = await pool.execute<CountRow[]>(`SELECT COUNT(*) AS total FROM warehouse_items wi WHERE ${where}`, values);
      return { total: Number(countRows[0]?.total ?? 0), items: rows.map(mapItem) };
    },

    async findItemById(itemId: string, db: DbExecutor = pool) {
      const [rows] = await sqlExecutor(db).execute<WarehouseItemRow[]>(`${itemSelect} WHERE wi.id = ? AND wi.deleted_at IS NULL LIMIT 1`, [itemId]);
      return rows[0] ? mapItem(rows[0]) : null;
    },

    async lockItemForUpdate(itemId: string, connection: PoolConnection | TransactionContext): Promise<WarehouseItemLock | null> {
      const [rows] = await sqlExecutor(connection).execute<WarehouseItemLockRow[]>(
        `SELECT id, post_id, handover_point_id, status, condition_notes, storage_code, retention_deadline, legal_hold, reserved_claim_id
       FROM warehouse_items
       WHERE id = ? AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
        [itemId]
      );
      const row = rows[0];
      return row ? {
        id: row.id,
        postId: row.post_id,
        handoverPointId: row.handover_point_id,
        status: row.status,
        conditionNotes: row.condition_notes,
        storageCode: row.storage_code,
        retentionDeadline: row.retention_deadline,
        legalHold: Boolean(row.legal_hold),
        reservedClaimId: row.reserved_claim_id
      } : null;
    },

    async createItem(input: {
      id: string;
      postId?: string | null;
      handoverPointId: string;
      itemName: string;
      description?: string | null;
      categoryId?: string | null;
      areaId?: string | null;
      buildingId?: string | null;
      roomText?: string | null;
      finderUserId?: string | null;
      finderName?: string | null;
      finderContact?: string | null;
      conditionNotes: string;
      storageCode?: string | null;
      receivedAt: Date;
      retentionDeadline: Date;
      createdBy: string;
    }, db: DbExecutor = pool) {
      await sqlExecutor(db).execute(
        `INSERT INTO warehouse_items (
        id, post_id, handover_point_id, item_name, description, category_id, area_id, building_id,
        room_text, finder_user_id, finder_name, finder_contact, status, condition_notes, storage_code,
        received_at, retention_deadline, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECEIVED', ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.postId ?? null,
          input.handoverPointId,
          input.itemName,
          input.description ?? null,
          input.categoryId ?? null,
          input.areaId ?? null,
          input.buildingId ?? null,
          input.roomText ?? null,
          input.finderUserId ?? null,
          input.finderName ?? null,
          input.finderContact ?? null,
          input.conditionNotes,
          input.storageCode ?? null,
          input.receivedAt,
          input.retentionDeadline,
          input.createdBy
        ]
      );
    },

    async updateItemState(itemId: string, input: {
      status?: WarehouseStatus;
      conditionNotes?: string | null;
      storageCode?: string | null;
      returnedAt?: Date | null;
    }, db: DbExecutor = pool) {
      const fields: string[] = [];
      const values: Array<string | Date | null> = [];
      if (input.status !== undefined) {
        fields.push("status = ?");
        values.push(input.status);
      }
      if (input.conditionNotes !== undefined) {
        fields.push("condition_notes = ?");
        values.push(input.conditionNotes);
      }
      if (input.storageCode !== undefined) {
        fields.push("storage_code = ?");
        values.push(input.storageCode);
      }
      if (input.returnedAt !== undefined) {
        fields.push("returned_at = ?");
        values.push(input.returnedAt);
      }
      if (!fields.length) return;
      await sqlExecutor(db).execute(`UPDATE warehouse_items SET ${fields.join(", ")} WHERE id = ?`, [...values, itemId]);
    },

    async createStorageLog(input: {
      id: string;
      warehouseItemId: string;
      postId?: string | null;
      handoverPointId: string;
      actorId: string;
      action: StorageLogAction;
      fromStatus?: string | null;
      toStatus?: string | null;
      conditionNotes?: string | null;
      storageCode?: string | null;
      note?: string | null;
    }, db: DbExecutor = pool) {
      await sqlExecutor(db).execute(
        `INSERT INTO storage_logs (
        id, warehouse_item_id, post_id, handover_point_id, actor_id, action,
        from_status, to_status, condition_notes, storage_code, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.warehouseItemId,
          input.postId ?? null,
          input.handoverPointId,
          input.actorId,
          input.action,
          input.fromStatus ?? null,
          input.toStatus ?? null,
          input.conditionNotes ?? null,
          input.storageCode ?? null,
          input.note ?? null
        ]
      );
    },

    async listLogs(itemId: string) {
      const [rows] = await pool.execute<StorageLogRow[]>(
        `SELECT sl.id, sl.warehouse_item_id, sl.post_id, sl.handover_point_id, hp.name AS handover_point_name,
        sl.actor_id, u.full_name AS actor_name, sl.action, sl.from_status, sl.to_status,
        sl.condition_notes, sl.storage_code, sl.note, sl.created_at
       FROM storage_logs sl
       LEFT JOIN handover_points hp ON hp.id = sl.handover_point_id
       INNER JOIN users u ON u.id = sl.actor_id
       WHERE sl.warehouse_item_id = ?
          OR sl.post_id = (SELECT post_id FROM warehouse_items WHERE id = ? AND post_id IS NOT NULL)
       ORDER BY sl.created_at DESC, sl.id DESC`,
        [itemId, itemId]
      );
      return rows.map(mapLog);
    },

    async generateNextStorageCode(db: DbExecutor = pool) {
      return `WH-${new Date().getUTCFullYear()}-${randomUUID()}`;
    },

    async findHandoverPointById(id: string) {
      const [rows] = await pool.execute<IdRow[]>("SELECT id FROM handover_points WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
      return rows[0]?.id ?? null;
    },

    async findAreaById(id: string) {
      const [rows] = await pool.execute<IdRow[]>("SELECT id FROM campus_areas WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
      return rows[0]?.id ?? null;
    },

    async findBuildingById(id: string) {
      const [rows] = await pool.execute<BuildingRow[]>("SELECT id, area_id FROM campus_buildings WHERE id = ? AND is_active = TRUE LIMIT 1", [id]);
      return rows[0] ? { id: rows[0].id, areaId: rows[0].area_id } : null;
    },

    async findPostById(id: string) {
      const [rows] = await pool.execute<IdRow[]>("SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL LIMIT 1", [id]);
      return rows[0]?.id ?? null;
    },

    async updatePostStatus(id: string, status: string, db: DbExecutor = pool) {
      await sqlExecutor(db).execute("UPDATE posts SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
    },

    async getPostInfoForIntake(postId: string, db: DbExecutor = pool) {
      const [rows] = await sqlExecutor(db).execute<Array<RowDataPacket & {
        title: string;
        description: string | null;
        category_id: string | null;
        area_id: string | null;
        building_id: string | null;
        room_text: string | null;
        user_id: string;
        user_name: string | null;
        phone_number: string | null;
      }>>(
        `SELECT p.title, p.description, p.category_id, p.area_id, p.building_id, p.room_text,
                p.user_id, u.full_name AS user_name, u.phone_number
         FROM posts p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.id = ? AND p.type = 'FOUND' AND p.deleted_at IS NULL LIMIT 1`,
        [postId]
      );
      if (!rows[0]) return null;
      return {
        title: rows[0].title,
        description: rows[0].description,
        categoryId: rows[0].category_id,
        areaId: rows[0].area_id,
        buildingId: rows[0].building_id,
        roomText: rows[0].room_text,
        finderUserId: rows[0].user_id,
        finderName: rows[0].user_name,
        finderContact: rows[0].phone_number
      };
    },

    async findCategoryNames(id: string) {
      const [rows] = await pool.execute<CategoryNameRow[]>(
        `SELECT c.id, c.name, p.name AS parent_name
       FROM item_categories c
       LEFT JOIN item_categories p ON p.id = c.parent_id
       WHERE c.id = ? AND c.is_active = TRUE
       LIMIT 1`,
        [id]
      );
      return rows[0] ? { id: rows[0].id, name: rows[0].name, parentName: rows[0].parent_name } : null;
    },

    async getConfigInt(key: string, fallback: number) {
      const [rows] = await pool.execute<ConfigRow[]>("SELECT config_value FROM config_entries WHERE config_key = ? LIMIT 1", [key]);
      const value = Number(rows[0]?.config_value);
      return Number.isInteger(value) && value > 0 && value <= 3650 ? value : fallback;
    }
  } satisfies WarehouseRepository;

  return warehouseRepository;

}
