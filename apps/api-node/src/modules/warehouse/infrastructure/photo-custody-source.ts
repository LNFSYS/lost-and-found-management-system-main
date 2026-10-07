import type { RowDataPacket } from "mysql2";
import { claimantIdSql, finderIdSql } from "../../../shared/infrastructure/claim-identity-sql.js";
import type { PhotoCustodySource } from "../application/custody-request.repository.port.js";

// A consumed contact photo authorizes custody transfer, never ownership or release.
export const photoCustodyJoins = `JOIN posts identity_post ON identity_post.id = c.post_id
  JOIN chat_rooms photo_room ON photo_room.claim_id = c.id
  JOIN claim_participants photo_finder ON photo_finder.claim_id = c.id AND photo_finder.user_id = ${finderIdSql} AND photo_finder.consent_status = 'ACCEPTED'
  JOIN claim_participants photo_owner ON photo_owner.claim_id = c.id AND photo_owner.user_id = ${claimantIdSql} AND photo_owner.consent_status = 'ACCEPTED'
  JOIN users photo_user ON photo_user.id = photo_finder.user_id AND photo_user.status = 'ACTIVE'
  JOIN lost_contact_photo_checks contact_photo ON contact_photo.id = (
    SELECT chosen.id FROM lost_contact_photo_checks chosen WHERE chosen.claim_id = c.id AND chosen.post_id = c.post_id
      AND chosen.actor_id = photo_finder.user_id AND chosen.score >= 0.5 AND chosen.consumed_at IS NOT NULL
    ORDER BY chosen.consumed_at,chosen.id LIMIT 1)
  JOIN claim_evidence photo_evidence ON photo_evidence.id = contact_photo.id AND photo_evidence.claim_id = c.id
    AND photo_evidence.uploaded_by = photo_finder.user_id AND photo_evidence.secure_url = contact_photo.storage_ref`;

export const photoCustodyScope = `identity_post.type = 'LOST' AND c.lost_post_id IS NULL AND c.source_found_post_id IS NULL
  AND photo_finder.user_id <> identity_post.user_id AND photo_owner.user_id = identity_post.user_id`;

export const photoCustodySelect = `SELECT identity_post.id AS lost_post_id,identity_post.title,identity_post.description,
  identity_post.category_id,identity_post.area_id,identity_post.building_id,identity_post.room_text,
  photo_user.id AS finder_id,photo_user.full_name AS finder_name,photo_user.phone_number AS finder_contact,
  contact_photo.id AS image_id,contact_photo.storage_ref,contact_photo.format,contact_photo.consumed_at AS uploaded_at
  FROM claims c ${photoCustodyJoins}`;

export function mapPhotoCustodySource(row: RowDataPacket): PhotoCustodySource {
  return { lostPostId: String(row.lost_post_id),
    post: { title: String(row.title), description: row.description ?? null, categoryId: row.category_id ?? null,
      areaId: row.area_id ?? null, buildingId: row.building_id ?? null, roomText: row.room_text ?? null,
      finderUserId: String(row.finder_id), finderName: row.finder_name ?? null, finderContact: row.finder_contact ?? null },
    image: { id: String(row.image_id), provenance: "CONTACT_PHOTO", storageRef: String(row.storage_ref), format: String(row.format),
      uploaderId: String(row.finder_id), uploadedAt: row.uploaded_at instanceof Date ? row.uploaded_at.toISOString() : String(row.uploaded_at),
      capturedAt: null, postId: String(row.lost_post_id), intakeKey: null, returnId: null } };
}
