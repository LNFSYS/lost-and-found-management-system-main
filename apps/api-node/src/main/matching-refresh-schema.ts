import type { Pool, RowDataPacket } from "mysql2/promise";

export async function checkMatchingRefreshSchema(pool: Pick<Pool, "query">) {
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matching_jobs'
    AND COLUMN_NAME IN ('lease_token', 'lease_expires_at')`);
  return rows.some(row => row.name === "lease_token" && row.type === "char(36)" && row.nullable === "YES")
    && rows.some(row => row.name === "lease_expires_at" && row.type === "datetime(6)" && row.nullable === "YES");
}
