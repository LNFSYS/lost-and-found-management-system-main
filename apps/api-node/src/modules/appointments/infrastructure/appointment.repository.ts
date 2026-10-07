import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { TransactionContext } from "../../../shared/application/transaction.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import { claimantIdSql, finderIdSql } from "../../../shared/infrastructure/claim-identity-sql.js";
import type { Appointment, AppointmentContext, AppointmentRepository } from "../application/appointment.repository.port.js";

const joins = `FROM return_appointments a JOIN claims c ON c.id=a.claim_id
  JOIN posts identity_post ON identity_post.id=c.post_id
  LEFT JOIN return_appointment_workflows w ON w.appointment_id=a.id
  LEFT JOIN handover_points hp ON hp.id=a.handover_point_id`;
const select = `SELECT a.*, identity_post.title, ${claimantIdSql} owner_id, ${finderIdSql} finder_id,
  identity_post.id item_post_id,
  (SELECT pm.id FROM post_media pm WHERE pm.post_id=identity_post.id AND pm.media_kind='ITEM' AND pm.resource_type='image'
    AND identity_post.visibility_mode='PUBLIC' AND identity_post.status<>'HIDDEN' AND identity_post.deleted_at IS NULL
    ORDER BY pm.sort_order,pm.created_at,pm.id LIMIT 1) item_media_id,
  hp.name location, COALESCE(w.version,0) version, COALESCE(w.finder_response,'PENDING') finder_response,
  COALESCE(w.owner_response,'PENDING') owner_response,w.no_show_user_id ${joins}`;
