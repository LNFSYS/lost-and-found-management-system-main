SET @legacy_feedback_idempotency_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_feedback'
    AND index_name = 'uq_return_feedback_reviewer_idempotency'
);
SET @drop_legacy_feedback_idempotency_sql = IF(
  @legacy_feedback_idempotency_exists = 1,
  'DROP INDEX uq_return_feedback_reviewer_idempotency ON return_feedback',
  'SELECT 1'
);
PREPARE drop_legacy_feedback_idempotency_stmt FROM @drop_legacy_feedback_idempotency_sql;
EXECUTE drop_legacy_feedback_idempotency_stmt;
DEALLOCATE PREPARE drop_legacy_feedback_idempotency_stmt;

SET @scoped_feedback_idempotency_exists = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_feedback'
    AND index_name = 'uq_return_feedback_appointment_reviewer_idempotency'
);
SET @create_scoped_feedback_idempotency_sql = IF(
  @scoped_feedback_idempotency_exists = 0,
  'CREATE UNIQUE INDEX uq_return_feedback_appointment_reviewer_idempotency ON return_feedback (appointment_id, reviewer_id, idempotency_key)',
  'SELECT 1'
);
PREPARE create_scoped_feedback_idempotency_stmt FROM @create_scoped_feedback_idempotency_sql;
EXECUTE create_scoped_feedback_idempotency_stmt;
DEALLOCATE PREPARE create_scoped_feedback_idempotency_stmt;
