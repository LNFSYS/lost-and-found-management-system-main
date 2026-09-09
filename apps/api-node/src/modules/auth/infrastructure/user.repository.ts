import type { UserRepository } from "../application/user.repository.port.js";

export type { UserRepository } from "../application/user.repository.port.js";

import type { TransactionContext } from "../../../shared/application/transaction.js";

import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";

import type { PoolConnection } from "mysql2/promise";

import type { RowDataPacket } from "mysql2";

import type { ActivitySummary, Role, User } from "../../../shared/domain/auth.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface UserRow extends RowDataPacket {
  id: string; email: string; full_name: string; student_code: string | null; phone_number: string | null;
  password_hash: string; avatar_file_path: string | null; avatar_mime_type: string | null; avatar_size: number | null; avatar_updated_at: Date | null;
  avatar_cloudinary_public_id: string | null; avatar_cloudinary_asset_id: string | null; avatar_cloudinary_version: number | null;
  avatar_cloudinary_format: string | null; avatar_cloudinary_resource_type: string | null; avatar_cloudinary_bytes: number | null;
  status: "ACTIVE" | "DISABLED"; session_version: number; created_at: Date; updated_at: Date; roles: string | null;
}

interface AvatarRow extends RowDataPacket {
  avatar_cloudinary_public_id: string | null;
  avatar_cloudinary_asset_id: string | null;
  avatar_cloudinary_version: number | null;
  avatar_cloudinary_format: string | null;
  avatar_cloudinary_resource_type: string | null;
  avatar_cloudinary_bytes: number | null;
  avatar_updated_at: Date | null;
}

