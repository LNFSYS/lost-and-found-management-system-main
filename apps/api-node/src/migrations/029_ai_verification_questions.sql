CREATE TABLE IF NOT EXISTS item_verification_questions (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  prompt VARCHAR(500) NOT NULL,
  question_type ENUM('TEXT', 'MASKED_SERIAL', 'VISUAL_DETAIL') NOT NULL DEFAULT 'TEXT',
  source_signal VARCHAR(100) NOT NULL,
  expected_answer_hash VARCHAR(255) NOT NULL,
  weight DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  privacy_level ENUM('PRIVATE', 'HIGHLY_PRIVATE') NOT NULL DEFAULT 'PRIVATE',
  status ENUM('DRAFT', 'APPROVED', 'DISABLED') NOT NULL DEFAULT 'DRAFT',
  active_post_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status = 'APPROVED' THEN post_id ELSE NULL END) STORED,
  created_by CHAR(36) NOT NULL,
  approved_by CHAR(36) NULL,
  approved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_verification_question_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_item_verification_question_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_item_verification_question_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  UNIQUE KEY uq_item_verification_active_post (active_post_id),
  KEY idx_item_verification_questions_post_status (post_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS claim_verification_answers (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  answered_by CHAR(36) NOT NULL,
  is_match BOOLEAN NOT NULL,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  last_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_verification_answer_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_claim_verification_answer_question FOREIGN KEY (question_id) REFERENCES item_verification_questions(id),
  CONSTRAINT fk_claim_verification_answer_user FOREIGN KEY (answered_by) REFERENCES users(id),
  UNIQUE KEY uq_claim_verification_answer (claim_id, question_id),
  KEY idx_claim_verification_answers_claim (claim_id, answered_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
