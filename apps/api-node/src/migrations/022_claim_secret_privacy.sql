ALTER TABLE claims
  ADD COLUMN secret_answer_hash VARCHAR(255) NULL AFTER description,
  ADD COLUMN has_private_signal BOOLEAN NOT NULL DEFAULT FALSE AFTER secret_answer_hash;

-- SQL cannot safely create bcrypt hashes for legacy values. Discard the old
-- plaintext while preserving the claim rows and their workflow state.
ALTER TABLE claims DROP COLUMN secret_answer;
