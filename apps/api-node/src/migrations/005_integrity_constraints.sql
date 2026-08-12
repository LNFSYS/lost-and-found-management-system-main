ALTER TABLE posts
  ADD CONSTRAINT fk_posts_handover_point
  FOREIGN KEY (handover_point_id) REFERENCES handover_points(id);

ALTER TABLE claims
  ADD UNIQUE KEY uq_claim_per_post_user (post_id, claimant_id);
