# Warehouse Database Recovery

Latest operational follow-up: [5 October warehouse-media rollout](warehouse-media-rollout.md) and [053/055 history review](../audits/migration-history-review-2026-10-05.md). The dated records below remain historical snapshots, including their then-local commit/push status.

## Scope and History

**4 October 2026 status:** the exact original `054_matching_feedback_periodic_refresh.sql` has been recovered, normalized SHA256 `404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d`, and is immutable. A database with its original applied record skips it; reviewed 057-only history uses schema-verified, read-only supersession without inventing history or converting legacy labels. Migration 059 is already applied; 060 was applied on 3 October after backup and isolated rehearsal. Additive 061/062 were applied on 4 October after a new encrypted backup and isolated restore/repeat-run rehearsal. Current preflight reports no pending migrations and the warehouse schema probe is ready. Original custody-time 055 remains unavailable. See the rollout records below; older unavailable-source statements refer to the 2 October snapshot only.

The original forward recovery was developed on `feat/lnfs-55` and is now integrated into `dev`; it is not a reconstruction of missing applied SQL.
The user authorized creating and applying the missing runtime schema on Aiven on 2026-10-02.

The 2 October shared-ledger snapshot contained these unavailable source files:

| Ledger version | Recorded checksum | Recovery evidence |
| --- | --- | --- |
| `054_matching_feedback_periodic_refresh.sql` | `404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d` | Exact ledger/attempt plus verified matching tables, columns, labels, indexes and foreign keys |
| `055_remove_proposed_time_from_custody.sql` | `97d256de30d11e39472fd6b69c7680e4272b3caa74e544841726c0030ee71c10` | Exact ledger/attempt plus current custody baseline and absence of `proposed_time` |

At that snapshot their original data/configuration effects were **unverified**. Matching 054's exact SQL is now recovered; custody-time 055's effects remain unverified. Compatibility recognizes only exact records and observed schemas; it does not alias, replay, delete, rename or rewrite ledger rows. Unknown checksums, incomplete attempts and schema drift still stop migration before DDL. Matching feedback/refresh runtime is now present in `dev` with separate code/test evidence in [matching review](../audits/matching-feedback-review.md), not inferred from table presence.

## Forward Migrations

- `053_custody_requests.sql`: canonical runtime custody tables; historical 053 is not an equivalent alias.
- `054_custody_safety_contract.sql`: private proofs, approvals, completed returns, physical source and concurrency guards. A dangling warehouse pointer is first archived in recovery evidence and cleared; lifecycle states remain unchanged.
- `056_warehouse_runtime_recovery.sql`: missing retention index and separate operator linkage-review evidence.
- `057_matching_feedback_recovery_contract.sql`: reproducible source/idempotency/dismissal schema. All five original and three observed feedback labels are preserved, with no meaning conversion or automatic status updates. No periodic scheduler is invented or enabled.
- `058_storage_link_recovery.sql`: archive then clear nonexistent warehouse references on storage logs; retain the log content, actor and lifecycle evidence.

`storage_logs.action` can use the canonical enum or the audited legacy `VARCHAR(40)` representation. Existing actions are not truncated/relabelled to force an enum conversion.

## Apply Procedure

1. Compare all ledger/attempt records, live metadata, pending SQL and duplicate physical-post counts. Confirm the configured endpoint and database explicitly.
2. Capture a consistent read-only InnoDB schema/data snapshot. Store it encrypted outside Git, with a separate restricted key. This application snapshot does not replace provider PITR/backups and does not include external media.
3. Restore to a generated loopback `lnfs_recovery_<uuid>_test` database. Verify rows and foreign keys, apply pending migrations, run migration again, compare old ledger and business rows, and rehearse linkage quarantine. Local MySQL version differences must be reported.
4. Apply through the existing migration runner/session lock. MySQL DDL auto-commits: if an attempt fails, stop and inspect the partial schema; do not blindly retry or erase history.
5. Run preflight and the maintenance schema probe again. The probe must report `ready: true`; unavailable history warnings remain intentional.

## Invalid Historical Links

Two audited custody records were linked to LOST posts and a requester other than the post owner. One was pending and one was already intaked. There is no verified physical FOUND source for either.

Restore rehearsal also found one request pointing to a nonexistent warehouse item. Its original pointer is retained in recovery evidence before the nullable pointer is cleared. No replacement item or physical source is fabricated. Restore normally rejects orphan foreign keys; this exact known constraint/count is explicitly allowed only for isolated reproduction, then must be repaired and rechecked.

