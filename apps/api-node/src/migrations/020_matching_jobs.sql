CREATE TABLE IF NOT EXISTS matching_jobs (
  post_id CHAR(36) PRIMARY KEY,
  status ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
  requested_version INT UNSIGNED NOT NULL DEFAULT 1,
  processed_version INT UNSIGNED NOT NULL DEFAULT 0,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_matching_jobs_post FOREIGN KEY (post_id) REFERENCES posts(id),
  KEY idx_matching_jobs_ready (status, available_at),
  KEY idx_matching_jobs_locked (status, locked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
