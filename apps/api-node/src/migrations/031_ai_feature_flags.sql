INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.verification_questions_enabled', 'true', 'BOOLEAN', 'Bật câu hỏi xác minh riêng tư theo vật phẩm', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.verification_questions_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.campus_radar_enabled', 'true', 'BOOLEAN', 'Bật radar thống kê cụm báo mất trong campus', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.campus_radar_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.visual_hunt_enabled', 'true', 'BOOLEAN', 'Bật tìm kiếm hỗ trợ bằng hình ảnh cho Staff/Admin', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.visual_hunt_enabled');
