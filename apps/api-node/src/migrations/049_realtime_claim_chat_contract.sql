ALTER TABLE chat_rooms
  ADD COLUMN next_sequence BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER claim_id,
  ADD COLUMN blocked_by CHAR(36) NULL AFTER next_sequence,
  ADD COLUMN blocked_at DATETIME NULL AFTER blocked_by,
  ADD COLUMN escalated_at DATETIME NULL AFTER blocked_at,
  ADD COLUMN escalated_by CHAR(36) NULL AFTER escalated_at,
  ADD COLUMN escalation_reason VARCHAR(255) NULL AFTER escalated_by;

ALTER TABLE chat_messages
  ADD COLUMN sequence BIGINT UNSIGNED NULL AFTER room_id,
  ADD COLUMN media_bytes INT UNSIGNED NULL AFTER media_public_id,
  ADD COLUMN media_format VARCHAR(10) NULL AFTER media_bytes,
  ADD COLUMN delivery_status ENUM('SENT', 'DELIVERED', 'READ') NOT NULL DEFAULT 'SENT' AFTER is_read,
  ADD COLUMN delivered_at DATETIME NULL AFTER delivery_status,
  ADD COLUMN edited_at DATETIME NULL AFTER delivered_at,
  ADD COLUMN deleted_at DATETIME NULL AFTER edited_at;

UPDATE chat_messages AS message
INNER JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at, id) AS assigned_sequence
  FROM chat_messages
) AS ranked ON ranked.id = message.id
SET message.sequence = ranked.assigned_sequence
WHERE message.sequence IS NULL;

UPDATE chat_rooms AS room
LEFT JOIN (
  SELECT room_id, MAX(sequence) AS maximum_sequence
  FROM chat_messages
  GROUP BY room_id
) AS messages ON messages.room_id = room.id
SET room.next_sequence = GREATEST(room.next_sequence, COALESCE(messages.maximum_sequence, 0) + 1);

ALTER TABLE chat_messages
  MODIFY COLUMN sequence BIGINT UNSIGNED NOT NULL AFTER room_id,
  ADD UNIQUE KEY uq_chat_messages_room_sequence (room_id, sequence),
  ADD KEY idx_chat_messages_room_unread (room_id, sender_id, is_read, created_at);

CREATE TABLE claim_room_blocks (
  room_id CHAR(36) NOT NULL,
  blocked_by CHAR(36) NOT NULL,
  blocked_user_id CHAR(36) NOT NULL,
  reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, blocked_by, blocked_user_id),
  CONSTRAINT fk_claim_room_blocks_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  CONSTRAINT fk_claim_room_blocks_actor FOREIGN KEY (blocked_by) REFERENCES users(id),
  CONSTRAINT fk_claim_room_blocks_target FOREIGN KEY (blocked_user_id) REFERENCES users(id),
  KEY idx_claim_room_blocks_target (blocked_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
