# Full System Re-Audit - 5 October 2026

The original audit snapshot below ends at **Recommended Next Steps**. Its findings, score and CI receipts describe the audited commit, not the repaired worktree. See [Repair Follow-Up](#repair-follow-up---5-october-2026) for the current local repair status; historical scores are unchanged.

## Scope and Verdict

- Repository: `F:/ky9/fptu-lost-found-system-main`; branch: `dev`.
- Audited commit: `f3f0d0585b9fc6ead1857ea3d11bb45d0ff3b9ce`, matching local `origin/dev` at review time.
- Working tree was clean before this audit. This report is the only intended repository change. No application repair, commit, push, merge, shared migration or Aiven business-data write was performed.
- Review includes complete automated suites, targeted source/behavioral review of authentication/SSE, chat mutations, matching, custody/return, media lifecycle, email leases/shutdown, CI and current documentation. It is not a manual line-by-line inspection of every file, penetration test or exhaustive acceptance test.
- **Engineering quality of the implemented Web/API scope: 85/100 (8.5/10).** There are two newly reproduced P2 findings and one P3 documentation finding. No new P0/P1 defect was confirmed in this pass; that is not proof that none exists.
- Green suites and CI do not close the findings below. Production acceptance is still conditional on repairs and the separate release checks, not automatically approved.

The previous [5 October audit](full-system-audit-2026-10-05.md), its 77/100 historical score and subsequent execution receipts remain intact. Findings in the original snapshot must not be presented as current failures after their repairs.

## Confirmed Findings

### B1 [P2] Upload compensation can delete an asset whose DB row has committed

References: [intake upload catch](../apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts#L179), [return-proof insert/catch](../apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts#L347), and [transaction commit handling](../apps/api-node/src/shared/infrastructure/config/db.ts#L62).

`uploadIntakeImage` removes the uploaded asset whenever the transaction rejects. `uploadProof` similarly removes it whenever `createProof` rejects. A lost connection/acknowledgement does not establish that the database rolled back: the INSERT or COMMIT can have succeeded remotely. Removing the asset unconditionally then leaves the committed row referring to a deleted file. A later successful physical receipt can attach that row without validating asset delivery.

Independent fault-injection reproduction used the actual freshly built use-case factory, in-memory repository/storage doubles and a synthetic PNG; no shared DB/provider write was made:

1. For return proof, the repository persisted the input row and then rejected with `ECONNRESET`, modelling a committed INSERT with a lost acknowledgement.
2. For intake, the transaction executed the repository callback, kept its row and then rejected with `ECONNRESET`, modelling a committed transaction with a lost COMMIT acknowledgement.
3. Both use cases rejected, called storage deletion once and left **one persisted row with zero remaining assets**.

```json
{"case":"return_proof_insert_ack_loss","persistedRows":1,"remainingAssets":0,"unsafeCleanupCalls":1}
{"case":"intake_transaction_commit_ack_loss","persistedRows":1,"remainingAssets":0,"unsafeCleanupCalls":1}
```

This confirms unsafe compensation under a simulated ambiguous DB outcome, not an observed new Aiven data-loss incident. Source review also finds equivalent catch/delete patterns in [post upload](../apps/api-node/src/modules/posts/application/post.use-cases.ts#L374), [claim evidence](../apps/api-node/src/modules/claims/application/claim.use-cases.ts#L1128), [LOST photo check](../apps/api-node/src/modules/claims/application/contact-photo.use-cases.ts#L47) and [avatar update](../apps/api-node/src/modules/auth/application/auth.use-cases.ts#L199); these other paths were not independently fault-injected in this audit.

Recommended repair: distinguish definite rollback/rejection from unknown persistence outcomes. Retain assets on uncertainty, reconcile by the generated record ID/reference using an authoritative DB read, and record unresolved operations for later cleanup/review. Do not delete an asset merely because a read also times out. Only compensate after confirmed non-persistence. Add regressions for committed-then-rejected INSERT/COMMIT, confirmed rollback, failed reconciliation, duplicate retry and cleanup concurrency. The protected historical media-transfer tool already treats uncertain outcomes more conservatively; its successful rollout does not fix normal uploads.

### B2 [P2] Walk-in modal does not behave modally for keyboard users

References: [keyboard effect](../apps/web/src/components/warehouse-intake-dialog.tsx#L37), [modal declaration](../apps/web/src/components/warehouse-intake-dialog.tsx#L102). The dialog declares `aria-modal="true"`, but only implements Escape handling; it does not establish initial focus, contain Tab/Shift+Tab, make background controls inert or explicitly restore focus.

Independent Chromium reproduction used the actual production Web build, a 1440x1000 viewport and mocked Staff HTTP responses:

1. Open `/admin/staff` and click the Walk-in intake button.
2. After the modal settles, `document.activeElement` is still the background Walk-in button, outside the dialog.
3. Focus the dialog's first close button and press Shift+Tab: focus returns to the background Walk-in button while the popup remains open.

```json
{"case":"settled_walk_in_keyboard_focus","initial":{"inside":false,"tag":"BUTTON"},"afterShiftTab":{"inside":false,"tag":"BUTTON"},"bounds":{"x":400,"y":50,"width":640,"height":900}}
```

This is a confirmed keyboard interaction defect, not a declaration of exhaustive WCAG failure or conformance. W3C's [modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) describes moving focus into the dialog and keeping keyboard navigation within it until closed.

Recommended repair: use an accessible dialog primitive or consistently implement initial focus, tab containment, inert background, Escape/busy behavior and focus restoration. Include nested image previews and closing during asynchronous work in regression coverage. The inventory-detail dialog already has explicit focus handling; avoid giving a nested popup conflicting focus handlers. Add keyboard tests for Walk-in/custody intake and review the other operational dialogs.

### B3 [P3] README still describes all media as instance-local

Reference: [README media section](../README.md#L140). It says files currently live in each machine's `UPLOAD_DIR` and that shared storage still needs implementing before staging. That statement is too broad for the current Cloudinary adapters and completed warehouse-media transfer, and conflicts with the more accurate [project overview](project-overview.md#L71) and [warehouse rollout](warehouse-media-rollout.md).

Recommended repair: distinguish authenticated Cloudinary-backed uploads, supported legacy local reads, the existing post/claim local fallback when configuration is absent, and warehouse's production refusal of new local writes. Do not claim every legacy post/claim image was migrated or that production topology/manual acceptance was certified.

## Fresh Verification

| Check | Result | Scope / limitation |
| --- | --- | --- |
| Normal root `npm test` | 330 passed, 0 failed, 14 opt-in SQL entries skipped; normal exit | Includes architecture checks and Web type checking; no force-exit |
| `npm run build` | Passed | Fresh API and Web production builds |
| `npx playwright test --workers=2 --reporter=line` from `apps/web` | 69 passed, 0 skipped | Existing desktop/mobile suite; mostly mocked HTTP, not production/provider UAT |
| Opt-in `test:db-integration` | 45 passed, 0 failed, 0 skipped | Dedicated loopback MySQL 9.3, disposable test DBs; never Aiven |
| `npm audit --omit=dev --json` | 0 known production dependency vulnerabilities | Advisory snapshot, not an application security certificate |
| `npm run migrate:preflight` | Passed; no pending forward migration | Read-only Aiven check; historical 053/055 limitations remain |
| `migrate:warehouse-media` default inventory | `READ_ONLY`, intake 0, returnProof 0 | Zero legacy local warehouse references at this check; not an audit of every post/claim asset |
| UC catalogue check | 168 total: 97 Implemented, 17 Partial, 54 Planned | Statuses were not promoted; not equivalent to 168 completed use cases |
| `git diff --check` | Passed before report creation | No product files changed by this audit |
| Additional DB fault-injection probes | B1 reproduced in both warehouse upload paths | Simulated lost acknowledgements, not live network fault injection |
| Additional Chromium keyboard probe | B2 reproduced after dialog settles | One concrete modal workflow, not full assistive-technology/device testing |

The task-owned MySQL server and preview server used by the extra browser probe were stopped after verification. User development servers and unrelated MySQL processes were not stopped.

### Exact Candidate CI

Fresh GitHub API verification confirmed [run 37269541071](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37269541071) is completed/successful for the exact audited SHA `f3f0d0585b9fc6ead1857ea3d11bb45d0ff3b9ce`:

- `verify (8.0)` and `verify (8.4)`: successful, including install, production dependency audit, normal unit/integration tests and API/Web build.
- `browser`: successful, including Playwright and evidence retention.
- The existing exact-candidate receipt in the previous audit records 375 passing tests per SQL matrix job and 69 browser tests. This pass reconfirmed run SHA/job conclusions; it did not download job logs again or trigger another CI run.
- A future code candidate needs its own CI evidence. This new uncommitted report is not part of that already-verified commit.

## Earlier Repairs and Remaining Limits

| Earlier concern | Assessment now |
| --- | --- |
| A1: SSE expiry/revocation | Session-bound, bounded validation and fail-closed implementation/regressions present; normal tests pass. No recurrence confirmed in this pass. |
| A2: stale chat mutations | Room/generation guards and delayed-success/failure/A-B-A coverage present; 69 browser tests pass. No recurrence confirmed in this pass. |
| A3: documentation drift | Current overview/runbooks/traceability and historical snapshots coexist; B3 remains in the repository README. |
| R1: warehouse-local media | Fresh inventory reports zero legacy local references. Earlier protected backup/restore and 16-image transfer/provider acceptance receipts exist; migration was not replayed. B1 affects normal upload failure handling, a separate issue. |
| R2: stale candidate CI | Exact current commit's MySQL 8.0/8.4 and browser jobs are successful. Actual production/manual release acceptance remains separate. |
| Chat -> custody -> Staff verification -> return | New/reversed legacy identity journeys pass isolated SQL; explicit Staff verification and dispute/legal-hold guards remain. |
| EXPIRED return, matching pagination, email duplicate/shutdown fixes | Relevant unit/SQL/browser regressions pass. SMTP duplicate avoidance intentionally treats uncertain delivery conservatively; no exactly-once SMTP guarantee is inferred. |

Historical preflight limitations remain: recovered original 053 bytes/checksum do not prove every old statement or original disposition/legal-hold schema effect ran. Original custody-time 055 SQL remains unavailable; current-schema compatibility does not certify its unknown historical effects. No ledger checksum rewrite, blind replay or historical linkage repair was performed. The earlier two quarantined/flagged LOST custody links still require physical-source review; they were not newly adjudicated here.

Post/claim media still support the documented local fallback if provider configuration is absent. No universal durability or two-instance delivery claim is made for those legacy assets. A passing warehouse-local inventory only covers its two warehouse tables.

No new live SMTP/Gemini/Cloudinary end-to-end provider acceptance, production failover/load benchmark, full security assessment, representative photo accuracy/false-accept evaluation, physical-item/identity UAT or full screen-reader/WCAG assessment was conducted in this pass. Earlier controlled provider/restore receipts remain evidence for their own scope, not new production acceptance. Photo similarity supports communication screening, not proof of possession/ownership.

## Score and Method

The rubric is informed by the public [ISO/IEC 25010:2023 product-quality model](https://www.iso.org/standard/78176.html), [OWASP ASVS](https://owasp.org/projects/asvs) for technical security verification and [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessibility. **Weights and numeric marks are this reviewer's judgement, not a formula prescribed by these sources, an official academic grade or a certificate.** Only ISO's public summary was consulted, not the full paid standard; a complete ASVS/WCAG conformity assessment was not performed.

The same six weighted groups as the earlier 77/100 audit are retained for comparability. The assessment concerns the implemented Web/API, not completion of Planned mobile/PWA/appointment scope or every catalogue UC.

| Criterion | Maximum | Awarded | Evidence / principal deduction |
| --- | ---: | ---: | --- |
| Functional correctness and workflow integrity | 25 | 23 | Composed custody/identity/return, matching, deletion and idempotency regressions pass; not all end-user/physical acceptance paths are demonstrated. |
| Security and privacy | 20 | 18 | SSE/auth lifetime, private-media authorization, explicit verification and clean dependency audit; no full adversarial/provider/identity acceptance. |
| Reliability and data lifecycle | 20 | 15 | Transactions, leases, restore/rollout evidence and exact-version CI are strong; B1, unknown historical migration effects and untested production failover remain. |
| UX and accessibility | 10 | 7 | Responsive compact inventory, full details, field errors and browser regressions; B2 and incomplete keyboard/assistive-technology assessment. |
| Maintainability and verification | 15 | 14 | Modular architecture checks and broad normal/SQL/browser automation; committed-after-error and modal-focus regressions missing. |
| Documentation and release evidence | 10 | 8 | Current BR/FR/UC traceability, protected execution receipts and exact candidate CI; B3 and production/manual acceptance gaps. |
| **Total** | **100** | **85** | **Strong engineering baseline with specific remaining repairs, not unconditional production approval.** |

The increase from the historical 77/100 reflects repaired SSE/chat isolation, completed observed warehouse-media transfer with protected restoration/provider evidence, and exact current-candidate CI. It does not erase the historical audit or make the remaining defects disappear. Passing test counts are not a line-coverage metric.

## Recommended Next Steps

1. Repair B1 across warehouse uploads first, then review the analogous post/claim/photo/avatar compensation paths. Preserve assets on an unknown DB outcome and add permanent fault-injection regressions.
2. Repair B2 using consistent accessible modal behavior and keyboard/nested-dialog tests.
3. Correct B3 without overstating legacy-media migration or production acceptance.
4. Run normal tests, isolated SQL, build, browser and production dependency audit for the repair candidate; push only when separately requested and verify its exact CI SHA.
5. Obtain release-owner acceptance of historical migration limits and representative production/private-media/physical verification UAT before declaring release readiness. Do not replay already-applied migrations merely to remove warnings.

## Repair Follow-Up - 5 October 2026

### Candidate and Boundaries

- Repairs were made only in `F:/ky9/fptu-lost-found-system-main` on `dev`, based on `f3f0d0585b9fc6ead1857ea3d11bb45d0ff3b9ce`. The existing untracked audit was preserved and this follow-up appended. No commit, push or merge was requested or performed.
- Aiven access for this repair was limited to read-only migration preflight. No migration, checksum/ledger mutation, recovery write, historical custody adjudication or media rollout was performed. The completed 16-image warehouse transfer was not replayed.
- This changes failure handling and keyboard behavior of existing workflows, not actor goals, ownership policy or business decisions. No new BR/FR/UC ID was introduced and no UC status or historical project score was promoted.

### B1: Upload Outcome Safety

**Implemented and locally verified across all six normal upload paths. Production/provider acceptance is still separate.**

- [Transaction outcome handling](../apps/api-node/src/shared/infrastructure/config/db.ts#L57) distinguishes an acknowledged rollback before COMMIT from an unknown result. Connection loss, failed rollback or rejected COMMIT acknowledgement is not evidence of non-persistence; unresolved connections are destroyed rather than reused.
- [Shared compensation/reconciliation](../apps/api-node/src/shared/application/media-upload.ts#L20) makes bounded authoritative lookups by operation record/reference. A confirmed matching record can return a real persisted result. An absent/unavailable/timed-out lookup preserves the asset and original error unless rollback, continued coordination ownership and an unreferenced-asset check are all confirmed. A conflicting existing reference is also retained.
- [Production coordinator](../apps/api-node/src/shared/infrastructure/media-uploads.ts#L15) derives stable IDs from actor/target/metadata and original bytes, serializes each scope with a MySQL named lock and runs the SQL transaction on that same held connection. Two concurrent uploads per instance and a bounded waiting queue reserve capacity for ordinary requests. This is not a load/failover benchmark.
- Repairs cover [intake](../apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts#L172), [return proof](../apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts#L363), [post media](../apps/api-node/src/modules/posts/application/post.use-cases.ts#L355), [claim evidence](../apps/api-node/src/modules/claims/application/claim.use-cases.ts#L1111), [LOST contact checks](../apps/api-node/src/modules/claims/application/contact-photo.use-cases.ts#L36) and [avatars](../apps/api-node/src/modules/auth/application/auth.use-cases.ts#L181). Stable retry checks reauthorize the target and verify existing asset delivery; provider failures cannot fabricate successful persistence. Intake/proof IDs are deduplicated in the UI as well.
- Intake reconciliation includes rows behind soft-deleted warehouse items; proof insertion now locks/rechecks the item inside its transaction. Avatar SQL reports a failed update when an inactive account causes zero affected rows, preventing deletion of its still-current previous avatar. Uploader, provenance, target relationships, physical-intake/return gates and history are preserved.
- Permanent [factory regressions](../apps/api-node/src/test/media-upload-regression.test.ts), [compensation tests](../apps/api-node/src/shared/application/media-upload.test.ts) and [isolated SQL regressions](../apps/api-node/src/integration/media-upload-outcomes.integration.test.ts) cover persisted INSERT with lost acknowledgement, committed-then-rejected transaction, acknowledged rollback, failed/timed-out reconciliation, retry, failed storage, lost coordination ownership, conflicting references, cross-instance serialization and retention of attached images during maintenance.

Unresolved operations are identified by opaque IDs in structured, access-controlled retained logs and stable provider references. There is **no new DB operation table or automatic unknown-asset deletion job**. Deployment log retention and the operator procedure in [Media Upload Reconciliation](media-upload-reconciliation.md) still need acceptance. An unknown upload must not be removed by age alone or because one DB lookup fails/returns no row. Real provider/database acknowledgement loss, instance replacement and production lock/primary-routing behavior have not been newly exercised here.

### B2: Modal Keyboard Behavior

**Implemented and locally verified for Walk-in/custody intake on desktop/mobile; not a full accessibility certification.**

- [Shared modal focus handling](../apps/web/src/hooks/use-modal-focus.ts#L49) sets initial focus, contains Tab/Shift+Tab, makes background siblings inert, handles only the top modal's Escape, respects busy state and restores focus when possible.
- [Intake dialog](../apps/web/src/components/warehouse-intake-dialog.tsx#L27) and [nested image preview](../apps/web/src/components/warehouse-images.tsx#L14) share the modal stack. Preview Escape closes only the preview and returns focus to its image button, without discarding intake draft/photos or closing the parent.
- Warehouse detail/return/proof-preview/update/rejection/success dialogs and claim verification/question/evidence dialogs use the same accessible wrapper/hook. Close/backdrop behavior respects request/proof-upload busy states; the old competing inventory-focus handler was removed.
- [Walk-in keyboard and delayed-work tests](../apps/web/tests/staff-page.spec.ts#L113) cover initial focus, Tab/Shift+Tab, inert background, nested preview, focus restoration, busy upload/save, server failure and preserved draft/images at 1440px and 390px. [Custody intake tests](../apps/web/tests/staff-page.spec.ts#L225) additionally verify initial focus/trapping and nested source-image restoration at both sizes. Screenshots were inspected at desktop/mobile widths.

Remaining: representative screen readers/browser-device combinations, wider operational-dialog acceptance and a full accessibility/security assessment. Automated focus tests do not establish WCAG conformance.

### B3: Current Documentation

**Updated. Historical snapshots and scores are preserved.**

- [README media section](../README.md#L138) distinguishes authenticated Cloudinary/protected proxy, legacy local reads, post/claim unconfigured local fallback and warehouse production refusal of new local writes/provider-error fallback. It does not claim universal post/claim migration or multi-instance local durability.
- [Warehouse rollout](warehouse-media-rollout.md#L91), [project overview](project-overview.md), the documentation index and the new reconciliation runbook describe current repairs separately from historical transfer/provider receipts. Commit/push/CI and deployment/manual acceptance remain separate stages.
- Existing BR/FR/UC and traceability were checked against this bug-fix scope; no new workflow rule/actor goal requires new IDs. Catalogue counts remain 168: 97 Implemented, 17 Partial, 54 Planned. Passing tests do not promote these statuses.

### Repair Verification

| Check | Current local result | Boundary / limitation |
| --- | --- | --- |
| Normal `npm test` | API 373 passed, 0 failed, 15 opt-in SQL entries skipped; normal process exit | Architecture tests and Web type checking also pass; no force-exit or added skips |
| Isolated `test:db-integration` | 53 passed, 0 failed, 0 skipped | Dedicated loopback MySQL 9.3/disposable DBs; never Aiven; includes 8 new upload-outcome tests (outer test plus subtests) |
| `npm run build` | Passed | API/Web production builds; no deployment certification |
| Full Playwright, two workers | 73 passed, 0 skipped on final rerun | Desktop/mobile HTTP-fixture suite; not live provider/production UAT |
| `npm audit --omit=dev --json` | 0 known production dependency vulnerabilities | Advisory snapshot, not a penetration test |
| `npm run check:architecture` | 2 checker tests passed; 193 production files, 0 violations | Includes type dependency cycles |
| `node scripts/check-uc-catalogue.mjs` | 168 total: 97 Implemented, 17 Partial, 54 Planned | Counts unchanged; not end-to-end acceptance of every UC |
| Read-only `npm run migrate:preflight` | Passed; 58 source, 61 applied, 28 attempts; pending/superseded lists empty | Both historical 053/055 warnings remain; no migration replay/write |
| `git diff --check` | Passed | Product diff reviewed; no changes to migration SQL or Git history |

One intermediate browser run had 72 passes and a 30-second timeout in the existing mobile-home test. Its diagnostic standalone run with trace passed (2 home tests); the full suite then passed 73/73 with failure-trace retention enabled. No assertion was removed, timeout increased, test skipped or product change made to hide it. The timeout was not conclusively attributed; retain it as a test-timing risk to watch in candidate CI rather than claiming it never occurred.

The task-owned isolated MySQL instance was shut down after verifying its port, data directory and server UUID; Playwright's task preview ended normally. Existing user development servers and unrelated database processes were left alone. Protected transient verification logs remain outside Git; no credentials, signed provider URLs or recipient data were added to public documentation.

### Remaining Acceptance and Release Gates

1. Accept/test deployment retention of opaque operation logs and operator reconciliation; verify production named-lock permissions and authoritative-primary routing. Unknown-outcome cleanup remains conservative/manual, not automatically completed.
2. Conduct live private-media acknowledgement-loss/restart/two-instance and cleanup/retry acceptance, load/failover testing, and representative physical-item/identity privacy UAT. Controlled provider doubles in regressions are not new live Cloudinary/SMTP/Gemini acceptance or photo false-accept/accuracy evidence.
3. Retain historical migration limits: original 053 effects are not fully certified, original custody-time 055 SQL remains unavailable, and the two flagged/quarantined LOST custody links require real physical-source review. Recovery writes need separate approval, backup and isolated rehearsal; this repair does not resolve them by altering the ledger.
4. Obtain broader screen-reader/keyboard/device and security acceptance. Neither this repair nor passing suites constitute certification or proof that no other defect exists.
5. If commit/push is later requested, verify CI's MySQL 8.0/8.4 and browser jobs on the **actual repair SHA**. The existing green run for `f3f0d0585b9fc6ead1857ea3d11bb45d0ff3b9ce` does not certify this uncommitted worktree. No current repair SHA/CI receipt exists yet.

**Verdict:** B1/B2/B3 code, regression tests and documentation are repaired locally. Historical recovery limits and the explicit production/manual acceptance above remain; main/production readiness is not declared, and the historical 77/100 and 85/100 marks are not re-scored.

## Finder Photo Custody Follow-Up - 5 October 2026

This later user-requested workflow extension is separate from B1/B2/B3 and their historical verification table. The temporary select/create-FOUND approach was undone; Finder does not need to publish a FOUND post to transfer an item from an unlinked direct LOST chat.

- The server requires the actual Finder, accepted room participants, and that Finder's consumed, strictly above-60% contact check with its matching private evidence record. Generic custody creation still requires an owned eligible FOUND and cannot forge the photo route. Wrong actor/room/source, missing evidence/consent and active duplicate requests are rejected.
- Photo-backed requests and received items retain NULL physical post IDs. The original LOST remains comparison context, with claim/room/Finder binding carried into intake, Staff review/explicit verification, reservation, return/feedback, notification recipients, source deletion and competing-case/dispute/hold checks. No synthetic FOUND or ownership decision is created. The known quarantined legacy LOST-post links remain separate and unresolved.
- Staff sees the original protected claim photo through CONTACT_PHOTO provenance. It cannot replace the separate mandatory Staff condition photos or physical receipt confirmation. Private storage references are not exposed. A cancelled/refused request alone does not grant warehouse-image access.
- Existing BR-53/60/65/68/69, FR-CUSTODY-02 and traceability were updated for this explicit policy extension; no new actor goal/UC ID or UC status promotion was introduced. A copied matching photo remains no proof of possession/ownership; real-photo and manual physical/privacy acceptance remain required.

Final local verification for the combined worktree:

| Check | Result | Boundary |
| --- | --- | --- |
| Normal npm test | 373 API passes, 0 failures, 18 opt-in SQL entries skipped; exits normally | SQL entries run separately below; no force-exit |
| Complete isolated SQL suite | 56 passes, 0 failures/skips | Dedicated loopback MySQL 9.3, disposable test DBs; new/legacy no-FOUND journeys and authenticated HTTP |
| Complete Playwright | 75 passes, 0 failures/skips | Two workers, desktop/mobile HTTP fixtures; source-image dimensions and screenshots checked, not provider/production UAT |
| Build | API/Web passed | Local builds only |
| Production dependency audit | 0 known vulnerabilities | Not penetration-test evidence |
| Architecture / UC catalogue | 194 production files, 0 violations; 168 UC with unchanged 97/17/54 statuses | No status promotion |

An initial SQL run caught the old HTTP assertion that photo-backed custody must return 403; the regression was updated to the newly requested policy, additionally asserting NULL physical source, unchanged LOST identity, actual Finder and no premature warehouse item. Final full SQL rerun passed. No assertion was skipped to hide the policy change.

No migration SQL, ledger, shared data, media rollout or Git history was changed for this follow-up. Existing nullable custody/warehouse relationships support the path, so no new migration is required. No commit/push/CI or deployment receipt is claimed; MySQL 8.0/8.4 candidate CI and live/manual acceptance are still separate release gates.

## Commit Preparation and UC Reconciliation - 6 October 2026

The user subsequently authorized committing/pushing the current work to `dev` and requested current UC mappings. This section records that later candidate without rewriting the earlier audit, scores, dates or verification tables.

- [Current catalogue](uc.md) covers the >=50% LOST contact gate (analysis confidence >=60%), immediate room/checked image, Finder-only photo-analysis suggestions with ordinary-text send/collapse/retry, protected chat images, separate evidence upload, no-FOUND photo custody and compact inventory/details. No duplicate UC ID was added. UC-120 moves from Planned to Partial because authenticated image-message API/Web runtime now exists; no UC becomes Implemented. Totals: 168 UCs, 97 Implemented, 18 Partial, 53 Planned; the existing 71 remaining-work assignments are retained.
- BR-35/69, FR-CHAT-01/02 and traceability now include UC-120 and the UC-106/107 suggestion slice. A communication-only meetup proposal is not appointment booking, ownership verification or a warehouse release right. Structured-question assignments and ordinary suggested text remain distinct.
- The fresh dependency audit, unlike the earlier dated clean receipts, initially reported Critical [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) for `proxy-addr@2.0.7`. The compatible transitive patch is locked/installed at 2.0.8. A real HTTP regression in `app.test.ts` confirms IPv4-mapped/overly broad IPv6 trust subnets do not allow spoofed IPv4 `X-Forwarded-For`, and valid IPv4 loopback trust still works. Production `trust proxy` configuration remains unchanged/disabled.
- Full dependency audit also exposed High [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) in build-only `source-map-js@1.2.1`; it is locked/installed at the compatible 1.2.2 patch. No direct dependencies or package manifests changed. Both `npm audit` and `npm audit --omit=dev` now report zero known vulnerabilities; this is not a penetration-test or production-security certification.
- Local verification for the workflow/UC candidate: normal `npm test` has 379 passes, zero failures, 20 opt-in SQL entry points skipped by default, and a normal process exit; architecture checks cover 196 production files with zero violations; Web type checking and API/Web builds pass. Full Playwright passed 85 tests at desktop/mobile sizes. Catalogue check confirms the new 97/18/53 split and all 18 local links in `uc.md` resolve.
- SQL integration was not rerun during this documentation/commit-preparation step. The earlier complete 58-test isolated MySQL 9.3 run and later focused 13-test authenticated custody run are scoped receipts in [photo workflow evidence](lost-contact-photo-rules.md), not new full SQL acceptance. Candidate CI must exercise MySQL 8.0/8.4 and browser jobs on the actual pushed SHA.

No migration, Aiven write, recovery or repeat media rollout was performed. Existing 053/055 history limits, physical-source review, real-provider/physical UAT, load/failover and broader accessibility acceptance remain open. Local verification does not declare production/main readiness. Commit/push and exact candidate CI must be checked separately after this preparation; no older green SHA certifies this candidate.

### Initial Candidate CI and Browser Timing Repair

Candidate `379e8b9f51a70ea186beb1a69350ed9fdec3848b` was committed/pushed to `dev`. [Exact candidate run 37408441283](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37408441283) passed both MySQL 8.0 and 8.4 jobs, each with 437 tests and zero failures/skips, clean production dependency audit and successful API/Web builds. Browser had 84 passes and one failure; this run is **not** a fully green acceptance receipt.

The existing image-analysis test delayed its HTTP fixture response for only 1500 ms, then scrolled and asserted the transient `.is-scanning` state. The response could complete before these checks on a different runner. The test now holds that response behind an explicit gate until the scanner visibility, two-image filmstrip, animated-beam movement and screenshot assertions finish, and releases it in `finally`. Draft/edit/publication/matching assertions remain unchanged. No product timing change, longer assertion timeout, retry setting, skipped test or removed assertion was used. This repair changes verification scheduling only, not UC scope/status; a new candidate still requires its own full CI result.

The repaired browser test passed four consecutive local runs with two workers; Web type checking passed. The earlier full local 85-test pass remains a scoped receipt, not proof of the new candidate's CI. Catalogue totals remain 168 with the 97/18/53 split.
