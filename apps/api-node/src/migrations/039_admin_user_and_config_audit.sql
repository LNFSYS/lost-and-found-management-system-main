CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id CHAR(36) NULL,
  before_state JSON NULL,
  after_state JSON NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  KEY idx_admin_audit_actor_time (actor_id, created_at),
  KEY idx_admin_audit_target_time (target_type, target_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE config_history
  ADD COLUMN config_id CHAR(36) NULL AFTER id,
  ADD COLUMN action VARCHAR(32) NOT NULL DEFAULT 'UPDATE' AFTER config_id,
  ADD COLUMN old_config_key VARCHAR(100) NULL AFTER config_key,
  ADD COLUMN new_config_key VARCHAR(100) NULL AFTER old_config_key,
  ADD COLUMN old_value_type VARCHAR(16) NULL AFTER old_value,
  ADD COLUMN new_value_type VARCHAR(16) NULL AFTER old_value_type,
  ADD COLUMN old_state_json JSON NULL AFTER new_value_type,
  ADD COLUMN new_state_json JSON NULL AFTER old_state_json,
  ADD COLUMN reason VARCHAR(255) NULL AFTER changed_by,
  ADD KEY idx_config_hist_id_time (config_id, changed_at);
