ALTER TABLE notification_email_preferences
  ADD COLUMN channel_preferences JSON NULL AFTER claim_mode;

CREATE TABLE notification_push_subscriptions (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  endpoint_hash CHAR(64) NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key VARCHAR(160) NOT NULL,
  auth_key VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_push_endpoint_hash (endpoint_hash),
  KEY idx_notification_push_user (user_id),
  CONSTRAINT fk_notification_push_subscription_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notification_push_outbox (
  id CHAR(36) NOT NULL,
  notification_id CHAR(36) NOT NULL,
  recipient_user_id CHAR(36) NOT NULL,
  subscription_id CHAR(36) NOT NULL,
  room_id CHAR(36) NULL,
  status ENUM('PENDING', 'PROCESSING', 'SENT', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  due_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  lease_token CHAR(36) NULL,
  lease_expires_at DATETIME NULL,
  last_error_code VARCHAR(80) NULL,
  sent_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notification_push_delivery (notification_id, subscription_id),
  KEY idx_notification_push_due (status, due_at, lease_expires_at),
  CONSTRAINT fk_notification_push_outbox_notification FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_push_outbox_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_push_outbox_subscription FOREIGN KEY (subscription_id) REFERENCES notification_push_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_push_outbox_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
