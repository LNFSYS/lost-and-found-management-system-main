UPDATE return_appointments ra
INNER JOIN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY claim_id
        ORDER BY
          CASE status WHEN 'ACCEPTED' THEN 0 WHEN 'RESCHEDULED' THEN 1 ELSE 2 END,
          created_at DESC,
          id DESC
      ) AS row_number_per_claim
    FROM return_appointments
    WHERE status IN ('PENDING', 'ACCEPTED', 'RESCHEDULED')
  ) ranked
  WHERE ranked.row_number_per_claim > 1
) duplicate_active ON duplicate_active.id = ra.id
SET ra.status = 'CANCELLED',
    ra.cancellation_reason = COALESCE(ra.cancellation_reason, 'Cancelled by active appointment integrity migration'),
    ra.updated_at = UTC_TIMESTAMP();

SET @active_claim_column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'active_claim_id'
);

SET @active_claim_column_sql = IF(
  @active_claim_column_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN active_claim_id CHAR(36) GENERATED ALWAYS AS (CASE WHEN status IN (''PENDING'', ''ACCEPTED'', ''RESCHEDULED'') THEN claim_id ELSE NULL END) STORED AFTER claim_id',
  'SELECT 1'
);
PREPARE active_claim_column_stmt FROM @active_claim_column_sql;
EXECUTE active_claim_column_stmt;
DEALLOCATE PREPARE active_claim_column_stmt;

SET @active_claim_unique_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND index_name = 'uq_return_appointments_one_active_claim'
);

SET @active_claim_unique_sql = IF(
  @active_claim_unique_exists = 0,
  'CREATE UNIQUE INDEX uq_return_appointments_one_active_claim ON return_appointments (active_claim_id)',
  'SELECT 1'
);
PREPARE active_claim_unique_stmt FROM @active_claim_unique_sql;
EXECUTE active_claim_unique_stmt;
DEALLOCATE PREPARE active_claim_unique_stmt;
