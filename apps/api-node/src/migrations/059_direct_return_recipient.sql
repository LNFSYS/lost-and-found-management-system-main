-- Allow Staff to complete an in-person return when the recipient has no LNFS account or claim.
-- Existing claim-linked returns remain valid; new direct returns keep their identity details
-- restricted to warehouse Staff/Admin access through the completed-return record.
ALTER TABLE warehouse_completed_returns
  MODIFY claim_id CHAR(36) NULL,
  MODIFY appointment_id CHAR(36) NULL,
  MODIFY recipient_id CHAR(36) NULL,
  ADD COLUMN recipient_name VARCHAR(150) NULL AFTER recipient_id,
  ADD COLUMN recipient_phone VARCHAR(20) NULL AFTER recipient_name,
  ADD COLUMN recipient_identity VARCHAR(100) NULL AFTER recipient_phone;
