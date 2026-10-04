# LOST Contact Photo Gate

Scope: dev follow-up on 4 October 2026, BR-69 / FR-CHAT-02. This extends UC-034/040/042/044 and adds a limited runtime slice of UC-106; no new UC ID or full ownership-verification completion is claimed.

## Communication Workflow

1. An authenticated non-owner opens a direct-message draft for an active LOST post. No conversation, warehouse item or ownership decision is created by opening the form.
2. Upload one JPEG/PNG/WebP, maximum 5 MB. The server authorizes the target and reuses the existing Gemini/OCR image-analysis service and matching engine. Client-supplied scores/approval flags are ignored.
3. Compare server-observed title/description (55%), category (15%), visual tags (25%) and OCR (5%) against the LOST post's saved signals. Photo location/time are not trusted and receive zero weight. Existing mismatch penalties still apply. This is a hybrid descriptive similarity score, not a calibrated probability or raw image-embedding distance.
4. Similarity must be strictly above 0.60, without rounding a boundary result upwards; analysis confidence must also be at least 0.60. Provider failure, ambiguous analysis or a lower score leaves contact blocked. The browser retains the selected photo and message draft for retry.
5. A successful check is private, actor/post/revision-bound and valid for 30 minutes until attachment. Creating a direct claim or first message consumes it for exactly one conversation; atomic first-message retries reuse the same evidence. Changed/expired/foreign checks are rejected.
6. Existing non-owner LOST conversations without a consumed check remain read-authorized, but further messages and verification questions/answers cannot bypass the gate. They can attach a fresh approved check. The LOST owner and ordinary FOUND conversations are unaffected. Closure/refusal/reporting are not converted into ownership approval.
7. The conversation displays safe category-question prompts from the existing template catalogue, without private expected answers. Questions are suggestions, not automatically answered assignments or an automatic acceptance decision.

## Ownership and Privacy Limits

- A copied, edited or AI-generated item photo may still match. This gate does not establish live possession, identify the owner, prevent every extortion/no-show attempt or guarantee a genuine Finder. User-facing warnings discourage payments; reports and human verification remain necessary.
- `CONTACT_PHOTO_MATCHED` audit explicitly records `COMMUNICATION_ONLY`. Claim state remains CONVERSATION_OPEN, never automatically ACCEPTED. Actual custody intake, Staff identification, competing-case/dispute/legal-hold checks and private return proof remain unchanged.
- Approved images become participant-protected PHOTO evidence. Raw private storage paths, image-analysis output and expected ownership answers are not returned by the check API or included in notification text. Unused drafts expire and maintenance cleans them; consumed evidence remains part of the authorized claim record.
- Storage uses the existing private local-filesystem adapter. Durable shared media storage and provider evaluation across instances remain deployment requirements, not solved by this gate.

## Rollout and Evidence

New additive migration `062_lost_contact_photo_checks.sql` follows physical-intake migration 061. Do not modify applied migrations, ledger checksums or shared data to install this feature. Back up, run read-only preflight, rehearse both migrations on an isolated DB and apply through the normal migration runner before deploying the API. This work has not applied 061/062 to Aiven; older evidence through 060 is not proof of their deployment.

Read-only `npm run migrate:preflight` on 4 October 2026 succeeded against the configured shared Aiven DB and reported exactly 061 and 062 pending. Existing historical 053/055 compatibility warnings remain; this run neither certifies unavailable original SQL nor changes the ledger.

Automated evidence: contact-photo.use-cases.test.ts (strict threshold, actor/post/revision/expiry/replay, provider failure, cleanup and client-forgery guards); custody-safety.integration.test.ts (fresh MySQL schema, real authenticated multipart/first-message HTTP, private PHOTO evidence, one message on retry, legacy gate and unchanged custody-return safeguards); lost-contact-photo.spec.ts (1440px/390px drafts, 60% rejection, provider failure, photo rendering and legacy unlock).

Real Gemini/photo quality and privacy review, manual physical Staff QA, shared-database rollout, Jira evidence and reviewed PR acceptance remain open. Passing isolated/mocked tests is not a declaration that the operational task is Done.
