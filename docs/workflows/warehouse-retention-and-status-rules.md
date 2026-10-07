# Warehouse Retention and Status Rules

Updated 4 October 2026. These are LNFS project defaults, **not an approved university retention/disposition policy**. The custody safety baseline is integrated into `dev`; local follow-up fixes and release limits are in [dev audit fixes](../audits/dev-main-audit-fixes.md). Runtime guards alone do not complete every catalogue actor goal.

## Retention

| Category group | Default | Reason |
| --- | ---: | --- |
| Documents, student cards, keys, vehicle documents | 120 days | Important ownership/access documents and keys |
| Electronics: phone, laptop, headphones | 90 days | High-value property |
| Perishable food and drinks | 3 days | Spoilage and hygiene |
| Other property: umbrella, jacket, backpack, bottle | 60 days | General project default |

- Both walk-in and custody intake use `warehouse-policy.ts`; category names are normalized and matched by whole words/phrases, not broad substrings such as `nuoc`.
- Deadline = **physical receivedAt in UTC + effective retention days**. Request time, Staff acceptance and proposed appointment are not receipt time. Future/invalid receivedAt is rejected.
- Config overrides use `warehouse.retention_days_document/electronic/perishable/default`, bounded integers 1–3650; invalid configured values fall back to policy defaults.
- An item can be overdue while still `RECEIVED`, `STORED` or `CLAIMED`. Passing time is a derived fact, not permission to change status or dispose.

## Separate State Machines

| Record | Meaning |
| --- | --- |
| Post | Publication/search lifecycle; not physical location |
| Claim | Consent and human ownership-verification decision |
| Custody request | PENDING → INTAKED; legacy ACCEPTED may also become INTAKED; or pre-intake REJECTED/CANCELLED |
| Warehouse item | Physical intake, storage, reservation, completed return or guarded disposition |

Request and acceptance leave the Finder holding the item. Only Staff physical intake changes custody. Intake must **not** resolve a post or accept/reject its claim. Custody escalation is not a claim rejection; cancellation/rejection clears the room escalation projection while retaining history.

## Warehouse Statuses

| Status | Meaning and gate |
| --- | --- |
| RECEIVED | Staff physically received the item at the counter; condition, actor, receipt time and custody log exist. Not yet necessarily shelved. |
| STORED | Staff recorded a non-empty storage code/location and condition. |
| CLAIMED | Reserved for an existing, consented, human-verified claimant; canonical reserve endpoint only. Not an arbitrary PATCH value. |
| RETURNED | Canonical Staff return: verified actual recipient identity/contact, private proof IDs, authorized completion and audit. Resolves linked posts. Feedback opens only for real linked online claim/Finder participants; offline recipients need no account or invented claim. |
| EXPIRED | Explicit Staff marking only after actual deadline, without active claim/appointment/dispute/hold. Scheduler does not set it. |
| DISPOSED | Admin-approved disposal, separate requester/approver, rechecked eligibility and private supporting proof at execution. |
| DONATED | Same guarded execution; property must be suitable for donation. Campaign workflow remains a separate planned goal. |
| TRANSFERRED | Guarded terminal external transfer. Internal relocation is a storage/location event, not invented successful return. Full internal-transfer workflow is not implemented here. |

`PENDING_APPROVAL` is retained for legacy data; a custody request is not a warehouse item in that state. Terminal outcomes cannot be reopened by PATCH. Releasing a CLAIMED reservation to STORED is a distinct action with reason, storage location, no active blocker/legal hold and audit; the old reservation history remains.

EXPIRED property is still physically retained until disposition. Canonical return can transition it to RETURNED, with the same identity/contact, verified online claimant when linked, private proof, reservation, dispute and legal-hold checks as other retained states. The original retention deadline remains unchanged. Generic PATCH does not bypass this return contract.

## Authorization and Integrity

