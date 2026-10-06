# Full System Audit - 5 October 2026

> The original audit and first Repair Follow-Up below are dated snapshots. See [Authorized Execution Follow-Up](#authorized-execution-follow-up---5-october-2026) for the later repairs, completed warehouse photo transfer and fresh verification. Original reproductions, test counts and the 77/100 score are preserved; they must not be read as fresh failures after the fixes.

## Scope and Snapshot

Repository: `F:/ky9/fptu-lost-found-system-main`, branch `dev`, HEAD `ca79a89`, with 19 existing modified files. This audit covers the current working tree, not just committed code. The obsolete `F:/ky9/fptu-lost-found-system` project was not used.

The fresh remote query returned dev `fd122e630939b4ee9a4f6d262e1afae6e0815c0f` and main `55aac52e102f06413c5e69ba062b789285e26830`. Local dev is eight commits ahead of remote dev. No current CI result can validate this exact uncommitted working tree. Existing CI is not missing: it defines MySQL 8.0/8.4 verification and browser jobs.

This is a source review, automated regression run and targeted behavioral audit. It is not an exhaustive penetration test, provider-quality evaluation, WCAG certification or production release approval. No application code, applied migration, ledger or Aiven business data was changed. This report is the only new repository file created by the audit; the 4 October report remains historical evidence.

## Findings

### A1 - P2: Existing SSE connections outlive session revocation and JWT expiry

References: [realtime.routes.ts](../../apps/api-node/src/modules/realtime/interfaces/http/realtime.routes.ts#L10), [realtime.controller.ts](../../apps/api-node/src/modules/realtime/interfaces/http/realtime.controller.ts#L19), [realtime.use-cases.ts](../../apps/api-node/src/modules/realtime/application/realtime.use-cases.ts#L113).

The HTTP auth middleware validates the token and session when opening the stream. Once connected, heartbeat checks only whether the response is destroyed; notification delivery does not revalidate the account/session or expire the stream. A previously authorized connection can therefore continue receiving notification payloads after its access has been revoked.

Reproduced using the real Express route, controller, auth middleware, JWT verification and realtime use case on a temporary loopback HTTP server. The session validator was a controlled stub, not an Aiven account mutation:

1. Open SSE with a valid three-second JWT and an active session.
2. Revoke the synthetic session: a new request with that token returns 401.
3. Wait for JWT expiry: another new request returns 401.
4. Publish a synthetic notification: the original stream still receives it.

Observed result: `revokedNewRequestStatus: 401`, `expiredNewRequestStatus: 401`, `existingStreamDelivered: 1`, `existingStreamReceivedSyntheticEvent: true`.

Impact is continued access to workflow notification titles, bodies and entity identifiers on an existing connection. This probe does not establish disclosure of private chat message bodies or another user's notifications, and does not assert that the normal browser logout leaves its own stream open.

Recommended repair: bind a stream to its validated session and token expiry; close it on expiry/revocation/account disable, with bounded revalidation or explicit revocation propagation. Add expiry and revoked-session regressions that assert both stream closure and zero subsequent delivery. Define how transient revalidation failures fail closed without uncontrolled retry loops.

### A2 - P2: A delayed chat send contaminates the next room and erases its draft

References: [claims-page.tsx](../../apps/web/src/pages/claims-page.tsx#L498), [claim-verification-panel.tsx](../../apps/web/src/components/claim-verification-panel.tsx#L98).

`submitMessage` captures the original claim ID for the request, but its completion unconditionally appends to the currently displayed message state and clears the current draft. The read-side stale-response guards do not protect this mutation callback.

Deterministic Chromium reproduction with mocked browser APIs, without sending real messages:

1. Send `ROOM_A_MESSAGE` in room A; hold its POST response.
2. Switch to room B and enter `ROOM_B_DRAFT`.
3. Release the successful POST response for A.

Observed result: the URL remains room B, `roomAMessageInRoomB: 1`, and `roomBDraft: ""`. Expected: zero A messages in B and the B draft unchanged. Screenshot: `C:/Users/ADMIN/.codex/tmp/lnfs-audit-20261005-7e9a31/cross-room-pending-send.png`.

This is a frontend context/draft-loss defect; the demonstrated request still targets room A. There is no evidence from this probe of backend delivery to the wrong recipient or cross-account data disclosure.

Recommended repair: fence mutation success, error and finally callbacks against the selected room/generation. Update the original sidebar entry by ID independently, but do not replace another room's message list, draft, error or verification state. Review the same pattern in `applyClaimUpdate` and decision/evidence callbacks; those additional paths were identified statically, not separately reproduced. Add delayed-success and delayed-failure room-switch tests, plus decision/upload equivalents.

### A3 - P3: Current overview contradicts implemented modules and migration state

References: [project-overview.md](../overview/project-overview.md#L44), [realtime baseline](../overview/project-overview.md#L113), [migration baseline](../overview/project-overview.md#L218).

The overview labels a section "Current implementation baseline" but still says realtime has no runtime, post/claim media is only local filesystem, and source migrations end at 046 with unapplied shared-DB changes. Current code has authenticated SSE and Cloudinary-backed post/claim adapters with local fallback; the current Aiven preflight reports no pending migrations. The branch-specific custody description also retains the old request/accept vocabulary.

Recommended repair: update current overview/module/storage/migration sections against current runtime and the new evidence below. Explicitly mark old dated snapshots as historical instead of changing their original test results. Align BR/FR/UC and traceability references to the current custody intake and Staff verification rules. No additional BR/FR/UC identifier is inherently required for A1/A2 bug fixes, and no catalogue status should be promoted solely because automated tests pass.

## Remaining Release Gates

### R1 - Durable warehouse evidence is still a conditional deployment blocker

References: [services.ts](../../apps/api-node/src/main/services.ts#L90), [private-media-storage.ts](../../apps/api-node/src/shared/infrastructure/private-media-storage.ts#L37), [FR-MEDIA-02](../requirements/requirements.md#L37).

Warehouse intake and return proof use the local `warehouse-proof` namespace. If deployed to ephemeral disks or independent instances sharing the same database, evidence can become unavailable after replacement or when a request lands on another instance. This is an existing, documented architectural limit, not a newly reproduced localhost failure. Deployment topology and durable shared storage were not verified. Before that topology is released, implement authenticated durable object storage or prove shared persistent storage, restore and multi-instance delivery.

### R2 - Exact artifact CI and operational acceptance remain outstanding

Eight unpublished commits and 19 pre-existing modified files mean remote CI cannot represent the audited working tree. Local MySQL 9.3 SQL success is not a substitute for the configured MySQL 8.0/8.4 CI matrix. Review the changes, fix confirmed defects, commit/push only with authorization, then obtain green CI on the exact candidate and provider/manual acceptance before release. This audit makes no commit, push or merge.

## Executed Verification

| Check | Current result | What it establishes |
| --- | --- | --- |
| `npm test` | 308 passed, 0 failed; 13 opt-in SQL entries skipped | Normal process exit without force-exit; architecture checks: 187 production files, 0 violations; Web type check passed |
| Explicit isolated SQL suites | 42 passed, 0 failed, 0 skipped | Real migrations, repositories, authenticated HTTP, custody/Staff verification/return, legacy identity/consent, source deletion/races, recovery and concurrency regressions |
| `npm run build` | Passed | API and Web production builds |
| Full Playwright `--workers=2` | 63 passed, 0 failed | Existing desktop/mobile browser regressions, including inventory layout and chat resilience; browser APIs/providers are mocked |
| `npm audit --omit=dev --json` | 0 known vulnerabilities | Current production lockfile and registry advisory response |
| `npm audit --json` | 0 known vulnerabilities | Current complete dependency advisory response; not a security certification |
| `npm run migrate:preflight` | Passed, no pending or superseded migrations | Aiven read-only: 58 source migrations, 61 applied ledger entries, 28 APPLIED attempts |
| `node scripts/check-uc-catalogue.mjs` | 168 total: 97 Implemented, 17 Partial, 54 Planned | Catalogue structural/status counts, not end-to-end acceptance of all 168 UCs |
| Existing local API `/api/ready` | `ready` | One successful current readiness check, not a network availability guarantee |
| Targeted delayed-send browser probe | Failed expected invariant, reproduced A2 | Additional audit scenario absent from passing browser regressions |
| Targeted SSE auth-lifetime HTTP probe | Failed expected invariant, reproduced A1 | Real auth/transport path with controlled session revocation, no shared-data writes |
| `git diff --check` | Passed | Working-tree whitespace check; normal CRLF notices are not defects |

SQL used a task-owned MySQL 9.3 instance bound to `127.0.0.1:33312` and disposable test databases, never Aiven. An initial harness run lacked the explicit nonempty test password required by three suites; isolated credentials were corrected and the full rerun above passed. The dedicated server was shut down afterwards; user API/Web and other MySQL processes were left intact.

Historical preflight warnings remain explicit: recovered historical 053 scope does not certify all original disposition/legal-hold effects; original custody-time 055 SQL is unavailable and its effects are not replayed. No checksum/ledger rewrite or recovery write was performed. A passing preflight is not proof of unknown historical SQL effects or repair of every historical business row.

The prior three reproduced 4 October defects now have passing composed SQL regressions: physical LOST/FOUND identities through Staff return, deletion guards around active custody/cases, and legacy GET/retry paths without fabricated consent. These results do not cover the newly reproduced frontend and SSE failures above.

## Project Score

**Current Web/API engineering quality: 77/100 (7.7/10). Production readiness: not approved.** This is a transparent reviewer estimate, not an official university grade or standards certificate. It assesses the implemented Web/API version; it does not count Planned Native Mobile or incomplete product scope as finished.

The rubric takes inspiration from the public [ISO/IEC 25010:2023 product-quality model](https://www.iso.org/standard/78176.html), [OWASP ASVS 5.0 security verification framework](https://owasp.org/projects/asvs) and [W3C WCAG 2.2 accessibility guidance](https://www.w3.org/TR/WCAG22/). The weights and numeric scores below are this audit's own method, not a scoring formula prescribed by those sources. The full ISO standard and full ASVS/WCAG conformance were not audited.

| Criterion | Weight | Awarded | Main evidence and deduction |
| --- | ---: | ---: | --- |
| Functional correctness and workflow integrity | 25 | 21 | Strong composed custody/return and migration regressions; delayed chat mutation defect and incomplete target workflows remain |
| Security and privacy | 20 | 16 | Role/participant/private-media gates and clean dependency advisory checks; SSE session lifetime defect, photo-possession and full security acceptance limits |
| Reliability and data lifecycle | 20 | 14 | Transactions, idempotency, migration preflight and concurrency tests; local warehouse evidence, unknown historical effects and unverified restore/load/failover |
| UX and accessibility | 10 | 8 | 63 desktop/mobile browser cases and compact inventory/detail flow; cross-room draft loss and no complete assistive-technology/WCAG assessment |
| Maintainability and verification | 15 | 13 | Modular architecture with zero detected dependency violations and broad automated coverage; missing adversarial mutation/session-lifetime cases |
| Documentation and release evidence | 10 | 5 | BR/FR/UC catalogue and useful runbooks exist; overview drift, no exact-working-tree CI and provider/manual release evidence remain |
| **Total** | **100** | **77** | **A strong local development baseline, not a certified production system** |

No line-coverage percentage or claim of exhaustive test coverage is inferred from the passing test counts. SMTP, Cloudinary and representative Gemini/photo accuracy were not exercised as live end-to-end providers in this audit. A photo similarity threshold is decision support, not proof of possession or ownership. Load testing, manual privacy/UAT, physical intake acceptance, backup restoration and full accessibility/device checks still need separate evidence.

## Recommended Order

1. Fix SSE expiry/revocation and add the two missing auth-lifetime regressions.
2. Fence room-specific async mutation callbacks and preserve other rooms' drafts; add the delayed-send reproduction to permanent browser coverage.
3. Reconcile current overview, BR/FR/UC references and deployment evidence without overwriting historical snapshots or promoting all UCs.
4. Resolve durable warehouse-media deployment and run exact-candidate MySQL 8.0/8.4/browser CI plus provider/manual acceptance.
5. Reassess release/main merge readiness. Passing local suites alone do not close the confirmed findings or deployment gates.

## Repair Follow-Up - 5 October 2026

This first, adapter-only follow-up is retained as an earlier snapshot. Its then-uncommitted/no-transfer statements and remaining actions are superseded where explicitly recorded in the authorized execution below.

Repairs were made on `dev` in `F:/ky9/fptu-lost-found-system-main`, retaining the 19 pre-existing modified files. HEAD is still `ca79a89`: these changes are uncommitted, and no commit, push or merge was performed. No applied SQL/checksum/ledger or Aiven business row was changed. The statements about no code edits and the counts in the original audit apply only to its earlier snapshot.

### Finding Disposition

| ID | Current status | Repair and evidence |
| --- | --- | --- |
| A1 | Fixed locally; regression verified | Streams bind to the verified JWT/session, close at token expiry, and revalidate before notifications and on the 25-second heartbeat. Failed/slow validation fails closed within a five-second bound; a late check cannot revive a closed stream. Real HTTP expiry/revocation/registration-error and use-case concurrency/failure tests pass; rejected registration remains a normal JSON error, not an incorrectly typed SSE response. |
| A2 | Fixed locally; regression verified | Mutation success/error/finally callbacks are fenced by room ID and generation. Original sidebar entries can update by ID, but another room's draft/messages/errors/review and pending-send state cannot be overwritten. Decision, evidence, contact-photo and composer callbacks are also guarded. Six new delayed-mutation browser cases pass, including re-entering the same room and a second room's pending send. |
| A3 | Updated locally | Overview, BR/FR/UC references, traceability and warehouse storage documentation now distinguish implemented runtime from historical snapshots and remaining acceptance. Existing BR-06/BR-29 and FR-RT-01/FR-MEDIA-02 were clarified; no new BR/FR/UC ID was required and no blanket UC promotion was made. |
| R1 | New-upload implementation fixed; legacy/deployment acceptance outstanding | Warehouse intake/proof now use authenticated Cloudinary assets through the existing authorized proxy. Production refuses new local writes when credentials are absent, and provider failure never falls back to local files. Legacy files remain readable. The 16 historical local references and restore/deployment acceptance still need the separate reviewed rollout below. |
| R2 | CI evidence workflow improved; remote acceptance outstanding | CI records the actual checked-out candidate for the MySQL 8.0/8.4 matrix and retains browser JUnit/screenshots; manual dispatch was added. There is still no remote CI result for this uncommitted candidate, and local MySQL 9.3 does not establish compatibility with both remote matrix versions. |

Session revocation on an idle stream is detected on the bounded heartbeat, not atomically at the database update. Notifications are independently revalidated before delivery. This closes the reproduced unlimited session-lifetime defect without claiming synchronous distributed revocation or multi-instance realtime fanout.

Primary repair references:

- [Realtime use cases](../../apps/api-node/src/modules/realtime/application/realtime.use-cases.ts), [HTTP lifetime regressions](../../apps/api-node/src/modules/realtime/interfaces/http/realtime-auth-lifetime.test.ts).
- [Chat mutation guards](../../apps/web/src/pages/claims-page.tsx), [browser regressions](../../apps/web/tests/claims-resilience.spec.ts).
- [Warehouse storage composition](../../apps/api-node/src/main/services.ts), [private provider adapter](../../apps/api-node/src/shared/infrastructure/cloudinary-private-media-storage.ts), [storage regressions](../../apps/api-node/src/shared/infrastructure/cloudinary-private-media-storage.test.ts).
- [Warehouse rollout and legacy evidence review](../runbooks/warehouse-media-rollout.md), [CI workflow](../../.github/workflows/ci.yml).

### Fresh Verification After Repairs

| Check | Result | Scope/limit |
| --- | --- | --- |
| `npm test` | 321 passed, 0 failed; 13 opt-in SQL entries skipped | Normal exit without force-exit; architecture: 187 production files, 0 violations; Web type check passed |
| Explicit isolated SQL suites | 42 passed, 0 failed, 0 skipped | MySQL 9.3 on task-owned loopback port 33312; real migration/repository/HTTP and custody/return regressions, never destructive integration tests on Aiven |
| `npm run build` | Passed | API and Web production builds |
| Full Playwright, two workers, line/JUnit reporters | 69 passed, 0 failed, 0 skipped | Desktop/mobile browser regressions; providers/API responses are mocked. Includes 12 chat-resilience tests. Ignored artifacts: `test-results/browser.xml` and `test-results/home/` |
| `npm audit --omit=dev --json` | 0 known vulnerabilities | Current production dependency/advisory response, not a security certificate |
| `npm run migrate:preflight` | Passed; no pending or superseded migrations | Read-only Aiven: 58 source migrations, 61 ledger entries, 28 APPLIED attempts; historical 053/055 limitations remain |
| UC catalogue check | 168 total: 97 Implemented, 17 Partial, 54 Planned | Counts unchanged; catalogue validation is not full product acceptance |
| Live Cloudinary warehouse smoke | Authenticated upload, equal delivery across independent adapters, unsigned direct access denied with 401, and disposable-asset cleanup passed | Synthetic one-pixel images, no identity document or shared DB row. Provider-normalized PNG is not byte-identical to input; this is not full role/restore/multi-instance API acceptance |
| Legacy warehouse inventory | 1 local intake reference and 15 local return-proof references; all 16 files available | Read-only DB inventory and local reads; no storage reference or business status changed |

### Remaining Actions Before Release

1. Review/authorize the historical-image rollout described in [warehouse-media-rollout.md](../runbooks/warehouse-media-rollout.md). Back up and restore-check the metadata and original volume before copying bytes, changing only unchanged storage references and retaining a protected old/new manifest and originals. Confirmation was requested; this repair does not silently migrate or delete historical shared evidence.
2. Complete staging Staff/Admin upload/delivery/privacy checks through two independent API instances, restart/restore and cleanup acceptance. A passing adapter smoke test is narrower evidence.
3. Review the combined pre-existing and new changes, then obtain authorized commit/push and green MySQL 8.0/8.4/browser CI for the exact candidate. Do not reuse an older green run as evidence for this tree.
4. Record representative provider/manual/privacy/physical-intake acceptance separately. No claim of full ASVS/WCAG, load/failover or provider-accuracy certification is made.

The three reported code/document findings are repaired locally. Production readiness remains conditional on R1/R2 and operational acceptance. The original score is not automatically raised by passing regressions; a new score/release decision requires those additional evidence sets.

## Authorized Execution Follow-Up - 5 October 2026

The latest request authorizes code/tests/docs, protected backup/restore, transfer of available historical warehouse images, meaningful commits authored by `Trần Thế Lượng <De180077trantheluong@gmail.com>` and push to `dev`. The eight pre-existing commits keep their original authors. Main is not merged; this request does not authorize historical migration/link recovery writes.

### Current Disposition

| ID | Result | Evidence and remaining scope |
| --- | --- | --- |
| A1 | Repaired and regression verified | JWT expiry timer; session/account validation before notification and bounded heartbeat; validation timeout/error fails closed, late disconnect cannot revive delivery, duplicate notifications deduplicated, registration errors remain JSON. Use-case and real HTTP regressions pass. Idle revocation remains bounded by the 25-second heartbeat, not synchronous distributed revocation. |
| A2 | Repaired and regression verified | Room ID/generation fencing for message, decision, photo, evidence and verification callbacks; old finally cannot unlock another pending send, A-B-A does not revive old mutations. Full browser suite passes, including delayed success/failure, decision/upload, room switch and same-room draft preservation. |
| A3 | Documentation reconciled | Current overview, BR/FR/UC, traceability, intake runbook, media receipt and migration-history review distinguish current operations from dated snapshots. Existing IDs extended only; catalogue stays 168/97/17/54, no blanket status promotion. |
| R1 | Observed legacy warehouse storage issue repaired; controlled provider acceptance passed | 16 original local references transferred after encrypted backup/restore. 0 conflicts/review entries/remaining local warehouse refs; all originals retained. Independent post-check verifies metadata/history/source/delivery. Real provider + authorized API role/independent-process/replacement/restart/cleanup checks passed on disposable loopback SQL. Actual production configuration, physical/manual privacy acceptance and non-warehouse legacy scope remain separate. |
| R2 | Exact code-candidate CI verified; deployment/manual acceptance separate | `dc925252c855afa0d34b30d26d8283e359849ef6` is pushed to dev and its MySQL 8.0/8.4 and browser jobs all passed. Checkout SHA, logs and artifacts were verified; see the receipt below. Any subsequent candidate must be checked again, and no production release/main merge approval is inferred. |

### Fresh Verification

| Check | Result | Scope/limit |
| --- | --- | --- |
| Normal `npm test` | 330 passed, 0 failed; 14 opt-in SQL entries skipped | No force-exit; architecture 191 production files/0 violations, Web type check passes |
| Full explicit isolated SQL | 45 passed, 0 failed, 0 skipped | Task-owned MySQL 9.3 loopback 33312; extra reference-only/CAS rollback/cleanup regressions and UTC/microsecond/epoch recovery check. Initial rerun failed because the restarted isolated server lacked the named test DB; created that test DB and reran all suites successfully. Never ran destructive tests on Aiven. JUnit: ignored `test-results/sql-rollout.xml` |
| API/Web build | Passed | Production TypeScript/Vite build |
| Full Playwright, two workers | 69 passed, 0 failed, 0 skipped | Mocked application/provider responses; desktop/mobile screenshots inspected, including compact three-column inventory and error/detail views. Ignored JUnit/screenshots under `test-results/` |
| `npm audit --omit=dev --json` | 0 known vulnerabilities | Fresh production dependency/advisory response, not complete security certification |
| Aiven read-only preflight | Passed; no pending/superseded migrations | 58 runnable source files, 61 applied entries, 28 APPLIED attempts; intentional 053 scope/055 unavailable-source warnings preserved |
| UC catalogue | 168 total: 97 Implemented, 17 Partial, 54 Planned | No status promotion based solely on tests |
| Safe rollout unit tests | 8 passed | AES tampering/no plaintext leakage, canonical delivery, journal ordering, ambiguous outcomes and conflict cleanup; included in normal test count |
| Original 053 archive regression | Passed | Exact Git-source checksum matches recorded historical checksum; archive excluded from 58 forward files |
| Protected full backup/restore | 64 tables, 3,758 rows, 16 source files verified | Full row/file fingerprints and FK checks on generated clone; same encrypted backup verified again with explicit UTC after transfer, earlier receipt retained |
| Authorized Aiven photo operation/post-check | 16 transferred/verified, 0 local references left | Only storage references changed; original/canonical SHA256 recorded separately; no changed uploader/date/relationship/state or ledger/attempt row |
| Live Cloudinary + real API | Passed | Staff/Admin privacy, outsider/anonymous denial, offline return, two compositions, separate Node process with empty disk and replacement, restart, draft cleanup, attached evidence retained, missing credentials fail without local writes. Synthetic assets/SQL clones cleaned; migrated historical assets retained |
| `git diff --check` | Passed | No whitespace errors; CRLF notices are informational |

### Protected Rollout and History Limits

The protected backup/manifest directory is `C:/Users/ADMIN/.codex/backups/lnfs-warehouse-media-20261005-75b8af`, owner/SYSTEM ACL only. Operation `audit-20261005-warehouse-media-75b8af` and encrypted journals retain old/new references and source/canonical hashes without publishing recipient data, keys or signed URLs. The original source volume is not deleted. [Warehouse media rollout](../runbooks/warehouse-media-rollout.md) records commands, hashes, unknown-COMMIT handling and rehearsed CAS rollback.

Historical 053 source was recovered from Git object `70911f6`, exact normalized SHA256 `63b1268a45409de6b4b12eb7473a3e5254459bd9da0e4db1c0c3497d9e4c4eef`, archived outside the forward runner. Read-only schema comparison found that the original disposition/legal-hold tables are absent and current custody has a different canonical representation. The full original scope remains uncertified; recovery is not an alias or blind replay. Original custody-time 055 SQL is still unavailable; current absence of `proposed_time` does not prove all original effects. The [separate history review](migration-history-review-2026-10-05.md) specifies evidence/backup/rehearsal and separate approval before any future recovery write. No applied SQL/checksum/ledger was rewritten, and 059 was not rerun.

### Remaining Acceptance

The exact code-candidate CI below passed; any subsequent candidate requires its own check, not reuse of that run. Production deployment configuration, representative provider/photo accuracy, SMTP end-to-end behavior, physical intake/identity privacy UAT, complete ASVS/WCAG, load/failover and incomplete product scope are not certified by the controlled tests. Historical 053/055 effects and previously flagged physical-source links remain scoped operator reviews, not automatically repaired business history. The historical 77/100 score is unchanged; this execution does not label the entire product done or main-merge ready.

## Commit and Remote CI Receipt

Four meaningful repair commits were pushed to `dev`; each has Author `Trần Thế Lượng <De180077trantheluong@gmail.com>`. Committer remains `Vo Chieu Quan <vochieuquan26@gmail.com>`; no global Git setting or existing author was changed.

| Commit | Scope |
| --- | --- |
| `2a89a69dc9406c12e91cead1d8515a8c6b0ed98a` | Backend session-bound SSE, private LOST/FOUND context, warehouse Cloudinary composition and regressions |
| `fb7dde6dd6e7b5a13c748b7aa577d74a71ab5472` | Guarded async chat mutations, error/retry, compact inventory and browser regressions |
| `530aaf1f92239166d55ee21421f00086cb927c46` | Safe journaled photo rollout, protected backup/UTC restore, isolated/live-provider acceptance and exact historical archive |
| `dc925252c855afa0d34b30d26d8283e359849ef6` | Reconciled audit/rules/requirements/traceability/runbooks and exact-artifact CI workflow |

[GitHub Actions run 37269042341](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37269042341) completed successfully for **exact SHA `dc925252c855afa0d34b30d26d8283e359849ef6`**, push event on `dev`, on 5 October 2026. Actual checkout SHA was checked in each job's logs, not inferred from a branch label.

- MySQL 8.0: normal root tests, **375 passed, 0 failed, 0 skipped**; architecture 191 production files/0 violations, production advisory audit 0 vulnerabilities, API/Web build passed.
- MySQL 8.4: the same **375 passed, 0 failed, 0 skipped**, architecture/audit/build passed.
- Browser: **69 passed**, exact checkout verified. [Browser JUnit/screenshots artifact 11327976310](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37269042341/artifacts/11327976310) is retained for 14 days; digest `sha256:61f242797111b4cbb5190ff1e6d5f0e8ffcf538e6916a3058debfe3d0e98c85a`.

This receipt documents the tested code candidate. The later documentation-only commit carrying this receipt must also receive its own post-push CI check; it does not silently inherit an older green status. Main remains untouched. The task-owned loopback MySQL server was orderly shut down after verification; user API/Web and other MySQL processes were not stopped.
