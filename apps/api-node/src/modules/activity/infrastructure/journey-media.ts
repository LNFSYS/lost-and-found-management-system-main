import { claimantIdSql, finderIdSql } from "../../../shared/infrastructure/claim-identity-sql.js";

// Listing and delivery use the same current ACL, committed attachments and snapshot.
// Receipt photos belong only to the actual recipient and the Finder of that return,
// not another claimant who can see the item's warehouse status.
export const journeyMediaCte = `WITH context AS (
  SELECT CAST(? AS CHAR(36)) post_id,CAST(? AS CHAR(36)) user_id,CAST(? AS DATETIME(6)) as_of
), permitted_claims AS (
  SELECT c.*,${finderIdSql} finder_id,${claimantIdSql} owner_id
  FROM claims c JOIN posts identity_post ON identity_post.id=c.post_id AND identity_post.deleted_at IS NULL
  JOIN context ctx ON c.post_id=ctx.post_id OR c.lost_post_id=ctx.post_id OR c.source_found_post_id=ctx.post_id
  JOIN claim_participants cp ON cp.claim_id=c.id AND cp.user_id=ctx.user_id AND cp.consent_status='ACCEPTED'
  JOIN users viewer ON viewer.id=ctx.user_id AND viewer.status='ACTIVE'
  WHERE c.status IN ('CONVERSATION_OPEN','NEED_MORE_INFO','ACCEPTED','REJECTED')
    AND (${finderIdSql}=ctx.user_id OR ${claimantIdSql}=ctx.user_id)
), visible_post AS (
  SELECT p.* FROM posts p JOIN context ctx ON p.id=ctx.post_id
  JOIN users viewer ON viewer.id=ctx.user_id AND viewer.status='ACTIVE'
  WHERE p.deleted_at IS NULL AND (p.user_id=ctx.user_id OR EXISTS(SELECT 1 FROM permitted_claims))
), permitted_stock AS (
  SELECT wi.* FROM warehouse_items wi JOIN context ctx JOIN visible_post vp
  WHERE wi.deleted_at IS NULL AND (
    EXISTS(SELECT 1 FROM posts p WHERE p.id=wi.post_id AND p.id=ctx.post_id AND p.type='FOUND' AND p.user_id=ctx.user_id AND p.deleted_at IS NULL)
    OR EXISTS(SELECT 1 FROM permitted_claims c JOIN posts source ON source.id=COALESCE(c.source_found_post_id,c.post_id)
      WHERE c.status='ACCEPTED' AND source.type='FOUND' AND source.deleted_at IS NULL AND wi.post_id=source.id)
    OR EXISTS(SELECT 1 FROM custody_requests cr WHERE cr.warehouse_item_id=wi.id
      AND (cr.claim_id IN (SELECT id FROM permitted_claims) OR (cr.post_id=ctx.post_id AND cr.requester_id=ctx.user_id)))
  )
), journey_media AS (
  SELECT CONCAT('POST:',p.id) event_id,m.id,'POST' kind,m.secure_url storage_ref,COALESCE(m.format,'jpg') format,
    m.created_at uploaded_at,p.created_at event_at,p.id target_id
  FROM post_media m JOIN visible_post p ON p.id=m.post_id JOIN context ctx
  WHERE m.media_kind='ITEM' AND m.resource_type='image' AND m.created_at<=ctx.as_of
    AND (p.user_id=ctx.user_id OR (p.visibility_mode='PUBLIC' AND p.status<>'HIDDEN'))
  UNION ALL
  SELECT CONCAT('CHAT_PHOTO:',e.id),e.id,'CLAIM',e.secure_url,COALESCE(e.media_format,'jpg'),e.created_at,e.created_at,c.id
  FROM claim_evidence e JOIN permitted_claims c ON c.id=e.claim_id JOIN visible_post vp JOIN context ctx
  WHERE e.evidence_type='PHOTO' AND e.created_at<=ctx.as_of
    AND EXISTS(SELECT 1 FROM chat_rooms room WHERE room.claim_id=c.id AND room.created_at<=ctx.as_of)
  UNION ALL
  SELECT CONCAT('WAREHOUSE:',sl.id),i.id,'INTAKE',i.storage_ref,i.format,i.created_at,sl.created_at,wi.id
  FROM warehouse_intake_images i JOIN warehouse_intake_sessions s ON s.id=i.intake_id
  JOIN permitted_stock wi ON wi.id=s.warehouse_item_id JOIN context ctx
  JOIN storage_logs sl ON sl.id=(SELECT first_log.id FROM storage_logs first_log
    WHERE first_log.warehouse_item_id=wi.id AND first_log.action='RECEIVED' ORDER BY first_log.created_at,first_log.id LIMIT 1)
  WHERE s.confirmed_at IS NOT NULL AND s.confirmed_at<=ctx.as_of AND i.created_at<=s.confirmed_at AND sl.created_at<=ctx.as_of
  UNION ALL
  SELECT CONCAT('RETURN:',r.appointment_id),p.id,'RETURN',p.storage_ref,p.format,p.created_at,r.completed_at,wi.id
  FROM warehouse_private_proofs p JOIN warehouse_completed_returns r ON r.warehouse_item_id=p.warehouse_item_id
    AND JSON_CONTAINS(r.proof_ids,JSON_QUOTE(p.id))
  JOIN permitted_stock wi ON wi.id=r.warehouse_item_id JOIN permitted_claims c ON c.id=r.claim_id
  JOIN return_appointments a ON a.id=r.appointment_id AND a.claim_id=c.id AND a.status='COMPLETED'
  JOIN context ctx
  WHERE r.recipient_id=c.owner_id AND (ctx.user_id=r.recipient_id OR ctx.user_id=c.finder_id)
    AND p.attached_at IS NOT NULL AND p.created_at<=ctx.as_of AND p.attached_at<=ctx.as_of AND r.completed_at<=ctx.as_of
), image_media AS (
  SELECT * FROM journey_media WHERE LOWER(format) IN ('jpg','jpeg','png','webp')
)`;
