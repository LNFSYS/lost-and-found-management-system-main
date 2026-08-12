INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.radar.minimum_observed_count', '3', 'INTEGER', 'Số bài LOST tối thiểu trong cửa sổ để Radar tạo candidate', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.radar.minimum_observed_count');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.radar.minimum_z_score', '2', 'FLOAT', 'Z-score tối thiểu để Radar xem là bất thường', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.radar.minimum_z_score');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.radar.minimum_observed_ratio', '2', 'FLOAT', 'Tỷ lệ so với baseline tối thiểu để Radar tạo candidate', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.radar.minimum_observed_ratio');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.visual_hunt.candidate_threshold', '0.2', 'FLOAT', 'Điểm metadata/OCR tối thiểu để Visual Hunt hiển thị candidate', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.visual_hunt.candidate_threshold');
