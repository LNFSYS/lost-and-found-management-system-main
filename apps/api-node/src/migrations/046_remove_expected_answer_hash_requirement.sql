-- Make expected_answer_hash nullable since we no longer require expected answers
-- Finder now just sends questions and reviews answers manually
ALTER TABLE item_verification_questions
MODIFY expected_answer_hash VARCHAR(255) NULL;

-- Make is_match nullable in claim_verification_answers since we no longer auto-compare answers
ALTER TABLE claim_verification_answers
MODIFY is_match BOOLEAN NULL;
