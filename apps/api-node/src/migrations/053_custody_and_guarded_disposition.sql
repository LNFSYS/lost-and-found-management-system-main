-- Migration 053: Custody transfer, Staff intake, Legal holds, and Guarded Disposition

-- 1. Extend posts.status to include IN_CUSTODY
ALTER TABLE posts
  MODIFY status ENUM('OPEN', 'MATCHED', 'RESOLVED', 'CLOSED', 'EXPIRED', 'HIDDEN', 'IN_CUSTODY') NOT NULL DEFAULT 'OPEN';

-- 2. Create custody_requests table
CREATE TABLE IF NOT EXISTS custody_requests (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  finder_id CHAR(36) NOT NULL,
  claim_id CHAR(36) NULL,
  status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'INTAKED') NOT NULL DEFAULT 'PENDING',
  reason ENUM('INACTIVITY', 'SAFETY_CONCERN', 'DISPUTE', 'SENSITIVE_ITEM', 'VOLUNTARY') NOT NULL,
  reason_notes TEXT NULL,
  proposed_handover_point_id CHAR(36) NULL,
  proposed_time DATETIME NULL,
  confirmed_handover_point_id CHAR(36) NULL,
  assigned_handler_id CHAR(36) NULL,
  warehouse_item_id CHAR(36) NULL,
  active_post_id CHAR(36) GENERATED ALWAYS AS (
    CASE WHEN status IN ('PENDING', 'ACCEPTED') THEN post_id ELSE NULL END
  ) STORED,
  idempotency_key VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_custody_post (post_id),
  INDEX idx_custody_finder (finder_id),
  INDEX idx_custody_status (status),
  UNIQUE INDEX uq_custody_idempotency (finder_id, idempotency_key),
  UNIQUE INDEX uq_custody_active_post (active_post_id),
  CONSTRAINT fk_custody_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_custody_finder FOREIGN KEY (finder_id) REFERENCES users(id),
  CONSTRAINT fk_custody_claim FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE SET NULL,
  CONSTRAINT fk_custody_proposed_hp FOREIGN KEY (proposed_handover_point_id) REFERENCES handover_points(id) ON DELETE SET NULL,
  CONSTRAINT fk_custody_confirmed_hp FOREIGN KEY (confirmed_handover_point_id) REFERENCES handover_points(id) ON DELETE SET NULL,
  CONSTRAINT fk_custody_handler FOREIGN KEY (assigned_handler_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create custody_request_logs table (Chain of Custody)
CREATE TABLE IF NOT EXISTS custody_request_logs (
  id CHAR(36) PRIMARY KEY,
  custody_request_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action ENUM('REQUESTED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'INTAKED', 'COMMENTED') NOT NULL,
  from_status VARCHAR(30) NULL,
  to_status VARCHAR(30) NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_custody_logs_request (custody_request_id, created_at),
  CONSTRAINT fk_custody_logs_request FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_custody_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Create disposition_orders table
CREATE TABLE IF NOT EXISTS disposition_orders (
  id CHAR(36) PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  disposition_type ENUM('DISPOSAL', 'DONATION', 'TRANSFER') NOT NULL,
  status ENUM('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_APPROVAL',
  reason TEXT NOT NULL,
  created_by CHAR(36) NOT NULL,
  approved_by CHAR(36) NULL,
  approved_at DATETIME NULL,
  rejection_reason TEXT NULL,
  cancelled_by CHAR(36) NULL,
  cancelled_at DATETIME NULL,
  cancellation_reason TEXT NULL,
  completed_by CHAR(36) NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_disp_orders_status (status),
  CONSTRAINT fk_disp_orders_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_disp_orders_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT fk_disp_orders_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id),
  CONSTRAINT fk_disp_orders_completer FOREIGN KEY (completed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Extend warehouse_items with custody, legal hold count and disposition order columns
-- Check if retention_deadline exists first
SET @retention_deadline_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND column_name = 'retention_deadline'
);

-- Add retention_deadline if it doesn't exist
SET @add_retention_deadline_sql = IF(
  @retention_deadline_exists = 0,
  'ALTER TABLE warehouse_items ADD COLUMN retention_deadline DATETIME NULL AFTER returned_at',
  'SELECT 1'
);
PREPARE add_retention_deadline_stmt FROM @add_retention_deadline_sql;
EXECUTE add_retention_deadline_stmt;
DEALLOCATE PREPARE add_retention_deadline_stmt;

-- Check if custody_request_id exists
SET @custody_request_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND column_name = 'custody_request_id'
);

-- Add custody_request_id if it doesn't exist
SET @add_custody_request_id_sql = IF(
  @custody_request_id_exists = 0,
  'ALTER TABLE warehouse_items ADD COLUMN custody_request_id CHAR(36) NULL AFTER post_id',
  'SELECT 1'
);
PREPARE add_custody_request_id_stmt FROM @add_custody_request_id_sql;
EXECUTE add_custody_request_id_stmt;
DEALLOCATE PREPARE add_custody_request_id_stmt;

-- Check if legal_hold_count exists
SET @legal_hold_count_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND column_name = 'legal_hold_count'
);

-- Add legal_hold_count if it doesn't exist
SET @add_legal_hold_count_sql = IF(
  @legal_hold_count_exists = 0,
  'ALTER TABLE warehouse_items ADD COLUMN legal_hold_count INT NOT NULL DEFAULT 0 AFTER retention_deadline',
  'SELECT 1'
);
PREPARE add_legal_hold_count_stmt FROM @add_legal_hold_count_sql;
EXECUTE add_legal_hold_count_stmt;
DEALLOCATE PREPARE add_legal_hold_count_stmt;

-- Check if disposition_order_id exists
SET @disposition_order_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND column_name = 'disposition_order_id'
);

-- Add disposition_order_id if it doesn't exist
SET @add_disposition_order_id_sql = IF(
  @disposition_order_id_exists = 0,
  'ALTER TABLE warehouse_items ADD COLUMN disposition_order_id CHAR(36) NULL AFTER storage_code',
  'SELECT 1'
);
PREPARE add_disposition_order_id_stmt FROM @add_disposition_order_id_sql;
EXECUTE add_disposition_order_id_stmt;
DEALLOCATE PREPARE add_disposition_order_id_stmt;

-- Add foreign key constraints if they don't exist
SET @fk_warehouse_custody_req_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND constraint_name = 'fk_warehouse_custody_req'
);

