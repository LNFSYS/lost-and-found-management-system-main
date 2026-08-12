ALTER TABLE claims
  ADD COLUMN accepted_post_id CHAR(36)
    GENERATED ALWAYS AS (
      CASE WHEN status = 'ACCEPTED' THEN post_id ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_claims_one_accepted_per_post (accepted_post_id);
