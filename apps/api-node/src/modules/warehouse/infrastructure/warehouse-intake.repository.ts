import type { RowDataPacket } from "mysql2";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { WarehouseRepository } from "../application/warehouse.repository.port.js";
import type { WarehouseImageRecord } from "../application/intake-evidence.dto.js";
import { photoCustodyJoins, photoCustodyScope } from "./photo-custody-source.js";

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value == null ? null : String(value);
function image(row: RowDataPacket): WarehouseImageRecord {
  return { id: String(row.id), provenance: row.provenance, storageRef: String(row.storage_ref), format: String(row.format ?? "jpg"),
    uploaderId: String(row.uploaded_by), uploadedAt: iso(row.uploaded_at)!, capturedAt: iso(row.captured_at),
    postId: row.post_id ?? null, intakeKey: row.intake_id ?? null, returnId: row.return_id ?? null };
}
const sourceSelect = `SELECT pm.id,'SOURCE_POST' AS provenance,pm.secure_url AS storage_ref,pm.format,p.user_id AS uploaded_by,
  pm.created_at AS uploaded_at,NULL AS captured_at,p.id AS post_id,NULL AS intake_id,NULL AS return_id
  FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.deleted_at IS NULL AND p.type = 'FOUND' AND pm.media_kind = 'ITEM'`;
const intakeSelect = `SELECT i.id,'INTAKE' AS provenance,i.storage_ref,i.format,i.uploaded_by,i.created_at AS uploaded_at,
  i.captured_at,wi.post_id,s.id AS intake_id,NULL AS return_id FROM warehouse_intake_images i
  JOIN warehouse_intake_sessions s ON s.id = i.intake_id LEFT JOIN warehouse_items wi ON wi.id = s.warehouse_item_id`;
const returnSelect = `SELECT p.id,'RETURN' AS provenance,p.storage_ref,p.format,p.uploaded_by,p.created_at AS uploaded_at,
  NULL AS captured_at,wi.post_id,NULL AS intake_id,r.id AS return_id FROM warehouse_private_proofs p
  JOIN warehouse_completed_returns r ON r.warehouse_item_id = p.warehouse_item_id AND JSON_CONTAINS(r.proof_ids,JSON_QUOTE(p.id))
  JOIN warehouse_items wi ON wi.id = p.warehouse_item_id AND wi.deleted_at IS NULL`;
const contactSelect = `SELECT contact_photo.id,'CONTACT_PHOTO' AS provenance,contact_photo.storage_ref,contact_photo.format,
  photo_user.id AS uploaded_by,contact_photo.consumed_at AS uploaded_at,NULL AS captured_at,c.post_id,NULL AS intake_id,NULL AS return_id
  FROM claims c ${photoCustodyJoins} JOIN custody_requests cr ON cr.claim_id = c.id AND cr.post_id IS NULL
    AND cr.room_id = photo_room.id AND cr.requester_id = photo_user.id AND cr.intake_type = 'CUSTODY_TRANSFER'
  WHERE ${photoCustodyScope}`;

