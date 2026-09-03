ALTER TABLE reports
  MODIFY entity_type ENUM('POST', 'USER', 'CLAIM', 'CHAT') NOT NULL;

ALTER TABLE moderation_actions
  MODIFY action_type ENUM('WARN_USER', 'HIDE_POST', 'DELETE_POST', 'BAN_USER', 'UNBAN_USER', 'DISMISS_REPORT') NOT NULL,
  MODIFY target_type ENUM('USER', 'POST', 'REPORT') NOT NULL;

SET @reports_status_created_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'reports'
    AND index_name = 'idx_reports_status_created'
);

SET @reports_status_created_index_sql = IF(
  @reports_status_created_index_exists = 0,
  'CREATE INDEX idx_reports_status_created ON reports (status, created_at)',
  'SELECT 1'
);
PREPARE reports_status_created_index_stmt FROM @reports_status_created_index_sql;
EXECUTE reports_status_created_index_stmt;
DEALLOCATE PREPARE reports_status_created_index_stmt;

SET @mod_actions_report_created_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'moderation_actions'
    AND index_name = 'idx_mod_actions_report_created'
);

SET @mod_actions_report_created_index_sql = IF(
  @mod_actions_report_created_index_exists = 0,
  'CREATE INDEX idx_mod_actions_report_created ON moderation_actions (report_id, created_at)',
  'SELECT 1'
);
PREPARE mod_actions_report_created_index_stmt FROM @mod_actions_report_created_index_sql;
EXECUTE mod_actions_report_created_index_stmt;
DEALLOCATE PREPARE mod_actions_report_created_index_stmt;
