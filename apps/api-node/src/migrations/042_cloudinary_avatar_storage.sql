SET @users_avatar_cloudinary_public_id_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_public_id'
);
SET @users_avatar_cloudinary_public_id_sql = IF(
  @users_avatar_cloudinary_public_id_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_public_id VARCHAR(255) NULL AFTER avatar_file_path',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_public_id_stmt FROM @users_avatar_cloudinary_public_id_sql;
EXECUTE users_avatar_cloudinary_public_id_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_public_id_stmt;

SET @users_avatar_cloudinary_asset_id_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_asset_id'
);
SET @users_avatar_cloudinary_asset_id_sql = IF(
  @users_avatar_cloudinary_asset_id_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_asset_id VARCHAR(255) NULL AFTER avatar_cloudinary_public_id',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_asset_id_stmt FROM @users_avatar_cloudinary_asset_id_sql;
EXECUTE users_avatar_cloudinary_asset_id_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_asset_id_stmt;

SET @users_avatar_cloudinary_version_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_version'
);
SET @users_avatar_cloudinary_version_sql = IF(
  @users_avatar_cloudinary_version_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_version INT NULL AFTER avatar_cloudinary_asset_id',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_version_stmt FROM @users_avatar_cloudinary_version_sql;
EXECUTE users_avatar_cloudinary_version_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_version_stmt;

SET @users_avatar_cloudinary_format_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_format'
);
SET @users_avatar_cloudinary_format_sql = IF(
  @users_avatar_cloudinary_format_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_format VARCHAR(16) NULL AFTER avatar_cloudinary_version',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_format_stmt FROM @users_avatar_cloudinary_format_sql;
EXECUTE users_avatar_cloudinary_format_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_format_stmt;

SET @users_avatar_cloudinary_resource_type_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_resource_type'
);
SET @users_avatar_cloudinary_resource_type_sql = IF(
  @users_avatar_cloudinary_resource_type_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_resource_type VARCHAR(16) NULL AFTER avatar_cloudinary_format',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_resource_type_stmt FROM @users_avatar_cloudinary_resource_type_sql;
EXECUTE users_avatar_cloudinary_resource_type_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_resource_type_stmt;

SET @users_avatar_cloudinary_bytes_exists = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'avatar_cloudinary_bytes'
);
SET @users_avatar_cloudinary_bytes_sql = IF(
  @users_avatar_cloudinary_bytes_exists = 0,
  'ALTER TABLE users ADD COLUMN avatar_cloudinary_bytes INT NULL AFTER avatar_cloudinary_resource_type',
  'SELECT 1'
);
PREPARE users_avatar_cloudinary_bytes_stmt FROM @users_avatar_cloudinary_bytes_sql;
EXECUTE users_avatar_cloudinary_bytes_stmt;
DEALLOCATE PREPARE users_avatar_cloudinary_bytes_stmt;
