import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import type { Role } from "../../../shared/domain/auth.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { AdminAccessRole, AdminUserStatus, ListAdminUsersQuery } from "../application/admin-user.dto.js";
import type { AdminUserRecord } from "../application/admin-user.repository.port.js";
export type { AdminUserRecord, AdminUserRepository } from "../application/admin-user.repository.port.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;
type SqlValue = string | number | null;



interface AdminUserRow extends RowDataPacket {
  id: string;
  email: string;
  full_name: string;
  student_code: string | null;
  phone_number: string | null;
  status: AdminUserStatus;
  created_at: Date;
  updated_at: Date;
  roles: string | null;
}

interface CountRow extends RowDataPacket {
  total: number | string;
}

interface IdRow extends RowDataPacket {
  id: string;
}

const selectAdminUser = `SELECT u.id, u.email, u.full_name, u.student_code, u.phone_number, u.status, u.created_at, u.updated_at,
  GROUP_CONCAT(ur.role_code ORDER BY ur.role_code SEPARATOR ',') AS roles
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id`;

function mapAdminUser(row: AdminUserRow): AdminUserRecord {
  const roles = (row.roles?.split(",").filter(Boolean) ?? []) as Role[];
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    studentCode: row.student_code,
    phoneNumber: row.phone_number,
    status: row.status,
    roles,
    accessRole: roles.includes("ADMIN") ? "ADMIN" : roles.includes("STAFF") ? "STAFF" : "USER",
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

function buildUserFilters(filters: ListAdminUsersQuery) {
  const where: string[] = [];
  const values: SqlValue[] = [];

  if (filters.status) {
    where.push("u.status = ?");
    values.push(filters.status);
  }
  if (filters.q) {
    where.push("(u.email LIKE ? OR u.full_name LIKE ? OR u.student_code LIKE ? OR u.phone_number LIKE ?)");
    const q = `%${filters.q}%`;
    values.push(q, q, q, q);
  }
  if (filters.role === "ADMIN") {
    where.push("EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role_code = 'ADMIN')");
  }
  if (filters.role === "STAFF") {
    where.push("EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role_code = 'STAFF')");
    where.push("NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role_code = 'ADMIN')");
  }
  if (filters.role === "USER") {
    where.push("NOT EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role_code IN ('STAFF', 'ADMIN'))");
  }

  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

export function createAdminUserRepository(database: SqlExecutor) {
  return {
    async listUsers(filters: ListAdminUsersQuery) {
      const { sql, values } = buildUserFilters(filters);
      const limit = filters.pageSize;
      const offset = (filters.page - 1) * filters.pageSize;
      const [countRows] = await sqlExecutor(database).execute<CountRow[]>(`SELECT COUNT(*) AS total FROM users u ${sql}`, values);
      const [rows] = await sqlExecutor(database).execute<AdminUserRow[]>(
        `${selectAdminUser} ${sql} GROUP BY u.id ORDER BY u.created_at DESC, u.id DESC LIMIT ${limit} OFFSET ${offset}`,
        values
      );

      return {
        total: Number(countRows[0]?.total ?? 0),
        page: filters.page,
        pageSize: filters.pageSize,
        items: rows.map(mapAdminUser)
      };
    },

    async findById(userId: string, connection: Queryable = database, forUpdate = false) {
      const [rows] = await sqlExecutor(connection).execute<AdminUserRow[]>(`${selectAdminUser} WHERE u.id = ? GROUP BY u.id${forUpdate ? " FOR UPDATE" : ""}`, [userId]);
      return rows[0] ? mapAdminUser(rows[0]) : null;
    },

    async findByNormalizedEmail(normalizedEmail: string, exceptUserId?: string, connection: Queryable = database): Promise<string | null> {
      const [rows] = await sqlExecutor(connection).execute<IdRow[]>(
        `SELECT id FROM users WHERE normalized_email = ? ${exceptUserId ? "AND id <> ?" : ""} LIMIT 1`,
        exceptUserId ? [normalizedEmail, exceptUserId] : [normalizedEmail]
      );
      return rows[0]?.id ?? null;
    },

    async createUser(input: {
      id: string;
      email: string;
      normalizedEmail: string;
      passwordHash: string;
      fullName: string;
      studentCode?: string | null;
      phoneNumber?: string | null;
      status: AdminUserStatus;
    }, connection: Queryable) {
      await sqlExecutor(connection).execute(
        `INSERT INTO users (id, email, normalized_email, password_hash, full_name, student_code, phone_number, status, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
        [input.id, input.email, input.normalizedEmail, input.passwordHash, input.fullName, input.studentCode ?? null, input.phoneNumber ?? null, input.status]
      );
    },

    async updateUser(userId: string, input: {
      email?: string;
      normalizedEmail?: string;
      fullName?: string;
      studentCode?: string | null;
      phoneNumber?: string | null;
    }, connection: Queryable = database) {
      const fields: string[] = [];
      const values: SqlValue[] = [];
      if (input.email !== undefined) { fields.push("email = ?"); values.push(input.email); }
      if (input.normalizedEmail !== undefined) { fields.push("normalized_email = ?"); values.push(input.normalizedEmail); }
      if (input.fullName !== undefined) { fields.push("full_name = ?"); values.push(input.fullName); }
      if (input.studentCode !== undefined) { fields.push("student_code = ?"); values.push(input.studentCode); }
      if (input.phoneNumber !== undefined) { fields.push("phone_number = ?"); values.push(input.phoneNumber); }
      if (!fields.length) return;
      fields.push("session_version = session_version + 1");
      await sqlExecutor(connection).execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, userId]);
    },

    async setAccessRole(userId: string, accessRole: AdminAccessRole, connection: Queryable) {
      await sqlExecutor(connection).execute("DELETE FROM user_roles WHERE user_id = ? AND role_code IN ('STAFF', 'ADMIN')", [userId]);
      await sqlExecutor(connection).execute("INSERT IGNORE INTO user_roles (user_id, role_code) VALUES (?, 'USER')", [userId]);
      if (accessRole !== "USER") {
        await sqlExecutor(connection).execute("INSERT IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?)", [userId, accessRole]);
      }
      await sqlExecutor(connection).execute("UPDATE users SET session_version = session_version + 1 WHERE id = ?", [userId]);
    },

    async assignRole(userId: string, role: Role, connection: Queryable) {
      await sqlExecutor(connection).execute("INSERT IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?)", [userId, role]);
    },

    async setStatus(userId: string, status: AdminUserStatus, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE users SET status = ?, session_version = session_version + 1 WHERE id = ?", [status, userId]);
    },

    async revokeRefreshTokens(userId: string, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
    },

    async countActiveAdmins(connection: Queryable = database) {
      const [rows] = await sqlExecutor(connection).execute<CountRow[]>(
        `SELECT COUNT(DISTINCT u.id) AS total
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role_code = 'ADMIN'
       WHERE u.status = 'ACTIVE'`
      );
      return Number(rows[0]?.total ?? 0);
    },

    async lockActiveAdmins(connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<IdRow[]>(
        `SELECT u.id
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id AND ur.role_code = 'ADMIN'
       WHERE u.status = 'ACTIVE'
       GROUP BY u.id
       ORDER BY u.id
       FOR UPDATE`
      );
      return rows.length;
    },

    async softDeleteUser(userId: string, connection: Queryable) {
      const [result] = await sqlExecutor(connection).execute<ResultSetHeader>(
        "UPDATE users SET status = 'DISABLED', session_version = session_version + 1 WHERE id = ?",
        [userId]
      );
      return result.affectedRows > 0;
    }
  };
};
