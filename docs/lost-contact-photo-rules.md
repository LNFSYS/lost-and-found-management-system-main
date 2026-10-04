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
8. The owner receiving contact on a LOST post sees a persistent safety reminder below the chat header: request current item photos, compare private characteristics before arranging collection, and do not send money or sensitive information. It remains visible even when the contact photo gate has passed; similarity does not prove possession. The reminder is not shown to the non-owner contacting LOST or to either participant in a FOUND conversation. It uses the server's LOST-owner contact-photo state, not the legacy `foundPostId` field name, and changes no messaging/ownership gate.

## Ownership and Privacy Limits

- A copied, edited or AI-generated item photo may still match. This gate does not establish live possession, identify the owner, prevent every extortion/no-show attempt or guarantee a genuine Finder. User-facing warnings discourage payments; reports and human verification remain necessary.
- `CONTACT_PHOTO_MATCHED` audit explicitly records `COMMUNICATION_ONLY`. Claim state remains CONVERSATION_OPEN, never automatically ACCEPTED. Actual custody intake, Staff identification, competing-case/dispute/legal-hold checks and private return proof remain unchanged.
- Approved images become participant-protected PHOTO evidence. Raw private storage paths, image-analysis output and expected ownership answers are not returned by the check API or included in notification text. Unused drafts expire and maintenance cleans them; consumed evidence remains part of the authorized claim record.
- Post/claim/contact-photo media use the authenticated Cloudinary adapter with private local fallback. Warehouse intake/return proof uses a separate private local store. Durable multi-instance deployment and real-provider acceptance remain requirements, not solved by this gate.

## Consistent Ownership and Read-Only Legacy Access

The LOST owner is the Claimant; the sender retaining the linked FOUND is the Finder. New participant rows use those roles. Legacy reversed labels are resolved from actual target ownership and participants, consistently in chat, Staff review, verified return and feedback; consent and earlier Finder history are not rewritten. The requester database key remains an idempotency key, not ownership proof.

Claim/verification/template GETs never approve pending legacy consent or create a room. An explicit authorized Finder decision is required. Source-post deletion is blocked atomically while custody or active cases/holds exist. Staff verification remains a separate in-person decision after physical intake; photo approval alone grants no return right. See BR-70/71 and the permanent [actor-journey regressions](full-system-audit-2026-10-04.md).

## Direct Room Verification

- Verification/item context prefers an explicitly linked physical FOUND source; when no source is linked, it uses the conversation's original LOST or FOUND post. A direct LOST room does not require inventing a FOUND post merely to read its category, question templates or verification state.
- The four Finder decisions remain role-restricted. Reading verification or matching a contact photo never approves ownership; meetup still needs the required private answers. Custody separately requires an eligible FOUND post owned by the Finder and cannot use a LOST context as a physical source.
- Private item images and exact location belong to the selected post's actual owner, not automatically to the Finder role. The other participant receives only the permitted category, area and public image metadata.
- A failed verification read renders a red inline error and an explicit retry, while retaining chat messages and the typed draft. Automatic verification polling pauses after a failure; requests are coalesced and cancelled/checked against the selected room so a late response cannot replace another room's state.
- On 4 October, read-only probes of the affected shared LOST conversation confirmed successful verification reads for both Finder and Claimant, with the correct roles/category and no automatic ownership acceptance. No migration or shared data correction was required for this fix. Unit/repository, real authenticated isolated HTTP/SQL and desktop/mobile browser regressions cover these contracts.

## Rollout and Evidence

New additive migration `062_lost_contact_photo_checks.sql` follows physical-intake migration 061. Do not modify applied migrations, ledger checksums or shared data to install this feature. On a new environment, back up, run read-only preflight, rehearse both migrations on an isolated DB and apply through the normal migration runner before deploying the API. Older evidence through 060 is not proof of this rollout.

Shared Aiven rollout on 4 October 2026 applied exactly 061/062 after encrypted backup and isolated restore/repeat-run rehearsal. Current `npm run migrate:preflight` reports no pending migrations; all three new tables and foreign keys pass verification, the maintenance probe is ready and the existing local API health/readiness checks pass. Old ledger records and existing table definitions are unchanged. Historical 053/055 compatibility warnings remain and do not certify unavailable original SQL. See [the operational receipt and limits](database-warehouse-recovery.md).

Automated evidence: contact-photo.use-cases.test.ts (strict threshold, actor/post/revision/expiry/replay, provider failure, cleanup and client-forgery guards); custody-safety.integration.test.ts (fresh MySQL schema, real authenticated multipart/first-message HTTP, private PHOTO evidence, one message on retry, legacy gate and unchanged custody-return safeguards); lost-contact-photo.spec.ts (1440px/390px drafts, 60% rejection, provider failure, photo rendering, legacy unlock and LOST-owner safety reminder; no reminder for LOST senders or either FOUND participant).

Real Gemini/photo quality and privacy review, manual physical Staff QA, durable private-media/application deployment, Jira evidence and reviewed PR acceptance remain open. Passing isolated/mocked tests and deploying the shared schema are not a declaration that the operational task is Done.
