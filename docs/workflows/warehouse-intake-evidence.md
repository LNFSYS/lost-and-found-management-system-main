# Physical Intake and Condition Evidence

Scope: dev work on 4 October 2026. This extends UC-051/052/056/144/146; it does not create a new actor goal or promote Partial UCs to Implemented.

## Receipt Workflow

- Finder request is immediately awaiting physical receipt. No approval or appointment is required before bringing the item to the selected desk.
- Staff opens source information and photos read-only. Nothing is physically received by opening a form or uploading a photo.
- Staff records actual name/description/category/location, condition, quantity and accessories. Corrections apply only to the warehouse item. The original Finder and source snapshot are preserved.
- Confirmation requires 1-5 new Staff-uploaded condition images plus explicit human review. Source images and return proofs cannot be substituted. PENDING and legacy ACCEPTED become INTAKED once, creating one RECEIVED item, not STORED.
- Exact actor/request/session payload retry returns the same item; changed payload or foreign photos are rejected. Intake never closes a post or accepts/rejects a claim.
- Walk-in needs no account, source post or claim. Optional Gemini/OCR suggestions are reviewed before application; failure retains images and entered fields for manual completion.

## Media and Responsibility

Warehouse media are served through authenticated Staff/Admin byte endpoints, not raw storage URLs. Unattached draft images belong only to their Staff uploader. Drafts expire after 72 hours and maintenance removes unused files. Inventory uses an intake thumbnail, falling back to a permitted source photo; old records show a placeholder.

Source-post, intake and return images retain separate provenance, uploader, upload timestamp and related-record IDs. Intake capture time can be supplied; it is otherwise unknown, not invented from upload time. Source secret EVIDENCE photos are never included in the source gallery. Returned identity evidence stays private.

Photos document what was physically received and its condition. They do not waive Staff accountability and do not prove ownership or possession.

## Rollout and Acceptance

On a new environment, run checksum preflight, back up and rehearse additive `061_warehouse_intake_evidence.sql` on an isolated database before applying it. No previously applied migration or ledger checksum may be edited.

The accompanying LOST contact-photo work also needs `062_lost_contact_photo_checks.sql`; deploy both additive migrations before starting the updated API. Maintenance intentionally pauses if either required schema is missing. See [contact-photo rules](lost-contact-photo-rules.md). Historical preflight evidence through 060 predates these changes and cannot certify this rollout.

On 4 October 2026, shared preflight initially listed exactly 061/062 pending. Both were then applied through the existing runner after a new encrypted 61-table/3,585-row backup and isolated restore/repeat-run rehearsal. Current preflight has no pending migrations, the maintenance probe is ready, and the existing local API health/readiness checks pass. Original ledger records and existing table definitions were preserved. See [the rollout receipt and limits](../runbooks/database-warehouse-recovery.md); schema readiness is not manual/provider acceptance or remote application deployment.

Automated evidence: intake-evidence.test.ts (missing/forged/stale/cross-actor/replay/privacy guards), custody-safety.integration.test.ts (fresh migrated MySQL, concurrent physical receipt, original source preservation, return/hold/dispute regressions), staff-page.spec.ts (walk-in, PENDING/legacy receipt, manual fallback and responsive form).

The later [actor-journey audit repairs](../audits/full-system-audit-2026-10-04.md) preserve source availability with atomic deletion guards and consistent LOST/FOUND ownership roles. Intake remains separate from Staff ownership verification. The 5 October audit follow-up adds authenticated Cloudinary warehouse intake/return storage, with production local-write refusal and legacy local read/delete compatibility. Existing local files are not automatically copied; provider/restore and historical-file acceptance remain required under [warehouse media rollout](../runbooks/warehouse-media-rollout.md). No new migration or shared business-data repair is needed or performed for these code safeguards.

## Inventory Presentation (5 October 2026)

The inventory uses a three-column desktop grid (two columns on smaller screens, one on mobile). Each compact card shows the image, title, status, category and physical receipt time with detail and eligible return actions; long descriptions appear only in the detail popup. The detail popup contains the complete description, protected photo gallery, receipt/location/finder/condition/quantity/accessory metadata and storage history; status updates remain available there. Closing or changing the selected item invalidates late log responses. Failed logs show an inline error and retry; image zoom Escape closes only the zoom before the detail popup.

The API orders all filtered inventory pages by physical `received_at DESC, id DESC`, not state or retention deadline. The ID tie-breaker stabilizes equal receipt times. This extends existing FR-STAFF-02/FR-WAREHOUSE-06 and UC-051/053/056; no new BR/FR/UC ID, migration or catalogue status promotion is introduced. Warehouse return/ownership/hold gates remain unchanged. Regression evidence: warehouse.repository.test.ts and staff-page.spec.ts (responsive three/two/one-column grids, compact metadata, full detail/images, update/return, late logs, errors/retry and pagination).

Later authorized 5 October rollout transferred all 16 inventoried warehouse-local references after protected full database/volume backup and isolated restore. Original files remain; independent post-check found unchanged other metadata/ledger and verified original/canonical hashes. Synthetic real-provider API checks covered Staff/Admin privacy, two compositions, a separate process with empty disk, process replacement/restart, offline return and cleanup. No shared state/link repair or SQL replay occurred. Production/physical/manual acceptance remains separate; [warehouse media receipt](../runbooks/warehouse-media-rollout.md) is the current evidence, superseding the earlier adapter-only pending-transfer snapshot.

Manual role/privacy QA, physical inventory reconciliation, representative real photos/Gemini output, multi-instance media durability and Jira/PR acceptance remain open. No Done/accepted claim is made by this document.
