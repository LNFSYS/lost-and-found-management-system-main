INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'ai.quick_post_draft_enabled', 'false', 'BOOLEAN', 'Enable AI-assisted image draft; user review and explicit publish remain required', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'ai.quick_post_draft_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'privacy.private_found_enabled', 'false', 'BOOLEAN', 'Enable private FOUND details with backend redaction', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'privacy.private_found_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'evidence.private_proof_vault_enabled', 'false', 'BOOLEAN', 'Enable the owner-scoped Private Proof Vault', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'evidence.private_proof_vault_enabled');

INSERT INTO config_entries (id, config_key, config_value, value_type, description, is_public)
SELECT UUID(), 'evidence.consistency_map_enabled', 'false', 'BOOLEAN', 'Enable reviewer-only Evidence Consistency Map', TRUE
WHERE NOT EXISTS (SELECT 1 FROM config_entries WHERE config_key = 'evidence.consistency_map_enabled');
