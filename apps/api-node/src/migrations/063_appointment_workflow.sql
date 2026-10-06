-- Forward-only companion to return_appointments; existing custody returns are unchanged.
CREATE TABLE return_appointment_workflows (
  appointment_id CHAR(36) PRIMARY KEY,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  finder_response ENUM('PENDING','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'PENDING',
  owner_response ENUM('PENDING','CONFIRMED','DISPUTED') NOT NULL DEFAULT 'PENDING',
  no_show_user_id CHAR(36) NULL,
  reminder_queued_at DATETIME NULL,
  FOREIGN KEY (appointment_id) REFERENCES return_appointments(id),
  FOREIGN KEY (no_show_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE appointment_events (
  id CHAR(36) PRIMARY KEY,
  appointment_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NULL,
  action VARCHAR(40) NOT NULL,
  request_key VARCHAR(64) NULL,
  request_hash VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES return_appointments(id),
  FOREIGN KEY (actor_id) REFERENCES users(id),
  UNIQUE KEY uq_appointment_request (actor_id, request_key),
  KEY idx_appointment_events_time (appointment_id, created_at, id),
  KEY idx_appointment_events_created (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
