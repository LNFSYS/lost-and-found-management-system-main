# Ma trận truy vết LNFS

Cập nhật mapping: **06/10/2026**, sau local [lịch hẹn, bàn giao và hành trình](../runbooks/appointment-journey-rollout.md) trên `dev@195b134`: **129 Implemented, 20 Partial, 19 Planned**. [Đối chiếu 71 UC](../audits/uc-status-review-2026-10-06.md) là snapshot trước implementation mới. [CI baseline](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37408974894) MySQL 8.0/8.4 mỗi job 437 pass/0 skip, browser 85 pass không chứng nhận thay đổi local mới hoặc deployment. Migration 063 chưa áp dụng Aiven. Receipt cũ và điểm lịch sử giữ tại các audit 04/05 October; không thay bằng kết quả mới.

## 1. Quy tắc

Nguồn status là code/test hiện tại. Mỗi dòng liên kết business rules (BR), requirement (FR/NFR), use case (UC) và evidence path. [uc.md](uc.md) là catalogue và nguồn ID UC chính thức. Migration, Jira ticket, mockup hoặc class skeleton không tự tạo evidence runtime.

## 2. Ma trận chính

| Business rules | Requirement | Use cases | Status | Evidence hoặc gap |
| --- | --- | --- | --- | --- |
| BR-01–BR-06 | FR-AUTH-01–03, FR-ROLE-01 | UC-001–UC-008, UC-062–UC-068 | Implemented/Verified | apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts; auth.use-cases.ts; auth.middleware.ts; auth.validator.test.ts; security.test.ts |
| BR-07–BR-12 | FR-WEB-01, FR-POST-01, FR-POST-02, FR-BOARD-01 | UC-013–UC-025 | Implemented/Verified | post.routes.ts; post.use-cases.ts; post.repository.ts; post.validator.ts; posts-page.tsx; post-detail-page.tsx; post validator tests |
| BR-10, BR-15, BR-18 | FR-PRIVPOST-01, FR-MEDIA-01 | UC-015, UC-019, UC-023–UC-025, UC-028, UC-045, UC-108 | Implemented current scope | Post/media visibility và serializer guards; private question/answer API không trả expected hash, raw answer nằm trong participant-protected room; claim-verification.use-cases.test.ts và HTTP runtime |
| BR-13 | FR-CATALOG-01, FR-ADMIN-01 | UC-016, UC-061, UC-069–UC-081 | Implemented/Verified | admin-catalog.repository.ts; admin-catalog.use-cases.ts; admin-page.tsx; catalog tests |
| BR-16–BR-18 | FR-AI-01, FR-AI-02 | UC-017 | Implemented/Verified | gemini-image-analyzer.ts; gemini-image.service.test.ts; story-post-form.tsx |
| BR-19–BR-25 | FR-MATCH-01–03 | UC-026–UC-031 | Implemented/Verified | matching.use-cases.ts; matching.engine.ts; matching.repository.ts; matching.engine.test.ts; post-matches-page.tsx |
| BR-26 | FR-HANDOVER-01 | UC-049, UC-050, UC-078–UC-081 | Implemented/Verified | handover.routes.ts; admin.routes.ts; admin-catalog.*; admin-handover.spec.ts |
| BR-32, BR-39 | FR-STAFF-01, FR-WAREHOUSE-01 | UC-050–UC-057 | Implemented current scope | staff.routes.ts; warehouse.use-cases.ts; warehouse.repository.ts; warehouse.use-cases.test.ts; staff-page.tsx; staff-page.spec.ts; disposition is a separate incomplete goal |
| BR-27 | NFR-DATA-01 | N/A | Implemented/Verified | migration-runner.ts; migration-runner.test.ts; numbered SQL migrations |
| BR-28 | NFR-ARCH-01; FR-JAVA-01 retired | N/A | Implemented | src/main composition; application ports; domain policies; scripts/check-architecture.mjs; Java source/build removed |
| BR-29, BR-30 | FR-MEDIA-02, NFR-PORT-01 | UC-023–UC-025, UC-044, UC-045, UC-051, UC-052, UC-055, UC-056, UC-146 | Partial | Authenticated adapters; warehouse refuses production local writes. cloudinary-private-media-storage.test.ts, warehouse-media-rollout.test.ts, warehouse-media.integration.test.ts and verify-warehouse-cloud.ts cover strict mode, unknown outcomes/CAS rollback/cleanup, real provider/API roles and independent processes/restart. 16 legacy warehouse references transferred after protected backup/UTC restore and post-check. Full production/non-warehouse/manual acceptance remains separate; warehouse-media-rollout.md |
| BR-31 | FR-AUDIT-01 | UC-069–UC-081 | Planned writer scope | Catalog audit before/after chưa có runtime evidence; new audit search does not invent those writers |
| BR-33–BR-36 | FR-VERIFY-01, FR-VERIFY-02, FR-CLAIM-01 | UC-032–UC-038, UC-043–UC-045, UC-106–UC-118 | Implemented/Partial/Planned by UC | Active question modal/private reply/evidence review UC-106–109 Implemented. General escalation and claimant overview UC-111/113–116 Partial; confidence UC-110, general Staff list UC-112 and Finder peer reservation UC-117/118 Planned. Claim/verification unit, HTTP runtime and browser regressions; no automatic answer matching |
| BR-37, BR-37A, BR-72, BR-73 | FR-APPT-01, FR-APPT-02, FR-HANDOVER-02, FR-FEEDBACK-01 | UC-126–UC-140 | Implemented except UC-129/132 Planned | appointments/application/appointment.use-cases.ts, infrastructure/appointment.repository.ts, interfaces/http/appointment.routes.ts; appointments-page.tsx; unit/integration tests, app.test.ts, appointment-journey.spec.ts. Lock/version/idempotency, dual physical acknowledgement, pending mismatch, reminder/outbox, no-show and report link. Public ITEM-only protected thumbnail projection, responsive cards/preview and explicit missing-image state. In-chat popup/custom location and reasoned cancellation before custody: claim-appointment-dialog.tsx, claim-verification-panel.tsx, claim.use-cases.ts, claim-verification.use-cases.test.ts, claims-resilience.spec.ts and appointment.integration.test.ts (linked/no-FOUND physical return). Counter-proposal/rescheduling remain missing. Rollout receipts: appointment-journey-rollout.md; image/popup/location follow-ups need no new schema |
| BR-38, BR-40, BR-42 | FR-CUSTODY-01, FR-WAREHOUSE-02 | UC-141–UC-158 | Implemented/Partial/Planned/TBD by UC | Request/queue/review/reject/cancel/intake UC-141/143–146 Implemented. UC-142/147–153/155/158 Partial; UC-154/156/157 Planned. Active disposition API guards do not complete missing order/evidence screens; policy approval remains separate |
| BR-06, BR-35, BR-41, BR-43, BR-73 | FR-CHAT-01, FR-RT-01, FR-APPT-02 | UC-039–UC-042, UC-119–UC-125 | Implemented/Partial by UC | UC-120/121/122/124 Implemented. UC-119/123/125 Partial: appointment producers now cover proposals, accept/reject/cancel, reminder/no-show and completion, but counter/reschedule/full channels remain missing. Server SSE is session-bound; Web chat polls at 10 seconds. Immediate Web subscriber/PWA push/block and general escalation remain separate gaps |
| BR-16–BR-18 | FR-TRAIN-01 | UC-101–UC-105 | Planned | Chưa có dataset pipeline, evaluation hoặc model artifact |
| BR-41 | FR-PWA-01, NFR-PWA-01 | N/A (delivery channel) | Partial | Manifest, service worker, offline shell và privacy-safe cache có; device matrix/manual evidence còn thiếu |
| BR-41 | FR-MOBILE-01, FR-MOBILE-02, NFR-MOBILE-01 | UC-M01–UC-M12 | Planned | Không tìm thấy project Android/iOS/Expo/React Native/Flutter |
| BR-03, BR-06, BR-14 | NFR-SEC-01–03, NFR-VALID-01 | UC-001–UC-009, UC-018, UC-019, UC-023, UC-044 | Implemented/Verified current scope | Zod validators, auth utilities, middleware, rate limiters và tests |
| BR-10, BR-15, BR-25 | NFR-PRIV-01 | UC-015, UC-024, UC-028, UC-045 | Implemented current API scope | Post/media/matching serializer, private search predicates, participant authorization và evidence proxy; local shared-storage deployment risk còn lại |
| BR-20, BR-24 | NFR-PERF-01 | UC-013, UC-014, UC-027, UC-029 | Implemented current baseline | Board pagination, candidate bound, time window và rerun rate limit; chưa load test |
| BR-19, BR-27, BR-39 | NFR-TEST-01 | N/A | Local and exact code-candidate CI verified | [5 October audit/CI receipt](../audits/full-system-audit-2026-10-05.md): 330 regular pass/14 opt-in skips, 45 isolated SQL pass, 69 browser pass; exact dc92525 MySQL 8.0/8.4 each 375 pass/no skips. Later commits/deployment require separate evidence. |
| BR-27, BR-28 | NFR-DATA-02 | N/A | Process rule | README yêu cầu không destructive test trên Aiven/shared DB |
| BR-27 | NFR-OBS-01 | N/A | Partial | /api/health và /api/ready có; graceful shutdown/observability cần verify thêm |
| BR-31 | NFR-AUDIT-01 | UC-056, UC-090, UC-163, UC-164, UC-166 | Implemented/Partial | Warehouse storage log, admin user/config và moderation audit đã có; catalog audit và toàn bộ domain transition còn thiếu |
| BR-31, BR-74 | FR-AUDIT-02 | UC-163, UC-166 | Implemented local API/Web | activity.use-cases.ts/repository.ts/routes.ts; admin-audit-page.tsx; activity.use-cases.test.ts, appointment.integration.test.ts, app.test.ts and appointment-journey.spec.ts. ADMIN-only filtered metadata search/export, CSV formula protection, 5000-row cap and transactional export audit; private JSON/notes omitted |
| BR-33, BR-57, BR-65, BR-74 | FR-JOURNEY-01 | UC-167 | Implemented local API/Web | activity repository authorized projection, journey-media.ts, protected journey image route, item-journey-page.tsx, journey-images.tsx, My Posts link; activity.use-cases.test.ts, journey-media.integration.test.ts, appointment.integration.test.ts and item-journey-media.spec.ts. Paired FOUND and no-FOUND custody history, independent summary, committed milestone photos, current participant/consent ACL, actual-return recipient/Finder restriction, snapshot/paging, keyboard/mobile previews. No raw chat/answers/documents/recipient/storage references; draft/unattached/offline proof stays private. Historical gaps and ambiguous sources remain explicit. Photo enhancement extends UC-167 without a new UC or migration; receipts in appointment-journey-rollout.md |

