ALTER TABLE posts
  ADD COLUMN visibility_mode ENUM('PUBLIC', 'PRIVATE_DETAILS') NOT NULL DEFAULT 'PUBLIC' AFTER type,
  ADD KEY idx_posts_visibility_status (visibility_mode, status, created_at);

CREATE TABLE private_proofs (
  id CHAR(36) PRIMARY KEY,
  owner_id CHAR(36) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  proof_type ENUM(
    'PURCHASE_RECEIPT',
    'PRE_LOSS_IMAGE',
    'SERIAL_SUFFIX',
    'UNIQUE_MARK',
    'ACCESSORY',
    'OWNERSHIP_NOTE'
  ) NOT NULL,
  private_description VARCHAR(2000) NULL,
  masked_value VARCHAR(255) NULL,
  secret_value_hash VARCHAR(255) NULL,
  media_secure_url VARCHAR(1000) NULL,
  media_public_id VARCHAR(500) NULL,
  media_format VARCHAR(32) NULL,
  status ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_private_proofs_owner FOREIGN KEY (owner_id) REFERENCES users(id),
  KEY idx_private_proofs_owner_status (owner_id, status, updated_at),
  KEY idx_private_proofs_type (proof_type, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE claim_private_proofs (
  claim_id CHAR(36) NOT NULL,
  proof_id CHAR(36) NOT NULL,
  attached_by CHAR(36) NOT NULL,
  item_name_snapshot VARCHAR(255) NOT NULL,
  proof_type_snapshot VARCHAR(50) NOT NULL,
  private_description_snapshot VARCHAR(2000) NULL,
  masked_value_snapshot VARCHAR(255) NULL,
  attached_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id, proof_id),
  CONSTRAINT fk_claim_private_proofs_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_claim_private_proofs_proof FOREIGN KEY (proof_id) REFERENCES private_proofs(id),
  CONSTRAINT fk_claim_private_proofs_actor FOREIGN KEY (attached_by) REFERENCES users(id),
  KEY idx_claim_private_proofs_proof (proof_id, attached_at),
  KEY idx_claim_private_proofs_claim (claim_id, attached_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