SET @add_fk_warehouse_custody_req_sql = IF(
  @fk_warehouse_custody_req_exists = 0,
  'ALTER TABLE warehouse_items ADD CONSTRAINT fk_warehouse_custody_req FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_fk_warehouse_custody_req_stmt FROM @add_fk_warehouse_custody_req_sql;
EXECUTE add_fk_warehouse_custody_req_stmt;
DEALLOCATE PREPARE add_fk_warehouse_custody_req_stmt;

SET @fk_warehouse_disp_order_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND constraint_name = 'fk_warehouse_disp_order'
);

SET @add_fk_warehouse_disp_order_sql = IF(
  @fk_warehouse_disp_order_exists = 0,
  'ALTER TABLE warehouse_items ADD CONSTRAINT fk_warehouse_disp_order FOREIGN KEY (disposition_order_id) REFERENCES disposition_orders(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_fk_warehouse_disp_order_stmt FROM @add_fk_warehouse_disp_order_sql;
EXECUTE add_fk_warehouse_disp_order_stmt;
DEALLOCATE PREPARE add_fk_warehouse_disp_order_stmt;

-- 6. Add warehouse_item_id foreign key constraint to custody_requests
SET @fk_custody_wh_item_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'custody_requests'
    AND constraint_name = 'fk_custody_wh_item'
);

SET @add_fk_custody_wh_item_sql = IF(
  @fk_custody_wh_item_exists = 0,
  'ALTER TABLE custody_requests ADD CONSTRAINT fk_custody_wh_item FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_fk_custody_wh_item_stmt FROM @add_fk_custody_wh_item_sql;
EXECUTE add_fk_custody_wh_item_stmt;
DEALLOCATE PREPARE add_fk_custody_wh_item_stmt;

-- 7. Create legal_holds table
CREATE TABLE IF NOT EXISTS legal_holds (
  id CHAR(36) PRIMARY KEY,
  warehouse_item_id CHAR(36) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT NOT NULL,
  applied_by CHAR(36) NOT NULL,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_by CHAR(36) NULL,
  released_at DATETIME NULL,
  release_reason TEXT NULL,
  INDEX idx_legal_holds_wh_item (warehouse_item_id, is_active),
  CONSTRAINT fk_legal_holds_wh_item FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_legal_holds_applier FOREIGN KEY (applied_by) REFERENCES users(id),
  CONSTRAINT fk_legal_holds_releaser FOREIGN KEY (released_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Create disposition_order_items table
CREATE TABLE IF NOT EXISTS disposition_order_items (
  id CHAR(36) PRIMARY KEY,
  disposition_order_id CHAR(36) NOT NULL,
  warehouse_item_id CHAR(36) NOT NULL,
  status ENUM('PENDING', 'PROCESSED', 'REMOVED') NOT NULL DEFAULT 'PENDING',
  processed_at DATETIME NULL,
  notes TEXT NULL,
  UNIQUE INDEX uq_order_wh_item (disposition_order_id, warehouse_item_id),
  CONSTRAINT fk_disp_items_order FOREIGN KEY (disposition_order_id) REFERENCES disposition_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_disp_items_wh_item FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Create disposition_evidence table
CREATE TABLE IF NOT EXISTS disposition_evidence (
  id CHAR(36) PRIMARY KEY,
  disposition_order_id CHAR(36) NOT NULL,
  warehouse_item_id CHAR(36) NULL,
  file_url VARCHAR(500) NOT NULL,
  file_kind ENUM('DOCUMENT', 'PHOTO', 'CERTIFICATE') NOT NULL DEFAULT 'PHOTO',
  uploaded_by CHAR(36) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_disp_evidence_order FOREIGN KEY (disposition_order_id) REFERENCES disposition_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_disp_evidence_item FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_disp_evidence_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.retention_alert_days', '7', 'INTEGER', 'Days before the retention deadline to alert authorised staff', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.retention_alert_days');
