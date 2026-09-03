SET @users_avatar_file_path_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'avatar_file_path'
);

SET @users_avatar_file_path_sql = IF(
  @users_avatar_file_path_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_file_path VARCHAR(500) NULL AFTER phone_number',
  'SELECT 1'
);
PREPARE users_avatar_file_path_stmt FROM @users_avatar_file_path_sql;
EXECUTE users_avatar_file_path_stmt;
DEALLOCATE PREPARE users_avatar_file_path_stmt;

SET @users_avatar_mime_type_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'avatar_mime_type'
);

SET @users_avatar_mime_type_sql = IF(
  @users_avatar_mime_type_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_mime_type VARCHAR(80) NULL AFTER avatar_file_path',
  'SELECT 1'
);
PREPARE users_avatar_mime_type_stmt FROM @users_avatar_mime_type_sql;
EXECUTE users_avatar_mime_type_stmt;
DEALLOCATE PREPARE users_avatar_mime_type_stmt;

SET @users_avatar_size_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'avatar_size'
);

SET @users_avatar_size_sql = IF(
  @users_avatar_size_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_size INT NULL AFTER avatar_mime_type',
  'SELECT 1'
);
PREPARE users_avatar_size_stmt FROM @users_avatar_size_sql;
EXECUTE users_avatar_size_stmt;
DEALLOCATE PREPARE users_avatar_size_stmt;

SET @users_avatar_updated_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'avatar_updated_at'
);

SET @users_avatar_updated_at_sql = IF(
  @users_avatar_updated_at_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_updated_at DATETIME NULL AFTER avatar_size',
  'SELECT 1'
);
PREPARE users_avatar_updated_at_stmt FROM @users_avatar_updated_at_sql;
EXECUTE users_avatar_updated_at_stmt;
DEALLOCATE PREPARE users_avatar_updated_at_stmt;

SET @posts_user_created_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'posts'
    AND index_name = 'idx_posts_user_created'
);

SET @posts_user_created_index_sql = IF(
  @posts_user_created_index_exists = 0,
  'CREATE INDEX idx_posts_user_created ON posts (user_id, created_at)',
  'SELECT 1'
);
PREPARE posts_user_created_index_stmt FROM @posts_user_created_index_sql;
EXECUTE posts_user_created_index_stmt;
DEALLOCATE PREPARE posts_user_created_index_stmt;

SET @claims_claimant_created_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'claims'
    AND index_name = 'idx_claims_claimant_created'
);

SET @claims_claimant_created_index_sql = IF(
  @claims_claimant_created_index_exists = 0,
  'CREATE INDEX idx_claims_claimant_created ON claims (claimant_id, created_at)',
  'SELECT 1'
);
PREPARE claims_claimant_created_index_stmt FROM @claims_claimant_created_index_sql;
EXECUTE claims_claimant_created_index_stmt;
DEALLOCATE PREPARE claims_claimant_created_index_stmt;

SET @appointments_status_completed_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND index_name = 'idx_return_appointments_status_completed'
);

SET @appointments_status_completed_index_sql = IF(
  @appointments_status_completed_index_exists = 0,
  'CREATE INDEX idx_return_appointments_status_completed ON return_appointments (status, completed_at)',
  'SELECT 1'
);
PREPARE appointments_status_completed_index_stmt FROM @appointments_status_completed_index_sql;
EXECUTE appointments_status_completed_index_stmt;
DEALLOCATE PREPARE appointments_status_completed_index_stmt;
