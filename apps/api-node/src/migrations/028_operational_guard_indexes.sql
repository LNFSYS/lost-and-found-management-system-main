CREATE INDEX idx_claims_post_status
  ON claims (post_id, status);

CREATE INDEX idx_return_appointments_post_status
  ON return_appointments (post_id, status);
