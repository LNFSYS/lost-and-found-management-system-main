# Media Upload Reconciliation

## Runtime Contract

This is a failure-handling repair of existing upload workflows, not a new ownership decision or actor goal. BR/FR/UC IDs and UC implementation statuses are unchanged.

- Production composition supplies one upload coordinator to intake images, return proof, post media, claim evidence, LOST contact checks and avatar updates.
- The operation/asset/record ID is derived from SHA-256 of the actor/target/metadata scope and original bytes. Identical retries reuse it; different actors, targets, metadata or bytes do not share an identity. The digest does not become a possession/ownership signal.
- MySQL named locks serialize each scope across API instances. The lock and SQL transaction use the same session: a lost lock connection cannot leave a different upload transaction running independently. Coordination reserves at most two connections per instance with a bounded waiting queue; lock acquisition is bounded. This is not a throughput or failover benchmark.
- Stable Cloudinary public IDs use `overwrite: false`, per the [provider's duplicate-upload contract](https://cloudinary.com/documentation/upload_images#avoiding_duplicate_uploads). Existing private assets must be readable before replay; existing avatar responses require authoritative provider metadata. Local retries compare original bytes rather than overwriting a conflicting file. Provider failure never produces fabricated upload success or warehouse production fallback.
- An INSERT/COMMIT error is not evidence of rollback. The transaction adapter marks only an acknowledged rollback before COMMIT as definite. Failed rollback destroys the connection rather than returning an unresolved transaction to the pool.
- A bounded authoritative DB lookup may confirm the same actor/target/reference persisted, allowing a genuine result. Failed/timed-out reads or a row not yet visible retain the asset and original failure. No success is returned from a missing or unavailable record.
- Compensation additionally requires confirmed rollback, continued ownership of the named lock and an authoritative absence/reference check. An existing but mismatched record is retained for review, not treated as an absent reference. Intake reconciliation uses an unfiltered record lookup, including references behind soft-deleted warehouse items.
- Normal draft cleanup still uses its existing session/row locks and expiry/attachment conditions. Intake/return attachment preserves IDs, uploader, provenance, relationships and business/audit history. Retries do not create duplicate records or duplicate image IDs in the intake/return UI.

## Protected Operations

Structured events contain only `kind`, opaque `operationId` and outcome/event names: `media_upload_started`, `media_upload_completed`, `media_upload_operation_failed`, `media_upload_review_required`, `media_upload_cleanup_required`. They must go to the deployment's access-controlled retained log sink. No scope, credentials, storage references, signed URLs, image bytes or recipient details are logged. A retained provider reference contains the same stable operation ID; it is not blindly deleted by an age-only orphan sweep.

There is no new DB operation table or automatic unknown-outcome deletion job. Operators must retain these logs and reconcile unresolved operations; this operational requirement still needs deployment/manual acceptance. Do not interpret a rolled-back current attempt as permission to delete an independently referenced asset, or a single absent read as proof an earlier transaction could not finish.

1. Identify the opaque operation and upload kind from protected logs. On the authoritative primary, inspect the corresponding record ID/reference: warehouse intake/proof, post media, claim evidence, contact check, or the user's avatar pointer. Check consumed contact evidence and attached intake/return records as well. Do not publish these queries/results or provider references in public reports.
2. Keep the asset if any record uses it or DB/provider/session state remains uncertain. Retry only the same original request with unchanged actor, target, metadata and bytes; reauthorization still applies. A stale contact check cannot be reused to bypass expiry or bind proof to another conversation.
3. Do not start a broad cleanup/recovery write in this repair. A separately approved orphan review must establish that the old session/transaction has terminated, fence concurrent retries/cleanup using the same locking rules, examine all references and retain protected evidence before deletion. Recovery writes require their own approval, backup and isolated rehearsal.
4. An absent/mismatched provider asset is an incident, not permission to fabricate an image or remove the evidence row. Review the source and retained bytes under the separate recovery procedure.

## Verification Boundaries

Permanent tests exercise committed-then-rejected INSERT/COMMIT, failed/timed-out reconciliation, acknowledged rollback, lost lock, conflicting references, identical retry, provider failure and actual factories for all six upload paths. Isolated SQL additionally exercises actual commits/rows, cross-instance named-lock serialization and attached-image retention during concurrent maintenance. Provider adapters are tested against controlled responses, including the minimal `existing` response; these tests do not constitute new live Cloudinary acceptance.

Remaining acceptance includes live provider/database acknowledgement loss and process replacement, retained logging, Aiven named-lock permissions/primary routing under production configuration, two-instance and load/failover behavior, cleanup operator procedure and representative item/identity privacy UAT. A passing local suite does not establish exactly-once provider behavior, complete security/accessibility conformance or main/production release readiness. Historical 053/055 limits and flagged custody links remain in [migration history review](migration-history-review-2026-10-05.md). The completed historical 16-image warehouse rollout must not be repeated.
