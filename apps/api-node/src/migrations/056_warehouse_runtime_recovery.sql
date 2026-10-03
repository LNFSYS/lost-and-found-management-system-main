-- Forward recovery of the audited runtime, not a replay of historical 053/055.
SET @retention_index_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warehouse_items' AND INDEX_NAME = 'idx_warehouse_retention_deadline');
SET @retention_index_sql = IF(@retention_index_exists = 0,
  'CREATE INDEX idx_warehouse_retention_deadline ON warehouse_items(retention_deadline)', 'SELECT 1');
PREPARE retention_index_stmt FROM @retention_index_sql;
EXECUTE retention_index_stmt;
DEALLOCATE PREPARE retention_index_stmt;

-- Operator recovery evidence is separate from user actions; do not impersonate a user.
CREATE TABLE IF NOT EXISTS custody_link_recovery_reviews (
  custody_request_id CHAR(36) PRIMARY KEY,
  warehouse_item_id CHAR(36) NULL,
  reason VARCHAR(100) NOT NULL,
  original_links JSON NOT NULL,
  status ENUM('REVIEW_REQUIRED','RESOLVED') NOT NULL DEFAULT 'REVIEW_REQUIRED',
  operation_ref VARCHAR(128) NOT NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (custody_request_id) REFERENCES custody_requests(id),
  FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
