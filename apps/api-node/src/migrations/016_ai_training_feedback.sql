SET @match_image_score_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'match_results'
    AND column_name = 'image_score'
);
SET @match_image_score_sql = IF(
  @match_image_score_exists = 0,
  'ALTER TABLE match_results ADD COLUMN image_score FLOAT NOT NULL DEFAULT 0 AFTER time_score',
  'SELECT 1'
);
PREPARE match_image_score_stmt FROM @match_image_score_sql;
EXECUTE match_image_score_stmt;
DEALLOCATE PREPARE match_image_score_stmt;

SET @match_ocr_score_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'match_results'
    AND column_name = 'ocr_score'
);
SET @match_ocr_score_sql = IF(
  @match_ocr_score_exists = 0,
  'ALTER TABLE match_results ADD COLUMN ocr_score FLOAT NOT NULL DEFAULT 0 AFTER image_score',
  'SELECT 1'
);
PREPARE match_ocr_score_stmt FROM @match_ocr_score_sql;
EXECUTE match_ocr_score_stmt;
DEALLOCATE PREPARE match_ocr_score_stmt;

SET @match_score_tier_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'match_results'
    AND column_name = 'score_tier'
);
SET @match_score_tier_sql = IF(
  @match_score_tier_exists = 0,
  'ALTER TABLE match_results ADD COLUMN score_tier ENUM(''WEAK'', ''SUGGESTION'', ''NOTIFY'', ''HIGH_CONFIDENCE'') NOT NULL DEFAULT ''WEAK'' AFTER ocr_score',
  'SELECT 1'
);
PREPARE match_score_tier_stmt FROM @match_score_tier_sql;
EXECUTE match_score_tier_stmt;
DEALLOCATE PREPARE match_score_tier_stmt;

SET @match_version_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'match_results'
    AND column_name = 'matcher_version'
);
SET @match_version_sql = IF(
  @match_version_exists = 0,
  'ALTER TABLE match_results ADD COLUMN matcher_version VARCHAR(40) NOT NULL DEFAULT ''rule-v1'' AFTER score_tier',
  'SELECT 1'
);
PREPARE match_version_stmt FROM @match_version_sql;
EXECUTE match_version_stmt;
DEALLOCATE PREPARE match_version_stmt;

SET @match_explanation_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'match_results'
    AND column_name = 'explanation_json'
);
SET @match_explanation_sql = IF(
  @match_explanation_exists = 0,
  'ALTER TABLE match_results ADD COLUMN explanation_json JSON NULL AFTER matcher_version',
  'SELECT 1'
);
PREPARE match_explanation_stmt FROM @match_explanation_sql;
EXECUTE match_explanation_stmt;
DEALLOCATE PREPARE match_explanation_stmt;

CREATE TABLE IF NOT EXISTS match_feedback (
  id CHAR(36) PRIMARY KEY,
  match_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  label ENUM('TRUE_MATCH', 'FALSE_MATCH', 'UNCERTAIN', 'DUPLICATE', 'INSUFFICIENT_EVIDENCE') NOT NULL,
  note VARCHAR(500) NULL,
  source ENUM('USER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'USER',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_feedback_match FOREIGN KEY (match_id) REFERENCES match_results(id),
  CONSTRAINT fk_match_feedback_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_match_feedback_user (match_id, user_id),
  KEY idx_match_feedback_label_created (label, created_at),
  KEY idx_match_feedback_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS match_suggestion_impressions (
  id CHAR(36) PRIMARY KEY,
  match_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  source_post_id CHAR(36) NOT NULL,
  suggested_post_id CHAR(36) NOT NULL,
  surface ENUM('CREATE_POST', 'SUGGESTION_LIST', 'DETAIL', 'NOTIFICATION', 'ADMIN') NOT NULL,
  action ENUM('SHOWN', 'CLICKED', 'DISMISSED', 'CLAIM_STARTED') NOT NULL DEFAULT 'SHOWN',
  score_snapshot FLOAT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_impression_match FOREIGN KEY (match_id) REFERENCES match_results(id),
  CONSTRAINT fk_match_impression_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_match_impression_source_post FOREIGN KEY (source_post_id) REFERENCES posts(id),
  CONSTRAINT fk_match_impression_suggested_post FOREIGN KEY (suggested_post_id) REFERENCES posts(id),
  KEY idx_match_impression_match_created (match_id, created_at),
  KEY idx_match_impression_user_created (user_id, created_at),
  KEY idx_match_impression_action_created (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
