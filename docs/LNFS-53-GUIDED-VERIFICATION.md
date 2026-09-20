# LNFS-53 guided ownership verification evidence

Updated: **18/09/2026**

## Canonical contract

- `PENDING` is a new claim waiting for Finder action.
- `ACCEPT / OPEN_CONVERSATION` produces `CONVERSATION_OPEN`; it does not verify ownership.
- `NEED_MORE_INFO` remains appointment-ineligible.
- `ACCEPTED` is the only ownership-verified and appointment-eligible claim state.
- Decline and custody escalation produce `REJECTED`; custody is distinguished by room escalation fields and the `CUSTODY_ESCALATED` audit event.
- `finder_decision = ACCEPTED` is legacy conversation consent and is not an appointment eligibility signal.

## Runtime evidence

| Concern | Implementation |
| --- | --- |
| Versioned category templates and safe custom prompts | `apps/api-node/src/modules/claims/domain/verification-question-templates.ts` |
| Server-authoritative transition, idempotency and privacy serialization | `apps/api-node/src/modules/claims/application/claim.use-cases.ts` |
| Existing question/assignment/answer/audit persistence | `apps/api-node/src/modules/claims/infrastructure/claim.repository.ts` |
| Validation and rate-limited HTTP routes | `apps/api-node/src/modules/claims/interfaces/http/claim.validator.ts`, `claim.controller.ts`, `claim.routes.ts` |
| Responsive Finder/Claimant controls | `apps/web/src/components/claim-verification-panel.tsx`, `apps/web/src/pages/claims-page.tsx`, `apps/web/src/styles.css` |
| API client contract | `apps/web/src/services/api.ts` |
| State/privacy/idempotency/AI-negative tests | `apps/api-node/src/modules/claims/application/claim-verification.use-cases.test.ts`, `domain/verification-question-templates.test.ts`, `interfaces/http/claim.validator.test.ts` |
| Browser flow and stale-room protection | `apps/web/tests/claims-resilience.spec.ts` |
| Isolated MySQL HTTP scenario | `apps/api-node/src/test/http-runtime-scenario.ts` |

The implementation reuses `item_verification_questions`, `claim_verification_assignments`, `claim_verification_answers`, `claim_audit_events`, `claims` and `chat_rooms`. It does not add or modify a database migration.

Question rows remain item-level `DRAFT`; the per-claim assignment plus `QUESTION_SENT` audit event is the authoritative delivery record. This avoids the existing one-`APPROVED`-question-per-post constraint causing one claimant room to invalidate another claimant's pending question.

## Privacy and AI boundary

The Finder-provided expected answer is normalized and bcrypt-hashed before persistence. A claimant answer is normalized, compared, discarded and represented only by match/attempt/timestamp metadata. Claimant responses omit both `isMatch` and audit `matched`; public endpoints never expose the verification entities.

AI/OCR has no dependency that can call the claim transition method. Any future AI suggestion must enter the same Finder-reviewed question endpoint. The automated negative test proves that sending a suggestion does not call `updateFinderDecision` or make a claim appointment-eligible.

## Verification executed

- Node build: passed.
- Node test suite: passed, 170 passed and 2 isolated-MySQL tests skipped because dedicated test database variables were not supplied.
- Web production build: passed.
- Playwright claim verification/resilience: passed, 2 tests at desktop/mobile viewport coverage.

Manual three-user privacy QA, isolated MySQL execution, reviewed PR/commit and Jira evidence remain required before the issue is marked Done. Git/PR/Jira actions were intentionally not performed for this implementation session.
