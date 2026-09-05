SET @ra_finder_confirmed_at_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'return_appointments' AND column_name = 'finder_confirmed_at'
);
SET @ra_finder_confirmed_at_sql = IF(
  @ra_finder_confirmed_at_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN finder_confirmed_at DATETIME NULL AFTER completed_at',
  'SELECT 1'
);
PREPARE ra_finder_confirmed_at_stmt FROM @ra_finder_confirmed_at_sql;
EXECUTE ra_finder_confirmed_at_stmt;
DEALLOCATE PREPARE ra_finder_confirmed_at_stmt;

SET @ra_owner_confirmed_at_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'return_appointments' AND column_name = 'owner_confirmed_at'
);
SET @ra_owner_confirmed_at_sql = IF(
  @ra_owner_confirmed_at_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN owner_confirmed_at DATETIME NULL AFTER finder_confirmed_at',
  'SELECT 1'
);
PREPARE ra_owner_confirmed_at_stmt FROM @ra_owner_confirmed_at_sql;
EXECUTE ra_owner_confirmed_at_stmt;
DEALLOCATE PREPARE ra_owner_confirmed_at_stmt;

SET @ra_custody_authorized_by_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'return_appointments' AND column_name = 'custody_authorized_by'
);
SET @ra_custody_authorized_by_sql = IF(
  @ra_custody_authorized_by_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN custody_authorized_by CHAR(36) NULL AFTER owner_confirmed_at',
  'SELECT 1'
);
PREPARE ra_custody_authorized_by_stmt FROM @ra_custody_authorized_by_sql;
EXECUTE ra_custody_authorized_by_stmt;
DEALLOCATE PREPARE ra_custody_authorized_by_stmt;

SET @ra_custody_authorized_at_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'return_appointments' AND column_name = 'custody_authorized_at'
);
SET @ra_custody_authorized_at_sql = IF(
  @ra_custody_authorized_at_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN custody_authorized_at DATETIME NULL AFTER custody_authorized_by',
  'SELECT 1'
);
PREPARE ra_custody_authorized_at_stmt FROM @ra_custody_authorized_at_sql;
EXECUTE ra_custody_authorized_at_stmt;
DEALLOCATE PREPARE ra_custody_authorized_at_stmt;

SET @ra_custody_fk_exists = (
  SELECT COUNT(*) FROM information_schema.table_constraints
  WHERE table_schema = DATABASE() AND table_name = 'return_appointments' AND constraint_name = 'fk_return_appointments_custody_authorized_by'
);
SET @ra_custody_fk_sql = IF(
  @ra_custody_fk_exists = 0,
  'ALTER TABLE return_appointments ADD CONSTRAINT fk_return_appointments_custody_authorized_by FOREIGN KEY (custody_authorized_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE ra_custody_fk_stmt FROM @ra_custody_fk_sql;
EXECUTE ra_custody_fk_stmt;
DEALLOCATE PREPARE ra_custody_fk_stmt;

SET @feedback_idempotency_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'return_feedback' AND column_name = 'idempotency_key'
);
SET @feedback_idempotency_sql = IF(
  @feedback_idempotency_exists = 0,
  'ALTER TABLE return_feedback ADD COLUMN idempotency_key VARCHAR(128) NULL AFTER target_user_id',
  'SELECT 1'
);
PREPARE feedback_idempotency_stmt FROM @feedback_idempotency_sql;
EXECUTE feedback_idempotency_stmt;
DEALLOCATE PREPARE feedback_idempotency_stmt;

SET @feedback_idempotency_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'return_feedback' AND index_name = 'uq_return_feedback_reviewer_idempotency'
);
SET @feedback_idempotency_index_sql = IF(
  @feedback_idempotency_index_exists = 0,
  'CREATE UNIQUE INDEX uq_return_feedback_reviewer_idempotency ON return_feedback (reviewer_id, idempotency_key)',
  'SELECT 1'
);
PREPARE feedback_idempotency_index_stmt FROM @feedback_idempotency_index_sql;
EXECUTE feedback_idempotency_index_stmt;
DEALLOCATE PREPARE feedback_idempotency_index_stmt;

SET @reputation_event_index_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'reputation_logs' AND index_name = 'uq_reputation_logs_feedback_event'
);
SET @reputation_event_index_sql = IF(
  @reputation_event_index_exists = 0,
  'CREATE UNIQUE INDEX uq_reputation_logs_feedback_event ON reputation_logs (user_id, entity_type, entity_id, reason)',
  'SELECT 1'
);
PREPARE reputation_event_index_stmt FROM @reputation_event_index_sql;
EXECUTE reputation_event_index_stmt;
DEALLOCATE PREPARE reputation_event_index_stmt;
