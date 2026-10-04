-- Preserve logs with a dangling warehouse pointer; never delete the audit row.
CREATE TABLE warehouse_link_recovery_evidence (
  source_table VARCHAR(64) NOT NULL,
  source_id CHAR(36) NOT NULL,
  original_links JSON NOT NULL,
  operation_ref VARCHAR(128) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_table,source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
START TRANSACTION;
INSERT INTO warehouse_link_recovery_evidence(source_table,source_id,original_links,operation_ref)
  SELECT 'storage_logs',sl.id,
    JSON_OBJECT('id',sl.id,'warehouse_item_id',sl.warehouse_item_id,'post_id',sl.post_id,
      'actor_id',sl.actor_id,'action',sl.action,'from_status',sl.from_status,'to_status',sl.to_status),
    'migration:058_storage_link_recovery.sql'
  FROM storage_logs sl LEFT JOIN warehouse_items wi ON wi.id=sl.warehouse_item_id
  WHERE sl.warehouse_item_id IS NOT NULL AND wi.id IS NULL;
UPDATE storage_logs sl LEFT JOIN warehouse_items wi ON wi.id=sl.warehouse_item_id
  SET sl.warehouse_item_id=NULL
  WHERE sl.warehouse_item_id IS NOT NULL AND wi.id IS NULL;
COMMIT;