| BR-31, BR-43 | FR-ADMIN-02 | UC-062–UC-068, UC-082–UC-085 | Implemented/Verified current scope | admin-reporting.service/repository, admin-page.tsx, moderation/KPI/export tests; moderation target được suy ra từ report và KPI snapshot tách khỏi metrics theo kỳ |
| BR-31, BR-44 | FR-ADMIN-02 | UC-093–UC-096, UC-165 | Implemented/Verified | User report API/PWA, server-derived accessible targets, idempotent submit/withdraw, Admin detail và privacy-safe audit history; unit/API/Playwright coverage |
| BR-07, BR-41 | FR-AUTH-04 | UC-008–UC-012 | Implemented/Verified current scope | Cloudinary avatar adapter, live authenticated upload/signed delivery/cleanup smoke test, profile activity API/UI và avatar cleanup tests; full UI/device QA còn cần chạy |
| BR-47–BR-52 | FR-NOTIFY-01–04, NFR-MAIL-01–02 | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 | Partial | Preferences/outbox, transactional claim/chat/custody producers, read cancellation, coalescing, privacy-safe templates and worker unit/isolated SQL evidence exist. Remaining: full producer/PWA matrix, real-provider acceptance and exactly-once capability. Xem [notification-email-rules.md](../workflows/notification-email-rules.md). |

