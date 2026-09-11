# LNFS-53 Finder Verification

## Runtime contract

`CONVERSATION_OPEN` is an open private room only. The appointment-eligible outcome is the existing claim state `ACCEPTED` together with the append-only audit action `FINDER_VERIFIED_FOR_MEETUP`. `REQUEST_MORE_INFO`, `REJECTED` and `CUSTODY_ESCALATION_REQUESTED` are not appointment-eligible.

`ACCEPT` remains accepted as a compatibility input and is normalized to `OPEN_CONVERSATION`; it is never described as ownership verification.

## Implementation evidence

- Template policy and safe custom-question validator: `apps/api-node/src/services/verification-templates.ts`
- Verification routes and rate limit: `apps/api-node/src/routes/claim.routes.ts`
- Request parsing: `apps/api-node/src/controllers/claim.controller.ts` and `apps/api-node/src/validators/claim.validator.ts`
- Participant/state/idempotency/transaction logic: `apps/api-node/src/services/claim.service.ts`
- Existing DB-backed question assignment, answer metadata and audit access: `apps/api-node/src/repositories/claim.repository.ts`
- Appointment guard contract for LNFS-54: `apps/api-node/src/services/appointment-eligibility.ts`
- Finder/claimant PWA panel and explicit decision controls: `apps/web/src/pages/claims-page.tsx`

## Privacy boundary

Question and answer text is delivered only through the participant-authorized private room. Audit metadata stores question key, template version, message ID, answer length, review result, confidence, reason, actor and server timestamp; raw answers and secret hashes are not returned by verification summaries or public post APIs.

## Database boundary

No migration or schema change is part of LNFS-53. The implementation reuses the already deployed `item_verification_questions`, `claim_verification_assignments`, `claim_verification_answers`, `chat_messages` and `claim_audit_events` tables. Built-in template prompts are versioned source configuration for claims without an approved DB question row.

## Verification tests

- `apps/api-node/src/services/verification-templates.test.ts`
- `apps/api-node/src/services/appointment-eligibility.test.ts`
- `apps/api-node/src/validators/claim.validator.test.ts`
- Existing claim privacy, participant and message idempotency tests remain green.

Run without migration or shared-DB writes:

```text
npm.cmd --workspace @lnfs/api-node run build
npm.cmd --workspace @lnfs/api-node run test
npm.cmd --workspace @lnfs/web run lint
```

Appointment creation and Staff intake remain owned by LNFS-54/LNFS-55. They must call the appointment guard before creating or rescheduling an appointment.
