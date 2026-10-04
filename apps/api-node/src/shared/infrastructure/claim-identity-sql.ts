// Direct claims keep the requester in claimant_id for idempotency. Resolve
// ownership from the target post without rewriting legacy roles or consent.
export const claimantIdSql = `CASE
  WHEN c.lost_post_id IS NULL AND identity_post.type = 'LOST' THEN identity_post.user_id
  WHEN c.lost_post_id IS NULL AND identity_post.type = 'FOUND' THEN COALESCE((
    SELECT identity_participant.user_id FROM claim_participants identity_participant
    WHERE identity_participant.claim_id = c.id AND identity_participant.user_id <> identity_post.user_id LIMIT 1
  ), c.claimant_id)
  ELSE c.claimant_id END`;

export const finderIdSql = `CASE
  WHEN c.lost_post_id IS NULL AND identity_post.type = 'LOST' THEN COALESCE((
    SELECT identity_participant.user_id FROM claim_participants identity_participant
    WHERE identity_participant.claim_id = c.id AND identity_participant.user_id <> identity_post.user_id LIMIT 1
  ), c.claimant_id)
  ELSE identity_post.user_id END`;

export const participantRoleSql = `CASE
  WHEN c.lost_post_id IS NULL AND identity_post.type = 'LOST'
    THEN CASE WHEN cp.user_id = identity_post.user_id THEN 'CLAIMANT' ELSE 'FINDER' END
  ELSE CASE WHEN cp.user_id = identity_post.user_id THEN 'FINDER' ELSE 'CLAIMANT' END END`;
