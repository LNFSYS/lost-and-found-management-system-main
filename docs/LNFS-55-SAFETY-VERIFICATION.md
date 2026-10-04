# LNFS-55 Safety Verification

Historical verification date: 2026-10-02. Workspace: `fptu-lost-found-system-main`; the original work was on `feat/lnfs-55`.
Remote: `LNFSYS/lost-and-found-management-system-main`. Updated status on 4 October: custody safety and matching are integrated into `dev` through `5ab9f0d` (PR #79); 059/060 are applied on Aiven. The test counts below retain the original recovery snapshot, not current release-wide evidence. Current local audit commits, test counts and release gates: [dev-main-audit-fixes.md](dev-main-audit-fixes.md).

## Verified Scope

- Owned active FOUND custody requests; participant/claim/room validation; actor-scoped immutable idempotency; serialized intake and physical-post uniqueness.
- Intake preserves claim/post ownership lifecycle; shared category-specific 120/90/3/60-day retention from physical UTC receipt.
- Generic warehouse status updates cannot bypass verified recipient/private proof, active-case/legal-hold or separate Admin disposition approval.
- Private proof references/authenticated retrieval; orphan metadata cleanup; transactional notification/outbox and after-commit realtime delivery.
- Staff custody-first intake/queue, server pagination/filters and warehouse detail/log/update workflows; same-page custody dialogs on matching/chat.
- Maintenance pauses on missing schema without business writes, resumes after schema verification, and logs safe failure metadata.
- Legacy matching history is preserved; own LOST suggestions are hidden; physical FOUND source is explicit for custody/ownership actions.

## Test Evidence

| Check | Evidence |
| --- | --- |
| API build | Passed after recovery implementation |
| Root tests / web TypeScript | 213 passed, 0 failed, 4 DB suites skipped; database evidence is recorded separately below |
| Architecture | 173 production files, 0 violations |
| Full isolated MySQL integration | 24 passed, 0 failed; local MySQL 9.3.0. Final added storage-link migration independently covered by recovery suite below |
| Final isolated recovery suite | 5 passed, 0 failed; includes dangling custody/storage references, preserved audit text, exact history/schema checks, idempotent quarantine and full backup restore |
| Actual Aiven snapshot rehearsal | 56 tables / 2,715 rows restored on loopback; all 5 pending migrations applied and repeated; old ledger and business rows preserved except reviewed dangling pointers/hold metadata; all FKs rechecked |
| Actual Aiven deployment | MySQL 8.4.8; 5 migrations applied, no pending/failed attempts; maintenance schema ready, all FKs valid |
| Actual API/maintenance | `/api/ready` returned ready. Real maintenance tick passed; preview found 0 reminders and 0 expired proofs, so no notifications or media deletion occurred |
| Web E2E/build | Earlier feature-branch run: 31 E2E passed and web build passed. Not rerun for this database-only recovery; not a claim of current release-wide acceptance |

Database details and backup locations: [recovery runbook](database-warehouse-recovery.md).

## Remaining Limits

- Two historical custody records still link to LOST posts without a verified physical FOUND source. They are recorded for manual review, not guessed/relinked. The linked warehouse item is already RETURNED; terminal state is preserved, no hold is applied retroactively.
- Original matching 054 SQL has since been recovered exactly and is immutable; custody-time 055 remains unavailable. Its exact checksum/current-schema verification does not prove the unavailable original effects. Recovery 057 remains an explicit forward contract, not a reconstructed original file.
- Full disposition order/evidence management UI, order rejection/cancellation and campaigns remain incomplete; schema alone does not complete those UCs.
- Stale claim/appointment and walk-in overdue producers, durable multi-instance private storage/crash-orphan reconciliation, and full SMTP/Gemini/provider/manual QA remain release work.
- Offline walk-in return is now supported through canonical recipient identity/contact and private proof without an account or invented claim; active online cases still block unlinked return. Feedback requires real linked claim/Finder participants. Follow-up custody verification supports an explicit Staff decision after intake, not automatic ownership transfer.
- UC catalogue statuses are not upgraded from Jira status, branch-only implementation or schema presence. Team PR/manual QA and merge/release decisions remain separate.