export function createWarehouseIntakeRepository(pool: SqlExecutor): Pick<WarehouseRepository,
  "openIntakeSession" | "lockIntakeSession" | "listIntakeImages" | "deleteDraftIntakeImage" | "listExpiredIntakeSessions" | "deleteExpiredIntakeSession" | "createIntakeImage" | "completeIntakeSession" | "listItemImages" | "listSourceImages" | "findWarehouseImage" | "findIntakeImage"> {
  return {
    async openIntakeSession(id, actorId, custodyRequestId, db) {
      await sqlExecutor(db).execute("INSERT INTO warehouse_intake_sessions (id,actor_id,custody_request_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE id = id", [id,actorId,custodyRequestId]);
    },
    async lockIntakeSession(id, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT * FROM warehouse_intake_sessions WHERE id = ? FOR UPDATE", [id]);
      const row = rows[0];
      return row ? { id: String(row.id), actorId: String(row.actor_id), custodyRequestId: row.custody_request_id ?? null,
        warehouseItemId: row.warehouse_item_id ?? null, createdAt: iso(row.created_at)!, requestPayload: row.request_payload ? JSON.stringify(typeof row.request_payload === "string" ? JSON.parse(row.request_payload) : row.request_payload) : null } : null;
    },
    async listIntakeImages(key, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(`${intakeSelect} WHERE s.id = ? ORDER BY i.created_at,i.id`, [key]);
      return rows.map(image);
    },
    async findIntakeImage(id) {
      const [rows] = await pool.execute<RowDataPacket[]>(`${intakeSelect} WHERE i.id = ?`, [id]);
      return rows[0] ? image(rows[0]) : null;
    },
    async deleteDraftIntakeImage(id, db) {
      await sqlExecutor(db).execute(`DELETE i FROM warehouse_intake_images i JOIN warehouse_intake_sessions s ON s.id = i.intake_id
        WHERE i.id = ? AND s.warehouse_item_id IS NULL`, [id]);
    },
    async listExpiredIntakeSessions(db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>(`SELECT id FROM warehouse_intake_sessions
        WHERE warehouse_item_id IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 72 HOUR)
        ORDER BY created_at LIMIT 50 FOR UPDATE SKIP LOCKED`);
      return rows.map(row => String(row.id));
    },
    async deleteExpiredIntakeSession(id, db) {
      await sqlExecutor(db).execute("DELETE FROM warehouse_intake_sessions WHERE id = ? AND warehouse_item_id IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 72 HOUR)", [id]);
    },
    async createIntakeImage(input, db) {
      await sqlExecutor(db).execute("INSERT INTO warehouse_intake_images (id,intake_id,uploaded_by,storage_ref,format,byte_size,captured_at) VALUES (?,?,?,?,?,?,?)",
        [input.id,input.intakeKey,input.actorId,input.storageRef,input.format,input.bytes,input.capturedAt]);
    },
    async completeIntakeSession(input, db) {
      await sqlExecutor(db).execute(`UPDATE warehouse_intake_sessions SET warehouse_item_id = ?,request_payload = ?,source_snapshot = ?,
        received_quantity = ?,accessories = ?,confirmed_at = UTC_TIMESTAMP(6) WHERE id = ? AND warehouse_item_id IS NULL`,
        [input.itemId,input.requestPayload,JSON.stringify(input.sourceSnapshot),input.quantity,input.accessories,input.id]);
    },
    async listSourceImages(postId) {
      const [rows] = await pool.execute<RowDataPacket[]>(`${sourceSelect} AND p.id = ? ORDER BY pm.sort_order,pm.created_at,pm.id`, [postId]);
      return rows.map(image);
    },
    async listItemImages(itemId) {
      const [rows] = await pool.execute<RowDataPacket[]>(`${sourceSelect} AND p.id IN (SELECT post_id FROM warehouse_items WHERE id = ? AND deleted_at IS NULL)
        UNION ALL ${intakeSelect} WHERE s.warehouse_item_id = ? AND wi.deleted_at IS NULL
        UNION ALL ${returnSelect} WHERE wi.id = ?
        UNION ALL ${contactSelect} AND cr.status = 'INTAKED' AND cr.warehouse_item_id = ? ORDER BY uploaded_at,id`, [itemId,itemId,itemId,itemId]);
      return rows.map(image);
    },
    async findWarehouseImage(id, provenance) {
      let query: string;
      if (provenance === "SOURCE_POST") query = `${sourceSelect} AND pm.id = ? AND (
        EXISTS(SELECT 1 FROM custody_requests cr WHERE cr.post_id = p.id)
        OR EXISTS(SELECT 1 FROM warehouse_items wi WHERE wi.post_id = p.id AND wi.deleted_at IS NULL))`;
      else if (provenance === "RETURN") query = `${returnSelect} WHERE p.id = ?`;
      else if (provenance === "CONTACT_PHOTO") query = `${contactSelect} AND contact_photo.id = ?
        AND (cr.status IN ('PENDING','ACCEPTED') OR (cr.status = 'INTAKED'
          AND EXISTS(SELECT 1 FROM warehouse_items wi WHERE wi.id = cr.warehouse_item_id AND wi.deleted_at IS NULL))) LIMIT 1`;
      else query = `${intakeSelect} WHERE i.id = ? AND (s.warehouse_item_id IS NULL OR (wi.id IS NOT NULL AND wi.deleted_at IS NULL))`;
      const [rows] = await pool.execute<RowDataPacket[]>(query, [id]);
      return rows[0] ? image(rows[0]) : null;
    }
  };
}
