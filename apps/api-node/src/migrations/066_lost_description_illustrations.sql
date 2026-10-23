ALTER TABLE post_media ADD COLUMN is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE lost_illustration_drafts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  active_owner_id CHAR(36) NULL,
  attempts_used TINYINT UNSIGNED NOT NULL DEFAULT 0,
  post_id CHAR(36) NULL,
  selected_attempt_id CHAR(36) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_illustration_active_owner (active_owner_id),
  KEY idx_illustration_draft_user (user_id),
  CONSTRAINT fk_illustration_draft_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_illustration_draft_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT chk_illustration_max_attempts CHECK (attempts_used <= 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lost_illustration_attempts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  draft_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  request_id CHAR(36) NOT NULL,
  attempt_number TINYINT UNSIGNED NOT NULL,
  status ENUM('PENDING','READY','REJECTED','FAILED') NOT NULL DEFAULT 'PENDING',
  input_hash CHAR(64) NOT NULL,
  category_id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  storage_ref VARCHAR(1024) NULL,
  public_id VARCHAR(255) NULL,
  format VARCHAR(10) NULL,
  bytes INT UNSIGNED NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  finished_at DATETIME(6) NULL,
  UNIQUE KEY uq_illustration_request (user_id, request_id),
  UNIQUE KEY uq_illustration_draft_attempt (draft_id, attempt_number),
  CONSTRAINT fk_illustration_attempt_draft FOREIGN KEY (draft_id) REFERENCES lost_illustration_drafts(id),
  CONSTRAINT fk_illustration_attempt_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT chk_illustration_attempt_number CHECK (attempt_number BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
