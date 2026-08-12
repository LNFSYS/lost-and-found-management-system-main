SET @appointment_status_type = (
  SELECT COLUMN_TYPE
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_appointments'
    AND COLUMN_NAME = 'status'
);

SET @appointment_status_update_sql = IF(
  @appointment_status_type LIKE '%CONFIRMED%',
  'UPDATE return_appointments SET status = ''ACCEPTED'' WHERE status = ''CONFIRMED''',
  'SELECT 1'
);

PREPARE appointment_status_update_stmt FROM @appointment_status_update_sql;
EXECUTE appointment_status_update_stmt;
DEALLOCATE PREPARE appointment_status_update_stmt;

ALTER TABLE return_appointments
  MODIFY status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED') NOT NULL DEFAULT 'PENDING';

SET @has_confirmed_at = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_appointments'
    AND COLUMN_NAME = 'confirmed_at'
);

SET @has_accepted_at = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'return_appointments'
    AND COLUMN_NAME = 'accepted_at'
);

SET @rename_confirmed_at_sql = IF(
  @has_confirmed_at > 0 AND @has_accepted_at = 0,
  'ALTER TABLE return_appointments RENAME COLUMN confirmed_at TO accepted_at',
  'SELECT 1'
);

PREPARE rename_confirmed_at_stmt FROM @rename_confirmed_at_sql;
EXECUTE rename_confirmed_at_stmt;
DEALLOCATE PREPARE rename_confirmed_at_stmt;
