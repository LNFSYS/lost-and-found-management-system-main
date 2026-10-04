# Full System Audit - 4 October 2026

Repository: `F:/ky9/fptu-lost-found-system-main`. Initial audit snapshot: branch `dev`, HEAD `f036fcb`, four local commits ahead of the current `origin/dev` reference, plus uncommitted fixes. The findings and first check table below preserve that historical snapshot. The follow-up section records the local repairs and new verification, not approval of a deployed release or proof that every planned UC is implemented.

## Initial Findings

### P1 - Direct LOST contact with a physical FOUND source cannot complete Staff verification/return

`claim.use-cases.ts` stores a direct requester as CLAIMANT and the target owner as FINDER. For LOST posts, `claim.repository.ts` normalizes these roles when reading the conversation, but the persisted `claim_participants.participant_role` values remain reversed relative to physical ownership. The warehouse return-review and verified-recipient SQL uses the raw participant roles, not that normalization.

Reproduced on an isolated fresh MySQL database using the real services/repositories and a simulated photo-analysis provider:

1. Finder passes the LOST photo gate and creates a direct message with `sourceFoundPostId` pointing to their own FOUND post.
2. Finder escalates custody; Staff uploads intake evidence and confirms physical receipt.
3. The item is RECEIVED, and chat displays the correct Finder/Claimant identities, but Staff return review returns zero claims.
4. Explicit Staff verification fails with an invalid claim/recipient conflict. Unlinked offline return is also blocked by the still-active claim.

References: `apps/api-node/src/modules/claims/application/claim.use-cases.ts:445`, `apps/api-node/src/modules/claims/infrastructure/claim.repository.ts:455`, `apps/api-node/src/modules/warehouse/infrastructure/warehouse.repository.ts:27`, `apps/api-node/src/modules/warehouse/infrastructure/warehouse.repository.ts:307`.

Required fix: use one consistent, physical-source-aware participant contract across chat, Staff review, verified recipients and completed-return/feedback readers. Preserve Finder identity and history; do not approve ownership from photo similarity or bypass disputes/holds. Add an end-to-end LOST-contact -> linked FOUND -> custody -> Staff verification -> return regression, not just a chat-role assertion.

### P1 - Deleting the source post after intake strands an active claimant

`softDeletePost` has no active custody/item guard. Once a Finder deletes the FOUND post, warehouse review/verification joins exclude it through `found.deleted_at IS NULL`, while `hasBlockingCases` still finds the live claim. Staff can no longer verify that claimant or perform an unlinked return.

Reproduced with a normal FOUND conversation and actual custody receipt: the review contained one claimant before deletion and zero afterwards; Staff verification conflicted and the active-case blocker stayed true. This is a baseline cross-module gap, not evidence that the latest safety-note UI caused it.

References: `apps/api-node/src/modules/posts/application/post.use-cases.ts:335`, `apps/api-node/src/modules/posts/infrastructure/post.repository.ts:425`, `apps/api-node/src/modules/warehouse/infrastructure/warehouse.repository.ts:28`.

Required fix: protect deletion while physical custody/active cases exist, or provide an authorized immutable source/history path that keeps operational verification available after publication deletion. Serialize the lifecycle checks; retain legal-hold/dispute gates and source evidence.

### P2 - Unauthorized reads can mutate legacy direct claims before authorization

`getClaim`, `getVerification` and `getVerificationTemplates` call `repairLegacyDirectClaim` before checking the caller's participation. The repair changes a direct PENDING claim to CONVERSATION_OPEN, accepts both consents and may create a room.

Reproduced using a non-participant: `getClaim` returned not-found, but the persisted claim had changed to CONVERSATION_OPEN and Finder consent to ACCEPTED. No private response disclosure was observed; the demonstrated bug is unauthorized state/consent mutation. This is an existing legacy-repair path.

