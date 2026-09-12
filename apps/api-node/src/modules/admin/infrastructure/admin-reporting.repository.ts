import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type {
  ListModerationReportsQuery,
  ModerationActionType,
  ReportEntityType,
  ReportStatus
} from "../application/admin-reporting.dto.js";
import type { DailyTrendRow, DashboardBreakdown, LockedReportRecord, ModerationReportRecord, ModerationTargetRecord, ModerationTargetType, ReportEntitySummary, ReportingWindow } from "../application/admin-reporting.repository.port.js";
export type { AdminReportingRepository, DailyTrendRow, DashboardBreakdown, DashboardSnapshot, DashboardTotals, LockedReportRecord, ModerationReportRecord, ModerationTargetRecord, ModerationTargetType, ReportEntitySummary, ReportingWindow, StatusCount } from "../application/admin-reporting.repository.port.js";

type SqlValue = string | number | Date | null;
type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;






















interface CountRow extends RowDataPacket {
  total: number | string;
}

interface ReportRow extends RowDataPacket {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string;
  entity_type: ReportEntityType;
  entity_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewer_name: string | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  post_title: string | null;
  post_status: string | null;
  post_owner_name: string | null;
  target_user_name: string | null;
  target_user_status: string | null;
  claim_status: string | null;
  claim_post_title: string | null;
  claim_post_owner_name: string | null;
  chat_claim_status: string | null;
  chat_post_title: string | null;
  chat_post_owner_name: string | null;
}

interface LockedReportRow extends RowDataPacket {
  id: string;
  reporter_id: string;
  entity_type: ReportEntityType;
  entity_id: string;
  reason: string;
  status: ReportStatus;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
}

interface ModerationTargetRow extends RowDataPacket {
  id: string;
  label: string;
  status: string;
  is_admin?: number;
}

interface DashboardTotalsRow extends RowDataPacket {
  posts: number | string;
  open_posts: number | string;
  claims: number | string;
  appointments: number | string;
  returns: number | string;
  custody_items: number | string;
  unresolved_reports: number | string;
}

interface DailyCountRow extends RowDataPacket {
  bucket: Date | string;
  total: number | string;
}

interface StatusCountRow extends RowDataPacket {
  status: string;
  total: number | string;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dayKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

const reportSelect = `SELECT
  r.id, r.reporter_id, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
  r.entity_type, r.entity_id, r.reason, r.details, r.status, r.reviewed_by,
  reviewer.full_name AS reviewer_name, r.reviewed_at, r.created_at,
  p.title AS post_title, p.status AS post_status, post_owner.full_name AS post_owner_name,
  target_user.full_name AS target_user_name, target_user.status AS target_user_status,
  c.status AS claim_status, claim_post.title AS claim_post_title, claim_owner.full_name AS claim_post_owner_name,
  chat_claim.status AS chat_claim_status, chat_post.title AS chat_post_title, chat_owner.full_name AS chat_post_owner_name
FROM reports r
INNER JOIN users reporter ON reporter.id = r.reporter_id
LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
LEFT JOIN posts p ON r.entity_type = 'POST' AND p.id = r.entity_id
LEFT JOIN users post_owner ON post_owner.id = p.user_id
LEFT JOIN users target_user ON r.entity_type = 'USER' AND target_user.id = r.entity_id
LEFT JOIN claims c ON r.entity_type = 'CLAIM' AND c.id = r.entity_id
LEFT JOIN posts claim_post ON claim_post.id = c.post_id
LEFT JOIN users claim_owner ON claim_owner.id = claim_post.user_id
LEFT JOIN chat_rooms chat_room ON r.entity_type = 'CHAT' AND chat_room.id = r.entity_id
LEFT JOIN claims chat_claim ON chat_claim.id = chat_room.claim_id
LEFT JOIN posts chat_post ON chat_post.id = chat_claim.post_id
LEFT JOIN users chat_owner ON chat_owner.id = chat_post.user_id`;

function mapReport(row: ReportRow): ModerationReportRecord {
  const entity: ReportEntitySummary = row.entity_type === "POST"
    ? { type: row.entity_type, title: row.post_title, status: row.post_status, ownerName: row.post_owner_name, referenceId: row.entity_id }
    : row.entity_type === "USER"
      ? { type: row.entity_type, title: row.target_user_name, status: row.target_user_status, ownerName: null, referenceId: row.entity_id }
      : row.entity_type === "CLAIM"
        ? { type: row.entity_type, title: row.claim_post_title, status: row.claim_status, ownerName: row.claim_post_owner_name, referenceId: row.entity_id }
        : { type: row.entity_type, title: row.chat_post_title, status: row.chat_claim_status, ownerName: row.chat_post_owner_name, referenceId: row.entity_id };

  return {
    id: row.id,
    reporter: { id: row.reporter_id, fullName: row.reporter_name, email: row.reporter_email },
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    reviewer: row.reviewed_by && row.reviewer_name ? { id: row.reviewed_by, fullName: row.reviewer_name } : null,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at)!,
    entity
  };
}

