INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.candidate_limit', '500', 'INTEGER', 'Maximum SQL-prefiltered opposite posts scored per matching job', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.candidate_limit');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.candidate_window_days', '120', 'INTEGER', 'Broad time window used by matching candidate prefilter', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.candidate_window_days');

SET @matching_candidate_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'posts'
    AND index_name = 'idx_posts_matching_candidates'
);

SET @matching_candidate_index_sql = IF(
  @matching_candidate_index_exists = 0,
  'CREATE INDEX idx_posts_matching_candidates ON posts (type, status, category_id, lost_found_at)',
  'SELECT 1'
);
PREPARE matching_candidate_index_stmt FROM @matching_candidate_index_sql;
EXECUTE matching_candidate_index_stmt;
DEALLOCATE PREPARE matching_candidate_index_stmt;
