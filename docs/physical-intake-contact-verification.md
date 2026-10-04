# Physical Intake and LOST Contact Verification

Date: 4 October 2026. Branch: local dev, based on fd122e6. This is automated verification evidence, not an operational Done/acceptance record.

## Separate Changes

- df6a1ad: queue physical receipt without Staff pre-approval; retain legacy ACCEPTED, refusal/cancellation reasons and audit.
- aa36b6b: private pre-item condition uploads, source reconciliation, account-free walk-in, reviewed AI suggestions and inventory galleries.
- 6271e57: server-side LOST contact-photo gate above 60%, safe existing question prompts and strict separation from ownership/return.
- The follow-up intake regression commit covers the real HTTP evidence contract, explicit AI review and Escape closing image zoom without discarding reconciliation.
- Uncommitted verification fix: direct LOST rooms use their target post when no physical FOUND source is linked; private item details remain owner-scoped. Inline verification errors/retry replace indefinite loading, with coalesced, room-scoped polling. This repairs existing BR-69/FR-CHAT-02 behavior and adds no UC ID or ownership approval.

## Executed Checks

| Check | Result | Scope |
| --- | --- | --- |
| npm test | Passed; API 303 passed, 5 opt-in SQL suites skipped | Architecture guards, API tests and Web type check; normal exit without force-exit |
| npm run build | Passed | Node API and React production builds |
| npx tsx --test apps/api-node/src/integration/*.test.ts | 34 passed, 0 failed, 0 skipped | Explicit disposable loopback MySQL 9.3; fresh/repeated migrations, history/recovery, real authenticated HTTP, direct LOST verification without a FOUND source, owner-scoped private media and custody/return gates |
| Playwright test --workers=2 (apps/web) | Latest full rerun: 57 passed, 0 failed | Browser fixture APIs, desktop/mobile source and intake images/zoom, AI failure/manual fallback and explicit application, LOST threshold/provider failure/legacy chat, four Finder decisions, inline verification errors/retry/room isolation, LOST-owner safety reminder/FOUND exclusion and existing app regressions |
| npm run migrate:preflight | Passed; no pending migrations after 061/062 apply | Shared Aiven rollout on 4 October after encrypted backup and isolated restore/repeat-run rehearsal; old ledger preserved |
| Focused migration/backup/maintenance tests | 17 passed, 0 failed | Schema pause/recovery, history protection, lock/failure handling and authenticated encrypted backup |
| git diff --check | Passed | No patch whitespace errors |

SQL suites reject remote hosts and require an explicit *_test database and LNFS_TEST_DB_* credentials. This run used port 33309 on a separate temporary MySQL instance, not the user's normal MySQL or Aiven. No MySQL 8.x CI run is claimed here. Browser image fixtures and the simulated analysis provider do not evaluate representative real-photo/Gemini quality.

The initial six-worker browser run overlapped the integration suites and had three page-setup/screenshot timeouts. After SQL finished, a clean full rerun with two browser workers passed all 52 tests without changing timeouts or skipping tests. The focused six-test chat suite also passed independently. Read-only live use-case probes of the affected shared LOST room confirmed the correct Finder/Claimant roles and `balo` template with ownership still unapproved; no shared business rows were changed for the verification fix.

## Remaining Release Work

The subsequent full working-tree audit reproduced three uncovered defects despite green automated suites: physical return from direct LOST contact with a linked FOUND source, source deletion after intake, and unauthorized legacy GET repair. They are now repaired locally with permanent regressions: `lost-custody-return.integration.test.ts` exercises new and legacy participant roles through real Staff verification/return/feedback; `post-custody-deletion.integration.test.ts` protects pending/received sources and tests a deterministic intake race; `legacy-claim-read.integration.test.ts` verifies unchanged SQL snapshots for unauthorized and pending reads. No consent or ownership is inferred from GET, photo approval or intake. Complete canonical LOST participant pairs also pass preflight verification without changing applied SQL/ledger. See [the full audit, latest rerun and remaining release gates](full-system-audit-2026-10-04.md).

The check table above remains the earlier intake/photo snapshot. The actor-journey follow-up is a separate local verification record in the full audit, not CI, deployment or provider acceptance. Previously deleted source posts still require authorized review; this prevention fix does not automatically restore shared records. Existing uncommitted verification/UI changes remain separate from the four scoped audit commits.

Shared schema rollout completed on 4 October 2026 at 12:48:48 UTC. All three new tables are present; the maintenance probe is ready and the existing local API readiness/health checks pass. The isolated restored DB preserved original business rows and ledger records, including on a repeated migration run. See [the recovery rollout record](database-warehouse-recovery.md) for the protected backup/receipt and MySQL 9.3 versus Aiven 8.4.8 scope. Historical 053/055 compatibility warnings remain; preflight does not recover unavailable original SQL.

1. Run manual Staff/Admin/Finder role and privacy QA using real source/condition photos and representative Gemini successes/failures. Check physical quantity/accessories, pending/legacy receipt, cancellation/refusal, retained source fields, inventory zoom and received-versus-stored status.
2. Exercise real LOST contact, copied/mismatched image limits, safe questions and unchanged Staff ownership/dispute/legal-hold/return-proof gates. Photo similarity is communication support, never proof of live possession or ownership.
3. Resolve durable private-media deployment, push/review the local commits when authorized, and record actual CI/PR/Jira and operator acceptance evidence. None of those steps is marked complete by local tests or schema readiness.

Rules and design detail: [physical intake](warehouse-intake-evidence.md), [LOST contact](lost-contact-photo-rules.md), [business rules](business-rules.md), [requirements](requirements.md) and [traceability](traceability-matrix.md).
