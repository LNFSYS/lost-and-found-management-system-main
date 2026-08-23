ALTER TABLE storage_logs
  MODIFY post_id CHAR(36) NULL,
  MODIFY action ENUM(
    'RECEIVED',
    'STORED',
    'CLAIMED',
    'RETURNED',
    'EXPIRED',
    'DISPOSED',
    'DONATED',
    'TRANSFERRED',
    'OVERDUE_MARKED',
    'CONDITION_UPDATED'
  ) NOT NULL;

SET @storage_log_item_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND column_name = 'warehouse_item_id'
);

SET @storage_log_item_sql = IF(
  @storage_log_item_column_exists = 0,
  'ALTER TABLE storage_logs ADD COLUMN warehouse_item_id CHAR(36) NULL AFTER id',
  'SELECT 1'
);
PREPARE storage_log_item_stmt FROM @storage_log_item_sql;
EXECUTE storage_log_item_stmt;
DEALLOCATE PREPARE storage_log_item_stmt;

SET @storage_log_from_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND column_name = 'from_status'
);

SET @storage_log_from_sql = IF(
  @storage_log_from_column_exists = 0,
  'ALTER TABLE storage_logs ADD COLUMN from_status VARCHAR(40) NULL AFTER action',
  'SELECT 1'
);
PREPARE storage_log_from_stmt FROM @storage_log_from_sql;
EXECUTE storage_log_from_stmt;
DEALLOCATE PREPARE storage_log_from_stmt;

SET @storage_log_to_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND column_name = 'to_status'
);

SET @storage_log_to_sql = IF(
  @storage_log_to_column_exists = 0,
  'ALTER TABLE storage_logs ADD COLUMN to_status VARCHAR(40) NULL AFTER from_status',
  'SELECT 1'
);
PREPARE storage_log_to_stmt FROM @storage_log_to_sql;
EXECUTE storage_log_to_stmt;
DEALLOCATE PREPARE storage_log_to_stmt;

SET @storage_log_code_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND column_name = 'storage_code'
);

SET @storage_log_code_sql = IF(
  @storage_log_code_column_exists = 0,
  'ALTER TABLE storage_logs ADD COLUMN storage_code VARCHAR(60) NULL AFTER condition_notes',
  'SELECT 1'
);
PREPARE storage_log_code_stmt FROM @storage_log_code_sql;
EXECUTE storage_log_code_stmt;
DEALLOCATE PREPARE storage_log_code_stmt;

SET @storage_log_note_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND column_name = 'note'
);

SET @storage_log_note_sql = IF(
  @storage_log_note_column_exists = 0,
  'ALTER TABLE storage_logs ADD COLUMN note TEXT NULL AFTER storage_code',
  'SELECT 1'
);
PREPARE storage_log_note_stmt FROM @storage_log_note_sql;
EXECUTE storage_log_note_stmt;
DEALLOCATE PREPARE storage_log_note_stmt;

SET @storage_log_item_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND constraint_name = 'fk_storage_logs_warehouse_item'
);

SET @storage_log_item_fk_sql = IF(
  @storage_log_item_fk_exists = 0,
  'ALTER TABLE storage_logs ADD CONSTRAINT fk_storage_logs_warehouse_item FOREIGN KEY (warehouse_item_id) REFERENCES warehouse_items(id)',
  'SELECT 1'
);
PREPARE storage_log_item_fk_stmt FROM @storage_log_item_fk_sql;
EXECUTE storage_log_item_fk_stmt;
DEALLOCATE PREPARE storage_log_item_fk_stmt;

SET @storage_log_item_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND index_name = 'idx_storage_logs_warehouse_item'
);

SET @storage_log_item_index_sql = IF(
  @storage_log_item_index_exists = 0,
  'CREATE INDEX idx_storage_logs_warehouse_item ON storage_logs (warehouse_item_id, created_at)',
  'SELECT 1'
);
PREPARE storage_log_item_index_stmt FROM @storage_log_item_index_sql;
EXECUTE storage_log_item_index_stmt;
DEALLOCATE PREPARE storage_log_item_index_stmt;

SET @storage_log_actor_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'storage_logs'
    AND index_name = 'idx_storage_logs_actor_created'
);

SET @storage_log_actor_index_sql = IF(
  @storage_log_actor_index_exists = 0,
  'CREATE INDEX idx_storage_logs_actor_created ON storage_logs (actor_id, created_at)',
  'SELECT 1'
);
PREPARE storage_log_actor_index_stmt FROM @storage_log_actor_index_sql;
EXECUTE storage_log_actor_index_stmt;
DEALLOCATE PREPARE storage_log_actor_index_stmt;
