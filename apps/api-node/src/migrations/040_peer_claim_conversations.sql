ALTER TABLE claims
  MODIFY status ENUM('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED', 'REJECTED', 'CANCELLED')
    NOT NULL DEFAULT 'PENDING';

ALTER TABLE claims
  ADD COLUMN lost_post_id CHAR(36) NULL AFTER post_id,
  ADD COLUMN request_key VARCHAR(190) NULL AFTER claimant_id,
  ADD COLUMN finder_decision ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING' AFTER status,
  ADD COLUMN active_pair_key VARCHAR(112)
    GENERATED ALWAYS AS (
      CASE
        WHEN lost_post_id IS NOT NULL AND status IN ('PENDING', 'CONVERSATION_OPEN', 'NEED_MORE_INFO')
          THEN CONCAT(lost_post_id, ':', post_id, ':', claimant_id)
        ELSE NULL
      END
    ) STORED,
  ADD CONSTRAINT fk_claims_lost_post FOREIGN KEY (lost_post_id) REFERENCES posts(id),
  ADD UNIQUE KEY uq_claim_active_pair (active_pair_key),
  ADD UNIQUE KEY uq_claim_request_key (claimant_id, request_key),
  ADD KEY idx_claims_lost_post (lost_post_id),
  ADD KEY idx_claims_finder_decision (post_id, finder_decision);

UPDATE claims
SET finder_decision = CASE
  WHEN status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') THEN 'ACCEPTED'
  WHEN status = 'REJECTED' THEN 'DECLINED'
  ELSE 'PENDING'
END;

CREATE TABLE claim_participants (
  claim_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  participant_role ENUM('CLAIMANT', 'FINDER') NOT NULL,
  consent_status ENUM('PENDING', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'PENDING',
  joined_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (claim_id, user_id),
  UNIQUE KEY uq_claim_participant_role (claim_id, participant_role),
  CONSTRAINT fk_claim_participants_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_claim_participants_user FOREIGN KEY (user_id) REFERENCES users(id),
  KEY idx_claim_participants_user (user_id, consent_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO claim_participants (claim_id, user_id, participant_role, consent_status, joined_at)
SELECT c.id, c.claimant_id, 'CLAIMANT', 'ACCEPTED', c.created_at
FROM claims c;

INSERT IGNORE INTO claim_participants (claim_id, user_id, participant_role, consent_status, joined_at)
SELECT c.id, found.user_id, 'FINDER',
  CASE
    WHEN c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') THEN 'ACCEPTED'
    WHEN c.status = 'REJECTED' THEN 'DECLINED'
    ELSE 'PENDING'
  END,
  CASE WHEN c.status IN ('CONVERSATION_OPEN', 'NEED_MORE_INFO', 'ACCEPTED') THEN c.accepted_at ELSE NULL END
FROM claims c
INNER JOIN posts found ON found.id = c.post_id;

CREATE TABLE claim_audit_events (
  id CHAR(36) PRIMARY KEY,
  claim_id CHAR(36) NOT NULL,
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(60) NOT NULL,
  from_status VARCHAR(40) NULL,
  to_status VARCHAR(40) NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_audit_claim FOREIGN KEY (claim_id) REFERENCES claims(id),
  CONSTRAINT fk_claim_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  KEY idx_claim_audit_claim_created (claim_id, created_at),
  KEY idx_claim_audit_actor_created (actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE chat_messages
  ADD COLUMN client_message_id VARCHAR(190) NULL AFTER sender_id,
  ADD UNIQUE KEY uq_chat_message_idempotency (room_id, sender_id, client_message_id);

ALTER TABLE claim_evidence
  ADD COLUMN uploaded_by CHAR(36) NULL AFTER claim_id,
  ADD COLUMN media_format VARCHAR(10) NULL AFTER public_id,
  ADD COLUMN media_bytes INT UNSIGNED NULL AFTER media_format,
  ADD CONSTRAINT fk_claim_evidence_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
  ADD KEY idx_claim_evidence_uploader (uploaded_by);