## 3. Channel evidence

| Channel | Evidence hiện tại | Status |
| --- | --- | --- |
| Web | apps/web/src/main.tsx, pages, components, Playwright tests | Implemented cho baseline |
| PWA | Responsive CSS, manifest.webmanifest, sw.js, offline shell và mobile viewport/file input | Partial: device/installability evidence còn thiếu |
| Native Mobile | Không có thư mục/project mobile | Planned — project not created yet |
| Backend/API | Node.js Clean Architecture: modules/domain/application/infrastructure/interfaces + main/shared | Implemented theo module; advanced claim/realtime vẫn partial/planned |
| Java | Không còn source/runtime/build trong repository | Retired 09/09/2026 |
| Database | Shared schema through 062; new additive 063 isolated-tested only | Earlier Aiven receipt: 58 source migrations, 61 applied entries, 28 APPLIED attempts, no then-pending migrations. It does NOT imply newly added 063 is deployed. Historical 053/055 limits remain; matching 054 stays immutable. Completed 16-photo rollout is not rerun; no ledger or custody-link rewrite |
| Test | Normal tests/typecheck/build, loopback SQL suites and Playwright | Fresh local receipts: appointment-journey-rollout.md. Earlier 379/20-skip and baseline CI 437/85 receipts remain historical in uc-status-review-2026-10-06.md. Exact new candidate CI MySQL 8.0/8.4, provider/manual/deployment acceptance still separate |

