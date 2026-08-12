INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.weak_threshold', '0.45', 'FLOAT', 'Minimum score to keep a weak internal match candidate', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.weak_threshold');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.suggestion_threshold', '0.60', 'FLOAT', 'Minimum score to show match suggestions to users', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.suggestion_threshold');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.high_confidence_threshold', '0.85', 'FLOAT', 'High confidence advisory threshold for match explanation', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.high_confidence_threshold');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.auto_mark_matched_enabled', '0', 'BOOLEAN', 'Whether high scoring matches automatically move posts to MATCHED', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.auto_mark_matched_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.weight_image', '0.15', 'FLOAT', 'Weight for Google Vision/image tag overlap in matching', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.weight_image');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'matching.weight_ocr', '0.10', 'FLOAT', 'Weight for OCR/serial/visible text overlap in matching', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'matching.weight_ocr');

UPDATE config_entries
SET config_value = '0.75',
    description = 'Minimum score to send a lightweight match notification'
WHERE config_key = 'matching.notification_threshold'
  AND CAST(config_value AS DECIMAL(5, 2)) > 0.75;

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.retention_days_default', '60', 'INTEGER', 'Default warehouse retention period for general items', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.retention_days_default');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.retention_days_document', '120', 'INTEGER', 'Retention period for documents, cards and student IDs before transfer handling', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.retention_days_document');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.retention_days_electronic', '90', 'INTEGER', 'Retention period for electronics or high-value items', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.retention_days_electronic');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.retention_days_perishable', '3', 'INTEGER', 'Retention period for perishable, hygiene or unsafe items', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.retention_days_perishable');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'warehouse.disposition_grace_days', '7', 'INTEGER', 'Grace period after retention deadline before disposal, donation or transfer', FALSE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'warehouse.disposition_grace_days');
