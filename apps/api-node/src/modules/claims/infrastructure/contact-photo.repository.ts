import type { RowDataPacket } from "mysql2";
import { sqlExecutor, type SqlExecutor } from "../../../shared/infrastructure/transaction-context.js";
import type { ContactPhotoCheck, ContactPhotoRepository } from "../application/contact-photo.repository.port.js";

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
function check(row: RowDataPacket): ContactPhotoCheck {
  return { id: String(row.id), actorId: String(row.actor_id), postId: String(row.post_id), postRevision: iso(row.post_revision), score: Number(row.score), model: String(row.model),
    storageRef: String(row.storage_ref), publicId: String(row.public_id), format: String(row.format), bytes: Number(row.byte_size), expiresAt: iso(row.expires_at), claimId: row.claim_id ?? null };
}
export function createContactPhotoRepository(pool: SqlExecutor): ContactPhotoRepository {
  return {
    async revision(postId, db) {
      const [rows] = await (db ? sqlExecutor(db) : pool).execute<RowDataPacket[]>("SELECT updated_at FROM posts WHERE id = ? AND type = 'LOST' AND status IN ('OPEN','MATCHED') AND deleted_at IS NULL" + (db ? " FOR UPDATE" : ""), [postId]);
      return rows[0] ? iso(rows[0].updated_at) : null;
    },
    async create(input, db) {
      await sqlExecutor(db).execute(`INSERT INTO lost_contact_photo_checks
        (id,actor_id,post_id,post_revision,score,model,storage_ref,public_id,format,byte_size,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [input.id,input.actorId,input.postId,new Date(input.postRevision),input.score,input.model,input.storageRef,input.publicId,input.format,input.bytes,new Date(input.expiresAt)]);
    },
    async lock(id, db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT * FROM lost_contact_photo_checks WHERE id = ? FOR UPDATE", [id]);
      return rows[0] ? check(rows[0]) : null;
    },
    async consume(id, claimId, db) { await sqlExecutor(db).execute("UPDATE lost_contact_photo_checks SET claim_id = ?, consumed_at = UTC_TIMESTAMP(6) WHERE id = ? AND claim_id IS NULL", [claimId,id]); },
    async conversation(claimId, db) {
      const [rows] = await (db ? sqlExecutor(db) : pool).execute<RowDataPacket[]>(`SELECT p.id,p.user_id,p.type,c.name AS category_name,parent.name AS parent_name
        FROM claims claim JOIN posts p ON p.id = claim.post_id
        LEFT JOIN item_categories c ON c.id = p.category_id LEFT JOIN item_categories parent ON parent.id = c.parent_id WHERE claim.id = ?`, [claimId]);
      const row = rows[0];
      return row ? { postId: String(row.id), ownerId: String(row.user_id), type: row.type, categoryName: String(row.category_name ?? ""), parentName: row.parent_name ?? null } : null;
    },
    async hasApproval(claimId, actorId, db) {
      const [rows] = await (db ? sqlExecutor(db) : pool).execute<RowDataPacket[]>(`SELECT c.id FROM lost_contact_photo_checks c
        JOIN claims claim ON claim.id = c.claim_id AND claim.post_id = c.post_id
        WHERE c.claim_id = ? AND c.actor_id = ? AND c.score > 0.6 AND c.consumed_at IS NOT NULL LIMIT 1`, [claimId,actorId]);
      return rows.length > 0;
    },
    async expiredDrafts(db) {
      const [rows] = await sqlExecutor(db).execute<RowDataPacket[]>("SELECT * FROM lost_contact_photo_checks WHERE claim_id IS NULL AND expires_at < UTC_TIMESTAMP(6) ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED");
      return rows.map(check);
    },
    async deleteDraft(id, db) { await sqlExecutor(db).execute("DELETE FROM lost_contact_photo_checks WHERE id = ? AND claim_id IS NULL", [id]); }
  };
}