## Actor Journey Audit Corrections

5 October inventory follow-up: existing FR-STAFF-02/FR-WAREHOUSE-06, UC-051/053/056 use a responsive three/two/one-column inventory grid with image/title/status/category/receipt time and a full detail/history popup. `warehouse.repository.test.ts` checks newest-receipt ordering before pagination; `staff-page.spec.ts` covers grid layout/compact metadata, desktop/mobile detail, protected images, updates/returns, late responses and retry. No new BR/FR/UC ID or status promotion. See [inventory presentation](../workflows/warehouse-intake-evidence.md).

| Rule | Existing Requirement | Existing UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-33, BR-57, BR-65, BR-71 | FR-CLAIM-01, FR-VERIFY-03, FR-WAREHOUSE-04 | UC-034, UC-040, UC-055, UC-058–UC-060, UC-114, UC-146 | claim-identity-sql.ts, claim-participant-integrity.ts, lost-custody-return.integration.test.ts; complete new and legacy participant pairs, real SQL Staff verification/return and feedback. No consent/history rewrite or ownership from photos |
| BR-70 | FR-POST-02, FR-CUSTODY-02 | UC-022, UC-051, UC-055, UC-146 | post.repository.ts, post-custody-deletion.integration.test.ts; atomic delete blockers, deterministic concurrent intake, completed deletion and retained feedback. Previously deleted sources need authorized review |
| BR-71 | FR-ROLE-01, FR-CLAIM-01, FR-CHAT-02 | UC-034, UC-035, UC-040, UC-042 | claim-readonly.test.ts, legacy-claim-read.integration.test.ts; outsider/Staff/Admin GET snapshots unchanged, legitimate pending reads and explicit Finder action |

BR-70/71 add safeguards to existing goals. No new FR/UC ID and no blanket UC status promotion. The two Lượng code commits cover role/read safeguards; Đạt covers deletion and documentation. This does not reassign historical UC ownership from commit counts.

## 4. UC status totals

Catalogue [uc.md](uc.md); totals computed from catalogue rows with `node scripts/check-uc-catalogue.mjs` (168 IDs):

- 129 Implemented in the local dev catalogue.
- 20 Partial: UC-111, UC-113–UC-116, UC-119, UC-123, UC-125, UC-142, UC-147–UC-153, UC-155, UC-158, UC-164, UC-168.
- 19 Planned.

The earlier 71-row review retained 113/20/35. New local appointment/handover/audit/journey runtime implements 15 formerly Planned goals and UC-140, while UC-125 becomes Partial. No new UC ID; dated snapshots retain original counts. Remaining allocation contains 39 UCs with unchanged assignees. Evidence and rollout limits: [appointment-journey-rollout.md](../runbooks/appointment-journey-rollout.md).

