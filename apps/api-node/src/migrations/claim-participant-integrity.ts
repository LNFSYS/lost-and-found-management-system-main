// Accept migration-045 labels and canonical direct-LOST labels, but require
// both real identities and a complete orientation; never infer consent here.
export const missingClaimParticipantsSql = `NOT (
  (EXISTS (SELECT 1 FROM claim_participants cp
    WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'CLAIMANT')
   AND (p.user_id = c.claimant_id OR EXISTS (SELECT 1 FROM claim_participants cp
     WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'FINDER')))
  OR (c.lost_post_id IS NULL AND p.type = 'LOST' AND p.user_id <> c.claimant_id
    AND EXISTS (SELECT 1 FROM claim_participants cp
      WHERE cp.claim_id = c.id AND cp.user_id = c.claimant_id AND cp.participant_role = 'FINDER')
    AND EXISTS (SELECT 1 FROM claim_participants cp
      WHERE cp.claim_id = c.id AND cp.user_id = p.user_id AND cp.participant_role = 'CLAIMANT'))
)`;