function mapLockedReport(row: LockedReportRow): LockedReportRecord {
  return {
    id: row.id,
    reporterId: row.reporter_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    reason: row.reason,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: toIso(row.created_at)!
  };
}

function buildReportFilters(filters: ListModerationReportsQuery) {
  const where: string[] = [];
  const values: SqlValue[] = [];

  if (filters.status) {
    where.push("r.status = ?");
    values.push(filters.status);
  }
  if (filters.entityType) {
    where.push("r.entity_type = ?");
    values.push(filters.entityType);
  }
  if (filters.q) {
    where.push(`(
      r.reason LIKE ? OR r.details LIKE ? OR reporter.full_name LIKE ? OR
      p.title LIKE ? OR target_user.full_name LIKE ? OR claim_post.title LIKE ? OR chat_post.title LIKE ?
    )`);
    const q = `%${filters.q}%`;
    values.push(q, q, q, q, q, q, q);
  }

  return { sql: where.length ? `WHERE ${where.join(" AND ")}` : "", values };
}

export function createAdminReportingRepository(database: SqlExecutor) {
  return {
    async listReports(filters: ListModerationReportsQuery) {
      const { sql, values } = buildReportFilters(filters);
      const limit = filters.pageSize;
      const offset = (filters.page - 1) * filters.pageSize;
      const [totalRows] = await sqlExecutor(database).execute<CountRow[]>(
        `SELECT COUNT(*) AS total FROM (${reportSelect} ${sql}) AS report_count`,
        values
      );
      const [rows] = await sqlExecutor(database).execute<ReportRow[]>(
        `${reportSelect} ${sql} ORDER BY r.created_at DESC, r.id DESC LIMIT ${limit} OFFSET ${offset}`,
        values
      );
      return {
        total: Number(totalRows[0]?.total ?? 0),
        page: filters.page,
        pageSize: filters.pageSize,
        items: rows.map(mapReport)
      };
    },

    async findReportById(reportId: string, connection: Queryable = database) {
      const [rows] = await sqlExecutor(connection).execute<ReportRow[]>(`${reportSelect} WHERE r.id = ? LIMIT 1`, [reportId]);
      return rows[0] ? mapReport(rows[0]) : null;
    },

    async lockReport(reportId: string, connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<LockedReportRow[]>(
        `SELECT id, reporter_id, entity_type, entity_id, reason, status, reviewed_by, reviewed_at, created_at
         FROM reports WHERE id = ? LIMIT 1 FOR UPDATE`,
        [reportId]
      );
      return rows[0] ? mapLockedReport(rows[0]) : null;
    },

    async setReportStatus(reportId: string, status: ReportStatus, reviewerId: string, connection: Queryable) {
      const [result] = await sqlExecutor(connection).execute<ResultSetHeader>(
        "UPDATE reports SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE id = ?",
        [status, reviewerId, reportId]
      );
      return result.affectedRows > 0;
    },

    async createModerationAction(input: {
      id: string;
      adminId: string;
      reportId: string;
      actionType: ModerationActionType;
      targetType: ModerationTargetType;
      targetId: string;
      note: string;
    }, connection: Queryable) {
      await sqlExecutor(connection).execute(
        `INSERT INTO moderation_actions (id, admin_id, report_id, action_type, target_type, target_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [input.id, input.adminId, input.reportId, input.actionType, input.targetType, input.targetId, input.note]
      );
    },

    async findPostTarget(postId: string, connection: Queryable = database, forUpdate = false): Promise<ModerationTargetRecord | null> {
      const [rows] = await sqlExecutor(connection).execute<ModerationTargetRow[]>(
        `SELECT id, title AS label, status FROM posts WHERE id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
        [postId]
      );
      return rows[0] ? { id: rows[0].id, type: "POST", label: rows[0].label, status: rows[0].status } : null;
    },

    async findUserTarget(userId: string, connection: Queryable = database, forUpdate = false): Promise<ModerationTargetRecord | null> {
      const [rows] = await sqlExecutor(connection).execute<ModerationTargetRow[]>(
        `SELECT u.id, u.full_name AS label, u.status,
                EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_code = 'ADMIN') AS is_admin
         FROM users u WHERE u.id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
        [userId]
      );
      return rows[0] ? { id: rows[0].id, type: "USER", label: rows[0].label, status: rows[0].status, isAdmin: Boolean(rows[0].is_admin) } : null;
    },

    async findPostOwnerTarget(postId: string, connection: Queryable = database, forUpdate = false): Promise<ModerationTargetRecord | null> {
      const [rows] = await sqlExecutor(connection).execute<ModerationTargetRow[]>(
        `SELECT u.id, u.full_name AS label, u.status,
                EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_code = 'ADMIN') AS is_admin
         FROM posts p INNER JOIN users u ON u.id = p.user_id
         WHERE p.id = ? LIMIT 1${forUpdate ? " FOR UPDATE" : ""}`,
        [postId]
      );
      return rows[0] ? { id: rows[0].id, type: "USER", label: rows[0].label, status: rows[0].status, isAdmin: Boolean(rows[0].is_admin) } : null;
    },

    async hidePost(postId: string, connection: Queryable) {
      const [result] = await sqlExecutor(connection).execute<ResultSetHeader>(
        "UPDATE posts SET status = 'HIDDEN' WHERE id = ? AND deleted_at IS NULL",
        [postId]
      );
      return result.affectedRows > 0;
    },

    async deletePost(postId: string, connection: Queryable) {
      const [result] = await sqlExecutor(connection).execute<ResultSetHeader>(
        "UPDATE posts SET status = 'HIDDEN', deleted_at = UTC_TIMESTAMP() WHERE id = ? AND deleted_at IS NULL",
        [postId]
      );
      return result.affectedRows > 0;
    },

    async setUserStatus(userId: string, status: "ACTIVE" | "DISABLED", connection: Queryable) {
      const [result] = await sqlExecutor(connection).execute<ResultSetHeader>(
        "UPDATE users SET status = ?, session_version = session_version + 1 WHERE id = ?",
        [status, userId]
      );
      return result.affectedRows > 0;
    },

    async lockActiveAdmins(connection: Queryable) {
      const [rows] = await sqlExecutor(connection).execute<RowDataPacket[]>(
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

    async revokeRefreshTokens(userId: string, connection: Queryable) {
      await sqlExecutor(connection).execute("UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL", [userId]);
    },

    async getDashboardTotals(window: ReportingWindow) {
      const values = [
        window.start, window.endExclusive,
        window.start, window.endExclusive,
        window.start, window.endExclusive,
        window.start, window.endExclusive
      ];
      const [rows] = await sqlExecutor(database).execute<DashboardTotalsRow[]>(
        `SELECT
          (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?) AS posts,
          (SELECT COUNT(*) FROM claims WHERE created_at >= ? AND created_at < ?) AS claims,
          (SELECT COUNT(*) FROM return_appointments WHERE created_at >= ? AND created_at < ?) AS appointments,
          (SELECT COUNT(*) FROM return_appointments WHERE status = 'COMPLETED' AND completed_at >= ? AND completed_at < ?) AS returns,
          (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status IN ('OPEN', 'MATCHED')) AS open_posts,
          (SELECT COUNT(*) FROM warehouse_items WHERE deleted_at IS NULL AND status IN ('PENDING_APPROVAL', 'RECEIVED', 'STORED', 'CLAIMED')) AS custody_items,
          (SELECT COUNT(*) FROM reports WHERE status = 'PENDING') AS unresolved_reports`,
        values
      );
      const row = rows[0];
      return {
        totals: {
          posts: Number(row?.posts ?? 0),
          claims: Number(row?.claims ?? 0),
          appointments: Number(row?.appointments ?? 0),
          returns: Number(row?.returns ?? 0)
        },
        snapshot: {
          openPosts: Number(row?.open_posts ?? 0),
          custodyItems: Number(row?.custody_items ?? 0),
          unresolvedReports: Number(row?.unresolved_reports ?? 0)
        }
      };
    },

    async getDailyTrends(window: ReportingWindow): Promise<DailyTrendRow[]> {
      const queries: Array<{ metric: DailyTrendRow["metric"]; sql: string; values: SqlValue[]; }> = [
        {
          metric: "posts",
          sql: "SELECT DATE(created_at) AS bucket, COUNT(*) AS total FROM posts WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? GROUP BY DATE(created_at)",
          values: [window.start, window.endExclusive]
        },
        {
          metric: "claims",
          sql: "SELECT DATE(created_at) AS bucket, COUNT(*) AS total FROM claims WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at)",
          values: [window.start, window.endExclusive]
        },
        {
          metric: "appointments",
          sql: "SELECT DATE(created_at) AS bucket, COUNT(*) AS total FROM return_appointments WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at)",
          values: [window.start, window.endExclusive]
        },
        {
          metric: "returns",
          sql: "SELECT DATE(completed_at) AS bucket, COUNT(*) AS total FROM return_appointments WHERE status = 'COMPLETED' AND completed_at >= ? AND completed_at < ? GROUP BY DATE(completed_at)",
          values: [window.start, window.endExclusive]
        },
        {
          metric: "custody",
          sql: "SELECT DATE(received_at) AS bucket, COUNT(*) AS total FROM warehouse_items WHERE deleted_at IS NULL AND received_at >= ? AND received_at < ? GROUP BY DATE(received_at)",
          values: [window.start, window.endExclusive]
        },
        {
          metric: "reports",
          sql: "SELECT DATE(created_at) AS bucket, COUNT(*) AS total FROM reports WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at)",
          values: [window.start, window.endExclusive]
        }
      ];

      const rows = await Promise.all(queries.map(async (query) => {
        const [result] = await sqlExecutor(database).execute<DailyCountRow[]>(query.sql, query.values);
        return result.map((row) => ({ date: dayKey(row.bucket), metric: query.metric, total: Number(row.total ?? 0) }));
      }));
      return rows.flat();
    },

    async getStatusBreakdown(window: ReportingWindow): Promise<DashboardBreakdown> {
      async function query(sql: string, values: SqlValue[] = []) {
        const [rows] = await sqlExecutor(database).execute<StatusCountRow[]>(sql, values);
        return rows.map((row) => ({ status: row.status, total: Number(row.total ?? 0) }));
      }

      const [posts, claims, appointments, custody, reports] = await Promise.all([
        query("SELECT status, COUNT(*) AS total FROM posts WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ? GROUP BY status ORDER BY status", [window.start, window.endExclusive]),
        query("SELECT status, COUNT(*) AS total FROM claims WHERE created_at >= ? AND created_at < ? GROUP BY status ORDER BY status", [window.start, window.endExclusive]),
        query("SELECT status, COUNT(*) AS total FROM return_appointments WHERE created_at >= ? AND created_at < ? GROUP BY status ORDER BY status", [window.start, window.endExclusive]),
        query("SELECT status, COUNT(*) AS total FROM warehouse_items WHERE deleted_at IS NULL AND received_at >= ? AND received_at < ? GROUP BY status ORDER BY status", [window.start, window.endExclusive]),
        query("SELECT status, COUNT(*) AS total FROM reports WHERE created_at >= ? AND created_at < ? GROUP BY status ORDER BY status", [window.start, window.endExclusive])
      ]);

      return { posts, claims, appointments, custody, reports };
    }
  };
}
