CREATE TABLE lost_search_profiles (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  answers_json JSON NOT NULL,
  skipped_fields_json JSON NULL,
  revision INT NOT NULL DEFAULT 1,
  applied_revision INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lost_search_profiles_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_lost_search_profiles_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  UNIQUE KEY uq_lost_search_profiles_post (post_id),
  KEY idx_lost_search_profiles_owner_updated (owner_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE finder_scan_sessions (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  status ENUM('ANALYZED', 'DRAFT_READY', 'PUBLISHED', 'EXPIRED') NOT NULL DEFAULT 'ANALYZED',
  draft_json JSON NOT NULL,
  candidates_json JSON NOT NULL,
  provider_status ENUM('AVAILABLE', 'FALLBACK') NOT NULL,
  provider_reason VARCHAR(80) NULL,
  selected_lost_post_id CHAR(36) NULL,
  created_post_id CHAR(36) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_finder_scan_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT fk_finder_scan_selected_lost FOREIGN KEY (selected_lost_post_id) REFERENCES posts(id),
  CONSTRAINT fk_finder_scan_created_post FOREIGN KEY (created_post_id) REFERENCES posts(id),
  UNIQUE KEY uq_finder_scan_actor_idempotency (actor_id, idempotency_key),
  KEY idx_finder_scan_actor_created (actor_id, created_at),
  KEY idx_finder_scan_expiry (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.search_companion_enabled', 'false', 'BOOLEAN', 'Enable owner-only Search Companion preview and confirmed apply', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.search_companion_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.finder_quick_scan_enabled', 'false', 'BOOLEAN', 'Enable Finder Quick Scan with Google Vision assisted OCR and safe fallback', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.finder_quick_scan_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'recovery.timeline_enabled', 'false', 'BOOLEAN', 'Enable Recovery Timeline derived from business records and audit logs', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'recovery.timeline_enabled');