- Transfer requires an owned, undeleted, active FOUND post and valid consented claim/room linkage when supplied. LOST chat is allowed, but ownership/custody needs a verified physical FOUND source owned by the Finder.
- Actor/operation-scoped keys support up to 190 client characters using a 64-character storage hash. New requests retain an immutable original payload for replay comparison; legacy keys remain readable and are checked conservatively. Changed payload conflicts.
- Post/request/item locks and unique active-post constraints prevent double request/intake. An actor-scoped request retry remains valid after completed return. A retry returns the same intake/completion; a changed recipient/proof set conflicts.
- Finder can cancel their own PENDING/ACCEPTED request; Staff can accept/reject/intake/cancel according to role and state. Unrelated users cannot read details/audit.
- Generic PATCH cannot assign CLAIMED, RETURNED, DISPOSED, DONATED or TRANSFERRED. Admin controls legal hold and disposition request/approval; another Admin approves. Staff/Admin execute only an item-bound approved action, with current retention, case, dispute, hold and proof checks in the transaction. Denied execution attempts are logged without private evidence. A canonical return excludes only its own completing claim/appointment from active-case blockers; competing cases and pending disputes still block return.
- Offline walk-in return records the recipient name, contact, identity and private proof without requiring an account or inventing a claim. Active online claims/disputes still block unlinked return. Only a real linked participant-based completed return authorizes feedback.
- After physical intake, Staff/Admin can separately verify a consented claimant in person with explicit confirmation and a 10-1000 character rationale (BR-65). Check item/claim/recipient linkage, other reservations, active competing claims/appointments, disputes and legal hold. Append independent Staff audit without rewriting Finder identity or decisions. Finder cannot override that Staff custody decision; intake alone never accepts ownership.
- Staff pre-approval is not required before physical receipt. Finder retains physical custody until intake; queueing alone does not resolve the post or verify ownership. Direct LOST uses the LOST owner as Claimant and the linked FOUND holder as Finder, including normalized legacy participants without changing consent/history.
- Source deletion locks the post and checks active requests/items/cases, disputes and legal hold atomically (BR-70). Completed eligible publication may be removed with history retained; previously deleted sources need authorized review rather than automatic restoration. GET cannot approve pending legacy claims (BR-71).

## Proof and Delivery

- JPEG/PNG/WEBP signature, MIME and 5 MB limit are validated. Stable IDs/metadata reference injected private storage; no base64/public identity URL is written to a TEXT note. Staff-only proof endpoint returns private/no-store responses.
- Failed metadata writes remove the upload. Unattached proof metadata/blobs older than 72 hours are cleaned by maintenance, using row locks against return/disposition attachment. Durable shared storage and crash-orphan reconciliation remain deployment work.
- Lifecycle notifications and email outbox rows share the business transaction, with event/recipient dedupe. Realtime publishes after commit. Private answers, evidence, chat, contact and raw storage URLs are excluded.
- Finder/Staff receive authorized custody links. Claimants receive their claim link (or safe post link when no specific claim was attached); API rechecks authorization.
- Maintenance checks required schema using read-only metadata before every tick. Missing tables/columns pause business work and emit one `WAREHOUSE_SCHEMA_NOT_READY` warning per changed schema condition; the next poll resumes only when the required schema exists. It never applies migrations automatically. Runtime failures log only phase and safe error codes, not raw SQL/private data.
- Maintenance polls once a minute for retained custody warehouse items and emits one overdue reminder per request. It never disposes/deletes/transitions an item. Stale claims/appointments and walk-in overdue reminders are **not** completed by this producer.
- Staff default screen is custody queue, with walk-in intake there, server filters/pagination, refresh of counts/lists/detail, and warehouse logs/update retained.
- Chat and matching custody modal stay on the current page. DVSV hours: Monday–Friday, 08:00/08:15–12:00 and 13:30–17:00, excluding public holidays. This is informational, not a holiday-aware scheduling engine.

## Traceability and Rollout

BR-53–BR-60, BR-65–BR-71; FR-POST-02, FR-CLAIM-01, FR-CUSTODY-02, FR-VERIFY-03, FR-WAREHOUSE-03/04/05/06, FR-MATCH-05, FR-NOTIFY-05/06, FR-STAFF-02; existing UC-022, UC-026–031, UC-040/042, UC-051–060, UC-114, UC-141–158, UC-168. Bug fixes do not introduce new UC IDs.

Canonical `053_custody_requests.sql`, additive `054_custody_safety_contract.sql`, recovery 056–058 and direct-recipient 059 are applied on Aiven. Matching lease migration 060 was applied on 3 October after backup and isolated rehearsal; read-only preflight on 4 October reports no pending migrations. Historical 053 is not an alias. Exact original matching 054 is recovered and immutable; original custody-time 055 effects remain unverified despite schema checks. No applied checksum/history was rewritten. No new migration is needed for the four follow-up fixes. See [database recovery](../runbooks/database-warehouse-recovery.md) for rollout evidence and unresolved physical-link reviews.

Historical evidence: [LNFS-55-SAFETY-VERIFICATION.md](../audits/LNFS-55-SAFETY-VERIFICATION.md). Current verification and release gates: [dev audit fixes](../audits/dev-main-audit-fixes.md), including stopping/draining older email workers before the lease/quarantine policy rollout.
