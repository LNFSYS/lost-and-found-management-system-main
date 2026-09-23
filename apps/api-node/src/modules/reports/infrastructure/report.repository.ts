import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { ListMyReportsQuery, ReportEntityType, ReportSourceType, ReportStatus } from "../application/report.dto.js";
import type { AccessibleReportTarget, LockedUserReport, ReportRepository, UserReportRecord } from "../application/report.repository.port.js";

type Queryable = Pick<PoolConnection, "execute"> | TransactionContext;

interface TargetRow extends RowDataPacket {
  entity_type: ReportEntityType;
  entity_id: string;
  source_type: ReportSourceType;
  source_id: string;
  title: string;
  status: string;
}

interface ReportRow extends RowDataPacket {
  id: string; entity_type: ReportEntityType; entity_id: string; source_type: ReportSourceType; source_id: string;
  reason: string; details: string | null; status: ReportStatus; resolution: string | null;
  reviewed_at: Date | string | null; withdrawn_at: Date | string | null; created_at: Date | string;
  target_title: string | null; target_status: string | null; request_hash: string | null;
}

interface LockedRow extends RowDataPacket {
  id: string; reporter_id: string; status: ReportStatus;
  reviewed_at: Date | string | null; withdrawn_at: Date | string | null;
}

interface CountRow extends RowDataPacket { total: number | string }

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapReport(row: ReportRow): UserReportRecord {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolution: row.resolution,
    reviewedAt: iso(row.reviewed_at),
    withdrawnAt: iso(row.withdrawn_at),
    createdAt: iso(row.created_at)!,
    target: { title: row.target_title ?? "Đối tượng không còn hiển thị", status: row.target_status ?? "UNAVAILABLE" }
  };
}

const reportSelect = `SELECT r.id, r.entity_type, r.entity_id, r.source_type, r.source_id, r.reason, r.details,
  r.status, r.reviewed_at, r.withdrawn_at, r.created_at, r.request_hash,
  (SELECT ma.note FROM moderation_actions ma WHERE ma.report_id = r.id ORDER BY ma.created_at DESC, ma.id DESC LIMIT 1) AS resolution,
  CASE
    WHEN r.entity_type = 'POST' THEN CASE WHEN p.deleted_at IS NULL AND p.status NOT IN ('DELETED', 'HIDDEN') THEN p.title ELSE NULL END
    WHEN r.entity_type = 'CLAIM' THEN CONCAT('Yêu cầu xác minh cho ', COALESCE(cp.title, 'bài đăng'))
    WHEN r.entity_type = 'CHAT' THEN 'Tin nhắn trong phòng trao đổi riêng'
    WHEN r.entity_type = 'HANDOVER' THEN 'Vấn đề bàn giao vật phẩm'
  END AS target_title,
  CASE
    WHEN r.entity_type = 'POST' THEN CASE WHEN p.deleted_at IS NULL THEN p.status ELSE NULL END
    WHEN r.entity_type = 'CLAIM' THEN c.status
    WHEN r.entity_type = 'CHAT' THEN cc.status
    WHEN r.entity_type = 'HANDOVER' THEN ra.status
  END AS target_status
FROM reports r
LEFT JOIN posts p ON r.entity_type = 'POST' AND p.id = r.entity_id
LEFT JOIN claims c ON r.entity_type = 'CLAIM' AND c.id = r.entity_id
LEFT JOIN posts cp ON cp.id = c.post_id
LEFT JOIN chat_rooms cr ON r.entity_type = 'CHAT' AND cr.id = r.entity_id
LEFT JOIN claims cc ON cc.id = cr.claim_id
LEFT JOIN return_appointments ra ON r.entity_type = 'HANDOVER' AND ra.id = r.entity_id`;

