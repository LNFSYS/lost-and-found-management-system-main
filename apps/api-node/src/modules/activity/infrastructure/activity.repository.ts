import type { RowDataPacket } from "mysql2";
import { claimantIdSql, finderIdSql } from "../../../shared/infrastructure/claim-identity-sql.js";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { ActivityEvent, ActivityRepository, JourneySummary } from "../application/activity.repository.port.js";

// Never select free-form notes, JSON snapshots, contact details or media references.
const auditUnion = `
  SELECT CONCAT('ADMIN:',id) id,'ADMIN' source,action,target_type,target_id,actor_id,created_at,NULL from_status,NULL to_status,reason search_reason FROM admin_audit_logs
  UNION ALL SELECT CONCAT('CLAIM:',id),'CLAIM',action,'CLAIM',claim_id,actor_id,created_at,from_status,to_status,NULL FROM claim_audit_events
  UNION ALL SELECT CONCAT('CUSTODY:',id),'CUSTODY',action,'CUSTODY',custody_request_id,actor_id,created_at,from_status,to_status,NULL FROM custody_request_audit
  UNION ALL SELECT CONCAT('WAREHOUSE:',id),'WAREHOUSE',action,'WAREHOUSE',warehouse_item_id,actor_id,created_at,from_status,to_status,NULL FROM storage_logs
  UNION ALL SELECT CONCAT('REPORT:',id),'REPORT',action,'REPORT',report_id,actor_id,created_at,NULL,NULL,NULL FROM report_audit_events
  UNION ALL SELECT CONCAT('MODERATION:',id),'MODERATION',action_type,target_type,target_id,admin_id,created_at,NULL,NULL,note FROM moderation_actions`;