function iso(value: Date | string | null): string | null { return value == null ? null : new Date(value).toISOString(); }
function map(r: RowDataPacket): Appointment {
  return { id: r.id, claimId: r.claim_id, postId: r.post_id, title: r.title, proposerId: r.proposer_id,
    finderId: r.finder_id, ownerId: r.owner_id, status: r.status, proposedAt: iso(r.proposed_at)!,
    handoverPointId: r.handover_point_id, location: r.location ?? r.custom_location, version: Number(r.version),
    itemImageUrl: r.item_media_id ? `/api/posts/${r.item_post_id}/media/${r.item_media_id}` : null,
    finderResponse: r.finder_confirmed_at ? "CONFIRMED" : r.finder_response,
    ownerResponse: r.owner_confirmed_at ? "CONFIRMED" : r.owner_response,
    noShowUserId: r.no_show_user_id, custodyAuthorized: Boolean(r.custody_authorized_at), completedAt: iso(r.completed_at), events: [] };
}
export function createAppointmentRepository(pool: SqlExecutor): AppointmentRepository {
  const repo: AppointmentRepository = {
    async schemaReady() {
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM information_schema.tables
        WHERE table_schema=DATABASE() AND table_name IN ('return_appointment_workflows','appointment_events')`);
      return Number(rows[0].total) === 2;
    },
    async context(claimId, tx) {
      const db = sqlExecutor(tx);
      await db.execute("SELECT id FROM claims WHERE id=? FOR UPDATE", [claimId]);
      const [rows] = await db.execute<RowDataPacket[]>(`SELECT c.id,c.post_id,c.status,c.finder_decision,
        ${claimantIdSql} owner_id,${finderIdSql} finder_id,
        (SELECT COUNT(*) FROM claim_participants cp WHERE cp.claim_id=c.id AND cp.consent_status='ACCEPTED') consent_count,
        EXISTS(SELECT 1 FROM claim_room_blocks b JOIN chat_rooms room ON room.id=b.room_id WHERE room.claim_id=c.id) blocked
        FROM claims c JOIN posts identity_post ON identity_post.id=c.post_id WHERE c.id=?`, [claimId]);
      const r = rows[0]; if (!r) return null;
      return { claimId, postId: r.post_id, finderId: r.finder_id, ownerId: r.owner_id,
        eligible: r.finder_id !== r.owner_id && r.status === "ACCEPTED" && r.finder_decision === "ACCEPTED" && Number(r.consent_count) === 2 && !r.blocked,
        blocked: Boolean(r.blocked) };
    },
    async assertSafe(context: AppointmentContext, tx) {
      const db = sqlExecutor(tx);
      const [posts] = await db.execute<RowDataPacket[]>(`SELECT p.id,p.status,p.deleted_at FROM posts p
        JOIN claims c ON p.id IN (c.post_id,c.lost_post_id,c.source_found_post_id) WHERE c.id=? ORDER BY p.id FOR UPDATE`, [context.claimId]);
      if (!posts.length || posts.some(p => p.deleted_at || !["OPEN", "MATCHED"].includes(p.status))) return false;
      const ids = posts.map(p => p.id); const placeholders = ids.map(() => "?").join(",");
      const [blocked] = await db.execute<RowDataPacket[]>(`WITH related_claims AS (SELECT id FROM claims
        WHERE post_id IN (${placeholders}) OR lost_post_id IN (${placeholders}) OR source_found_post_id IN (${placeholders})) SELECT 1 blocked WHERE
        EXISTS(SELECT 1 FROM custody_requests cr WHERE (cr.claim_id=? OR cr.post_id IN (${placeholders})) AND cr.status IN ('PENDING','ACCEPTED','INTAKED'))
        OR EXISTS(SELECT 1 FROM warehouse_items wi WHERE wi.post_id IN (${placeholders}) AND wi.deleted_at IS NULL)
        OR EXISTS(SELECT 1 FROM claims other WHERE other.id<>? AND other.status IN ('PENDING','CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED')
          AND other.id IN (SELECT id FROM related_claims))
        OR EXISTS(SELECT 1 FROM reports r WHERE r.status='PENDING' AND
          ((r.entity_type='POST' AND r.entity_id IN (${placeholders})) OR (r.entity_type='CLAIM' AND r.entity_id IN (SELECT id FROM related_claims))
           OR r.source_id IN (SELECT id FROM related_claims) OR (r.entity_type='CHAT' AND r.entity_id IN (SELECT id FROM chat_rooms WHERE claim_id IN (SELECT id FROM related_claims)))
           OR (r.entity_type='HANDOVER' AND r.entity_id IN (SELECT id FROM return_appointments WHERE claim_id IN (SELECT id FROM related_claims)))))
        OR EXISTS(SELECT 1 FROM return_appointments WHERE claim_id=? AND status='COMPLETED')
        OR (SELECT COUNT(*) FROM users WHERE id IN (?,?) AND status='ACTIVE')<>2`,
        [...ids,...ids,...ids,context.claimId,...ids,...ids,context.claimId,...ids,context.claimId,context.finderId,context.ownerId]);
      return !blocked.length;
    },
    async find(id, tx) {
      const db = sqlExecutor(tx ?? pool);
      if (tx) await db.execute("SELECT id FROM return_appointments WHERE id=? FOR UPDATE", [id]);
      const [rows] = await db.execute<RowDataPacket[]>(`${select} WHERE a.id=?`, [id]);
      if (!rows[0]) return null; const a = map(rows[0]);
      const [events] = await db.execute<RowDataPacket[]>("SELECT id,action,actor_id,created_at,note FROM appointment_events WHERE appointment_id=? ORDER BY created_at,id", [id]);
      a.events = events.map(e => ({ id: e.id, action: e.action, actorId: e.actor_id, createdAt: iso(e.created_at)!,note:e.note })); return a;
    },
    async list(userId, page, claimId) {
      const where = `(${claimantIdSql}=? OR ${finderIdSql}=?)${claimId ? " AND c.id=?" : ""}`;
      const values = [userId,userId,...(claimId ? [claimId] : [])];
      const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) total ${joins} WHERE ${where}`, values);
      const [rows] = await pool.execute<RowDataPacket[]>(`${select} WHERE ${where} ORDER BY a.proposed_at DESC,a.id DESC LIMIT 20 OFFSET ${(page-1)*20}`, values);
      return { results: rows.map(map), total: Number(counts[0].total) };
    },
    async replay(actorId, key, tx) {
      const [rows] = await sqlExecutor(tx).execute<RowDataPacket[]>("SELECT appointment_id,request_hash FROM appointment_events WHERE actor_id=? AND request_key=?", [actorId,key]);
      return rows[0] ? { appointmentId: rows[0].appointment_id, hash: rows[0].request_hash } : null;
    },
    async create(input, tx) {
      const db = sqlExecutor(tx);
      await db.execute(`INSERT INTO return_appointments (id,claim_id,post_id,proposer_id,proposed_at,handover_point_id) VALUES (?,?,?,?,?,?)`,
        [input.id,input.claimId,input.postId,input.proposerId,input.proposedAt,input.handoverPointId]);
      await db.execute("INSERT INTO return_appointment_workflows (appointment_id) VALUES (?)", [input.id]);
    },
    async active(claimId, tx) {
      const [rows] = await sqlExecutor(tx).execute<RowDataPacket[]>("SELECT id FROM return_appointments WHERE claim_id=? AND status IN ('PENDING','ACCEPTED','RESCHEDULED') FOR UPDATE", [claimId]);
      return rows.length > 0;
    },
    async pointExists(id, tx) {
      const [rows] = await sqlExecutor(tx).execute<RowDataPacket[]>("SELECT id FROM handover_points WHERE id=? AND is_active=TRUE FOR SHARE", [id]); return rows.length > 0;
    },
    async update(a, time, tx) {
      const db = sqlExecutor(tx);
      await db.execute(`UPDATE return_appointments SET status=?,accepted_at=IF(?='ACCEPTED',COALESCE(accepted_at,?),accepted_at),
        finder_confirmed_at=IF(?='CONFIRMED',COALESCE(finder_confirmed_at,?),NULL),owner_confirmed_at=IF(?='CONFIRMED',COALESCE(owner_confirmed_at,?),NULL),
        completed_at=?,updated_at=? WHERE id=?`, [a.status,a.status,time,a.finderResponse,time,a.ownerResponse,time,a.completedAt ? new Date(a.completedAt) : null,time,a.id]);
      await db.execute("UPDATE return_appointment_workflows SET version=?,finder_response=?,owner_response=?,no_show_user_id=? WHERE appointment_id=?", [a.version,a.finderResponse,a.ownerResponse,a.noShowUserId,a.id]);
      if (a.status === "COMPLETED") await db.execute(`UPDATE posts p JOIN claims c ON p.id IN (c.post_id,c.lost_post_id,c.source_found_post_id)
        SET p.status='RESOLVED',p.resolved_at=?,p.updated_at=? WHERE c.id=? AND p.deleted_at IS NULL`, [time,time,a.claimId]);
    },
    async event(e, tx) {
      const db=sqlExecutor(tx);
      await db.execute("INSERT INTO appointment_events (id,appointment_id,actor_id,action,request_key,request_hash,note) VALUES (?,?,?,?,?,?,?)", [e.id,e.appointmentId,e.actorId,e.action,e.key ?? null,e.hash ?? null,e.note ?? null]);
      if(e.action === "RETURN_COMPLETED") await db.execute(`INSERT INTO claim_audit_events (id,claim_id,actor_id,action,from_status,to_status)
        SELECT ?,claim_id,?,'DIRECT_RETURN_COMPLETED','ACCEPTED','ACCEPTED' FROM return_appointments WHERE id=?`,[e.id,e.actorId,e.appointmentId]);
    },
    async dueReminders(time,leadMinutes) {
      const [rows] = await pool.execute<RowDataPacket[]>(`SELECT a.id FROM return_appointments a JOIN return_appointment_workflows w ON w.appointment_id=a.id
        WHERE a.status='ACCEPTED' AND a.custody_authorized_at IS NULL AND a.proposed_at>? AND a.proposed_at<=? AND w.reminder_queued_at IS NULL ORDER BY a.proposed_at LIMIT 50`, [time,new Date(time.getTime()+leadMinutes*60_000)]);
      return rows.map(r => r.id);
    },
    async markReminded(id, time, tx) {
      const [r] = await sqlExecutor(tx).execute<ResultSetHeader>("UPDATE return_appointment_workflows SET reminder_queued_at=? WHERE appointment_id=? AND reminder_queued_at IS NULL", [time,id]); return r.affectedRows === 1;
    }
  }; return repo;
}