References: `apps/api-node/src/modules/claims/application/claim.use-cases.ts:123`, `apps/api-node/src/modules/claims/application/claim.use-cases.ts:511`, `apps/api-node/src/modules/claims/application/claim.use-cases.ts:550`.

Required fix: authorize before any repair, and prefer a controlled, audited reconciliation operation over mutating state from GET. Add a real SQL regression asserting unchanged claim, consent and room rows after an outsider read.

## Initial Executed Verification

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | Passed: 303 API tests, 0 failures, 5 opt-in SQL suites skipped; architecture and Web type check pass | Normal process exit; no force-exit |
| Explicit isolated SQL suites | 34 passed, 0 failures, 0 skipped | Loopback MySQL 9.3 on port 33309, dedicated disposable test databases; migrations/recovery, authenticated HTTP, permissions, custody/return/disposition, matching/email concurrency |
| `npm run build` | Passed | API and Web production builds |
| Full Playwright, two workers | 57 passed, 0 failures | Mocked browser APIs; desktop/mobile forms, private image previews, photo gate, LOST-owner warning, matching, chat retries, Staff intake/return, admin navigation and other existing browser cases |
| `npm audit --omit=dev --json` and `npm audit --json` | 0 known vulnerabilities | Current lockfile and registry audit response |
| Shared Aiven preflight | Passed; no pending or superseded migrations | 58 source migrations, 61 applied ledger entries, 28 APPLIED attempts; read-only check |
| Existing local API health/readiness | `ok` / `ready` | Existing user service on port 3001, point-in-time check |
| UC catalogue checker | 168 total: 97 Implemented, 17 Partial, 54 Planned | Structural/status counts, not runtime acceptance of every UC |
| `git diff --check` | Passed | Existing LF/CRLF notices are not whitespace failures |
| Additional isolated audit probes | Three defects reproduced | Real SQL/services, fake photo provider; no shared data changes. Temporary probe removed after results were recorded |

At this initial snapshot, passing suites did not cover the three failing actor journeys above. They exercised canonical FOUND return and LOST chat separately, but missed their physical handoff composition and publication deletion. Permanent composed regressions are included in the follow-up below.

## Documentation and Release Limits

- BR-68/69, FR-CUSTODY-01, FR-CHAT-02 and the partial UC mappings describe the new intake/photo/warning scope; the warning adds no new UC ID. Catalogue counts remain unchanged.
- The initial documentation contradictions are corrected in the follow-up: PENDING can go directly to INTAKED, ACCEPTED is legacy-compatible, and post/claim storage uses authenticated Cloudinary with private local fallback. Warehouse proof/intake storage remains local and still needs durable deployment.
- Historical 053/055 preflight warnings remain intentionally. No ledger/checksum/source migration was rewritten, and no shared business rows were changed during this audit.
- No current CI result covers this exact working tree. The initial audit made no commit/push/merge; the follow-up makes four scoped local commits only. Local MySQL 9.3 is not a current MySQL 8.0/8.4 CI result.
- Real Gemini/photo quality, real SMTP/Cloudinary delivery, manual actor/privacy acceptance and multi-instance warehouse-media durability were not certified by mocked/isolated tests. A successful readiness check cannot guarantee the network will never time out.

## Local Repairs and Permanent Regression Evidence

