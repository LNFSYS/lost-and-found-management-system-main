-- Forward-only intake drafts and receipts; no existing post/claim is rewritten.
CREATE TABLE IF NOT EXISTS warehouse_intake_sessions (
  id CHAR(36) PRIMARY KEY,
  actor_id CHAR(36) NOT NULL,
  custody_request_id CHAR(36) NULL,
  warehouse_item_id CHAR(36) NULL UNIQUE,
  request_payload JSON NULL,
  source_snapshot JSON NULL,
  received_quantity INT NULL,
  accessories VARCHAR(2000) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  confirmed_at DATETIME(6) NULL,
  KEY idx_intake_drafts (warehouse_item_id, created_at),
  FOREIGN KEY (actor_id) REFERENCES users(id),
  FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id),
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouse_intake_images (
  id CHAR(36) PRIMARY KEY,
  intake_id CHAR(36) NOT NULL,
  uploaded_by CHAR(36) NOT NULL,
  storage_ref VARCHAR(500) NOT NULL,
  format VARCHAR(8) NOT NULL,
  byte_size INT NOT NULL,
  captured_at DATETIME(6) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  FOREIGN KEY (intake_id) REFERENCES warehouse_intake_sessions(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  KEY idx_intake_images (intake_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
