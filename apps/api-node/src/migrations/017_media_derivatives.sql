SET @post_media_thumbnail_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'post_media'
    AND column_name = 'thumbnail_url'
);
SET @post_media_thumbnail_sql = IF(
  @post_media_thumbnail_exists = 0,
  'ALTER TABLE post_media ADD COLUMN thumbnail_url VARCHAR(500) NULL AFTER secure_url',
  'SELECT 1'
);
PREPARE post_media_thumbnail_stmt FROM @post_media_thumbnail_sql;
EXECUTE post_media_thumbnail_stmt;
DEALLOCATE PREPARE post_media_thumbnail_stmt;

SET @post_media_optimized_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'post_media'
    AND column_name = 'optimized_url'
);
SET @post_media_optimized_sql = IF(
  @post_media_optimized_exists = 0,
  'ALTER TABLE post_media ADD COLUMN optimized_url VARCHAR(500) NULL AFTER thumbnail_url',
  'SELECT 1'
);
PREPARE post_media_optimized_stmt FROM @post_media_optimized_sql;
EXECUTE post_media_optimized_stmt;
DEALLOCATE PREPARE post_media_optimized_stmt;

SET @post_media_kind_sort_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'post_media'
    AND index_name = 'idx_post_media_kind_sort'
);
SET @post_media_kind_sort_index_sql = IF(
  @post_media_kind_sort_index_exists = 0,
  'CREATE INDEX idx_post_media_kind_sort ON post_media (post_id, media_kind, sort_order, created_at)',
  'SELECT 1'
);
PREPARE post_media_kind_sort_index_stmt FROM @post_media_kind_sort_index_sql;
EXECUTE post_media_kind_sort_index_stmt;
DEALLOCATE PREPARE post_media_kind_sort_index_stmt;
