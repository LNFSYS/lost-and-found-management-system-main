UPDATE config_entries
SET config_value = '0.8',
    updated_at = UTC_TIMESTAMP()
WHERE config_key = 'matching.notification_threshold';

ALTER TABLE post_media
  ADD COLUMN media_kind ENUM('ITEM', 'EVIDENCE') NOT NULL DEFAULT 'ITEM' AFTER resource_type;
