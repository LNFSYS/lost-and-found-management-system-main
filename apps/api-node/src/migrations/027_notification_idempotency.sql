ALTER TABLE notifications
  ADD COLUMN dedupe_key VARCHAR(190) NULL AFTER entity_id,
  ADD UNIQUE KEY uq_notifications_dedupe_key (dedupe_key);
