ALTER TABLE match_feedback
  MODIFY COLUMN label ENUM('TRUE_MATCH', 'FALSE_MATCH', 'UNCERTAIN', 'DUPLICATE', 'INSUFFICIENT_EVIDENCE', 'USEFUL', 'IRRELEVANT', 'INCORRECT') NOT NULL;

UPDATE match_feedback SET label = CASE label
  WHEN 'TRUE_MATCH' THEN 'USEFUL'
  WHEN 'FALSE_MATCH' THEN 'INCORRECT'
  ELSE 'IRRELEVANT'
END
WHERE label IN ('TRUE_MATCH', 'FALSE_MATCH', 'UNCERTAIN', 'DUPLICATE', 'INSUFFICIENT_EVIDENCE');

ALTER TABLE match_feedback
  MODIFY COLUMN label ENUM('USEFUL', 'IRRELEVANT', 'INCORRECT') NOT NULL,
  ADD COLUMN source_post_id CHAR(36) NULL AFTER user_id,
  ADD COLUMN correlation_key VARCHAR(128) NULL AFTER source,
  ADD CONSTRAINT fk_match_feedback_source_post FOREIGN KEY (source_post_id) REFERENCES posts(id),
  ADD UNIQUE KEY uq_match_feedback_correlation (user_id, correlation_key);

CREATE TABLE match_suggestion_dismissals (
  id CHAR(36) PRIMARY KEY,
  match_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  source_post_id CHAR(36) NOT NULL,
  reason VARCHAR(500) NULL,
  correlation_key VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_dismissal_match FOREIGN KEY (match_id) REFERENCES match_results(id),
  CONSTRAINT fk_match_dismissal_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_match_dismissal_source_post FOREIGN KEY (source_post_id) REFERENCES posts(id),
  UNIQUE KEY uq_match_dismissal_actor (match_id, user_id, source_post_id),
  UNIQUE KEY uq_match_dismissal_correlation (user_id, correlation_key),
  KEY idx_match_dismissal_post_created (source_post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE matching_jobs
  ADD COLUMN correlation_key VARCHAR(128) NULL AFTER post_id,
  ADD KEY idx_matching_jobs_correlation (correlation_key);
