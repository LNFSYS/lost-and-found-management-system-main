ALTER TABLE item_verification_questions
  MODIFY question_type ENUM('TEXT', 'MASKED_SERIAL', 'MULTIPLE_CHOICE', 'VISUAL_DETAIL') NOT NULL DEFAULT 'TEXT',
  ADD COLUMN options_json JSON NULL AFTER expected_answer_hash;

CREATE TABLE IF NOT EXISTS claim_verification_assignments (
  claim_id CHAR(36) NOT NULL,
  question_id CHAR(36) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id, question_id),
  CONSTRAINT fk_claim_verification_assignment_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_claim_verification_assignment_question FOREIGN KEY (question_id) REFERENCES item_verification_questions(id),
  KEY idx_claim_verification_assignment_question (question_id, assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO claim_verification_assignments (claim_id, question_id)
SELECT c.id, q.id
FROM claims c
INNER JOIN item_verification_questions q ON q.post_id = c.post_id AND q.status = 'APPROVED';

CREATE TABLE IF NOT EXISTS visual_hunt_feedback (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  post_id CHAR(36) NOT NULL,
  decision ENUM('CANDIDATE', 'NOT_RELEVANT') NOT NULL,
  similarity_score DECIMAL(5,4) NULL,
  source ENUM('CAMERA', 'IMAGE', 'VIDEO_FRAMES', 'BATCH_IMAGES') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_visual_hunt_feedback_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT fk_visual_hunt_feedback_post FOREIGN KEY (post_id) REFERENCES posts(id),
  KEY idx_visual_hunt_feedback_decision_created (decision, created_at),
  KEY idx_visual_hunt_feedback_post_created (post_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
