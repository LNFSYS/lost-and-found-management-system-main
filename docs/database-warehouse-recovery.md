# Warehouse Database Recovery

## Scope and History

**3 October 2026 update:** the matching branch recovered the exact original `054_matching_feedback_periodic_refresh.sql`, normalized SHA256 `404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d`. The 2 October unavailable-source statements below are retained as historical recovery context, not the current status of matching 054. Its original SQL is immutable. A database with the original applied record skips it; a database with reviewed 057 but no 054 record uses schema-verified, read-only supersession without inventing history or converting legacy labels. New worker lease fields belong to `060_matching_refresh_leases.sql`. This update does not apply 060 on Aiven or deploy API/Web. Original custody-time 055 remains unavailable.

This is forward recovery on `feat/lnfs-55`, not a reconstruction of missing applied SQL.
The user authorized creating and applying the missing runtime schema on Aiven on 2026-10-02.

The shared ledger already contains these unavailable source files:

| Ledger version | Recorded checksum | Recovery evidence |
| --- | --- | --- |
| `054_matching_feedback_periodic_refresh.sql` | `404c6ac5d3b9424db1a82eef2238924ac5f2ef36366c89fd4ed03b97ab60853d` | Exact ledger/attempt plus verified matching tables, columns, labels, indexes and foreign keys |
| `055_remove_proposed_time_from_custody.sql` | `97d256de30d11e39472fd6b69c7680e4272b3caa74e544841726c0030ee71c10` | Exact ledger/attempt plus current custody baseline and absence of `proposed_time` |

Their original data/configuration effects remain **unverified**. Compatibility recognizes only those exact records and observed schemas; it does not alias, replay, delete, rename or rewrite ledger rows. Unknown checksums, incomplete attempts and schema drift still stop migration before DDL. No claim is made that periodic refresh/feedback APIs are implemented on this branch merely because tables exist.

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

- Backup: 56 tables, 2,715 rows, authenticated AES-256-GCM, compressed; round-trip verified. Stored outside Git in `C:/Users/ADMIN/.codex/backups/lnfs-aiven-20261002/lnfs-20261002053200297.aes`, with separate `.key`. Windows access is restricted to the owner and SYSTEM. Keep both for recovery; do not upload the key to source control.
- Loopback MySQL 9.3.0: restored every table/row, explicitly reproduced the two known orphan FKs, applied all five pending migrations, reran without replay, compared original ledger/business rows and rechecked all FKs. Quarantine rerun was idempotent. Temporary clone databases were dropped after verification.
- Shared Aiven MySQL 8.4.8: applied `053_custody_requests.sql`, `054_custody_safety_contract.sql`, `056_warehouse_runtime_recovery.sql`, `057_matching_feedback_recovery_contract.sql`, `058_storage_link_recovery.sql`. Preflight: 57 applied ledger entries, 24 APPLIED attempts, **no pending migrations**, intentional unavailable-history warnings only. No original checksum/timestamp was rewritten.
- All shared FKs rechecked successfully. One custody pointer and one storage-log pointer to nonexistent items were archived then cleared. Two LOST-linked custody requests were recorded for manual review, **not relinked/resolved**. Their linked warehouse item is already RETURNED, so terminal state was preserved and no hold was applied retroactively.
- Maintenance schema probe: `ready: true`, missing objects: none. A real maintenance tick passed after a preview found 0 overdue reminders and 0 expired proofs; no notification/media deletion was triggered by that smoke test. Existing API `/api/ready` returned ready.
- Verification: root tests 213 passed / 0 failed / 4 DB suites skipped; architecture 173 production files / 0 violations; full isolated integration 24 passed before final storage-link addition, and final recovery suite 5 passed after that addition; API build passed. No E2E/provider/manual QA or remote application deployment is claimed by this recovery.

The Aiven **database** deployment is complete. Local code/doc changes remain uncommitted/unpushed on `feat/lnfs-55`; this does not deploy remote API/web services or change dev/main UC status.
