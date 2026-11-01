ALTER TABLE custody_requests
  ADD COLUMN requested_intake_at DATETIME NULL AFTER handover_point_id;

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
VALUES (
  UUID(),
  'custody.intake.schedule',
  '{"timezone":"Asia/Ho_Chi_Minh","weeklyHours":{"0":[],"1":[{"start":"08:00","end":"12:00"},{"start":"13:30","end":"17:00"}],"2":[{"start":"08:00","end":"12:00"},{"start":"13:30","end":"17:00"}],"3":[{"start":"08:00","end":"12:00"},{"start":"13:30","end":"17:00"}],"4":[{"start":"08:00","end":"12:00"},{"start":"13:30","end":"17:00"}],"5":[{"start":"08:00","end":"12:00"},{"start":"13:30","end":"17:00"}],"6":[]},"holidays":[]}',
  'JSON',
  'Lịch tiếp nhận custody: giờ theo thứ trong tuần, múi giờ và các ngày nghỉ YYYY-MM-DD',
  TRUE
)
ON DUPLICATE KEY UPDATE config_key = VALUES(config_key);
