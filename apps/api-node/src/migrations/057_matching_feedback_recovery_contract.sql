-- New reproducible contract, NOT the missing original 054 SQL.
-- Preserve every existing label; do not infer or rewrite feedback meanings.
ALTER TABLE match_feedback MODIFY label
  ENUM('TRUE_MATCH','FALSE_MATCH','UNCERTAIN','DUPLICATE','INSUFFICIENT_EVIDENCE','USEFUL','IRRELEVANT','INCORRECT') NOT NULL;

SET @feedback_source_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_feedback' AND COLUMN_NAME = 'source_post_id');
SET @feedback_source_sql = IF(@feedback_source_exists = 0,
  'ALTER TABLE match_feedback ADD COLUMN source_post_id CHAR(36) NULL, ADD CONSTRAINT fk_match_feedback_source_post FOREIGN KEY(source_post_id) REFERENCES posts(id)', 'SELECT 1');
PREPARE feedback_source_stmt FROM @feedback_source_sql;
EXECUTE feedback_source_stmt;
DEALLOCATE PREPARE feedback_source_stmt;

SET @feedback_key_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_feedback' AND COLUMN_NAME = 'correlation_key');
SET @feedback_key_sql = IF(@feedback_key_exists = 0,
  'ALTER TABLE match_feedback ADD COLUMN correlation_key VARCHAR(128) NULL', 'SELECT 1');
PREPARE feedback_key_stmt FROM @feedback_key_sql;
EXECUTE feedback_key_stmt;
DEALLOCATE PREPARE feedback_key_stmt;
SET @feedback_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'match_feedback' AND INDEX_NAME = 'uq_match_feedback_correlation');
SET @feedback_index_sql = IF(@feedback_index_exists = 0,
  'CREATE UNIQUE INDEX uq_match_feedback_correlation ON match_feedback(user_id,correlation_key)', 'SELECT 1');
PREPARE feedback_index_stmt FROM @feedback_index_sql;
EXECUTE feedback_index_stmt;
DEALLOCATE PREPARE feedback_index_stmt;

SET @job_key_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matching_jobs' AND COLUMN_NAME = 'correlation_key');
SET @job_key_sql = IF(@job_key_exists = 0,
  'ALTER TABLE matching_jobs ADD COLUMN correlation_key VARCHAR(128) NULL', 'SELECT 1');
PREPARE job_key_stmt FROM @job_key_sql;
EXECUTE job_key_stmt;
DEALLOCATE PREPARE job_key_stmt;
SET @job_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matching_jobs' AND INDEX_NAME = 'idx_matching_jobs_correlation');
SET @job_index_sql = IF(@job_index_exists = 0,
  'CREATE INDEX idx_matching_jobs_correlation ON matching_jobs(correlation_key)', 'SELECT 1');
PREPARE job_index_stmt FROM @job_index_sql;
EXECUTE job_index_stmt;
DEALLOCATE PREPARE job_index_stmt;

CREATE TABLE IF NOT EXISTS match_suggestion_dismissals (
  id CHAR(36) PRIMARY KEY,
  match_id CHAR(36) NOT NULL, user_id CHAR(36) NOT NULL, source_post_id CHAR(36) NOT NULL,
  reason VARCHAR(500) NULL, correlation_key VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_match_dismissal_actor (match_id,user_id,source_post_id),
  UNIQUE KEY uq_match_dismissal_correlation (user_id,correlation_key),
  KEY idx_match_dismissal_post_created (source_post_id,created_at),
  CONSTRAINT fk_match_dismissal_match FOREIGN KEY(match_id) REFERENCES match_results(id),
  CONSTRAINT fk_match_dismissal_user FOREIGN KEY(user_id) REFERENCES users(id),
  CONSTRAINT fk_match_dismissal_source_post FOREIGN KEY(source_post_id) REFERENCES posts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
