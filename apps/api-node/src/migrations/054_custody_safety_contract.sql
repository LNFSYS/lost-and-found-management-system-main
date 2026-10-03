-- Additive safety contract. Do not rewrite or alias an applied 053 migration.
-- Duplicate physical posts must be reviewed before applying the unique guards.
-- Preserve a dangling warehouse pointer before removing it. This does not infer
-- ownership, create a warehouse item or change the request/claim/post status.
CREATE TABLE custody_link_recovery_reviews (
  custody_request_id CHAR(36) PRIMARY KEY,
  warehouse_item_id CHAR(36) NULL,
  reason VARCHAR(100) NOT NULL,
  original_links JSON NOT NULL,
  status ENUM('REVIEW_REQUIRED','RESOLVED') NOT NULL DEFAULT 'REVIEW_REQUIRED',
  operation_ref VARCHAR(128) NOT NULL,
  reviewed_by CHAR(36) NULL, reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id),
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
START TRANSACTION;
INSERT INTO custody_link_recovery_reviews(custody_request_id,reason,original_links,operation_ref)
  SELECT cr.id,'MISSING_WAREHOUSE_LINK',
    JSON_OBJECT('id',cr.id,'post_id',cr.post_id,'requester_id',cr.requester_id,
      'claim_id',cr.claim_id,'room_id',cr.room_id,'status',cr.status,'warehouse_item_id',cr.warehouse_item_id),
    'migration:054_custody_safety_contract.sql'
  FROM custody_requests cr LEFT JOIN warehouse_items wi ON wi.id=cr.warehouse_item_id
  WHERE cr.warehouse_item_id IS NOT NULL AND wi.id IS NULL;
UPDATE custody_requests cr LEFT JOIN warehouse_items wi ON wi.id=cr.warehouse_item_id
  SET cr.warehouse_item_id=NULL
  WHERE cr.warehouse_item_id IS NOT NULL AND wi.id IS NULL;
COMMIT;
ALTER TABLE custody_requests ADD COLUMN active_post_id CHAR(36)
  GENERATED ALWAYS AS (CASE WHEN status IN ('PENDING','ACCEPTED','INTAKED') THEN post_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_custody_active_post (active_post_id);
ALTER TABLE claims ADD COLUMN source_found_post_id CHAR(36) NULL,
  ADD CONSTRAINT fk_claim_source_found FOREIGN KEY (source_found_post_id) REFERENCES posts(id);
ALTER TABLE warehouse_items ADD COLUMN legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN reserved_claim_id CHAR(36) NULL,
  ADD COLUMN active_post_id CHAR(36)
    GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL AND status IN ('PENDING_APPROVAL','RECEIVED','STORED','CLAIMED','EXPIRED') THEN post_id ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_warehouse_active_post (active_post_id),
  ADD CONSTRAINT fk_warehouse_reserved_claim FOREIGN KEY (reserved_claim_id) REFERENCES claims(id);
CREATE TABLE warehouse_private_proofs (
  id CHAR(36) PRIMARY KEY, warehouse_item_id CHAR(36) NOT NULL, uploaded_by CHAR(36) NOT NULL,
  storage_ref VARCHAR(500) NOT NULL, format VARCHAR(8) NOT NULL, byte_size INT NOT NULL,
  attached_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id), KEY idx_proof_orphans (attached_at,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE warehouse_action_approvals (
  id CHAR(36) PRIMARY KEY, warehouse_item_id CHAR(36) NOT NULL,
  target_status ENUM('DISPOSED','DONATED','TRANSFERRED') NOT NULL,
  requested_by CHAR(36) NOT NULL, approved_by CHAR(36) NULL,
  reason VARCHAR(1000) NOT NULL, status ENUM('PENDING','APPROVED','EXECUTED') NOT NULL DEFAULT 'PENDING',
  approved_at DATETIME NULL, executed_at DATETIME NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id),
  FOREIGN KEY (requested_by) REFERENCES users(id), FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE warehouse_completed_returns (
  id CHAR(36) PRIMARY KEY, warehouse_item_id CHAR(36) NOT NULL UNIQUE,
  claim_id CHAR(36) NOT NULL, appointment_id CHAR(36) NOT NULL UNIQUE,
  recipient_id CHAR(36) NOT NULL, authorized_by CHAR(36) NOT NULL,
  proof_ids JSON NOT NULL, completed_at DATETIME NOT NULL,
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id), FOREIGN KEY (claim_id) REFERENCES claims(id),
  FOREIGN KEY (appointment_id) REFERENCES return_appointments(id), FOREIGN KEY (recipient_id) REFERENCES users(id),
  FOREIGN KEY (authorized_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Immutable payload fingerprint; legacy rows remain nullable and are checked conservatively.
ALTER TABLE custody_requests ADD COLUMN request_payload JSON NULL;

