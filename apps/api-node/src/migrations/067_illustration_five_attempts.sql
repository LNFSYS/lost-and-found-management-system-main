ALTER TABLE lost_illustration_drafts DROP CONSTRAINT chk_illustration_max_attempts;
ALTER TABLE lost_illustration_drafts ADD CONSTRAINT chk_illustration_max_attempts CHECK (attempts_used <= 5);

ALTER TABLE lost_illustration_attempts DROP CONSTRAINT chk_illustration_attempt_number;
ALTER TABLE lost_illustration_attempts ADD CONSTRAINT chk_illustration_attempt_number CHECK (attempt_number BETWEEN 1 AND 5);
