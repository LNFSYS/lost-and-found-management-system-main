SET @warehouse_retention_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND column_name = 'retention_deadline'
);

SET @warehouse_retention_sql = IF(
  @warehouse_retention_column_exists = 0,
  'ALTER TABLE warehouse_items ADD COLUMN retention_deadline DATETIME NULL AFTER returned_at',
  'SELECT 1'
);
PREPARE warehouse_retention_stmt FROM @warehouse_retention_sql;
EXECUTE warehouse_retention_stmt;
DEALLOCATE PREPARE warehouse_retention_stmt;

SET @warehouse_retention_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'warehouse_items'
    AND index_name = 'idx_warehouse_retention_deadline'
);

SET @warehouse_retention_index_sql = IF(
  @warehouse_retention_index_exists = 0,
  'CREATE INDEX idx_warehouse_retention_deadline ON warehouse_items (retention_deadline)',
  'SELECT 1'
);
PREPARE warehouse_retention_index_stmt FROM @warehouse_retention_index_sql;
EXECUTE warehouse_retention_index_stmt;
DEALLOCATE PREPARE warehouse_retention_index_stmt;

UPDATE warehouse_items
SET retention_deadline = DATE_ADD(received_at, INTERVAL 60 DAY)
WHERE deleted_at IS NULL
  AND retention_deadline IS NULL
  AND status IN ('PENDING_APPROVAL', 'RECEIVED', 'STORED', 'CLAIMED');
