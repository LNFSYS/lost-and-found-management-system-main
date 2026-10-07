# Warehouse Media Rollout

Updated: 5 October 2026. This runbook addresses audit R1 without rewriting applied SQL, changing custody/claim state or publishing recipient identity photos.

## Current Contract

- New intake and return-proof uploads use `createCloudinaryPrivateMediaStorage` with namespace `warehouse-proof` when all Cloudinary credentials are present.
- Assets are uploaded with `type: authenticated`, stable opaque references are stored in MySQL, and signed provider delivery is fetched by the server. Clients still receive only the Staff/Admin-authorized warehouse media/proof endpoints, never a raw provider URL.
- Production (`NODE_ENV=production`) refuses new local warehouse writes if Cloudinary is not configured. A configured provider upload failure also never falls back to disk.
- Development/test can use local storage when credentials are absent. Legacy `private://warehouse-proof/...` references still resolve/remove through the local adapter.
- Existing files are not automatically copied or discarded. A new adapter cannot recreate missing bytes from database metadata. Keep the old instance/upload volume until legacy evidence has been reviewed and safely migrated.
- New references fit the existing storage columns; no schema migration or ledger/checksum change is required.

## Provider and Deployment Acceptance

1. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in server secrets; do not expose them to Vite or commit `.env`.
2. Use a staging database and test identities. Staff uploads an intake photo and a return proof through the normal API. Check that the DB references use `cloudinary://warehouse-proof/` and that unauthenticated/non-Staff requests cannot retrieve the images.
3. Start a second API instance with the same staging DB and credentials but a different, empty upload directory. Retrieve both images through its authorized proxy; compare delivery bytes between instances and verify content against the fixtures. Provider format normalization may change bytes from the original upload: retain and record original and delivered checksums separately, rather than claim byte-identical preservation.
4. Restart/replace the first instance and repeat delivery. Verify anonymous direct provider requests cannot fetch the authenticated assets.
5. Simulate absent/failed provider credentials: upload must fail with a controlled error, create no committed proof/image row and not write an instance-local fallback in production.
6. Exercise draft cleanup and a real return in staging. Confirm cleanup does not remove attached evidence, and participant feedback/status gates remain unchanged.
7. Record the candidate commit, environment, dates, masked provider identifiers and results. Test account images must not contain real identity documents. Delete disposable smoke assets afterwards.

Automated independent-adapter, authenticated-delivery, strict-mode and failure regressions are in `cloudinary-private-media-storage.test.ts`; real provider, restore and deployment acceptance are separate requirements.

The opt-in live acceptance command is `node --import tsx apps/api-node/src/migrations/verify-warehouse-cloud.ts` with `LNFS_DB_INTEGRATION=1`, explicit loopback `LNFS_TEST_DB_*` credentials and real server-only Cloudinary secrets. It creates/drops its own generated SQL fixture and synthetic assets, exercises actual HTTP/multipart endpoints and a separate API process, and prints only aggregate results. Do not point it at production/Aiven. It must pass before recording controlled provider/API acceptance, and it does not replace physical/manual UAT.

## Legacy Evidence Review

Run the following aggregate-only checks with read-only access, not destructive integration tests on Aiven:

```sql
SELECT 'intake' AS kind, COUNT(*) AS local_references
FROM warehouse_intake_images
WHERE storage_ref LIKE 'private://warehouse-proof/%'
UNION ALL
SELECT 'return' AS kind, COUNT(*) AS local_references
FROM warehouse_private_proofs
WHERE storage_ref LIKE 'private://warehouse-proof/%';
```

Before any copy/update, back up both table metadata and the original upload volume into access-controlled storage and verify restore. Inventory each original file by its opaque reference, byte size and checksum. Missing files require a separately authorized incident/source review, not synthetic replacement or silent deletion of evidence rows.

A reviewed copy process must upload original bytes as authenticated assets, verify delivery/content and record original/canonical checksums, then conditionally replace only the same row's unchanged `storage_ref` and record old/new references in an access-controlled manifest. Preserve image IDs, uploader, timestamps, provenance and all custody/return relationships. Coordinate with draft cleanup and active uploads. A conflicting/deleted row must not be overwritten; unused newly uploaded assets must be cleaned up. Retain the original volume and manifest through the restore/rollback acceptance period. Do not blanket-update refs or delete local files first.

The initial adapter-only repair did not run such a migration. The later explicitly authorized execution below transferred the inventoried warehouse images; it does not certify all post/claim media or an untested production environment.

Earlier adapter-only evidence: one local intake reference and 15 local return-proof references, all available; no reference was updated at that stage. Synthetic smoke assets verified private delivery and normalization and were removed. That snapshot is superseded for warehouse references by the authorized execution below, not by an assumption that the adapter copied files automatically.

## Guarded Operator Commands

Run from the repository root. The default command is read-only inventory. The Node entrypoint avoids PowerShell/npm option-forwarding differences. Do not use integration tests against Aiven.

```powershell
node --import tsx apps/api-node/src/migrations/run-warehouse-media-rollout.ts
node --import tsx apps/api-node/src/migrations/run-warehouse-media-rollout.ts --prepare --backup-dir <protected-empty-directory-outside-Git>
```

Set explicit `LNFS_TEST_DB_HOST=127.0.0.1`, port/user/password and an isolated `LNFS_TEST_DB_NAME` ending in `_test`. Verification creates and drops its own generated recovery clone; it never restores into Aiven or an existing database.

