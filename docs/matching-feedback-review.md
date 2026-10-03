# Matching feedback and periodic refresh

Scope: UC-098, UC-099, UC-100. UC-097 notifications are excluded.

## Runtime contract

- GET `/api/posts/:id/matches?page=1&pageSize=20` returns owner/Staff/Admin-authorized suggestions with privacy redaction and stable score/date/id ordering.
- POST `/api/posts/:id/matches/:matchId/feedback`: `value` is USEFUL, IRRELEVANT or INCORRECT; optional `note` (500 characters); required `correlationKey` (8-128 characters).
- POST `/api/posts/:id/matches/:matchId/dismiss`: optional `reason` (500 characters), required `correlationKey`.
- Exact replays return the original result. Conflicting feedback or a correlation key reused for another match returns conflict.
- Dismissal persists per actor/source/match across recalculation. There is no automatic resurfacing or restore action.
- Feedback and dismissal do not create claims, verify ownership, change appointments or complete handover.
- Refresh uses deterministic matching and stored signals; no live Gemini/OCR dependency.

## Running

1. Run `npm run migrate` before starting the updated API.
2. Run `npm run dev` and open My Posts, then the matching view for an owned active post.
3. Rate a suggestion, reload, dismiss it, then recalculate. Rating persists and dismissal stays hidden.
4. Use an unrelated account to check source-post access denial.
5. Refresh defaults: enabled, polling every 300 seconds, eligibility interval 6 hours, batch size 20, stale lease 15 minutes. See `.env.example` for MATCHING_REFRESH_* configuration.

## Verification recorded on 2026-10-03

- `npm test`: architecture checks and 197 API/unit tests passed; 2 isolated MySQL tests skipped; web type-check passed.
- `npm run build`: API and web passed.
- `npx playwright test tests/story-post-form.spec.ts tests/profile-feedback.spec.ts` from apps/web: 7 passed.
- On 2026-09-30, migration 054 applied to the configured database; the reported post query returned 6 suggestions and scheduler enqueue succeeded.
- Historical custody migration compatibility is limited to the exact observed 053/055 checksums and a custody schema check. It neither rewrites the ledger nor installs custody on fresh databases.

## Remaining review evidence

- Isolated MySQL concurrent-worker/replay tests and complete manual role/privacy QA remain pending. SQL/worker unit tests are not substitutes for database concurrency evidence.
- Existing operational preflight drift: storage_logs.action and warehouse_items.idx_warehouse_retention_deadline. This change does not repair warehouse schema.
- Reviewed PR and Jira evidence must be supplied before Done; no PR approval or Jira completion is claimed.
