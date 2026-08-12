SET @has_post_room_text = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'room_text'
);

SET @add_post_room_text_sql = IF(
  @has_post_room_text = 0,
  'ALTER TABLE posts ADD COLUMN room_text VARCHAR(100) NULL AFTER building_id',
  'SELECT 1'
);

PREPARE add_post_room_text_stmt FROM @add_post_room_text_sql;
EXECUTE add_post_room_text_stmt;
DEALLOCATE PREPARE add_post_room_text_stmt;

SET @has_post_contact_info = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'posts'
    AND COLUMN_NAME = 'contact_info'
);

SET @add_post_contact_info_sql = IF(
  @has_post_contact_info = 0,
  'ALTER TABLE posts ADD COLUMN contact_info VARCHAR(255) NULL AFTER custom_location',
  'SELECT 1'
);

PREPARE add_post_contact_info_stmt FROM @add_post_contact_info_sql;
EXECUTE add_post_contact_info_stmt;
DEALLOCATE PREPARE add_post_contact_info_stmt;
