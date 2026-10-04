# Dev Audit Fixes and Release Evidence

Date: 4 October 2026. Workspace: `fptu-lost-found-system-main`, branch `dev`.
Merged baseline: `5ab9f0d` (PR #79). The four fixes below are local commits; this audit does not push, merge into main or deploy remote API/Web.

## Fixed Findings

| Finding | Commit | Runtime and regression evidence |
| --- | --- | --- |
| Unverified chat claim blocks return after custody intake | `497e846` | Staff/Admin explicitly verifies a consented claimant after physical intake, with rationale and independent audit. Finder identity/decisions/history remain intact; competing cases, reservations and legal hold still block. Warehouse review/verify routes and return modal; custody-verification tests, claim-history guard, SQL transaction/concurrency and desktop/mobile browser checks |
| Undisposed EXPIRED property cannot return | `d547674` | Canonical return uses the same domain transition policy and Staff UI action. Identity/contact/private-proof and case/hold gates are unchanged; generic PATCH cannot bypass return and processed terminal states cannot reopen. Policy/application, SQL EXPIRED return and browser regressions |
| Slow SMTP permits duplicate workers | `242a9b6` | Live lease heartbeat, pre-send check and token/expiry fences. Expired PROCESSING, unknown outcomes and failed post-send acknowledgements are cancelled, never automatically resent. Only explicit NOT_SENT errors retry. Mock-transport unit tests and real SQL slow-send two-worker/stale-lease tests |
| Staff/Admin matching page counts precede source-owner exclusion | `2bd63cc` | Matching excludes source owner's LOST before total/slicing, separately from viewer feedback/dismissals. Serialization only maps/redacts the page; permitted inactive history remains. Unit and real HTTP owner/Staff/Admin pageSize=1 checks |

## Verification

Commands were run from the current workspace without force-exit:

| Command | Result and limit |
| --- | --- |
| `npm test` | API: 274 passed, 0 failed, 5 opt-in DB suites skipped; architecture: 177 production files, 0 violations, checker tests 2 passed; Web type checks passed. Process exited naturally |
| `npm run build` | API TypeScript and Web production builds passed |
| `npm --workspace @lnfs/api-node run test:db-integration` | 31 passed, 0 failed, 0 skipped, all five suites. Isolated loopback MySQL 9.3 on port 33311, test-only database/credentials; no shared Aiven writes |
| `npm --workspace @lnfs/web run e2e:home` | 39 passed, 0 failed. Includes Staff claimant verification at desktop/mobile and RECEIVED/EXPIRED returns; API calls are mocked. Screenshots/layout assertions cover overflow and action text |
| `npm run migrate:preflight` | Read-only Aiven check: 56 source migrations, 59 applied entries, 26 applied attempts; pending/superseded lists empty. Historical 053 scope and unavailable original custody-time 055 warnings remain intentional |
| `node scripts/check-uc-catalogue.mjs` | 168 IDs: 97 Implemented, 16 Partial, 55 Planned; no duplicate/new UC IDs |

Integration opt-in configuration uses `LNFS_DB_INTEGRATION=1`, loopback `LNFS_TEST_DB_HOST`, port 33311 and a database ending in `_test`. Isolated root credentials are test-only and are not committed. A real-provider SMTP/Gemini call is not part of these tests. Local MySQL 9.3 is not a substitute for the target MySQL 8.4 matrix.

The merged baseline passed [remote CI on MySQL 8.0/8.4 with browser/build checks](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37123734681). That run predates these four commits. Their remote CI must run after push; no new remote CI result is claimed here.

## Documents and UC Scope

- New rules: BR-65 explicit post-intake Staff verification, BR-66 retained EXPIRED return, BR-67 conservative optional-email lease/uncertainty policy. BR-61 now explicitly separates source-owner exclusion from viewer scope before pagination.
- New requirements: FR-VERIFY-03, FR-WAREHOUSE-05 and FR-NOTIFY-06. Related existing matching, custody, notification and migration requirements are synchronized in requirements/business-rules/traceability.
- No new actor goal or UC ID. UC-114 is Partial because only custody approval exists, not general escalation rejection/more-information review. UC-141 through UC-147 are Partial with existing request/intake runtime and scheduling/full acceptance gaps. Other Planned UCs are not upgraded merely from schema or guard evidence.
- Recovery/matching documents distinguish historical review counts from current merged runtime. 059 is already applied; 060 was applied on 3 October after backup/rehearsal, with ready schema and preserved history. No migration SQL/checksum/ledger was changed by these fixes. Restricted rollout receipt and unresolved historical links remain in [database recovery](database-warehouse-recovery.md).

## Release Gates

1. Push reviewed commits and require remote CI for the actual new head; merge into main remains a separate decision.
2. Before deploying the email fix, stop/drain ALL older API and standalone email workers. Mixed versions may retain the old expired-lease reclaim policy. Do not automatically requeue uncertain CANCELLED rows without independent provider evidence that nothing was delivered.
3. Perform manual role/privacy and provider acceptance. Stable Message-ID is correlation, not exactly-once; cancellation may lose an optional email while in-app remains canonical. SMTP stage/idle timeouts do not guarantee a total send deadline.
4. Keep the two historical LOST-linked custody records under physical-source review; do not fabricate a FOUND link, recipient or lifecycle correction. Shared schema readiness does not resolve these legacy business-data issues.
5. University retention approval, complete disposition/evidence/campaign UI, walk-in/stale-case overdue producers, durable multi-instance private storage and crash-orphan reconciliation remain separate work.