interface PostStatsRow extends RowDataPacket {
  total: number;
  open_total: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface ReputationRow extends RowDataPacket {
  total_points: number;
  level: ActivitySummary["reputation"]["level"];
  updated_at: Date;
}

interface ActivityEventRow extends RowDataPacket {
  event_type: ActivitySummary["recentEvents"][number]["type"];
  label: string;
  occurred_at: Date;
  points_delta: number | null;
}

function mapUser(row: UserRow): User & { sessionVersion: number; } {
  return {
    id: row.id, email: row.email, fullName: row.full_name, studentCode: row.student_code, phoneNumber: row.phone_number,
    avatar: {
      hasAvatar: Boolean(row.avatar_cloudinary_public_id),
      updatedAt: row.avatar_updated_at?.toISOString() ?? null
    },
    status: row.status, sessionVersion: row.session_version, roles: (row.roles?.split(",").filter(Boolean) ?? []) as Role[],
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
  };
}

const selectUser = `SELECT u.id, u.email, u.password_hash, u.full_name, u.student_code, u.phone_number,
  u.avatar_file_path, u.avatar_mime_type, u.avatar_size, u.avatar_updated_at,
  u.avatar_cloudinary_public_id, u.avatar_cloudinary_asset_id, u.avatar_cloudinary_version,
  u.avatar_cloudinary_format, u.avatar_cloudinary_resource_type, u.avatar_cloudinary_bytes,
  u.status, u.session_version, u.created_at, u.updated_at,
  GROUP_CONCAT(ur.role_code ORDER BY ur.role_code SEPARATOR ',') AS roles
  FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id`;

export function createUserRepository(pool: SqlExecutor) {

  const userRepository = {
    async findByEmail(normalizedEmail: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<UserRow[]>(`${selectUser} WHERE u.normalized_email = ? GROUP BY u.id`, [normalizedEmail]);
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async findAuthByEmail(normalizedEmail: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<UserRow[]>(`${selectUser} WHERE u.normalized_email = ? GROUP BY u.id`, [normalizedEmail]);
      return rows[0] ? { user: mapUser(rows[0]), passwordHash: rows[0].password_hash } : null;
    },
    async findById(id: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<UserRow[]>(`${selectUser} WHERE u.id = ? GROUP BY u.id`, [id]);
      return rows[0] ? mapUser(rows[0]) : null;
    },
    async create(input: { id: string; email: string; normalizedEmail: string; passwordHash: string; fullName: string; studentCode?: string; phoneNumber?: string; }, connection: Queryable) {
      await sqlExecutor(connection).execute(`INSERT INTO users (id, email, normalized_email, password_hash, full_name, student_code, phone_number, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`, [input.id, input.email, input.normalizedEmail, input.passwordHash, input.fullName, input.studentCode ?? null, input.phoneNumber ?? null]);
    },
    async assignRole(userId: string, role: Role, connection: Queryable) {
      await sqlExecutor(connection).execute("INSERT IGNORE INTO user_roles (user_id, role_code) VALUES (?, ?)", [userId, role]);
    },
    async updateProfile(userId: string, input: { fullName?: string; studentCode?: string | null; phoneNumber?: string | null; }) {
      const fields: string[] = []; const values: Array<string | null> = [];
      if (input.fullName !== undefined) { fields.push("full_name = ?"); values.push(input.fullName); }
      if (input.studentCode !== undefined) { fields.push("student_code = ?"); values.push(input.studentCode); }
      if (input.phoneNumber !== undefined) { fields.push("phone_number = ?"); values.push(input.phoneNumber); }
      await pool.execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, [...values, userId]);
      return this.findById(userId);
    },
    async findAvatarById(userId: string, connection: Queryable = pool) {
      const [rows] = await sqlExecutor(connection).execute<AvatarRow[]>(
        `SELECT avatar_cloudinary_public_id, avatar_cloudinary_asset_id, avatar_cloudinary_version,
              avatar_cloudinary_format, avatar_cloudinary_resource_type, avatar_cloudinary_bytes, avatar_updated_at
       FROM users
       WHERE id = ? AND status = 'ACTIVE'
       LIMIT 1`,
        [userId]
      );
      const row = rows[0];
      if (!row?.avatar_cloudinary_public_id
        || !row.avatar_cloudinary_version
        || !row.avatar_cloudinary_format
        || row.avatar_cloudinary_resource_type !== "image") return null;
      return {
        publicId: row.avatar_cloudinary_public_id,
        assetId: row.avatar_cloudinary_asset_id,
        version: row.avatar_cloudinary_version,
        format: row.avatar_cloudinary_format,
        resourceType: "image" as const,
        size: row.avatar_cloudinary_bytes ?? 0,
        updatedAt: row.avatar_updated_at?.toISOString() ?? null
      };
    },
    async updateAvatar(userId: string, input: {
      publicId: string;
      assetId: string | null;
      version: number;
      format: string;
      resourceType: "image";
      size: number;
    }) {
      await pool.execute(
        `UPDATE users
       SET avatar_cloudinary_public_id = ?, avatar_cloudinary_asset_id = ?, avatar_cloudinary_version = ?,
           avatar_cloudinary_format = ?, avatar_cloudinary_resource_type = ?, avatar_cloudinary_bytes = ?,
           avatar_file_path = NULL, avatar_mime_type = NULL, avatar_size = NULL, avatar_updated_at = UTC_TIMESTAMP()
       WHERE id = ? AND status = 'ACTIVE'`,
        [input.publicId, input.assetId, input.version, input.format, input.resourceType, input.size, userId]
      );
      return this.findById(userId);
    },
    async getActivitySummary(userId: string): Promise<ActivitySummary> {
      const [
        [postRows],
        [claimRows],
        [returnRows],
        [feedbackRows],
        [reputationRows],
        [eventRows]
      ] = await Promise.all([
        pool.execute<PostStatsRow[]>(
          `SELECT COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN status IN ('OPEN', 'MATCHED') THEN 1 ELSE 0 END), 0) AS open_total
         FROM posts
         WHERE user_id = ? AND deleted_at IS NULL`,
          [userId]
        ),
        pool.execute<CountRow[]>("SELECT COUNT(*) AS total FROM claims WHERE claimant_id = ?", [userId]),
        pool.execute<CountRow[]>(
          `SELECT COUNT(DISTINCT ra.id) AS total
         FROM return_appointments ra
         INNER JOIN claims c ON c.id = ra.claim_id
         INNER JOIN posts p ON p.id = ra.post_id
         WHERE ra.status = 'COMPLETED'
           AND (c.claimant_id = ? OR p.user_id = ? OR ra.proposer_id = ?)`,
          [userId, userId, userId]
        ),
        pool.execute<CountRow[]>("SELECT COUNT(*) AS total FROM return_feedback WHERE target_user_id = ?", [userId]),
        pool.execute<ReputationRow[]>(
          `SELECT total_points, level, updated_at
         FROM reputation_scores
         WHERE user_id = ?
         LIMIT 1`,
          [userId]
        ),
        pool.execute<ActivityEventRow[]>(
          `SELECT event_type, label, occurred_at, points_delta
         FROM (
           SELECT 'POST_CREATED' AS event_type, CONCAT('Da tao bai ', p.type) AS label, p.created_at AS occurred_at, NULL AS points_delta
           FROM posts p
           WHERE p.user_id = ? AND p.deleted_at IS NULL
           UNION ALL
           SELECT 'CLAIM_CREATED' AS event_type, 'Da gui yeu cau claim' AS label, c.created_at AS occurred_at, NULL AS points_delta
           FROM claims c
           WHERE c.claimant_id = ?
           UNION ALL
           SELECT 'RETURN_COMPLETED' AS event_type, 'Da hoan tat tra nhan vat pham' AS label, COALESCE(ra.completed_at, ra.updated_at) AS occurred_at, NULL AS points_delta
           FROM return_appointments ra
           INNER JOIN claims c ON c.id = ra.claim_id
           INNER JOIN posts p ON p.id = ra.post_id
           WHERE ra.status = 'COMPLETED'
             AND (c.claimant_id = ? OR p.user_id = ? OR ra.proposer_id = ?)
           UNION ALL
           SELECT 'FEEDBACK_RECEIVED' AS event_type, CONCAT('Nhan feedback ', rf.rating, '/5 sau hoan tra') AS label, rf.created_at AS occurred_at, NULL AS points_delta
           FROM return_feedback rf
           WHERE rf.target_user_id = ?
           UNION ALL
           SELECT 'REPUTATION_CHANGED' AS event_type, 'Diem uy tin thay doi' AS label, rl.created_at AS occurred_at, rl.delta AS points_delta
           FROM reputation_logs rl
           WHERE rl.user_id = ?
         ) activity_events
         ORDER BY occurred_at DESC
         LIMIT 10`,
          [userId, userId, userId, userId, userId, userId, userId]
        )
      ]);

      const reputation = reputationRows[0];
      return {
        ownerId: userId,
        counts: {
          posts: Number(postRows[0]?.total ?? 0),
          openPosts: Number(postRows[0]?.open_total ?? 0),
          claims: Number(claimRows[0]?.total ?? 0),
          completedReturns: Number(returnRows[0]?.total ?? 0),
          receivedFeedback: Number(feedbackRows[0]?.total ?? 0)
        },
        reputation: {
          totalPoints: Number(reputation?.total_points ?? 0),
          level: reputation?.level ?? "NEW",
          updatedAt: reputation?.updated_at?.toISOString() ?? null
        },
        recentEvents: eventRows.map((event) => ({
          type: event.event_type,
          label: event.label,
          occurredAt: event.occurred_at.toISOString(),
          ...(event.points_delta === null ? {} : { pointsDelta: Number(event.points_delta) })
        }))
      };
    },
    async updateLastLogin(userId: string) { await pool.execute("UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [userId]); },
    async updatePasswordAndInvalidateSessions(userId: string, passwordHash: string, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", [passwordHash, userId]);
      await sqlExecutor(connection).execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
    }
  } satisfies UserRepository;

  return userRepository;

}
