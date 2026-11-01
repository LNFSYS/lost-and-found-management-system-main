# Warehouse disposition and completed-return feedback

Date: 2026-10-07. Scope: UC-148-153, UC-155, UC-158 and the profile feedback appointment selector.

## Setup

1. Use the repository's existing environment and current migration chain. No new schema migration is introduced by this change.
2. Run `npm ci`, `npm run build`, then `npm run dev` at the repository root.
3. Use a disposable test database with two distinct Admin accounts, one Staff account and one ordinary User. Do not backdate or dispose of real shared records for testing.
4. Prepare an active warehouse item whose retention deadline is past and which has no active claim, appointment, reservation, report or legal hold. Prepare separate fresh/held/claimed items for rejection cases.

## Feedback without a UUID

1. Complete a return through the existing dual-confirmation or authorised custody flow.
2. Sign in as either real participant and open `/profile`.
3. Under feedback, select the completed appointment by item title/date. No UUID entry is required.
4. Submit a rating/comment once. The selected row displays the recorded rating; reopening it displays existing feedback.
5. Check the other participant's account, an unrelated account, empty history, pagination and network retry. No other participant's contact/evidence is included in the list.

`GET /api/returns/completed?page=1` derives the participant from the session, returns 20 rows plus `hasMore`, orders by completion time/ID and uses private/no-store caching. Existing feedback eligibility/idempotency rules are unchanged. A walk-in return without an online appointment or real participant account is not given a fabricated appointment.

## Warehouse workflow

1. Open `/admin/staff?tab=warehouse` (Staff can also open `/staff` and select the warehouse tab).
2. Enable the overdue/non-held filter and apply it. A fresh, deleted, returned, disposed, donated or transferred item must not appear. A held item remains accessible through the unfiltered inventory.
3. Open item detail. Review deadline, legal hold, claim/appointment/dispute blockers, storage history and eligibility.
4. As Admin A, enter a reason and apply legal hold. Creation/approval/execution must be blocked. Repeating the same hold state creates no second audit entry. Remove the hold with a reason.
5. As Admin A, select disposal, donation or transfer and create the order. A repeat of the same actor/target/reason returns the existing active order; a different active request is rejected.
6. Admin A cannot approve their own order. Sign in as Admin B, open the same item and approve. Staff cannot create orders, approve or change holds.
7. As Staff or Admin, upload 1-5 JPG/PNG/WebP proofs (maximum 5 MB each), review them and check the execution confirmation. Record completion.
8. Verify the terminal item status, executed order, attached proof and audit. Replaying successful execution must not add another event. Raw storage URLs are never returned by the disposition context.
9. Between approval and execution, add a hold or active case in a separate fixture: execution must be rejected. Missing, duplicate, wrong-item or wrong-uploader proof is rejected too.

Each order concerns one existing warehouse item. Rejection, cancellation and donation campaigns (UC-156/157/159-162) are not implemented by this change.

## APIs

| Method and path (under `/api`) | Access |
| --- | --- |
| GET `/staff/warehouse-items?overdue=true&page=1&pageSize=12` | Staff/Admin |
| GET `/staff/warehouse-items/:id/disposition` | Staff/Admin; eligibility, orders, proof IDs, logs |
| POST `/staff/warehouse-items/:id/legal-hold` | Admin; `{ held, reason }` |
| POST `/staff/warehouse-items/:id/disposition` | Admin; `{ target, reason }` |
| POST `/staff/warehouse-approvals/:id/approve` | Different Admin |
| POST `/staff/warehouse-items/upload-proof` | Staff/Admin; multipart `itemId`, `file` |
| GET `/staff/warehouse-proofs/:id` | Staff/Admin; authenticated binary response |
| POST `/staff/warehouse-approvals/:id/execute` | Staff/Admin; `{ proofIds }` |

## Retention reminders

The existing maintenance task runs every 60 seconds with its existing overlap protection. Upcoming alerts default to 7 days (`warehouse.retention_alert_days`, clamped to 1-30); overdue alerts start after the deadline. The batch is bounded to 100 records and skips records already notified to all current active Staff/Admin recipients. Deduplication is keyed by item, deadline, phase and recipient. A changed deadline or newly authorised staff member can receive a new alert; an unchanged retry does not repeat it. Held items may still generate reminders, but notification never releases a hold or changes warehouse/claim/ownership state. Existing custody reminders remain intact.

## Verification and remaining evidence

- Local results on 2026-10-07: `npm test` passed (426 backend tests passed, 32 skipped; architecture and web lint passed); `npm run build` passed; the two Playwright suites passed 35/35. Build retains the existing large-bundle warning.
- `npm test`: architecture checks, backend tests and web TypeScript lint. Database integration suites require explicit isolated MySQL and are skipped without it.
- `npm run build`: API and production web type-check/build.
- `cd apps/web; npx playwright test tests/profile-feedback.spec.ts tests/staff-page.spec.ts`: mocked API browser workflows including desktop/mobile and existing custody/return regressions.
- Added use-case and SQL-contract tests cover replay, separate approver, guards, evidence scope, reminder recipients/deduplication, return-list privacy and owner scoping. HTTP tests cover 401/403 and pagination validation.
- Extended `custody-safety.integration.test.ts` for early eligibility rejection and retention recipient/deduplication assertions. This suite was **not executed against a database in this environment**: no isolated local MySQL/Docker is available.
- Browser tests are not live API/database or real multi-account evidence. Run the workflow above on an isolated migrated environment before marking these UCs Implemented/Done. No Jira update, reviewed PR or production readiness is claimed.
