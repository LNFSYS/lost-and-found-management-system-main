# Migration History Review - 5 October 2026

This is a read-only history/schema review, not permission to replay SQL or rewrite ledger checksums. Warehouse photo-reference transfer is a separate, authorized operation described in [the media rollout](../runbooks/warehouse-media-rollout.md).

## Original 053 Recovered

The Git object `70911f6:apps/api-node/src/migrations/053_custody_and_guarded_disposition.sql` contains the exact historical SQL. Its normalized SHA256 is `63b1268a45409de6b4b12eb7473a3e5254459bd9da0e4db1c0c3497d9e4c4eef`, matching the recorded Aiven compatibility checksum.

An unchanged copy is retained in [historical/053_custody_and_guarded_disposition.sql](../../apps/api-node/src/migrations/historical/053_custody_and_guarded_disposition.sql). The historical directory is excluded from the forward runner; a regression checks both the checksum and exclusion. The SQL's duplicate foreign-key ALTER is retained verbatim, not repaired and represented as original SQL. It must not be executed blindly.

Read-only Aiven comparison on 5 October found:

- The original `custody_request_logs`, `disposition_orders`, `legal_holds`, `disposition_order_items` and `disposition_evidence` tables are absent. Current canonical `custody_request_audit` is present with 35 rows.
- Current custody uses `requester_id`, nullable TEXT `reason`, and no `finder_id` or `proposed_time`. Warehouse uses `legal_hold`, without the original `legal_hold_count`, `disposition_order_id` or `custody_request_id` columns.
- Canonical custody/warehouse schema is separately checked by migration preflight and runtime regressions. This does not prove every original disposition/legal-hold effect occurred or certify equivalent historical scope.

The exact ledger/attempt records are preserved. Recovering source text establishes its bytes, not successful execution of every statement or reconstruction of old business events. The intentional 053 scope warning therefore remains.

## Original 055 Still Unavailable

No exact `055_remove_proposed_time_from_custody.sql` was found in the available Git history, reviewed historical objects or available backup SQL sources. Recorded checksum: `97d256de30d11e39472fd6b69c7680e4272b3caa74e544841726c0030ee71c10`.

The observed canonical custody schema has no `proposed_time`; compatibility verifies that schema and exact record only. It does not prove that removing the column was the old SQL's only effect. No reconstructed SQL is labelled as the original, no checksum is changed, and no migration is replayed.

## Separate Recovery Plan, Not Executed

1. Preserve provider/database history, exact ledger/attempt records and encrypted metadata/media backups. Ask the original operator for the SQL/provider DDL/audit records if available.
2. Specify the required current business contract and compare original 053 scope with current columns, indexes, foreign keys, audit rows and disposition/hold requirements. Do not invent missing historical events or assume old table absence proves no old event existed.
3. Design an additive, independently numbered recovery only for confirmed current gaps. Include preconditions, idempotency, data provenance, before/after invariants and a rollback/unknown-commit procedure.
4. Restore the protected backup to an isolated generated loopback database with UTC sessions, rehearse the planned change twice, and verify all old history/business rows and foreign keys.
5. Obtain separate approval for that exact recovery write and operational target before applying it. Photo migration authorization does not authorize historical schema/link corrections.

Fresh read-only preflight: 58 forward source files, 61 applied ledger entries, 28 APPLIED attempts, no pending/superseded migrations. Both historical warnings remain. Migration 059 is already applied and was not rerun. No applied SQL or ledger record changed in this review.
