import type { PoolConnection } from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { Role, User } from "../types/auth.js";

type Queryable = Pick<PoolConnection, "execute">;
interface UserRow extends RowDataPacket {
  id: string; email: string; full_name: string; student_code: string | null; phone_number: string | null;
  password_hash: string; status: "ACTIVE" | "DISABLED"; session_version: number; created_at: Date; updated_at: Date; roles: string | null;
}

function mapUser(row: UserRow): User & { sessionVersion: number } {
  return {
    id: row.id, email: row.email, fullName: row.full_name, studentCode: row.student_code, phoneNumber: row.phone_number,
    status: row.status, sessionVersion: row.session_version, roles: (row.roles?.split(",").filter(Boolean) ?? []) as Role[],
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
  };
}

const selectUser = `SELECT u.id, u.email, u.password_hash, u.full_name, u.student_code, u.phone_number, u.status, u.session_version, u.created_at, u.updated_at,
  GROUP_CONCAT(ur.role_code ORDER BY ur.role_code SEPARATOR ',') AS roles
  FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id`;

export const userRepository = {
  async findByEmail(normalizedEmail: string, connection: Queryable = pool) {
    const [rows] = await connection.execute<UserRow[]>(`${selectUser} WHERE u.normalized_email = ? GROUP BY u.id`, [normalizedEmail]);
    return rows[0] ? mapUser(rows[0]) : null;
  },
  async findAuthByEmail(normalizedEmail: string, connection: Queryable = pool) {
    const [rows] = await connection.execute<UserRow[]>(`${selectUser} WHERE u.normalized_email = ? GROUP BY u.id`, [normalizedEmail]);
    return rows[0] ? { user: mapUser(rows[0]), passwordHash: rows[0].password_hash } : null;
  },
  async findById(id: string, connection: Queryable = pool) {
    const [rows] = await connection.execute<UserRow[]>(`${selectUser} WHERE u.id = ? GROUP BY u.id`, [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  },
  async create(input: { id: string; email: string; normalizedEmail: string; passwordHash: string; fullName: string; studentCode?: string; phoneNumber?: string }, connection: Queryable) {
    await connection.execute(`INSERT INTO users (id, email, normalized_email, password_hash, full_name, student_code, phone_number, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`, [input.id, input.email, input.normalizedEmail, input.passwordHash, input.fullName, input.studentCode ?? null, input.phoneNumber ?? null]);
  },
  async assignRole(userId: string, role: Role, connection: Queryable) {
    await connection.execute("INSERT IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?)", [userId, role]);
  },
  async updateProfile(userId: string, input: { fullName?: string; studentCode?: string | null; phoneNumber?: string | null }) {
    const fields: string[] = []; const values: Array<string | null> = [];
    if (input.fullName !== undefined) { fields.push("full_name = ?"); values.push(input.fullName); }
    if (input.studentCode !== undefined) { fields.push("student_code = ?"); values.push(input.studentCode); }
    if (input.phoneNumber !== undefined) { fields.push("phone_number = ?"); values.push(input.phoneNumber); }
    await pool.execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, userId]);
    return this.findById(userId);
  },
  async updateLastLogin(userId: string) { await pool.execute("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [userId]); },
  async updatePasswordAndInvalidateSessions(userId: string, passwordHash: string, connection: Queryable) {
    await connection.execute("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", [passwordHash, userId]);
    await connection.execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
  }
};
