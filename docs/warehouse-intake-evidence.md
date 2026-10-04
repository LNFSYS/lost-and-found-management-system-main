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

Run checksum preflight, back up and rehearse the additive `061_warehouse_intake_evidence.sql` on an isolated database before applying it to the shared DB. No previously applied migration or ledger checksum is edited. This task's isolated tests do not establish that Aiven has 061.

Automated evidence: intake-evidence.test.ts (missing/forged/stale/cross-actor/replay/privacy guards), custody-safety.integration.test.ts (fresh migrated MySQL, concurrent physical receipt, original source preservation, return/hold/dispute regressions), staff-page.spec.ts (walk-in, PENDING/legacy receipt, manual fallback and responsive form).

Manual role/privacy QA, physical inventory reconciliation, representative real photos/Gemini output, multi-instance media durability and Jira/PR acceptance remain open. No Done/accepted claim is made by this document.
