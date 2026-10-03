-- Custody request lifecycle tables
-- NOTE: Do NOT run against production without review.

CREATE TABLE IF NOT EXISTS custody_requests (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NULL,
  room_id CHAR(36) NULL,
  post_id CHAR(36) NULL,
  requester_id CHAR(36) NOT NULL,
  handler_id CHAR(36) NULL,
  status ENUM('PENDING','ACCEPTED','REJECTED','CANCELLED','INTAKED') NOT NULL DEFAULT 'PENDING',
  intake_type ENUM('CUSTODY_TRANSFER','WALK_IN') NOT NULL DEFAULT 'CUSTODY_TRANSFER',
  reason TEXT NULL,
  rejection_reason TEXT NULL,
  handover_point_id CHAR(36) NULL,
  confirmed_handover_at DATETIME NULL,
  warehouse_item_id CHAR(36) NULL,
  idempotency_key VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_custody_req_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_custody_req_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_custody_req_requester FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT fk_custody_req_handler FOREIGN KEY (handler_id) REFERENCES users(id),
  CONSTRAINT fk_custody_req_handover FOREIGN KEY (handover_point_id) REFERENCES handover_points(id),
  CONSTRAINT fk_custody_req_warehouse FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id),
  CONSTRAINT uq_custody_req_idempotency UNIQUE (idempotency_key),
  CONSTRAINT uq_custody_req_warehouse UNIQUE (warehouse_item_id),
  KEY idx_custody_req_status (status),
  KEY idx_custody_req_claim (claim_id),
  KEY idx_custody_req_requester (requester_id),
  KEY idx_custody_req_handler (handler_id),
  KEY idx_custody_req_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custody_request_audit (
  id CHAR(36) PRIMARY KEY,
  custody_request_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(40) NOT NULL,
  from_status VARCHAR(20) NULL,
  to_status VARCHAR(20) NOT NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_custody_audit_req FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id),
  CONSTRAINT fk_custody_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  KEY idx_custody_audit_req (custody_request_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
