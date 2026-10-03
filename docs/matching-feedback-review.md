# Matching Feedback and Periodic Refresh

Scope: UC-098, UC-099, UC-100. UC-097 new-match notifications are excluded. No new UC is introduced.
Base: dev@03c7bda (PR #77). Matching code is reviewed through PR #79.

## Runtime Contract

- GET /api/posts/:id/matches?page=1&pageSize=20 and POST /api/posts/:id/matches/recalculate with the same query return total, page, pageSize, hasMore, stable score/date/id order, private-signal redaction and actor-scoped saved feedback/dismissals.
- Recalculate preserves viewer scope; an owner-dismissed suggestion never automatically resurfaces. Own LOST candidates are removed before pagination; permitted inactive history remains readable, deleted/hidden data stays guarded.
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
- 060_matching_refresh_leases.sql adds lease_token and lease_expires_at with schema existence checks. It is NEW and has NOT been applied to Aiven by this work.
- Before shared rollout: read npm run migrate:preflight, confirm endpoint/database, take a recoverable backup and apply through npm run migrate. Do not re-run 054/059 manually, modify checksums or erase attempt history.
- Until 060 exists with the correct types, the refresh worker pauses with MATCHING_LEASE_SCHEMA_REQUIRED and checks again on later polls. Existing API/business workflows are not blocked by this worker gate.

## Verification on 3 October 2026

- npm test, without force-exit: architecture/Web type checks pass; API 236 pass, 0 fail, five isolated suites skipped and executed separately below. The test process exits naturally.
- npm run build: API and Web pass.
- Full isolated integration, MySQL 9.3 on loopback port 33308: 29/29 pass across database, migration reconciliation, custody safety, recovery and matching refresh suites.
- New real HTTP checks cover 25 results/page 2, metadata, owner-scoped recalculate after dismissal, feedback persistence/replay, opposite-owner isolation, private-signal redaction and Staff/Admin write denial.
- New SQL checks cover fresh/original-054/dev-057 upgrades, unchanged history/timestamps/legacy labels, repeat migration, drift rejection, two concurrent connections, stale completion/failure/heartbeat/persistence rejection, closed jobs and five-attempt exhaustion.
- Full Playwright: 36/36 pass. Pagination/recalculate browser regression and desktop/mobile screenshots were inspected; no horizontal overflow. Browser cases mock API and are not provider/production acceptance tests.
- UC catalogue checker: 168 total = 97 Implemented + 8 Partial + 63 Planned. UC-098/099/100 retain Partial pending reviewed merge/manual QA.
- PR-target CI now includes dev; remote matrix MySQL 8.0/8.4 and merge result remain gates to check before merge.
- Test script globs are quoted so Linux shells do not truncate recursive test discovery. Before this correction, remote CI ran only 66 tests including integration, omitting nested module/shared tests despite a green result.
- No shared Aiven migration/data correction, SMTP/Gemini call or remote API/Web deployment was performed. Temporary database/preview processes were stopped after verification.

## Linked Requirements

FR-MATCH-06/07/08; BR-61/62/63/64; NFR-DATA-01/02.
Requirements, business rules, UC and traceability were updated together.
Full manual role/privacy QA, production rollout and UC-097 notification delivery remain separate work.
