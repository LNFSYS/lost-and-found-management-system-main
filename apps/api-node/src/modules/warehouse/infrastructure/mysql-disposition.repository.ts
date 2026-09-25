import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type {
  DispositionOrderRecord,
  DispositionRepository,
  LegalHoldRecord,
  OverdueWarehouseItemRecord
} from "../application/disposition.repository.port.js";
import {
  checkDispositionEligibility,
  type DispositionOrderStatus,
  type DispositionType,
  type WarehouseStatus
} from "../domain/warehouse-policy.js";

interface LegalHoldRow extends RowDataPacket {
  id: string;
  warehouse_item_id: string;
  item_name: string | null;
  is_active: number | boolean;
  reason: string;
  applied_by: string;
  applied_by_name: string | null;
  applied_at: Date | string;
  released_by: string | null;
  released_by_name: string | null;
  released_at: Date | string | null;
  release_reason: string | null;
}

interface DispositionOrderRow extends RowDataPacket {
  id: string;
  order_number: string;
  disposition_type: DispositionType;
  status: DispositionOrderStatus;
  reason: string;
  created_by: string;
  created_by_name: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: Date | string | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_by_name: string | null;
  cancelled_at: Date | string | null;
  cancellation_reason: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface OverdueItemRow extends RowDataPacket {
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
  legal_hold_count: number;
  disposition_order_id: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  log_count: number | string;
  active_claims_count: number;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapLegalHoldRow(row: LegalHoldRow): LegalHoldRecord {
  return {
    id: row.id,
    warehouseItemId: row.warehouse_item_id,
    itemName: row.item_name ?? undefined,
    isActive: Boolean(row.is_active),
    reason: row.reason,
    appliedBy: {
      id: row.applied_by,
      fullName: row.applied_by_name
    },
    appliedAt: toIsoString(row.applied_at)!,
    releasedBy: row.released_by
      ? {
        id: row.released_by,
        fullName: row.released_by_name
      }
      : null,
    releasedAt: toIsoString(row.released_at),
    releaseReason: row.release_reason
  };
}

export function createMySqlDispositionRepository(pool: SqlExecutor): DispositionRepository {
  const runner = (custom?: TransactionContext): SqlExecutor => sqlExecutor(custom ?? pool);

  return {
    async createLegalHold(data, custom) {
      await runner(custom).execute(
        `INSERT INTO legal_holds (
          id, warehouse_item_id, is_active, reason, applied_by
        ) VALUES (?, ?, TRUE, ?, ?)`,
        [data.id, data.warehouseItemId, data.reason, data.appliedBy]
      );
    },

    async findLegalHoldById(id, custom) {
      const [rows] = await runner(custom).execute<LegalHoldRow[]>(
        `SELECT
          lh.*,
          wi.item_name,
          u_app.full_name AS applied_by_name,
          u_rel.full_name AS released_by_name
        FROM legal_holds lh
        INNER JOIN warehouse_items wi ON wi.id = lh.warehouse_item_id
        INNER JOIN users u_app ON u_app.id = lh.applied_by
        LEFT JOIN users u_rel ON u_rel.id = lh.released_by
        WHERE lh.id = ?`,
        [id]
      );
      return rows[0] ? mapLegalHoldRow(rows[0]) : null;
    },

    async listActiveLegalHolds(warehouseItemId, custom) {
      const [rows] = await runner(custom).execute<LegalHoldRow[]>(
        `SELECT
          lh.*,
          wi.item_name,
          u_app.full_name AS applied_by_name,
          u_rel.full_name AS released_by_name
        FROM legal_holds lh
        INNER JOIN warehouse_items wi ON wi.id = lh.warehouse_item_id
        INNER JOIN users u_app ON u_app.id = lh.applied_by
        LEFT JOIN users u_rel ON u_rel.id = lh.released_by
        WHERE lh.warehouse_item_id = ? AND lh.is_active = TRUE
        ORDER BY lh.applied_at DESC`,
        [warehouseItemId]
      );
      return rows.map(mapLegalHoldRow);
    },

    async releaseLegalHold(id, data, custom) {
      await runner(custom).execute(
        `UPDATE legal_holds SET
          is_active = FALSE,
          released_by = ?,
          released_at = ?,
          release_reason = ?
        WHERE id = ?`,
        [data.releasedBy, data.releasedAt, data.releaseReason, id]
      );
    },

    async incrementLegalHoldCount(warehouseItemId, amount, custom) {
      await runner(custom).execute(
        `UPDATE warehouse_items
         SET legal_hold_count = GREATEST(0, legal_hold_count + ?)
         WHERE id = ?`,
        [amount, warehouseItemId]
      );
    },

    async listOverdueItems(query) {
      const conditions: string[] = ["wi.retention_deadline IS NOT NULL", "wi.retention_deadline < NOW()"];
      const params: any[] = [];

      if (query.handoverPointId) {
        conditions.push("wi.handover_point_id = ?");
        params.push(query.handoverPointId);
      }
      if (query.legalHoldOnly) {
        conditions.push("wi.legal_hold_count > 0");
      }
      if (query.q?.trim()) {
        conditions.push("(wi.item_name LIKE ? OR wi.storage_code LIKE ?)");
        const term = `%${query.q.trim()}%`;
        params.push(term, term);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await runner().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM warehouse_items wi ${whereClause}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);

      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await runner().execute<OverdueItemRow[]>(
        `SELECT
          wi.*,
          hp.name AS handover_point_name,
          hp.address AS handover_point_address,
          c.name AS category_name,
          a.name AS area_name,
          b.name AS building_name,
          u_find.full_name AS finder_user_name,
          u_create.full_name AS created_by_name,
          (SELECT COUNT(*) FROM storage_logs sl WHERE sl.warehouse_item_id = wi.id) AS log_count,
          (SELECT COUNT(DISTINCT cl.id) FROM claims cl
           LEFT JOIN return_appointments ra ON ra.claim_id = cl.id AND ra.status IN ('PENDING', 'ACCEPTED', 'RESCHEDULED')
           LEFT JOIN chat_rooms cr ON cr.claim_id = cl.id AND cr.escalated_at IS NOT NULL
           WHERE cl.post_id = wi.post_id AND (cl.status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED')
             OR ra.id IS NOT NULL OR cr.id IS NOT NULL)) AS active_claims_count
        FROM warehouse_items wi
        LEFT JOIN handover_points hp ON hp.id = wi.handover_point_id
        LEFT JOIN item_categories c ON c.id = wi.category_id
        LEFT JOIN campus_areas a ON a.id = wi.area_id
        LEFT JOIN campus_buildings b ON b.id = wi.building_id
        LEFT JOIN users u_find ON u_find.id = wi.finder_user_id
        LEFT JOIN users u_create ON u_create.id = wi.created_by
        ${whereClause}
        ORDER BY wi.retention_deadline ASC
        LIMIT ${Number(query.pageSize)} OFFSET ${Number(offset)}`,
        params
      );

      const now = Date.now();
      const items: OverdueWarehouseItemRecord[] = rows.map((row: OverdueItemRow) => {
        const deadline = row.retention_deadline ? new Date(row.retention_deadline) : null;
        const diffMs = deadline ? now - deadline.getTime() : 0;
        const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        const activeClaimsCount = Number(row.active_claims_count ?? 0);
        const eligibility = checkDispositionEligibility({
          status: row.status,
          retentionDeadline: deadline,
          legalHoldCount: Number(row.legal_hold_count ?? 0),
          dispositionOrderId: row.disposition_order_id,
          activeClaimsCount
        });

        return {
          id: row.id,
          postId: row.post_id,
          handoverPoint: row.handover_point_id
            ? {
              id: row.handover_point_id,
              name: row.handover_point_name,
              address: row.handover_point_address
            }
            : null,
          itemName: row.item_name,
          description: row.description,
          category: row.category_id
            ? {
              id: row.category_id,
              name: row.category_name
            }
            : null,
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
          receivedAt: toIsoString(row.received_at)!,
          returnedAt: toIsoString(row.returned_at),
          retentionDeadline: toIsoString(row.retention_deadline),
          legalHoldCount: Number(row.legal_hold_count ?? 0),
          dispositionOrderId: row.disposition_order_id,
          createdBy: {
            id: row.created_by,
            fullName: row.created_by_name
          },
          createdAt: toIsoString(row.created_at)!,
          updatedAt: toIsoString(row.updated_at)!,
          logCount: Number(row.log_count ?? 0),
          daysOverdue,
          isEligibleForDisposition: eligibility.eligible,
          blockers: eligibility.blockers
        };
      });

      return { total, items };
    },

    async countActiveClaimsForPost(postId, custom) {
      const [rows] = await runner(custom).execute<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT cl.id) AS total FROM claims cl
         LEFT JOIN return_appointments ra ON ra.claim_id = cl.id AND ra.status IN ('PENDING', 'ACCEPTED', 'RESCHEDULED')
         LEFT JOIN chat_rooms cr ON cr.claim_id = cl.id AND cr.escalated_at IS NOT NULL
         WHERE cl.post_id = ? AND (cl.status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED')
           OR ra.id IS NOT NULL OR cr.id IS NOT NULL)`,
        [postId]
      );
      return Number(rows[0]?.total ?? 0);
    },

    async lockDispositionOrder(orderId, custom) {
      await runner(custom).execute(`SELECT id FROM disposition_orders WHERE id = ? FOR UPDATE`, [orderId]);
    },

    async lockWarehouseItem(itemId, custom) {
      await runner(custom).execute(`SELECT id FROM warehouse_items WHERE id = ? FOR UPDATE`, [itemId]);
    },

    async generateOrderNumber(type) {
      const prefix = type === "DISPOSAL" ? "DISP" : type === "DONATION" ? "DONA" : "TRAN";
      const year = new Date().getFullYear();
      const random = Math.floor(1000 + Math.random() * 9000);
      return `${prefix}-${year}-${random}`;
    },

    async createDispositionOrder(order, itemIds, custom) {
      await runner(custom).execute(
        `INSERT INTO disposition_orders (
          id, order_number, disposition_type, status, reason, created_by
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          order.id,
          order.orderNumber,
          order.dispositionType,
          order.status,
          order.reason,
          order.createdBy
        ]
      );

      for (const itemId of itemIds) {
        await runner(custom).execute(
          `INSERT INTO disposition_order_items (
            id, disposition_order_id, warehouse_item_id, status
          ) VALUES (UUID(), ?, ?, 'PENDING')`,
          [order.id, itemId]
        );
      }
    },

    async findDispositionOrderById(id, custom) {
      const [orderRows] = await runner(custom).execute<DispositionOrderRow[]>(
        `SELECT
          d.*,
          u_create.full_name AS created_by_name,
          u_app.full_name AS approved_by_name,
          u_canc.full_name AS cancelled_by_name,
          u_comp.full_name AS completed_by_name
        FROM disposition_orders d
        INNER JOIN users u_create ON u_create.id = d.created_by
        LEFT JOIN users u_app ON u_app.id = d.approved_by
        LEFT JOIN users u_canc ON u_canc.id = d.cancelled_by
        LEFT JOIN users u_comp ON u_comp.id = d.completed_by
        WHERE d.id = ?`,
        [id]
      );

      if (!orderRows[0]) return null;
      const row = orderRows[0];

      const [itemRows] = await runner(custom).execute<RowDataPacket[]>(
        `SELECT
          doi.id,
          doi.warehouse_item_id,
          wi.item_name,
          wi.storage_code,
          doi.status,
          doi.processed_at,
          doi.notes
        FROM disposition_order_items doi
        INNER JOIN warehouse_items wi ON wi.id = doi.warehouse_item_id
        WHERE doi.disposition_order_id = ?`,
        [id]
      );

      const [evidenceRows] = await runner(custom).execute<RowDataPacket[]>(
        `SELECT
          de.id,
          de.file_url,
          de.file_kind,
          de.description,
          de.created_at,
          u.id AS uploaded_by_id,
          u.full_name AS uploaded_by_name
        FROM disposition_evidence de
        INNER JOIN users u ON u.id = de.uploaded_by
        WHERE de.disposition_order_id = ?`,
        [id]
      );

      return {
        id: row.id,
        orderNumber: row.order_number,
        dispositionType: row.disposition_type,
        status: row.status,
        reason: row.reason,
        createdBy: {
          id: row.created_by,
          fullName: row.created_by_name
        },
        approvedBy: row.approved_by ? { id: row.approved_by, fullName: row.approved_by_name } : null,
        approvedAt: toIsoString(row.approved_at),
        rejectionReason: row.rejection_reason,
        cancelledBy: row.cancelled_by ? { id: row.cancelled_by, fullName: row.cancelled_by_name } : null,
        cancelledAt: toIsoString(row.cancelled_at),
        cancellationReason: row.cancellation_reason,
        completedBy: row.completed_by ? { id: row.completed_by, fullName: row.completed_by_name } : null,
        completedAt: toIsoString(row.completed_at),
        createdAt: toIsoString(row.created_at)!,
        updatedAt: toIsoString(row.updated_at)!,
        items: itemRows.map((it: RowDataPacket) => ({
          id: it.id,
          warehouseItemId: it.warehouse_item_id,
          itemName: it.item_name,
          storageCode: it.storage_code,
          status: it.status,
          processedAt: toIsoString(it.processed_at),
          notes: it.notes
        })),
        evidence: evidenceRows.map((ev: RowDataPacket) => ({
          id: ev.id,
          fileUrl: ev.file_url,
          fileKind: ev.file_kind,
          uploadedBy: {
            id: ev.uploaded_by_id,
            fullName: ev.uploaded_by_name
          },
          description: ev.description,
          createdAt: toIsoString(ev.created_at)!
        }))
      };
    },

    async listDispositionOrders(query) {
      const conditions: string[] = [];
      const params: any[] = [];

      if (query.status && query.status !== "ALL") {
        conditions.push("d.status = ?");
        params.push(query.status);
      }
      if (query.dispositionType && query.dispositionType !== "ALL") {
        conditions.push("d.disposition_type = ?");
        params.push(query.dispositionType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const [countRows] = await runner().execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM disposition_orders d ${whereClause}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);

      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await runner().execute<DispositionOrderRow[]>(
        `SELECT
          d.*,
          u_create.full_name AS created_by_name,
          u_app.full_name AS approved_by_name,
          u_canc.full_name AS cancelled_by_name,
          u_comp.full_name AS completed_by_name
        FROM disposition_orders d
        INNER JOIN users u_create ON u_create.id = d.created_by
        LEFT JOIN users u_app ON u_app.id = d.approved_by
        LEFT JOIN users u_canc ON u_canc.id = d.cancelled_by
        LEFT JOIN users u_comp ON u_comp.id = d.completed_by
        ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ${Number(query.pageSize)} OFFSET ${Number(offset)}`,
        params
      );

      return {
        total,
        items: rows.map((row: DispositionOrderRow) => ({
          id: row.id,
          orderNumber: row.order_number,
          dispositionType: row.disposition_type,
          status: row.status,
          reason: row.reason,
          createdBy: {
            id: row.created_by,
            fullName: row.created_by_name
          },
          approvedBy: row.approved_by ? { id: row.approved_by, fullName: row.approved_by_name } : null,
          approvedAt: toIsoString(row.approved_at),
          rejectionReason: row.rejection_reason,
          cancelledBy: row.cancelled_by ? { id: row.cancelled_by, fullName: row.cancelled_by_name } : null,
          cancelledAt: toIsoString(row.cancelled_at),
          cancellationReason: row.cancellation_reason,
          completedBy: row.completed_by ? { id: row.completed_by, fullName: row.completed_by_name } : null,
          completedAt: toIsoString(row.completed_at),
          createdAt: toIsoString(row.created_at)!,
          updatedAt: toIsoString(row.updated_at)!
        }))
      };
    },

    async updateDispositionOrderStatus(orderId, data, custom) {
      const updates: string[] = [];
      const params: any[] = [];

      if (data.status) {
        updates.push("status = ?");
        params.push(data.status);
      }
      if (data.approvedBy !== undefined) {
        updates.push("approved_by = ?");
        params.push(data.approvedBy);
      }
      if (data.approvedAt !== undefined) {
        updates.push("approved_at = ?");
        params.push(data.approvedAt);
      }
      if (data.rejectionReason !== undefined) {
        updates.push("rejection_reason = ?");
        params.push(data.rejectionReason);
      }
      if (data.cancelledBy !== undefined) {
        updates.push("cancelled_by = ?");
        params.push(data.cancelledBy);
      }
      if (data.cancelledAt !== undefined) {
        updates.push("cancelled_at = ?");
        params.push(data.cancelledAt);
      }
      if (data.cancellationReason !== undefined) {
        updates.push("cancellation_reason = ?");
        params.push(data.cancellationReason);
      }
      if (data.completedBy !== undefined) {
        updates.push("completed_by = ?");
        params.push(data.completedBy);
      }
      if (data.completedAt !== undefined) {
        updates.push("completed_at = ?");
        params.push(data.completedAt);
      }

      if (updates.length === 0) return;

      params.push(orderId);
      await runner(custom).execute(
        `UPDATE disposition_orders SET ${updates.join(", ")} WHERE id = ?`,
        params
      );
    },

    async attachOrderToWarehouseItems(itemIds, orderId, custom, expectedOrderId) {
      if (itemIds.length === 0) return 0;
      if (orderId === null && !expectedOrderId) throw new Error("Expected order ID is required when releasing items");
      const placeholders = itemIds.map(() => "?").join(", ");
      const [result] = await runner(custom).execute<ResultSetHeader>(
        `UPDATE warehouse_items SET disposition_order_id = ?
         WHERE id IN (${placeholders}) AND ${orderId === null ? "disposition_order_id = ?" : "disposition_order_id IS NULL"}`,
        orderId === null ? [null, ...itemIds, expectedOrderId ?? null] : [orderId, ...itemIds]
      );
      return result.affectedRows;
    },

    async addDispositionEvidence(evidence, custom) {
      for (const ev of evidence) {
        await runner(custom).execute(
          `INSERT INTO disposition_evidence (
            id, disposition_order_id, warehouse_item_id, file_url, file_kind, uploaded_by, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ev.id,
            ev.dispositionOrderId,
            ev.warehouseItemId ?? null,
            ev.fileUrl,
            ev.fileKind,
            ev.uploadedBy,
            ev.description ?? null
          ]
        );
      }
    },

    async markOrderItemsProcessed(orderId, processedItemIds, notes, custom) {
      if (processedItemIds.length === 0) return;
      const placeholders = processedItemIds.map(() => "?").join(", ");
      await runner(custom).execute(
        `UPDATE disposition_order_items
         SET status = 'PROCESSED', processed_at = NOW(), notes = ?
         WHERE disposition_order_id = ? AND status = 'PENDING' AND warehouse_item_id IN (${placeholders})`,
        [notes ?? null, orderId, ...processedItemIds]
      );
    },

    async updateWarehouseItemsStatus(orderId, itemIds, status, custom) {
      if (itemIds.length === 0) return 0;
      const placeholders = itemIds.map(() => "?").join(", ");
      const [result] = await runner(custom).execute<ResultSetHeader>(
        `UPDATE warehouse_items wi
         SET wi.status = ?, wi.disposition_order_id = NULL
         WHERE wi.id IN (${placeholders})
           AND wi.disposition_order_id = ?
           AND wi.status IN ('RECEIVED', 'STORED', 'EXPIRED')
           AND wi.retention_deadline < NOW()
           AND wi.legal_hold_count = 0
           AND NOT EXISTS (SELECT 1 FROM legal_holds lh WHERE lh.warehouse_item_id = wi.id AND lh.is_active = TRUE)
           AND EXISTS (SELECT 1 FROM disposition_order_items doi WHERE doi.disposition_order_id = ?
             AND doi.warehouse_item_id = wi.id AND doi.status = 'PENDING')
           AND NOT EXISTS (SELECT 1 FROM claims cl
             LEFT JOIN return_appointments ra ON ra.claim_id = cl.id AND ra.status IN ('PENDING', 'ACCEPTED', 'RESCHEDULED')
             LEFT JOIN chat_rooms cr ON cr.claim_id = cl.id AND cr.escalated_at IS NOT NULL
             WHERE cl.post_id = wi.post_id AND (cl.status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED')
               OR ra.id IS NOT NULL OR cr.id IS NOT NULL))`,
        [status, ...itemIds, orderId, orderId]
      );
      return result.affectedRows;
    }
  };
}
