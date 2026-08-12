INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
VALUES (
  UUID(),
  'matching.notification_threshold',
  '0.8',
  'FLOAT',
  'Ngưỡng điểm matching để gửi thông báo tự động',
  TRUE
)
ON DUPLICATE KEY UPDATE config_key = VALUES(config_key);

CREATE TABLE IF NOT EXISTS warehouse_items (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NULL,
  handover_point_id CHAR(36) NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category_id CHAR(36) NULL,
  area_id CHAR(36) NULL,
  building_id CHAR(36) NULL,
  room_text VARCHAR(100) NULL,
  finder_user_id CHAR(36) NULL,
  finder_name VARCHAR(150) NULL,
  finder_contact VARCHAR(255) NULL,
  status ENUM('RECEIVED', 'STORED', 'CLAIMED', 'RETURNED', 'DISPOSED') NOT NULL DEFAULT 'RECEIVED',
  condition_notes TEXT NULL,
  storage_code VARCHAR(60) NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  returned_at DATETIME NULL,
  created_by CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_warehouse_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_warehouse_handover FOREIGN KEY (handover_point_id) REFERENCES handover_points(id),
  CONSTRAINT fk_warehouse_category FOREIGN KEY (category_id) REFERENCES item_categories(id),
  CONSTRAINT fk_warehouse_area FOREIGN KEY (area_id) REFERENCES campus_areas(id),
  CONSTRAINT fk_warehouse_building FOREIGN KEY (building_id) REFERENCES campus_buildings(id),
  CONSTRAINT fk_warehouse_finder FOREIGN KEY (finder_user_id) REFERENCES users(id),
  CONSTRAINT fk_warehouse_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  KEY idx_warehouse_status (status),
  KEY idx_warehouse_post (post_id),
  KEY idx_warehouse_handover (handover_point_id),
  KEY idx_warehouse_received_at (received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
