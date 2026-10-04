# Physical Intake and LOST Contact Verification

Date: 4 October 2026. Branch: local dev, based on fd122e6. This is automated verification evidence, not an operational Done/acceptance record.

## Separate Changes

- df6a1ad: queue physical receipt without Staff pre-approval; retain legacy ACCEPTED, refusal/cancellation reasons and audit.
- aa36b6b: private pre-item condition uploads, source reconciliation, account-free walk-in, reviewed AI suggestions and inventory galleries.
- 6271e57: server-side LOST contact-photo gate above 60%, safe existing question prompts and strict separation from ownership/return.
- The follow-up intake regression commit covers the real HTTP evidence contract, explicit AI review and Escape closing image zoom without discarding reconciliation.

## Executed Checks

| Check | Result | Scope |
| --- | --- | --- |
| npm test | Passed; API 299 passed, 5 opt-in SQL suites skipped | Architecture guards, API tests and Web type check; normal exit without force-exit |
| npm run build | Passed | Node API and React production builds |
| npx tsx --test apps/api-node/src/integration/*.test.ts | 33 passed, 0 failed, 0 skipped | Explicit disposable loopback MySQL 9.3; fresh/repeated migrations, history/recovery, real authenticated HTTP, private media and custody/return gates |
| npm --workspace @lnfs/web run e2e:home | 49 passed, 0 failed | Browser fixture APIs, desktop/mobile source and intake images/zoom, AI failure/manual fallback and explicit application, LOST threshold/provider failure/legacy chat, existing app regressions |
| npm run migrate:preflight | Passed; 061 and 062 pending | Read-only configured shared Aiven DB; no DDL, ledger edits or shared-data changes |
| git diff --check | Passed | No patch whitespace errors |

SQL suites reject remote hosts and require an explicit *_test database and LNFS_TEST_DB_* credentials. This run used port 33309 on a separate temporary MySQL instance, not the user's normal MySQL or Aiven. No MySQL 8.x CI run is claimed here. Browser image fixtures and the simulated analysis provider do not evaluate representative real-photo/Gemini quality.

## Remaining Release Work

1. Back up the shared database and rehearse/apply additive 061_warehouse_intake_evidence.sql and 062_lost_contact_photo_checks.sql through the migration runner. Historical 053/055 compatibility warnings remain recorded; preflight does not recover unavailable original SQL.
2. Run manual Staff/Admin/Finder role and privacy QA using real source/condition photos and representative Gemini successes/failures. Check physical quantity/accessories, pending/legacy receipt, cancellation/refusal, retained source fields, inventory zoom and received-versus-stored status.
3. Exercise real LOST contact, copied/mismatched image limits, safe questions and unchanged Staff ownership/dispute/legal-hold/return-proof gates. Photo similarity is communication support, never proof of live possession or ownership.
4. Resolve durable private-media deployment, push/review the local commits when authorized, and record actual CI/PR/Jira and operator acceptance evidence. None of those steps is marked complete by local tests.

Rules and design detail: [physical intake](warehouse-intake-evidence.md), [LOST contact](lost-contact-photo-rules.md), [business rules](business-rules.md), [requirements](requirements.md) and [traceability](traceability-matrix.md).