export function createReportRepository(database: SqlExecutor): ReportRepository {
  const executor = (connection: Queryable = database) => sqlExecutor(connection);
  async function selectMine(reportId: string, reporterId: string, connection: Queryable = database) {
    const [rows] = await executor(connection).execute<ReportRow[]>(`${reportSelect} WHERE r.id = ? AND r.reporter_id = ? LIMIT 1`, [reportId, reporterId]);
    return rows[0] ? mapReport(rows[0]) : null;
  }

  return {
    async findAccessibleTarget(userId, sourceType, sourceId) {
      let query = "";
      if (sourceType === "POST") {
        query = `SELECT 'POST' entity_type, p.id entity_id, 'POST' source_type, p.id source_id, p.title, p.status
          FROM posts p WHERE p.id = ? AND p.deleted_at IS NULL AND p.status NOT IN ('DELETED', 'HIDDEN')`;
      } else if (sourceType === "CLAIM") {
        query = `SELECT 'CLAIM' entity_type, c.id entity_id, 'CLAIM' source_type, c.id source_id,
          CONCAT('Yêu cầu xác minh cho ', p.title) title, c.status
          FROM claims c INNER JOIN posts p ON p.id = c.post_id INNER JOIN claim_participants participant ON participant.claim_id = c.id
          WHERE c.id = ? AND participant.user_id = ?`;
      } else if (sourceType === "MESSAGE") {
        query = `SELECT 'CHAT' entity_type, room.id entity_id, 'MESSAGE' source_type, message.id source_id,
          'Tin nhắn trong phòng trao đổi riêng' title, claim.status
          FROM chat_messages message INNER JOIN chat_rooms room ON room.id = message.room_id
          INNER JOIN claims claim ON claim.id = room.claim_id INNER JOIN claim_participants participant ON participant.claim_id = claim.id
          WHERE message.id = ? AND participant.user_id = ?`;
      } else {
        query = `SELECT 'HANDOVER' entity_type, appointment.id entity_id, 'HANDOVER' source_type, appointment.id source_id,
          'Vấn đề bàn giao vật phẩm' title, appointment.status
          FROM return_appointments appointment INNER JOIN claim_participants participant ON participant.claim_id = appointment.claim_id
          WHERE appointment.id = ? AND participant.user_id = ?`;
      }
      const values = sourceType === "POST" ? [sourceId] : [sourceId, userId];
      const [rows] = await executor().execute<TargetRow[]>(`${query} LIMIT 1`, values);
      const row = rows[0];
      return row ? { entityType: row.entity_type, entityId: row.entity_id, sourceType: row.source_type, sourceId: row.source_id, title: row.title, status: row.status } : null;
    },

    async findByIdempotencyKey(reporterId, key, connection = undefined) {
      const queryable = connection ?? database;
      const [rows] = await executor(queryable).execute<ReportRow[]>(`${reportSelect} WHERE r.reporter_id = ? AND r.idempotency_key = ? LIMIT 1`, [reporterId, key]);
      return rows[0] ? { report: mapReport(rows[0]), requestHash: rows[0].request_hash } : null;
    },

    async create(input, connection) {
      await executor(connection).execute(
        `INSERT INTO reports (id, reporter_id, entity_type, entity_id, source_type, source_id, reason, details, idempotency_key, request_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [input.id, input.reporterId, input.target.entityType, input.target.entityId, input.target.sourceType, input.target.sourceId,
          input.reason, input.details, input.idempotencyKey, input.requestHash]
      );
    },

    async createAuditEvent(input, connection) {
      await executor(connection).execute(
        "INSERT INTO report_audit_events (id, report_id, actor_id, action) VALUES (?, ?, ?, ?)",
        [input.id, input.reportId, input.actorId, input.action]
      );
    },

    async listMine(reporterId, query: ListMyReportsQuery) {
      const where = ["r.reporter_id = ?"];
      const values: Array<string | number> = [reporterId];
      if (query.status) { where.push("r.status = ?"); values.push(query.status); }
      const clause = `WHERE ${where.join(" AND ")}`;
      const [counts] = await executor().execute<CountRow[]>(`SELECT COUNT(*) total FROM reports r ${clause}`, values);
      const offset = (query.page - 1) * query.pageSize;
      const [rows] = await executor().execute<ReportRow[]>(`${reportSelect} ${clause} ORDER BY r.created_at DESC, r.id DESC LIMIT ${query.pageSize} OFFSET ${offset}`, values);
      return { total: Number(counts[0]?.total ?? 0), page: query.page, pageSize: query.pageSize, items: rows.map(mapReport) };
    },

    findMine: selectMine,

    async lock(reportId, connection) {
      const [rows] = await executor(connection).execute<LockedRow[]>(
        "SELECT id, reporter_id, status, reviewed_at, withdrawn_at FROM reports WHERE id = ? LIMIT 1 FOR UPDATE", [reportId]
      );
      const row = rows[0];
      return row ? { id: row.id, reporterId: row.reporter_id, status: row.status, reviewedAt: iso(row.reviewed_at), withdrawnAt: iso(row.withdrawn_at) } satisfies LockedUserReport : null;
    },

    async withdraw(reportId, connection) {
      const [result] = await executor(connection).execute<ResultSetHeader>(
        "UPDATE reports SET status = 'WITHDRAWN', withdrawn_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'PENDING' AND reviewed_at IS NULL", [reportId]
      );
      return result.affectedRows === 1;
    }
  };
}