const appointmentAudit = ` UNION ALL SELECT CONCAT('APPOINTMENT:',id),'APPOINTMENT',action,'APPOINTMENT',appointment_id,actor_id,created_at,NULL,NULL,NULL FROM appointment_events`;
function map(r: RowDataPacket): ActivityEvent {
  return { id:r.id,source:r.source,action:r.action,targetType:r.target_type,targetId:r.target_id ?? "",
    actorId:r.actor_id ?? null,createdAt:new Date(r.created_at).toISOString(),fromStatus:r.from_status ?? null,toStatus:r.to_status ?? null };
}
export function createActivityRepository(pool: SqlExecutor): ActivityRepository {
  async function hasAppointments(db=pool) {
    const [rows] = await db.execute<RowDataPacket[]>("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='appointment_events'"); return rows.length>0;
  }
  return {
    async audit(filter,limit,tx) {
      const db=sqlExecutor(tx??pool);
      const clauses:string[] = []; const values:Array<string | Date> = [];
      if (filter.query) { clauses.push("(action LIKE ? OR target_id LIKE ? OR actor_id LIKE ? OR search_reason LIKE ?)"); values.push(...Array(4).fill(`%${filter.query}%`)); }
      for (const [field,value] of [["source",filter.source],["actor_id",filter.actorId],["target_id",filter.targetId]] as const) if (value) { clauses.push(`${field}=?`);values.push(value); }
      if (filter.from) { clauses.push("created_at>=?");values.push(new Date(filter.from)); }
      if (filter.to) { clauses.push("created_at<=?");values.push(new Date(filter.to)); }
      const union = auditUnion + (await hasAppointments(db) ? appointmentAudit : "");
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const [count] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) total FROM (${union}) activity ${where}`,values);
      const [rows] = await db.execute<RowDataPacket[]>(`SELECT id,source,action,target_type,target_id,actor_id,created_at,from_status,to_status FROM (${union}) activity ${where} ORDER BY created_at DESC,id DESC LIMIT ${limit} OFFSET ${(filter.page-1)*limit}`,values);
      return { results:rows.map(map),total:Number(count[0].total) };
    },
    async journey(postId,userId,page,asOf) {
      const allowed = `SELECT c.id,c.post_id,c.lost_post_id,c.source_found_post_id FROM claims c
        JOIN posts identity_post ON identity_post.id=c.post_id
        WHERE (c.post_id=? OR c.lost_post_id=? OR c.source_found_post_id=?) AND (${claimantIdSql}=? OR ${finderIdSql}=?)`;
      const args = [postId,postId,postId,userId,userId];
      const [post] = await pool.execute<RowDataPacket[]>(`SELECT p.title,p.status,p.type FROM posts p WHERE p.id=? AND
        (p.user_id=? OR EXISTS(${allowed}))`,[postId,userId,...args]);
      if (!post[0]) return null;
      const cte = `WITH allowed_claims AS (${allowed}), physical_posts AS
        (SELECT id FROM posts WHERE id=? AND user_id=? AND type='FOUND'
         UNION SELECT source.id FROM posts source JOIN claims c ON source.id=COALESCE(c.source_found_post_id,c.post_id)
           JOIN allowed_claims ac ON ac.id=c.id WHERE source.type='FOUND' AND c.status='ACCEPTED'),
        relevant_custody AS (SELECT cr.id,cr.warehouse_item_id FROM custody_requests cr
          WHERE cr.claim_id IN (SELECT id FROM allowed_claims) OR (cr.post_id=? AND cr.requester_id=?))`;
      const contextValues=[...args,postId,userId,postId,userId];
      const events = `
        SELECT CONCAT('POST:',p.id) id,'POST' source,'POST_CREATED' action,'POST' target_type,p.id target_id,NULL actor_id,p.created_at,NULL from_status,NULL to_status FROM posts p WHERE p.id=?
        UNION ALL SELECT CONCAT('MATCH:',MIN(m.id)),'MATCHING','MATCHING_AVAILABLE','POST',?,NULL,MIN(m.created_at),NULL,NULL FROM match_results m WHERE m.lost_post_id=? OR m.found_post_id=? HAVING COUNT(*)>0
        UNION ALL SELECT CONCAT('CLAIM_CREATED:',c.id),'CLAIM','CLAIM_CREATED','CLAIM',c.id,NULL,c.created_at,NULL,NULL FROM claims c JOIN allowed_claims ac ON ac.id=c.id
        UNION ALL SELECT CONCAT('CLAIM:',e.id),'CLAIM',e.action,'CLAIM',e.claim_id,NULL,e.created_at,e.from_status,e.to_status FROM claim_audit_events e JOIN allowed_claims ac ON ac.id=e.claim_id WHERE e.action<>'DIRECT_RETURN_COMPLETED'
        UNION ALL SELECT CONCAT('CHAT:',room.id),'CHAT','CONVERSATION_OPENED','CLAIM',room.claim_id,NULL,room.created_at,NULL,NULL FROM chat_rooms room JOIN allowed_claims ac ON ac.id=room.claim_id
        UNION ALL SELECT CONCAT('CUSTODY:',e.id),'CUSTODY',e.action,'CUSTODY',e.custody_request_id,NULL,e.created_at,e.from_status,e.to_status FROM custody_request_audit e JOIN relevant_custody rc ON rc.id=e.custody_request_id
        UNION ALL SELECT CONCAT('WAREHOUSE:',sl.id),'WAREHOUSE',sl.action,'WAREHOUSE',sl.warehouse_item_id,NULL,sl.created_at,sl.from_status,sl.to_status FROM storage_logs sl
          WHERE sl.warehouse_item_id IN (SELECT warehouse_item_id FROM relevant_custody)
          OR sl.warehouse_item_id IN (SELECT wi.id FROM warehouse_items wi WHERE wi.post_id IN (SELECT id FROM physical_posts))
        UNION ALL SELECT CONCAT('RETURN:',a.id),'RETURN',IF((a.finder_confirmed_at IS NOT NULL AND a.owner_confirmed_at IS NOT NULL) OR a.custody_authorized_at IS NOT NULL,'RETURN_COMPLETED','LEGACY_RETURN_RECORDED'),'APPOINTMENT',a.id,NULL,a.completed_at,NULL,'COMPLETED' FROM return_appointments a JOIN allowed_claims ac ON ac.id=a.claim_id WHERE a.status='COMPLETED' AND a.completed_at IS NOT NULL
        UNION ALL SELECT CONCAT('FEEDBACK:',f.id),'FEEDBACK','FEEDBACK_RECORDED','APPOINTMENT',f.appointment_id,NULL,f.created_at,NULL,NULL FROM return_feedback f JOIN return_appointments a ON a.id=f.appointment_id JOIN allowed_claims ac ON ac.id=a.claim_id`;
      const appt = await hasAppointments() ? ` UNION ALL SELECT CONCAT('APPOINTMENT:',e.id),'APPOINTMENT',e.action,'APPOINTMENT',e.appointment_id,NULL,e.created_at,NULL,NULL
        FROM appointment_events e JOIN return_appointments a ON a.id=e.appointment_id JOIN allowed_claims ac ON ac.id=a.claim_id WHERE e.action NOT IN ('REMINDER_QUEUED','RETURN_COMPLETED')` : "";
      const values = [...contextValues,postId,postId,postId,postId,new Date(asOf)];
      const base = `${cte}, events AS (${events}${appt})`;
      const [count] = await pool.execute<RowDataPacket[]>(`${base} SELECT COUNT(*) total FROM events WHERE created_at<=?`,values);
      const [rows] = await pool.execute<RowDataPacket[]>(`${base} SELECT * FROM events WHERE created_at<=? ORDER BY created_at,id LIMIT 50 OFFSET ${(page-1)*50}`,values);
      const [stock] = await pool.execute<RowDataPacket[]>(`${cte} SELECT wi.status,wi.received_at,wi.returned_at FROM warehouse_items wi
        WHERE wi.deleted_at IS NULL AND (wi.id IN (SELECT warehouse_item_id FROM relevant_custody) OR wi.post_id IN (SELECT id FROM physical_posts))
        ORDER BY wi.received_at DESC,wi.id DESC LIMIT 2`,contextValues);
      const [returns] = await pool.execute<RowDataPacket[]>(`${cte} SELECT a.id,a.completed_at,
        NOT EXISTS(SELECT 1 FROM return_feedback f WHERE f.appointment_id=a.id AND f.reviewer_id=?) feedback_eligible
        FROM return_appointments a JOIN allowed_claims ac ON ac.id=a.claim_id WHERE a.status='COMPLETED'
          AND ((a.finder_confirmed_at IS NOT NULL AND a.owner_confirmed_at IS NOT NULL) OR a.custody_authorized_at IS NOT NULL)
        ORDER BY a.completed_at DESC LIMIT 1`,[...contextValues,userId]);
      const [holder] = await pool.execute<RowDataPacket[]>(`${cte} SELECT 1 FROM allowed_claims ac JOIN claims c ON c.id=ac.id WHERE c.status='ACCEPTED' LIMIT 1`,contextValues);
      const s=stock[0];const r=returns[0];
      const ambiguous=post[0].type === "LOST" && !r && stock.filter(item=>["RECEIVED","STORED","CLAIMED","EXPIRED","PENDING_APPROVAL"].includes(item.status)).length>1;
      const held=s&&["RECEIVED","STORED","CLAIMED","EXPIRED","PENDING_APPROVAL"].includes(s.status);
      const returned=Boolean(r || s?.status === "RETURNED");
      const other=s&&["DONATED","DISPOSED","TRANSFERRED"].includes(s.status);
      const receivedAt=!ambiguous&&s?.received_at?new Date(s.received_at).toISOString():null;
      const returnedAt=ambiguous?null:s?.returned_at?new Date(s.returned_at).toISOString():r?.completed_at?new Date(r.completed_at).toISOString():null;
      const summary:JourneySummary={custodian:ambiguous?"UNKNOWN":held?"STAFF":other?"UNKNOWN":returned?"OWNER":post[0].type === "FOUND"||holder.length?"FINDER":"UNKNOWN",
        locationClass:ambiguous?"UNKNOWN":held?"WAREHOUSE":other?"OTHER_DISPOSITION":returned?"RETURNED":post[0].type === "FOUND"||holder.length?"FINDER_HELD":"UNKNOWN",
        receivedAt,returnedAt,custodyHours:receivedAt?Math.max(0,Math.round(((returnedAt?new Date(returnedAt).getTime():Date.now())-new Date(receivedAt).getTime())/36000)/100):null,
        feedbackEligible:Boolean(r?.feedback_eligible)};
      return { title:post[0].title,status:post[0].status,results:rows.map(map),total:Number(count[0].total),summary };
    }
  };
}