UC-M01–UC-M12 là nhóm mobile target lịch sử, chưa thuộc catalogue 168 business UC cho tới khi team phê duyệt ID mapping. Khi đưa Native Mobile vào SRS, cần tạo mapping chính thức, không tự trùng ID.

## 5. Verification rules

- Link evidence phải trỏ tới file thực tế.
- Status chỉ nâng sau code + test/build/evidence tương ứng.
- Requirements không có UC hoặc evidence phải ghi Planned/TBD.
- Peer-to-peer flow là target main flow; Staff custody là optional/escalation.
- Native Mobile không được ghi implemented khi repository chưa có project.
- Jira/sprint/assignee chưa xác minh vì không có connector trong workspace.

## 6. Custody Safety Traceability (Integrated Baseline)

| BR | FR | UC | Runtime and regression evidence |
| --- | --- | --- | --- |
| BR-53, BR-54, BR-65, BR-68 | FR-CUSTODY-02, FR-VERIFY-03, FR-WAREHOUSE-06 | UC-042, UC-141–UC-146 | claim.use-cases.ts; custody-request.use-cases.ts; photo-custody-source.ts; custody-request/warehouse/warehouse-intake repositories; lost-custody-return.integration.test.ts covers no-FOUND Finder-photo receipt, explicit Staff verification, return/feedback and legacy roles; custody-safety.integration.test.ts covers authenticated HTTP; staff-page.spec.ts covers protected CONTACT_PHOTO display and intake on desktop/mobile. Local 5 October follow-up, not deployed acceptance. |
| BR-55 | FR-WAREHOUSE-03 | UC-053–UC-055, UC-151–UC-158 | warehouse.use-cases.ts, warehouse.repository.ts, staff.routes.ts; real SQL approval/hold/terminal PATCH tests. Full disposition/evidence UI not complete. |
| BR-56, BR-57 | FR-WAREHOUSE-04 | UC-052, UC-055, UC-057–UC-060, UC-146 | warehouse-policy.ts, private-media-storage.ts, canonical return/proof/feedback integration tests |
| BR-58, BR-59 | FR-NOTIFY-05 | UC-147, UC-150, UC-168 | custody-notifications.ts, notification-email.worker.ts, main/server.ts, transactional integration tests; only custody-item overdue producer implemented here |
| BR-60 | FR-MATCH-05 | UC-026–UC-031, UC-040, UC-042 | matching.repository.ts, post.use-cases.ts, claim.repository.ts; real HTTP inactive/deleted/hidden/own LOST + source FOUND regression |
| BR-53–BR-60 | FR-STAFF-02 | UC-051–UC-056, UC-143–UC-146 | staff-page.tsx; staff-page.spec.ts; claims-resilience.spec.ts; story-post-form.spec.ts; desktop/mobile screenshots |
| BR-27 | NFR-DATA-01–02 | N/A | Exact historical ledger and schema verifiers; canonical 053, safety 054, recovery 056–058 and 059/060 applied on Aiven after backup/rehearsal. Original matching 054 is recovered, original custody-time 055 remains unverified; two LOST custody links require physical-source review. See [recovery evidence](../runbooks/database-warehouse-recovery.md). |

See [warehouse rules](../workflows/warehouse-retention-and-status-rules.md) for project defaults, state semantics and release constraints. UC-141/143–146 are Implemented from active API/Web and regressions, not schema alone. UC-142/147 remain Partial for actual scheduling/producer gaps; manual physical/provider acceptance is separate for all statuses.

## Matching and Custody Audit Corrections (4 October 2026)