1. **LOST contact through physical return:** direct LOST rows now record the LOST owner as Claimant and the linked FOUND holder as Finder. Shared SQL identity expressions resolve legacy labels without modifying consent or history; chat, Staff review, verified recipients, withdrawal and completed feedback use the same identities. `lost-custody-return.integration.test.ts` covers both orientations through photo approval, custody intake, explicit Staff verification, private-proof return and real participant feedback, with wrong-recipient/actor, dispute, hold and premature/offline-return denials. Photo approval and intake never accept ownership.
2. **Source protection:** deletion locks the owned post, checks requests/items/claims/appointments/disputes/hold in the same transaction and only then soft-deletes. `post-custody-deletion.integration.test.ts` covers pending and received custody, unauthorized deletion, cancellation, completed eligible deletion with feedback retained, a post dispute and a deterministic race held at physical intake. It prevents new stranded sources; it does not restore previously deleted records automatically.
3. **Read-only legacy access:** removed GET repair and requester retry paths that fabricated Finder approval. `claim-readonly.test.ts` rejects unauthorized reads before transactions. `legacy-claim-read.integration.test.ts` exercises real authenticated HTTP for outsider/Staff/Admin and asserts unchanged full claim/participant/room/audit snapshots for each GET; legitimate pending reads/retries stay pending, and only an explicit authorized Finder decision opens the legacy room with audit.
4. **Preflight contract:** full SQL testing exposed a raw-label assumption in the migration-045 schema verifier. The TypeScript verifier now accepts complete recognized legacy or canonical direct-LOST participant pairs, while incomplete pairs still block preflight. No applied SQL, checksum or ledger is changed; the repair command is not executed by this audit.

BR-33 is reconciled; BR-70/71 describe the deletion/read/identity safeguards. Existing FR-POST-02, FR-CLAIM-01, media requirements and UC descriptions/mappings are updated. No new FR/UC ID is needed. Catalogue totals/statuses remain unchanged. Original dirty API/UI verification changes are retained separately, not silently included in the scoped code commits; full working-tree tests include those changes.

## Follow-Up Verification

Scoped code commits on local `dev`: `76567c8` (Trần Thế Lượng, role/return contract), `1519ad6` (Trương Quang Đạt, atomic source deletion), `29f5889` (Trần Thế Lượng, read-only legacy access). The separate documentation reconciliation commit is authored by Trương Quang Đạt. The four commits preserve the existing committer and do not reassign unrelated historical work.

| Check | Result | Scope |
| --- | --- | --- |
| `npm test` | 307 passed, 0 failures; 13 opt-in SQL test entries skipped | Normal exit; architecture 187 production files, 0 violations, Web type check passed |
| Explicit full SQL | 42 passed, 0 failed, 0 skipped | Dedicated temporary loopback MySQL 9.3 on port 33310; real migrations/repositories/HTTP and lifecycle/concurrency tests |
| `npm run build` | Passed | API and Web production builds |
| `npm audit --omit=dev --json`, `npm audit --json` | 0 known vulnerabilities | Current registry response and lockfile, not a security certification |
| Full Playwright `--workers=2` | 57 passed, 0 failed | Full desktop/mobile browser suite after SQL; mocked browser API providers |
| `npm run migrate:preflight` | Passed; 58 source, 61 applied entries, 28 APPLIED attempts, no pending/superseded | Aiven read-only; historical 053/055 warnings retained |
| `node scripts/check-uc-catalogue.mjs` | 168: 97 Implemented, 17 Partial, 54 Planned | No status promotion from these bug fixes |
| `git diff --check` | Passed | Full working tree; LF/CRLF notices are not whitespace failures |

The first full SQL rerun failed because the new canonical roles were incorrectly rejected by the old verifier; that verifier was corrected and re-tested. A subsequent run found the older database suite needed its named empty test DB; it was created only on the task-owned loopback instance. The final full run above has no skipped or failed SQL cases. Neither setup nor tests wrote to Aiven business data.

Photo analysis, SMTP and browser API providers are simulated in regressions; private proof fixtures are local, not live Cloudinary acceptance. Representative Gemini quality, copied-photo/possession limits, real SMTP/Cloudinary, durable warehouse-media multi-instance deployment, load/WCAG/manual actor/privacy acceptance and current CI remain unverified. Historical deleted/LOST-linked custody records need separately authorized source review. No new migration is needed for these repairs; no shared schema/data change, push or merge is performed.

Recommendation: the three reproduced audit defects are repaired locally, with composed failing-before/passing-after regressions. Review the scoped commits and remaining original changes, obtain current CI and operational/provider/manual acceptance, then reassess main merge readiness; this document does not grant release approval.
