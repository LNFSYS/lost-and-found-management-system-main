SET @legacy_feedback_idempotency_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_feedback'
    AND index_name = 'uq_return_feedback_reviewer_idempotency'
);

-- The legacy unique index may be the only index supporting the reviewer_id FK.
-- Keep the FK intact by creating a dedicated leftmost reviewer_id index first.
SET @reviewer_fk_support_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_feedback'
    AND column_name = 'reviewer_id'
    AND seq_in_index = 1
    AND index_name <> 'uq_return_feedback_reviewer_idempotency'
);
SET @create_reviewer_fk_support_sql = IF(
  @legacy_feedback_idempotency_exists > 0 AND @reviewer_fk_support_exists = 0,
  'CREATE INDEX idx_return_feedback_reviewer_fk_support ON return_feedback (reviewer_id)',
  'SELECT 1'
);
PREPARE create_reviewer_fk_support_stmt FROM @create_reviewer_fk_support_sql;
EXECUTE create_reviewer_fk_support_stmt;
DEALLOCATE PREPARE create_reviewer_fk_support_stmt;

SET @drop_legacy_feedback_idempotency_sql = IF(
  @legacy_feedback_idempotency_exists > 0,
  'DROP INDEX uq_return_feedback_reviewer_idempotency ON return_feedback',
  'SELECT 1'
);
PREPARE drop_legacy_feedback_idempotency_stmt FROM @drop_legacy_feedback_idempotency_sql;
EXECUTE drop_legacy_feedback_idempotency_stmt;
DEALLOCATE PREPARE drop_legacy_feedback_idempotency_stmt;
