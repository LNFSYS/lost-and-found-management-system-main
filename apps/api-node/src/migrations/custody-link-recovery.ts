import type { RowDataPacket } from "mysql2/promise";
import type { MigrationConnection, MigrationPool } from "./migration-state.js";
import { withMigrationLock } from "./migration-state.js";

async function invalidLinks(connection: MigrationConnection, lock: boolean) {
  const [rows] = await connection.query(`SELECT cr.id, cr.post_id, cr.requester_id, cr.claim_id, cr.room_id,
    cr.status, cr.warehouse_item_id, p.type AS post_type, p.user_id AS post_owner
    FROM custody_requests cr JOIN posts p ON p.id=cr.post_id
    WHERE cr.intake_type='CUSTODY_TRANSFER' AND (p.type<>'FOUND' OR p.user_id<>cr.requester_id)
    ORDER BY cr.id ${lock ? "FOR UPDATE" : ""}`);
  return rows as RowDataPacket[];
}

export async function recoverCustodyLinks(input: { pool: MigrationPool; apply?: boolean; expectedDatabase?: string; operationRef?: string }) {
  return withMigrationLock(input.pool, async (connection, database) => {
    if (input.apply && (input.expectedDatabase !== database || !input.operationRef?.trim())) throw new Error("Recovery requires exact database confirmation and operation reference");
    await connection.query(input.apply ? "START TRANSACTION" : "START TRANSACTION READ ONLY");
    try {
      const rows = await invalidLinks(connection, Boolean(input.apply));
      let held = 0, recorded = 0;
      if (input.apply) for (const row of rows) {
        const [existing] = await connection.query("SELECT custody_request_id,status FROM custody_link_recovery_reviews WHERE custody_request_id=? FOR UPDATE", [row.id]);
        const review = (existing as RowDataPacket[])[0];
        if (review?.status === "RESOLVED") throw new Error("Previously resolved recovery review still has invalid links; explicit new review is required");
        if (!review) {
          await connection.query(`INSERT INTO custody_link_recovery_reviews(custody_request_id,warehouse_item_id,reason,original_links,operation_ref)
            VALUES(?,?, 'INVALID_PHYSICAL_FOUND_LINK',?,?)`, [row.id, row.warehouse_item_id, JSON.stringify(row), input.operationRef]);
          recorded++;
        }
        if (row.warehouse_item_id) {
          const [items] = await connection.query("SELECT id,status,legal_hold FROM warehouse_items WHERE id=? FOR UPDATE", [row.warehouse_item_id]);
          const item = (items as RowDataPacket[])[0];
          if (!item) throw new Error("Recovery linked warehouse item is missing");
          if (!["RETURNED", "DISPOSED", "DONATED", "TRANSFERRED"].includes(item.status) && !Number(item.legal_hold)) {
            await connection.query("UPDATE warehouse_items SET legal_hold=TRUE WHERE id=?", [item.id]);
            held++;
          }
        }
      }
      await connection.query(input.apply ? "COMMIT" : "ROLLBACK");
      return { database, invalidRequests: rows.length, newlyRecorded: recorded, newlyHeld: held, applied: Boolean(input.apply),
        unresolved: rows.map(row => ({ requestId: row.id, status: row.status, warehouseItemId: row.warehouse_item_id })) };
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => undefined);
      throw error;
    }
  });
}
