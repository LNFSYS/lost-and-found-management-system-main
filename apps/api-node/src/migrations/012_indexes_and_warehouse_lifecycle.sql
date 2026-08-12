ALTER TABLE warehouse_items
  MODIFY status ENUM(
    'PENDING_APPROVAL',
    'RECEIVED',
    'STORED',
    'CLAIMED',
    'RETURNED',
    'EXPIRED',
    'DISPOSED',
    'DONATED',
    'TRANSFERRED'
  ) NOT NULL DEFAULT 'RECEIVED';

CREATE INDEX idx_posts_feed_created
  ON posts (deleted_at, created_at);

CREATE INDEX idx_posts_feed_filters
  ON posts (deleted_at, status, type, category_id, created_at);

CREATE INDEX idx_posts_location_filters
  ON posts (deleted_at, status, type, area_id, building_id, created_at);

CREATE INDEX idx_match_lost_score_created
  ON match_results (lost_post_id, total_score, created_at);

CREATE INDEX idx_match_found_score_created
  ON match_results (found_post_id, total_score, created_at);

CREATE INDEX idx_notifications_user_created
  ON notifications (user_id, created_at);

CREATE INDEX idx_claim_state_logs_claim_created
  ON claim_state_logs (claim_id, created_at);
