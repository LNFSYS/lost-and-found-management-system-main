# Matching Feedback and Periodic Refresh

Scope: UC-098, UC-099, UC-100. UC-097 new-match notifications are excluded. No new UC is introduced.
Updated 4 October 2026. Matching was merged into `dev` by PR #79 (`5ab9f0d`); source-owner pagination correction is recorded in `2bd63cc`. These local audit commits are not a remote application deployment. Current verification: [dev audit fixes](dev-main-audit-fixes.md).

## Runtime Contract

- GET /api/posts/:id/matches?page=1&pageSize=20 and POST /api/posts/:id/matches/recalculate with the same query return total, page, pageSize, hasMore, stable score/date/id order, private-signal redaction and actor-scoped saved feedback/dismissals.
- Recalculate preserves viewer scope; an owner-dismissed suggestion never automatically resurfaces. LOST candidates belonging to the source owner are removed before totals/pagination for owner, Staff and Admin alike. Viewer-scoped feedback/dismissals remain separate; serialization only maps/redacts the already filtered page. Permitted inactive history remains readable; deleted/hidden data stays guarded.
- Only the source owner can write feedback/dismissal. Staff/Admin can inspect/recalculate without rating on the owner's behalf. Pair eligibility remains required for writes.
- Feedback: USEFUL / IRRELEVANT / INCORRECT, optional note up to 500 characters and correlationKey 8-128 characters. Dismissal uses the same key contract and optional reason. Exact replay returns the original record; conflicting/reused keys return 409.
- Feedback/dismissal do not create claims, decide ownership, change appointments, close posts or complete custody.
- Existing FOUND custody choices/modal, physical-source chat linkage and inactive history from dev are retained.
- Refresh uses stored signals, not a live Gemini/OCR request. Defaults: enabled, polling 300 seconds, eligibility interval 6 hours, batch size 20, lease 15 minutes.
- Claims are just-in-time, not a preclaimed sequential batch. Each claim has a unique lease token with expiry and heartbeat at half the lease interval. Persistence, renew, complete and fail require the current unexpired token; stale workers cannot overwrite a new lease or its results.
- Closed/deleted jobs become FAILED. Transient failures back off 15 minutes and stop after five attempts; exhausted jobs do not loop automatically. Successful scheduled jobs reset the next legitimate attempt budget. Shutdown drains the current worker before closing its pool.

## Migration Safety and Rollout

- Historical 054_matching_feedback_periodic_refresh.sql is the recovered original, normalized SHA256 404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d. Neither original 054 nor applied 057 SQL has been edited.
- Fresh database: run original 054, recovery 057 and additive 060 normally.
- Original-054 history: skip 054 using the original ledger/checksum; preserve applied_at and schema history.
- Dev-with-057 but no 054 record: require exact reviewed 054/057 source checksums, the applied 057 checksum, no incomplete attempts and the full feedback/dismissal/job schema verifier. Report 054 as superseded by 057 in a read-only plan; do not replay label conversion or write fake APPLIED rows.
- Drifted schema/unknown checksum blocks DDL. Historical custody-time 055 remains separately schema-verified; it is not replaced by a weaker duplicate verifier.
- 060_matching_refresh_leases.sql adds lease_token and lease_expires_at with schema existence checks. It was applied to Aiven `defaultdb`, MySQL 8.4.8, on 3 October 2026; the rollout receipt was verified at 14:57:12 UTC. The encrypted 61-table/3,500-row backup was restored and rehearsed in isolation; old history, business row fingerprints and foreign keys were preserved.
- Read-only `npm run migrate:preflight` on 4 October reports 56 source migrations, 59 applied entries, 26 applied attempts and no pending migrations. Historical 053 scope and unavailable original custody-time 055 warnings remain intentional. Do not re-run 054/059/060 manually, modify checksums or erase attempt history. Future shared DDL still requires endpoint confirmation, recoverable backup and isolated rehearsal.
- Until 060 exists with the correct types, the refresh worker pauses with MATCHING_LEASE_SCHEMA_REQUIRED and checks again on later polls. Existing API/business workflows are not blocked by this worker gate.

## Verification on 3 October 2026

- npm test, without force-exit: architecture/Web type checks pass; API 236 pass, 0 fail, five isolated suites skipped and executed separately below. The test process exits naturally.
- npm run build: API and Web pass.
- Full isolated integration, MySQL 9.3 on loopback port 33308: 29/29 pass across database, migration reconciliation, custody safety, recovery and matching refresh suites.
- New real HTTP checks cover 25 results/page 2, metadata, owner-scoped recalculate after dismissal, feedback persistence/replay, opposite-owner isolation, private-signal redaction and Staff/Admin write denial.
- New SQL checks cover fresh/original-054/dev-057 upgrades, unchanged history/timestamps/legacy labels, repeat migration, drift rejection, two concurrent connections, stale completion/failure/heartbeat/persistence rejection, closed jobs and five-attempt exhaustion.
- Full Playwright: 36/36 pass. Pagination/recalculate browser regression and desktop/mobile screenshots were inspected; no horizontal overflow. Browser cases mock API and are not provider/production acceptance tests.
- Historical UC catalogue checker: 168 total = 97 Implemented + 8 Partial + 63 Planned. UC-098/099/100 remain Partial for manual role/privacy QA and operational acceptance, not because PR #79 is unmerged. Current catalogue totals are in [uc.md](uc.md).
- PR-target CI includes dev. The merged baseline `5ab9f0d` passed the [MySQL 8.0/8.4 matrix and browser/build checks](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37123734681). That run does not validate the later local audit commits; their remote CI is still a release gate.
- Test script globs are quoted so Linux shells do not truncate recursive test discovery. Before this correction, remote CI ran only 66 tests including integration, omitting nested module/shared tests despite a green result.
- The initial branch review did not apply shared DDL or call SMTP/Gemini. The later authorized 060 database rollout is recorded above and in [database recovery](database-warehouse-recovery.md); it is not a remote API/Web deployment. Temporary review database/preview processes were stopped after verification.

## Verification on 4 October 2026

- Normal `npm test`: API 274 passed, 0 failed, five database suites skipped deliberately; architecture and Web type checks passed. No force-exit flag was used.
- Full isolated MySQL 9.3 integration: 31 passed, 0 failed, 0 skipped. Owner/Staff/Admin `pageSize=1` HTTP checks exclude the source owner's LOST before pagination and preserve permitted inactive results.
- Full Playwright: 39 passed, 0 failed; API/Web production builds passed. Browser API calls are mocked; real SQL/HTTP contracts are covered separately.
- Shared Aiven access in this audit was read-only preflight. No new migration is needed for the four audit fixes. Manual role/privacy QA and remote CI for the new commits remain separate gates.

## Linked Requirements

FR-MATCH-06/07/08; BR-61/62/63/64; NFR-DATA-01/02.
Requirements, business rules, UC and traceability were updated together.
Full manual role/privacy QA, production rollout and UC-097 notification delivery remain separate work.
