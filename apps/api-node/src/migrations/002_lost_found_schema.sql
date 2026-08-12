CREATE TABLE campus_areas (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campus_buildings (
  id CHAR(36) PRIMARY KEY,
  area_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_buildings_area FOREIGN KEY (area_id) REFERENCES campus_areas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE item_categories (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  name_normalized VARCHAR(100) NOT NULL,
  icon VARCHAR(100) NULL,
  parent_id CHAR(36) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES item_categories(id),
  UNIQUE KEY uq_category_name (name_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE posts (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type ENUM('LOST', 'FOUND') NOT NULL,
  status ENUM('OPEN', 'MATCHED', 'RESOLVED', 'CLOSED', 'EXPIRED', 'HIDDEN') NOT NULL DEFAULT 'OPEN',
  title VARCHAR(255) NOT NULL,
  title_normalized VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  description_normalized TEXT NOT NULL,
  category_id CHAR(36) NULL,
  area_id CHAR(36) NULL,
  building_id CHAR(36) NULL,
  room_text VARCHAR(100) NULL,
  custom_location VARCHAR(255) NULL,
  contact_info VARCHAR(255) NULL,
  lost_found_at DATETIME NULL,
  handover_point_id CHAR(36) NULL,
  secret_verification_hash VARCHAR(255) NULL,
  expires_at DATETIME NULL,
  resolved_at DATETIME NULL,
  view_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_posts_category FOREIGN KEY (category_id) REFERENCES item_categories(id),
  CONSTRAINT fk_posts_area FOREIGN KEY (area_id) REFERENCES campus_areas(id),
  CONSTRAINT fk_posts_building FOREIGN KEY (building_id) REFERENCES campus_buildings(id),
  KEY idx_posts_type_status (type, status),
  KEY idx_posts_user (user_id),
  KEY idx_posts_created (created_at),
  KEY idx_posts_lost_found_at (lost_found_at),
  FULLTEXT KEY ft_posts_search (title_normalized, description_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_media (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  secure_url VARCHAR(500) NOT NULL,
  public_id VARCHAR(255) NOT NULL,
  resource_type VARCHAR(20) NOT NULL DEFAULT 'image',
  format VARCHAR(10) NULL,
  width INT NULL,
  height INT NULL,
  bytes INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_post_media_post FOREIGN KEY (post_id) REFERENCES posts(id),
  KEY idx_post_media_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_tags (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  tag VARCHAR(100) NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0,
  source ENUM('VISION_LABEL', 'VISION_OBJECT', 'OCR', 'MANUAL') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ai_tags_post FOREIGN KEY (post_id) REFERENCES posts(id),
  KEY idx_ai_tags_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE match_results (
  id CHAR(36) PRIMARY KEY,
  lost_post_id CHAR(36) NOT NULL,
  found_post_id CHAR(36) NOT NULL,
  total_score FLOAT NOT NULL DEFAULT 0,
  text_score FLOAT NOT NULL DEFAULT 0,
  category_score FLOAT NOT NULL DEFAULT 0,
  location_score FLOAT NOT NULL DEFAULT 0,
  time_score FLOAT NOT NULL DEFAULT 0,
  is_notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_lost FOREIGN KEY (lost_post_id) REFERENCES posts(id),
  CONSTRAINT fk_match_found FOREIGN KEY (found_post_id) REFERENCES posts(id),
  UNIQUE KEY uq_match_pair (lost_post_id, found_post_id),
  KEY idx_match_total_score (total_score DESC),
  KEY idx_match_lost_post (lost_post_id),
  KEY idx_match_found_post (found_post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE claims (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  claimant_id CHAR(36) NOT NULL,
  status ENUM('PENDING', 'NEED_MORE_INFO', 'ACCEPTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  description TEXT NULL,
  secret_answer TEXT NULL,
  approximate_lost_at DATETIME NULL,
  approximate_location VARCHAR(255) NULL,
  rejection_reason TEXT NULL,
  more_info_request TEXT NULL,
  accepted_at DATETIME NULL,
  rejected_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_claims_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_claims_claimant FOREIGN KEY (claimant_id) REFERENCES users(id),
  KEY idx_claims_post (post_id),
  KEY idx_claims_claimant (claimant_id),
  KEY idx_claims_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE claim_state_logs (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NOT NULL,
  actor_id CHAR(36) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_state_logs_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  KEY idx_claim_state_logs_claim (claim_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE claim_evidence (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL,
  secure_url VARCHAR(500) NOT NULL,
  public_id VARCHAR(255) NOT NULL,
  evidence_type ENUM('OWNERSHIP_PROOF', 'ADDITIONAL_DOC', 'PHOTO') NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_evidence_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  KEY idx_claim_evidence_claim (claim_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE handover_points (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  area_id CHAR(36) NULL,
  building_id CHAR(36) NULL,
  opening_hours VARCHAR(255) NULL,
  contact_info VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hp_area FOREIGN KEY (area_id) REFERENCES campus_areas(id),
  CONSTRAINT fk_hp_building FOREIGN KEY (building_id) REFERENCES campus_buildings(id),
  CONSTRAINT fk_hp_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE storage_logs (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  handover_point_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action ENUM('RECEIVED', 'STORED', 'RETURNED', 'OVERDUE_MARKED') NOT NULL,
  condition_notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_storage_logs_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_storage_logs_hp FOREIGN KEY (handover_point_id) REFERENCES handover_points(id),
  CONSTRAINT fk_storage_logs_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  KEY idx_storage_logs_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE return_appointments (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL,
  post_id CHAR(36) NOT NULL,
  proposer_id CHAR(36) NOT NULL,
  status ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'RESCHEDULED') NOT NULL DEFAULT 'PENDING',
  proposed_at DATETIME NOT NULL,
  handover_point_id CHAR(36) NULL,
  custom_location VARCHAR(255) NULL,
  rejection_reason TEXT NULL,
  cancellation_reason TEXT NULL,
  accepted_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_appt_post FOREIGN KEY (post_id) REFERENCES posts(id),
  CONSTRAINT fk_appt_proposer FOREIGN KEY (proposer_id) REFERENCES users(id),
  CONSTRAINT fk_appt_hp FOREIGN KEY (handover_point_id) REFERENCES handover_points(id),
  KEY idx_appt_claim (claim_id),
  KEY idx_appt_proposed_at (proposed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_rooms (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_rooms_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id CHAR(36) PRIMARY KEY,
  room_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  content TEXT NULL,
  media_url VARCHAR(500) NULL,
  media_public_id VARCHAR(255) NULL,
  message_type ENUM('TEXT', 'IMAGE', 'SYSTEM') NOT NULL DEFAULT 'TEXT',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id),
  KEY idx_messages_room_created (room_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id CHAR(36) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_notifications_user_read (user_id, is_read),
  KEY idx_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reputation_scores (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  total_points INT NOT NULL DEFAULT 0,
  level ENUM('NEW', 'TRUSTED', 'RELIABLE', 'EXCELLENT') NOT NULL DEFAULT 'NEW',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reputation_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reputation_logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  delta INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  entity_type VARCHAR(60) NULL,
  entity_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rep_logs_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_rep_logs_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reports (
  id CHAR(36) PRIMARY KEY,
  reporter_id CHAR(36) NOT NULL,
  entity_type ENUM('POST', 'USER', 'CLAIM') NOT NULL,
  entity_id CHAR(36) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT NULL,
  status ENUM('PENDING', 'REVIEWED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id),
  KEY idx_reports_status (status),
  KEY idx_reports_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE moderation_actions (
  id CHAR(36) PRIMARY KEY,
  admin_id CHAR(36) NOT NULL,
  report_id CHAR(36) NULL,
  action_type ENUM('WARN_USER', 'HIDE_POST', 'DELETE_POST', 'BAN_USER', 'UNBAN_USER') NOT NULL,
  target_type ENUM('USER', 'POST') NOT NULL,
  target_id CHAR(36) NOT NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mod_admin FOREIGN KEY (admin_id) REFERENCES users(id),
  CONSTRAINT fk_mod_report FOREIGN KEY (report_id) REFERENCES reports(id),
  KEY idx_mod_actions_admin (admin_id),
  KEY idx_mod_actions_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE config_entries (
  id CHAR(36) PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  value_type ENUM('STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON') NOT NULL DEFAULT 'STRING',
  description VARCHAR(255) NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by CHAR(36) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_config_key (config_key),
  CONSTRAINT fk_config_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE config_history (
  id CHAR(36) PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  old_value TEXT NULL,
  new_value TEXT NOT NULL,
  changed_by CHAR(36) NOT NULL,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_config_hist_user FOREIGN KEY (changed_by) REFERENCES users(id),
  KEY idx_config_hist_key_time (config_key, changed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public) VALUES
  (UUID(), 'post.expiration_days',      '30',         'INTEGER', 'Số ngày trước khi bài đăng hết hạn',                TRUE),
  (UUID(), 'post.max_per_user_per_day', '5',          'INTEGER', 'Số bài đăng tối đa mỗi user mỗi ngày',              TRUE),
  (UUID(), 'post.max_images',           '5',          'INTEGER', 'Số ảnh tối đa mỗi bài',                             TRUE),
  (UUID(), 'post.max_image_size_mb',    '10',         'INTEGER', 'Dung lượng ảnh tối đa (MB)',                        TRUE),
  (UUID(), 'post.allowed_image_formats','jpg,png,webp','STRING',  'Định dạng ảnh cho phép (CSV)',                      TRUE),
  (UUID(), 'matching.threshold',        '0.4',        'FLOAT',  'Ngưỡng điểm matching để hiển thị gợi ý',            TRUE),
  (UUID(), 'matching.weight_text',      '0.4',        'FLOAT',  'Trọng số text similarity',                          FALSE),
  (UUID(), 'matching.weight_category',  '0.3',        'FLOAT',  'Trọng số category match',                           FALSE),
  (UUID(), 'matching.weight_location',  '0.2',        'FLOAT',  'Trọng số location match',                           FALSE),
  (UUID(), 'matching.weight_time',      '0.1',        'FLOAT',  'Trọng số time proximity',                           FALSE),
  (UUID(), 'email.policy',             'any',        'STRING',  'Chính sách email MVP: any valid email with OTP',       TRUE);