A complete foreign-key audit found one additional storage log with a nonexistent warehouse reference. Migration 058 preserves that pointer in `warehouse_link_recovery_evidence` and clears only the nullable reference; no audit row/text is removed.

`recoverCustodyLinks` defaults to a read-only preview. Applying requires an exact database and operation reference. It records original IDs/statuses in `custody_link_recovery_reviews`, puts nonterminal linked warehouse items on legal hold, and is idempotent. It does **not** guess a FOUND post, impersonate a user in custody audit, cancel/approve claims, revert lifecycle statuses or reopen posts.

Run `npm --workspace @lnfs/api-node run migrate:review-custody-links` for a preview. Applying additionally requires `--apply --confirm-database <name> --confirm-endpoint <host:port> --operation-ref <approved-review-reference>`, after backup and isolated rehearsal.

Staff acceptance and intake require a valid owned active FOUND source. Actual relinking remains a manual prerequisite: verify the physical item, actual finder, corresponding FOUND post and participant consent, then perform a separately reviewed transactional correction with before/after evidence. These records must not be marked resolved until that evidence exists.

Thirty direct conversations on LOST posts had no stored FOUND source in the initial audit. This alone does not make a conversation invalid; no bulk assignment or deletion is permitted.

## Verification Record

Executed on 2026-10-02:

- Backup: 56 tables, 2,715 rows, authenticated AES-256-GCM, compressed; round-trip verified. Stored outside Git in `<protected-backup-dir>`, with separate `.key`. Windows access is restricted to the owner and SYSTEM. Keep both for recovery; do not upload the key to source control.
- Loopback MySQL 9.3.0: restored every table/row, explicitly reproduced the two known orphan FKs, applied all five pending migrations, reran without replay, compared original ledger/business rows and rechecked all FKs. Quarantine rerun was idempotent. Temporary clone databases were dropped after verification.
- Shared Aiven MySQL 8.4.8: applied `053_custody_requests.sql`, `054_custody_safety_contract.sql`, `056_warehouse_runtime_recovery.sql`, `057_matching_feedback_recovery_contract.sql`, `058_storage_link_recovery.sql`. Preflight: 57 applied ledger entries, 24 APPLIED attempts, **no pending migrations**, intentional unavailable-history warnings only. No original checksum/timestamp was rewritten.
- All shared FKs rechecked successfully. One custody pointer and one storage-log pointer to nonexistent items were archived then cleared. Two LOST-linked custody requests were recorded for manual review, **not relinked/resolved**. Their linked warehouse item is already RETURNED, so terminal state was preserved and no hold was applied retroactively.
- Maintenance schema probe: `ready: true`, missing objects: none. A real maintenance tick passed after a preview found 0 overdue reminders and 0 expired proofs; no notification/media deletion was triggered by that smoke test. Existing API `/api/ready` returned ready.
- Verification: root tests 213 passed / 0 failed / 4 DB suites skipped; architecture 173 production files / 0 violations; full isolated integration 24 passed before final storage-link addition, and final recovery suite 5 passed after that addition; API build passed. No E2E/provider/manual QA or remote application deployment is claimed by this recovery.

## Earlier Rollout Record (Through 060)

