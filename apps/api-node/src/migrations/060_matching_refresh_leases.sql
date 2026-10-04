-- Additive contract; never replay or edit historical matching 054.
SET @lease_token_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matching_jobs' AND COLUMN_NAME = 'lease_token');
SET @lease_token_sql = IF(@lease_token_exists = 0,
  'ALTER TABLE matching_jobs ADD COLUMN lease_token CHAR(36) NULL', 'SELECT 1');
PREPARE lease_token_stmt FROM @lease_token_sql;
EXECUTE lease_token_stmt;
DEALLOCATE PREPARE lease_token_stmt;

SET @lease_expiry_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'matching_jobs' AND COLUMN_NAME = 'lease_expires_at');
SET @lease_expiry_sql = IF(@lease_expiry_exists = 0,
  'ALTER TABLE matching_jobs ADD COLUMN lease_expires_at DATETIME(6) NULL', 'SELECT 1');
PREPARE lease_expiry_stmt FROM @lease_expiry_sql;
EXECUTE lease_expiry_stmt;
DEALLOCATE PREPARE lease_expiry_stmt;
