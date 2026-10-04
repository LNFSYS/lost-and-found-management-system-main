ALTER TABLE reports
  MODIFY entity_type ENUM('POST', 'USER', 'CLAIM', 'CHAT', 'HANDOVER') NOT NULL,
  MODIFY status ENUM('PENDING', 'REVIEWED', 'DISMISSED', 'WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN source_type ENUM('POST', 'CLAIM', 'MESSAGE', 'HANDOVER') NULL AFTER entity_id,
  ADD COLUMN source_id CHAR(36) NULL AFTER source_type,
  ADD COLUMN idempotency_key VARCHAR(128) NULL AFTER source_id,
  ADD COLUMN request_hash VARCHAR(255) NULL AFTER idempotency_key,
  ADD COLUMN withdrawn_at DATETIME NULL AFTER reviewed_at,
  ADD UNIQUE KEY uq_reports_reporter_idempotency (reporter_id, idempotency_key),
  ADD KEY idx_reports_reporter_created (reporter_id, created_at);

UPDATE reports
SET source_type = entity_type, source_id = entity_id
WHERE source_type IS NULL AND entity_type IN ('POST', 'CLAIM');

CREATE TABLE report_audit_events (
  id CHAR(36) PRIMARY KEY,
  report_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action ENUM('SUBMITTED', 'WITHDRAWN') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_audit_report FOREIGN KEY (report_id) REFERENCES reports(id),
  CONSTRAINT fk_report_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  UNIQUE KEY uq_report_audit_action (report_id, action),
  KEY idx_report_audit_created (report_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
