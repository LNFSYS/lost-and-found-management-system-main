SET @appointment_proof_image_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'proof_image_url'
);

SET @appointment_proof_image_sql = IF(
  @appointment_proof_image_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN proof_image_url VARCHAR(500) NULL AFTER completed_at',
  'SELECT 1'
);
PREPARE appointment_proof_image_stmt FROM @appointment_proof_image_sql;
EXECUTE appointment_proof_image_stmt;
DEALLOCATE PREPARE appointment_proof_image_stmt;

SET @appointment_proof_public_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'proof_public_id'
);

SET @appointment_proof_public_id_sql = IF(
  @appointment_proof_public_id_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN proof_public_id VARCHAR(255) NULL AFTER proof_image_url',
  'SELECT 1'
);
PREPARE appointment_proof_public_id_stmt FROM @appointment_proof_public_id_sql;
EXECUTE appointment_proof_public_id_stmt;
DEALLOCATE PREPARE appointment_proof_public_id_stmt;

SET @appointment_proof_uploaded_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'proof_uploaded_by'
);

SET @appointment_proof_uploaded_by_sql = IF(
  @appointment_proof_uploaded_by_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN proof_uploaded_by CHAR(36) NULL AFTER proof_public_id',
  'SELECT 1'
);
PREPARE appointment_proof_uploaded_by_stmt FROM @appointment_proof_uploaded_by_sql;
EXECUTE appointment_proof_uploaded_by_stmt;
DEALLOCATE PREPARE appointment_proof_uploaded_by_stmt;

SET @appointment_proof_uploaded_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'proof_uploaded_at'
);

SET @appointment_proof_uploaded_at_sql = IF(
  @appointment_proof_uploaded_at_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN proof_uploaded_at DATETIME NULL AFTER proof_uploaded_by',
  'SELECT 1'
);
PREPARE appointment_proof_uploaded_at_stmt FROM @appointment_proof_uploaded_at_sql;
EXECUTE appointment_proof_uploaded_at_stmt;
DEALLOCATE PREPARE appointment_proof_uploaded_at_stmt;

SET @appointment_proof_note_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND column_name = 'proof_note'
);

SET @appointment_proof_note_sql = IF(
  @appointment_proof_note_exists = 0,
  'ALTER TABLE return_appointments ADD COLUMN proof_note VARCHAR(1000) NULL AFTER proof_uploaded_at',
  'SELECT 1'
);
PREPARE appointment_proof_note_stmt FROM @appointment_proof_note_sql;
EXECUTE appointment_proof_note_stmt;
DEALLOCATE PREPARE appointment_proof_note_stmt;

SET @appointment_proof_fk_exists = (
  SELECT COUNT(*)
  FROM information_schema.table_constraints
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND constraint_name = 'fk_return_appointments_proof_uploaded_by'
);

SET @appointment_proof_fk_sql = IF(
  @appointment_proof_fk_exists = 0,
  'ALTER TABLE return_appointments ADD CONSTRAINT fk_return_appointments_proof_uploaded_by FOREIGN KEY (proof_uploaded_by) REFERENCES users(id)',
  'SELECT 1'
);
PREPARE appointment_proof_fk_stmt FROM @appointment_proof_fk_sql;
EXECUTE appointment_proof_fk_stmt;
DEALLOCATE PREPARE appointment_proof_fk_stmt;

SET @appointment_proof_index_exists = (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'return_appointments'
    AND index_name = 'idx_return_appointments_proof_uploaded_by'
);

SET @appointment_proof_index_sql = IF(
  @appointment_proof_index_exists = 0,
  'CREATE INDEX idx_return_appointments_proof_uploaded_by ON return_appointments (proof_uploaded_by)',
  'SELECT 1'
);
PREPARE appointment_proof_index_stmt FROM @appointment_proof_index_sql;
EXECUTE appointment_proof_index_stmt;
DEALLOCATE PREPARE appointment_proof_index_stmt;