- The warehouse recovery and matching feature are integrated into `dev` through `5ab9f0d` (PR #79). Their earlier branch/uncommitted statements are historical, not current rollout status. Four follow-up audit fixes are local commits, not yet pushed in this audit.
- `059_direct_return_recipient.sql` was applied on 2 October 2026 at 07:15:32 UTC. It supports identity/contact records for direct offline recipients without creating an account or synthetic claim. Do not apply it again.
- `060_matching_refresh_leases.sql` was applied on 3 October; receipt verification at 14:57:12 UTC confirms `char(36)` token, `datetime(6)` expiry, unchanged old history, valid foreign keys and a ready worker schema. The encrypted backup contains 61 tables/3,500 rows; isolated MySQL 9.3 restore/repeat-run rehearsal preserved business row fingerprints. The later runtime receipt at 15:03:34 UTC recorded API readiness and 26 refresh completions since apply.
- Restricted receipt: `<protected-backup-dir>`. Backup and separate key remain outside Git; the key is not part of the delivery artifact.
- Read-only `npm run migrate:preflight` on 4 October 2026: 56 source migrations, 59 applied entries, 26 applied attempts, no pending/superseded migrations. Only the historical 053 scope and unavailable original custody-time 055 warnings remain. No ledger checksum/timestamp was modified.
- No new migration or shared data correction was run for the four audit fixes. The two LOST-linked custody records still require physical-source review; this rollout does not resolve them. Database readiness does not certify remote application deployment or every UC.
- Current tests and release limits: [dev audit fixes](../audits/dev-main-audit-fixes.md). SQL integration ran on isolated MySQL 9.3, not the shared Aiven service.

## Physical Intake and Contact Rollout (4 October 2026)

- The updated API paused warehouse maintenance because exactly `warehouse_intake_sessions`, `warehouse_intake_images` and `lost_contact_photo_checks` were absent. Read-only preflight listed only 061/062 pending; this was missing additive schema, not a credentials or connection failure.
- New backup: 61 tables / 3,585 rows, consistent read-only InnoDB snapshot with string-preserved date/time precision, authenticated AES-256-GCM and verified decrypt round trip. Directory `<protected-backup-dir>` is restricted to the owner and SYSTEM. Encrypted backup and separate key remain outside Git; external media/provider backups are not included.
- Restored to generated loopback MySQL 9.3.0. Initial row fingerprints matched the backup; applying exactly 061/062 preserved every old business row, table definition and ledger record. Only the three new empty tables and two successful ledger/attempt entries were added. A second migration run changed nothing; all foreign keys and the maintenance probe passed. The disposable clone was dropped.
- Shared Aiven MySQL 8.4.8 apply/post-verification completed at `2026-10-04T12:48:48.350Z` (19:48:48 UTC+07). The existing runner and session lock applied only `061_warehouse_intake_evidence.sql` and `062_lost_contact_photo_checks.sql`. All original ledger checksums/timestamps and existing table definitions were preserved; all foreign keys passed. Concurrent application business writes were not fingerprint-compared on the shared DB.
- Post-apply `npm run migrate:preflight`: 58 source migrations, 61 applied entries, 28 APPLIED attempts, no pending/superseded migrations. Warehouse schema: `ready: true`, `missing: []`. The existing local API on port 3001 returned `/api/ready` ready and `/api/health` ok. Maintenance rechecks schema every 60 seconds; it does not require disabling its guard.
- Restricted operational receipt: `061-062-rollout.json` in the backup directory above. Focused migration/backup/maintenance tests: 17 passed, 0 failed, normal process exit. This rollout did not replay 054/059, rewrite history or perform custody-link recovery.
- Historical 053/055 warnings and the two LOST-linked custody records still require the separately documented review. Schema readiness does not certify real Gemini quality, durable private media, manual role/privacy acceptance, remote application deployment or every UC. The four feature commits remain local on `dev`; no push/merge is claimed by this schema rollout.

## Actor Journey Audit Follow-Up

The later LOST/custody participant, atomic source-deletion and read-only legacy repairs require no new SQL migration. The TypeScript claim schema verifier accepts complete canonical direct-LOST roles as well as recognized migration-045 legacy roles; missing participants still block verification. Applied SQL, checksums and ledger history remain unchanged. The participant repair command was not run.

The follow-up ran only read-only Aiven `migrate:preflight`: 58 source migrations, 61 applied entries, 28 APPLIED attempts and no pending/superseded migrations; historical 053/055 warnings remain. All destructive regression work ran on a task-owned temporary loopback MySQL instance. No shared custody-link correction or automatic restoration of deleted sources occurred. Current tests, scoped commits and deployment limits: [full-system audit](../audits/full-system-audit-2026-10-04.md).

## Warehouse Media Follow-Up (5 October 2026)

The authorized photo operation backed up 64 tables/3,758 rows and all 16 source files, rehearsed full isolated restore, then changed only 16 unchanged warehouse `storage_ref` values to authenticated Cloudinary references. Post-check confirms source/canonical hashes, original retention, unchanged other row fields and unchanged migration ledger/attempts; no new DDL or custody-link correction was run. A second UTC-explicit restore matched all row/file fingerprints and preserved fractional timestamp precision. Receipts and limits are in [warehouse-media-rollout.md](warehouse-media-rollout.md).

Original historical 053 SQL was recovered exactly from Git object `70911f6` and archived outside the forward runner, matching checksum `63b1268a45409de6b4b12eb7473a3e5254459bd9da0e4db1c0c3497d9e4c4eef`. Missing old disposition/hold tables mean its full historical scope is still not certified. Original custody-time 055 remains unavailable. Read-only preflight still reports 58 source/61 ledger/28 attempts and no pending/superseded migrations, with both intentional warnings. See [the separate review/recovery plan](../audits/migration-history-review-2026-10-05.md); it authorizes no historical recovery writes.
