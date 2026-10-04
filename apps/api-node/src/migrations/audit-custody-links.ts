import type { RowDataPacket } from "mysql2";
import { createDatabasePool } from "../shared/infrastructure/config/db.js";

// Operator diagnostic: aggregate counts only; never fixes shared records.
const pool = createDatabasePool();
const db = await pool.getConnection();
try {
  await db.query("START TRANSACTION READ ONLY");
  const [columns] = await db.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'claims' AND COLUMN_NAME = 'source_found_post_id'");
  const found = columns.length ? "COALESCE(c.source_found_post_id,c.post_id)" : "c.post_id";
  const [links] = await db.query<RowDataPacket[]>(`SELECT
    (SELECT COUNT(*) FROM custody_requests cr JOIN posts p ON p.id = cr.post_id WHERE p.type <> 'FOUND') AS custody_linked_to_lost,
    (SELECT COUNT(*) FROM custody_requests cr JOIN posts p ON p.id = cr.post_id WHERE cr.requester_id <> p.user_id) AS custody_wrong_owner,
    (SELECT COUNT(*) FROM claims c JOIN posts p ON p.id = ${found} WHERE p.type = 'LOST') AS conversations_without_found_source,
    (SELECT COUNT(*) FROM (SELECT post_id FROM custody_requests WHERE status IN ('PENDING','ACCEPTED','INTAKED') AND post_id IS NOT NULL GROUP BY post_id HAVING COUNT(*) > 1) duplicates) AS duplicate_active_requests,
    (SELECT COUNT(*) FROM (SELECT post_id FROM warehouse_items WHERE deleted_at IS NULL AND post_id IS NOT NULL AND status IN ('RECEIVED','STORED','CLAIMED','EXPIRED') GROUP BY post_id HAVING COUNT(*) > 1) duplicates) AS duplicate_active_items`);
  console.info("Read-only custody linkage audit", links[0]);
} finally {
  await db.rollback();
  db.release();
  await pool.end();
}