```powershell
node --import tsx apps/api-node/src/migrations/run-warehouse-media-rollout.ts --verify --backup-dir <protected-directory>
node --import tsx apps/api-node/src/migrations/run-warehouse-media-rollout.ts --apply --backup-dir <protected-directory> --confirm-database <exact-database> --confirm-endpoint <exact-host:port> --operation-ref <approved-reference>
node --import tsx apps/api-node/src/migrations/run-warehouse-media-rollout.ts --check --backup-dir <protected-directory>
```

Prepare stores an encrypted consistent database snapshot and the complete warehouse source volume with separate keys, verifies round trips and rejects missing/changed files. Verify restores rows/FKs and source files, compares every row fingerprint and file checksum, and writes a hash-bound `restore-check-utc.json`. SQL session UTC and string-preserved fractional timestamps are explicit; existing receipts are not overwritten.

Apply requires that receipt and exact database/endpoint confirmations. It journals each planned opaque reference before upload, verifies independent canonical delivery, locks intake parents in cleanup order and conditionally changes only the original row's `storage_ref`. Conflict handling removes only an unreferenced new asset. Unknown provider/COMMIT/cleanup outcomes stop the batch and retain the planned reference in an encrypted `REVIEW_REQUIRED` journal; reconcile DB and provider before any retry. Never delete an asset simply because a client saw a COMMIT error.

Check compares non-reference metadata and ledger/attempt rows with the snapshot, original file hashes and canonical provider delivery hashes. Archives/journals/receipts must stay access-controlled outside Git. No original source file is removed. An approved rollback must verify the original bytes, lock the same parent/row and CAS the still-matching new reference back to its original reference; it must not alter status, relationships or history. This CAS rollback is rehearsed in isolated SQL, not performed on shared migrated rows.

## Authorized Execution Receipt - 5 October 2026

- Fresh inventory confirmed 1 intake and 15 return-proof local references, all 16 source files present.
- Backup: 64 InnoDB tables, 3,758 rows and the entire 16-file warehouse source volume. AES-256-GCM round trips passed; the external directory is restricted to the owner and SYSTEM. Database SHA256 `b8a0b56c8ed237cb5420b93e62556b1c4dd33413ea3ef8c8e7d463da109278cc`; volume SHA256 `679df1fcc9a8b737254c008ac23f7aa5a4f555505f2220c5210adbac7245438c`.
- Full isolated MySQL 9.3 restore/FK/row-fingerprint/file verification passed before transfer. An additional explicit-UTC restore check passed afterwards, preserving the earlier receipt and the same backup hashes; the regression verifies microseconds and UTC epoch across +07/-05 sessions.
- Authorized operation `audit-20261005-warehouse-media-75b8af`: 16 authenticated Cloudinary uploads and conditional reference updates, 0 conflicts, 0 review-required entries, 0 remaining local warehouse references. IDs, uploader, timestamps, relationships and lifecycle states were not changed.
- Independent post-check passed for all 16 original/canonical hashes, original source-file retention, all non-reference row metadata and unchanged ledger/attempt history. Protected old/new journals and receipts remain in `<protected-backup-dir>`; keys/references/recipient data are not published here.
- Live acceptance used synthetic images and a disposable loopback SQL database: real Staff intake/upload/offline return, Staff/Admin delivery, outsider/anonymous denial, two independent API compositions, a separate Node API process with an empty disk and process replacement, restart delivery, draft cleanup, retention of attached evidence, unsigned provider denial and missing-credential production refusal all passed. Disposable provider assets were removed; historical migrated assets were retained.
- Unit tests cover encryption/tampering, provider normalization, unknown outcomes and conflict cleanup; isolated SQL covers reference-only updates, stale metadata, CAS rollback and concurrent cleanup. The local MySQL 9.3 result is distinct from exact-candidate MySQL 8.0/8.4 CI.

This closes the observed legacy warehouse-local references and demonstrates live-provider/API portability in a controlled topology. It is not proof of deployed production configuration, representative real-item/identity privacy UAT, load/failover or every provider's quality. Keep originals and protected recovery artifacts until the release owner's acceptance/retention decision. Historical migration limitations remain in [the 053/055 review](../audits/migration-history-review-2026-10-05.md).

## Exact Candidate CI

`.github/workflows/ci.yml` runs for pushes/PRs and now permits manual dispatch. It records the actual checked-out commit for each MySQL 8.0/8.4 matrix job and retains browser JUnit/screenshots in an artifact named with the candidate SHA. The browser job is gated by the verification matrix.

After a separately authorized reviewed commit/push, use the CI run for that exact commit, not an older green run. For PRs, record the merge-test SHA and source head; re-run when the candidate changes. Earlier authorized commits and their authors are preserved; the B1/B2/B3 repair request does not authorize commit, push or merge. Exact remote acceptance is recorded separately in the audit follow-up after the run completes.

## Normal Upload Outcome Safety

The B1 repair applies to normal intake/return uploads, not another transfer of the 16 historical images. It also covers post media, claim evidence, LOST contact checks and avatar replacement. See [media-upload-reconciliation.md](media-upload-reconciliation.md) for stable upload IDs, same-session transaction/lock fencing, conservative compensation, protected operation logs and operator review requirements. No forward migration or Aiven write is needed for this repair.

Read-only preflight on the repair worktree reports no pending migration and retains the historical 053/055 warnings. The earlier protected transfer/provider receipts remain historical evidence for their original scope. New upload fault tests and keyboard tests do not certify new production/provider failover, physical-item/identity or screen-reader acceptance.