| BR | FR / NFR | UC | Code and Verification |
| --- | --- | --- | --- |
| BR-61 | FR-MATCH-06 | UC-026–UC-028 | post.controller.ts, post.use-cases.ts, matching.use-cases.ts; http-runtime-scenario.ts verifies more than 20 matches, page 2 and owner-scoped recalculate |
| BR-62 | FR-MATCH-07 | UC-098, UC-099 | matching use cases/repository, post-matches-page.tsx; application + real HTTP dismissal/feedback replay tests, story-post-form.spec.ts; Implemented actor goals, manual/privacy acceptance tracked separately |
| BR-63 | FR-MATCH-08 | UC-100 | matching-refresh.worker.ts, matching.repository.ts, main/server.ts, 060_matching_refresh_leases.sql; matching-refresh.integration.test.ts fences two SQL connections, expired completion/failure/persistence, closed posts and five-attempt exhaustion |
| BR-65 | FR-VERIFY-03 | UC-114, UC-055, UC-146 | warehouse.verifyCustodyClaim, return-claim-reviews/verify-claim routes, Staff return modal; custody-verification.test.ts, custody-safety.integration.test.ts and staff-page.spec.ts. Only post-intake approval is delivered; no automatic intake ownership decision. |
| BR-66 | FR-WAREHOUSE-05 | UC-055, UC-148 | warehouse-policy.ts, canonical returnItem and Staff action; warehouse-return.test.ts, custody-safety.integration.test.ts and RECEIVED/EXPIRED browser return cases. Terminal disposition and legal hold remain blocking. |
| BR-67 | FR-NOTIFY-06 | UC-168, UC-147 | notification-email.worker.ts, repository and SMTP adapter; heartbeat/uncertainty unit tests and real SQL two-worker delivery test. CANCELLED uncertainty codes deliberately favor no duplicate over guaranteed optional delivery. |
| BR-54, BR-68 | FR-CUSTODY-01, FR-WAREHOUSE-06 | UC-051, UC-052, UC-056, UC-144, UC-146 | custody-request.use-cases.ts; intake-evidence.ts; warehouse-intake.repository.ts; 061_warehouse_intake_evidence.sql; warehouse-intake-dialog.tsx; warehouse-images.tsx; intake-evidence.test.ts; custody-safety.integration.test.ts; staff-page.spec.ts. Shared DB migration applied 4 October 2026 after backup/isolated rehearsal; durable media/application deployment and manual acceptance remain pending. See warehouse-intake-evidence.md and database-warehouse-recovery.md. |
| BR-35, BR-69 | FR-CHAT-01, FR-CHAT-02 | UC-034, UC-040, UC-041, UC-042, UC-044, UC-045, UC-106–UC-109, UC-120 | Photo/contact/chat runtime and tests remain unchanged. Communication-only decision alone books no time/place or ownership; separate appointments module now implements UC-128 under additive 063. shared 062/photo/provider receipts retain their original scope; see lost-contact-photo-rules.md and appointment-journey-rollout.md |
| BR-61 | FR-MATCH-06, FR-MATCH-07 | UC-026, UC-028 | Source-owner filtering occurs in buildStoredResults before totals/slicing; serializer only maps/redacts. matching.use-cases.test.ts and custody-safety.integration.test.ts cover pageSize=1 for owner/Staff/Admin and keep inactive permitted history/viewer feedback scope. |
| BR-64 | NFR-DATA-01–02 | UC-098–UC-100 | matching-recovery-supersession.ts, migration runner/preflight, immutable 054/057, additive 060; matching-refresh.integration.test.ts verifies three upgrade paths, ledger/timestamps/legacy labels and schema drift |

No new UC is introduced. The scheduler's historical scope did not implement UC-097. The 7 October local follow-up adds a separate producer and moves UC-097 to Partial, not accepted deployment. Historical evidence remains in [matching-feedback-review.md](../audits/matching-feedback-review.md).

| Business rules | Requirements | Use cases | Local follow-up evidence |
| --- | --- | --- | --- |
| BR-47–BR-52 | FR-MATCH-04, FR-NOTIFY-01–04 | UC-097, UC-026, UC-029, UC-100, UC-168 | matching.use-cases.ts/repository, notification-email.worker.ts/repository, matching-email.integration.test.ts and story-post-form.spec.ts; 60% cross-owner dedupe, transactional rollback, closed-post cancellation, preferences and one-time popup. CI/deployment/inbox acceptance remain pending; [policy and limits](../workflows/matching-notification-rules.md). |
