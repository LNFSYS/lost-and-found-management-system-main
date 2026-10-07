-- This is communication eligibility, never an ownership-verification decision.
CREATE TABLE IF NOT EXISTS lost_contact_photo_checks (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  post_id CHAR(36) NOT NULL,
  post_revision DATETIME(6) NOT NULL,
  score DECIMAL(6,5) NOT NULL,
  model VARCHAR(120) NOT NULL,
  storage_ref VARCHAR(500) NOT NULL,
  public_id VARCHAR(500) NOT NULL,
  format VARCHAR(8) NOT NULL,
  byte_size INT NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  claim_id CHAR(36) NULL,
  consumed_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (actor_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (claim_id) REFERENCES claims(id),
  KEY idx_contact_claim (claim_id, actor_id),
  KEY idx_contact_expiry (claim_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
