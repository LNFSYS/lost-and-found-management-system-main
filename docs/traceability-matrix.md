# Ma trận truy vết LNFS

Cập nhật mapping: **06/10/2026**, gồm UC-120 Partial và [photo/chat follow-up](lost-contact-photo-rules.md). Baseline matching đã merge: `dev@5ab9f0d` (PR #79); audit follow-up và tám commit trước đó đã push `dev` trong candidate `dc92525`. CI đúng SHA lịch sử này đã xanh MySQL 8.0/8.4 (375 test mỗi job, không skip) và browser (69 test). Bằng chứng rollout và giới hạn xem [audit 05/10 + receipt](full-system-audit-2026-10-05.md) và [re-audit repairs](full-system-re-audit-2026-10-05.md); candidate sau vẫn phải kiểm tra CI riêng. [Verification LNFS-55](LNFS-55-SAFETY-VERIFICATION.md) và [dev audit fixes](dev-main-audit-fixes.md) giữ snapshot lịch sử, không chứng nhận deployment mới.

## 1. Quy tắc

Nguồn status là code/test hiện tại. Mỗi dòng liên kết business rules (BR), requirement (FR/NFR), use case (UC) và evidence path. [uc.md](uc.md) là catalogue và nguồn ID UC chính thức. Migration, Jira ticket, mockup hoặc class skeleton không tự tạo evidence runtime.

## 2. Ma trận chính

| Business rules | Requirement | Use cases | Status | Evidence hoặc gap |
| --- | --- | --- | --- | --- |
| BR-01–BR-06 | FR-AUTH-01–03, FR-ROLE-01 | UC-001–UC-008, UC-062–UC-068 | Implemented/Verified | apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts; auth.use-cases.ts; auth.middleware.ts; auth.validator.test.ts; security.test.ts |
| BR-07–BR-12 | FR-WEB-01, FR-POST-01, FR-POST-02, FR-BOARD-01 | UC-013–UC-025 | Implemented/Verified | post.routes.ts; post.use-cases.ts; post.repository.ts; post.validator.ts; posts-page.tsx; post-detail-page.tsx; post validator tests |
| BR-10, BR-15, BR-18 | FR-PRIVPOST-01, FR-MEDIA-01 | UC-015, UC-019, UC-023–UC-025, UC-028, UC-045 | Implemented current scope | post.repository.ts visibility predicates; media.ts; media-storage.ts; post/match/private-evidence serializer and authorization tests; guided private answers chưa có |
| BR-13 | FR-CATALOG-01, FR-ADMIN-01 | UC-016, UC-061, UC-069–UC-081 | Implemented/Verified | admin-catalog.repository.ts; admin-catalog.use-cases.ts; admin-page.tsx; catalog tests |
| BR-16–BR-18 | FR-AI-01, FR-AI-02 | UC-017 | Implemented/Verified | gemini-image-analyzer.ts; gemini-image.service.test.ts; story-post-form.tsx |
| BR-19–BR-25 | FR-MATCH-01–03 | UC-026–UC-031 | Implemented/Verified | matching.use-cases.ts; matching.engine.ts; matching.repository.ts; matching.engine.test.ts; post-matches-page.tsx |
| BR-26 | FR-HANDOVER-01 | UC-049, UC-050, UC-078–UC-081 | Implemented/Verified | handover.routes.ts; admin.routes.ts; admin-catalog.*; admin-handover.spec.ts |
| BR-32, BR-39 | FR-STAFF-01, FR-WAREHOUSE-01 | UC-050–UC-057 | Implemented/Partial | staff.routes.ts; warehouse.use-cases.ts; warehouse.repository.ts; warehouse.use-cases.test.ts; staff-page.tsx; staff-page.spec.ts |
| BR-27 | NFR-DATA-01 | N/A | Implemented/Verified | migration-runner.ts; migration-runner.test.ts; numbered SQL migrations |
| BR-28 | NFR-ARCH-01; FR-JAVA-01 retired | N/A | Implemented | src/main composition; application ports; domain policies; scripts/check-architecture.mjs; Java source/build removed |
| BR-29, BR-30 | FR-MEDIA-02, NFR-PORT-01 | UC-023–UC-025, UC-044, UC-045, UC-051, UC-052, UC-055, UC-056, UC-146 | Partial | Authenticated adapters; warehouse refuses production local writes. cloudinary-private-media-storage.test.ts, warehouse-media-rollout.test.ts, warehouse-media.integration.test.ts and verify-warehouse-cloud.ts cover strict mode, unknown outcomes/CAS rollback/cleanup, real provider/API roles and independent processes/restart. 16 legacy warehouse references transferred after protected backup/UTC restore and post-check. Full production/non-warehouse/manual acceptance remains separate; warehouse-media-rollout.md |
| BR-31 | FR-AUDIT-01 | UC-069–UC-081, UC-163 | Planned | Catalog audit before/after chưa có runtime evidence |
| BR-33–BR-36 | FR-VERIFY-01, FR-VERIFY-02, FR-CLAIM-01 | UC-032–UC-038, UC-043–UC-045, UC-106–UC-118 | Implemented/Partial | claim routes/use-cases/repository/validators; verification-question-templates.ts; claim-verification-panel.tsx; state/idempotency/privacy/AI-negative unit tests và claims-resilience Playwright. Staff review và OCR evidence vẫn partial/planned |
| BR-37 | FR-APPT-01, FR-HANDOVER-02 | UC-126–UC-140 | Partial/Planned | Canonical `ACCEPTED` eligibility policy và negative tests có; appointment/dual-confirmation runtime chưa có |
| BR-38, BR-40, BR-42 | FR-CUSTODY-01, FR-WAREHOUSE-02 | UC-141–UC-158 | Partial/TBD | Custody request/queue/intake and canonical disposition API guards are in dev. Full scheduling/order/evidence UI and acceptance remain incomplete; university policy is unapproved |
| BR-06, BR-35, BR-41, BR-43 | FR-CHAT-01, FR-RT-01 | UC-039–UC-042, UC-119–UC-125 | Partial/Planned | Private REST text/IMAGE room, participant-protected media, retry idempotency, cursor history, notifications and session-bound SSE. UC-120 now Partial for actual multipart API/Web image runtime. realtime-auth-lifetime.test.ts and realtime.use-cases.test.ts cover expiry/revocation/timeout/disconnect; claims-resilience.spec.ts covers delayed text/image, verification and evidence across room switches. Full seen/unread/PWA push, image provider/manual acceptance and general escalation review remain open |
| BR-16–BR-18 | FR-TRAIN-01 | UC-101–UC-105 | Planned | Chưa có dataset pipeline, evaluation hoặc model artifact |
| BR-41 | FR-PWA-01, NFR-PWA-01 | N/A (delivery channel) | Partial | Manifest, service worker, offline shell và privacy-safe cache có; device matrix/manual evidence còn thiếu |
| BR-41 | FR-MOBILE-01, FR-MOBILE-02, NFR-MOBILE-01 | UC-M01–UC-M12 | Planned | Không tìm thấy project Android/iOS/Expo/React Native/Flutter |
| BR-03, BR-06, BR-14 | NFR-SEC-01–03, NFR-VALID-01 | UC-001–UC-009, UC-018, UC-019, UC-023, UC-044 | Implemented/Verified current scope | Zod validators, auth utilities, middleware, rate limiters và tests |
| BR-10, BR-15, BR-25 | NFR-PRIV-01 | UC-015, UC-024, UC-028, UC-045 | Implemented current API scope | Post/media/matching serializer, private search predicates, participant authorization và evidence proxy; local shared-storage deployment risk còn lại |
| BR-20, BR-24 | NFR-PERF-01 | UC-013, UC-014, UC-027, UC-029 | Implemented current baseline | Board pagination, candidate bound, time window và rerun rate limit; chưa load test |
| BR-19, BR-27, BR-39 | NFR-TEST-01 | N/A | Local and exact code-candidate CI verified | [5 October audit/CI receipt](full-system-audit-2026-10-05.md): 330 regular pass/14 opt-in skips, 45 isolated SQL pass, 69 browser pass; exact dc92525 MySQL 8.0/8.4 each 375 pass/no skips. Later commits/deployment require separate evidence. |
| BR-27, BR-28 | NFR-DATA-02 | N/A | Process rule | README yêu cầu không destructive test trên Aiven/shared DB |
| BR-27 | NFR-OBS-01 | N/A | Partial | /api/health và /api/ready có; graceful shutdown/observability cần verify thêm |
| BR-31 | NFR-AUDIT-01 | UC-056, UC-090, UC-163, UC-164, UC-166 | Implemented/Partial | Warehouse storage log, admin user/config và moderation audit đã có; catalog audit và toàn bộ domain transition còn thiếu |

| BR-31, BR-43 | FR-ADMIN-02 | UC-062–UC-068, UC-082–UC-085 | Implemented/Verified current scope | admin-reporting.service/repository, admin-page.tsx, moderation/KPI/export tests; moderation target được suy ra từ report và KPI snapshot tách khỏi metrics theo kỳ |
| BR-31, BR-44 | FR-ADMIN-02 | UC-093–UC-096, UC-165 | Implemented/Verified | User report API/PWA, server-derived accessible targets, idempotent submit/withdraw, Admin detail và privacy-safe audit history; unit/API/Playwright coverage |
| BR-07, BR-41 | FR-AUTH-04 | UC-008–UC-012 | Implemented/Verified current scope | Cloudinary avatar adapter, live authenticated upload/signed delivery/cleanup smoke test, profile activity API/UI và avatar cleanup tests; full UI/device QA còn cần chạy |
| BR-47–BR-52 | FR-NOTIFY-01–04, NFR-MAIL-01–02 | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 | Partial | Preferences/outbox, transactional claim/chat/custody producers, read cancellation, coalescing, privacy-safe templates and worker unit/isolated SQL evidence exist. Remaining: full producer/PWA matrix, real-provider acceptance and exactly-once capability. Xem [notification-email-rules.md](notification-email-rules.md). |

## 3. Channel evidence

| Channel | Evidence hiện tại | Status |
| --- | --- | --- |
| Web | apps/web/src/main.tsx, pages, components, Playwright tests | Implemented cho baseline |
| PWA | Responsive CSS, manifest.webmanifest, sw.js, offline shell và mobile viewport/file input | Partial: device/installability evidence còn thiếu |
| Native Mobile | Không có thư mục/project mobile | Planned — project not created yet |
| Backend/API | Node.js Clean Architecture: modules/domain/application/infrastructure/interfaces + main/shared | Implemented theo module; advanced claim/realtime vẫn partial/planned |
| Java | Không còn source/runtime/build trong repository | Retired 09/09/2026 |
| Database | Numbered migrations through 062, checksum/preflight runner and forward recovery | Aiven read-only preflight: 58 source migrations, 61 applied entries, 28 APPLIED attempts, no pending migrations. Historical 053/055 limits remain; exact matching 054 stays immutable. Authorized photo rollout changes only 16 warehouse storage references, with unchanged other metadata/ledger and retained originals; no DDL or custody-link correction. Schema evidence is not business acceptance |
| Test | Normal Node tests/typecheck/build, opt-in loopback SQL suites and two-worker Playwright | Commands, current counts and limits: full-system-audit-2026-10-04.md. Provider/manual QA and remote CI for follow-up commits remain separate |

## Actor Journey Audit Corrections

5 October inventory follow-up: existing FR-STAFF-02/FR-WAREHOUSE-06, UC-051/053/056 use a responsive three/two/one-column inventory grid with image/title/status/category/receipt time and a full detail/history popup. `warehouse.repository.test.ts` checks newest-receipt ordering before pagination; `staff-page.spec.ts` covers grid layout/compact metadata, desktop/mobile detail, protected images, updates/returns, late responses and retry. No new BR/FR/UC ID or status promotion. See [inventory presentation](warehouse-intake-evidence.md).

| Rule | Existing Requirement | Existing UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-33, BR-57, BR-65, BR-71 | FR-CLAIM-01, FR-VERIFY-03, FR-WAREHOUSE-04 | UC-034, UC-040, UC-055, UC-058–UC-060, UC-114, UC-146 | claim-identity-sql.ts, claim-participant-integrity.ts, lost-custody-return.integration.test.ts; complete new and legacy participant pairs, real SQL Staff verification/return and feedback. No consent/history rewrite or ownership from photos |
| BR-70 | FR-POST-02, FR-CUSTODY-02 | UC-022, UC-051, UC-055, UC-146 | post.repository.ts, post-custody-deletion.integration.test.ts; atomic delete blockers, deterministic concurrent intake, completed deletion and retained feedback. Previously deleted sources need authorized review |
| BR-71 | FR-ROLE-01, FR-CLAIM-01, FR-CHAT-02 | UC-034, UC-035, UC-040, UC-042 | claim-readonly.test.ts, legacy-claim-read.integration.test.ts; outsider/Staff/Admin GET snapshots unchanged, legitimate pending reads and explicit Finder action |

BR-70/71 add safeguards to existing goals. No new FR/UC ID and no blanket UC status promotion. The two Lượng code commits cover role/read safeguards; Đạt covers deletion and documentation. This does not reassign historical UC ownership from commit counts.

## 4. UC status totals

Catalogue [uc.md](uc.md); totals computed from catalogue rows with `node scripts/check-uc-catalogue.mjs` (168 IDs):

- 97 Implemented in the dev catalogue.
- 18 Partial, including UC-098–UC-100, UC-106, UC-114, UC-120, UC-141–UC-147 and UC-168.
- 53 Planned.

Reconciled 6 October: UC-120 moves from Planned to Partial based on its new authenticated image-message API/UI, not tests alone. No new UC ID or Implemented promotion; dated audit snapshots retain their historical counts. Remaining Partial/Planned allocation is still 71 UCs.

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
| BR-27 | NFR-DATA-01–02 | N/A | Exact historical ledger and schema verifiers; canonical 053, safety 054, recovery 056–058 and 059/060 applied on Aiven after backup/rehearsal. Original matching 054 is recovered, original custody-time 055 remains unverified; two LOST custody links require physical-source review. See [recovery evidence](database-warehouse-recovery.md). |

See [warehouse rules](warehouse-retention-and-status-rules.md) for project defaults, state semantics and release constraints. The custody baseline is merged in dev; UC-141–UC-147 are Partial with explicit remaining gaps, not automatically Implemented from schema presence.

## Matching and Custody Audit Corrections (4 October 2026)

| BR | FR / NFR | UC | Code and Verification |
| --- | --- | --- | --- |
| BR-61 | FR-MATCH-06 | UC-026–UC-028 | post.controller.ts, post.use-cases.ts, matching.use-cases.ts; http-runtime-scenario.ts verifies more than 20 matches, page 2 and owner-scoped recalculate |
| BR-62 | FR-MATCH-07 | UC-098, UC-099 | matching use cases/repository, post-matches-page.tsx; application + real HTTP dismissal/feedback replay tests, story-post-form.spec.ts; merged runtime, Partial for manual/privacy acceptance |
| BR-63 | FR-MATCH-08 | UC-100 | matching-refresh.worker.ts, matching.repository.ts, main/server.ts, 060_matching_refresh_leases.sql; matching-refresh.integration.test.ts fences two SQL connections, expired completion/failure/persistence, closed posts and five-attempt exhaustion |
| BR-65 | FR-VERIFY-03 | UC-114, UC-055, UC-146 | warehouse.verifyCustodyClaim, return-claim-reviews/verify-claim routes, Staff return modal; custody-verification.test.ts, custody-safety.integration.test.ts and staff-page.spec.ts. Only post-intake approval is delivered; no automatic intake ownership decision. |
| BR-66 | FR-WAREHOUSE-05 | UC-055, UC-148 | warehouse-policy.ts, canonical returnItem and Staff action; warehouse-return.test.ts, custody-safety.integration.test.ts and RECEIVED/EXPIRED browser return cases. Terminal disposition and legal hold remain blocking. |
| BR-67 | FR-NOTIFY-06 | UC-168, UC-147 | notification-email.worker.ts, repository and SMTP adapter; heartbeat/uncertainty unit tests and real SQL two-worker delivery test. CANCELLED uncertainty codes deliberately favor no duplicate over guaranteed optional delivery. |
| BR-54, BR-68 | FR-CUSTODY-01, FR-WAREHOUSE-06 | UC-051, UC-052, UC-056, UC-144, UC-146 | custody-request.use-cases.ts; intake-evidence.ts; warehouse-intake.repository.ts; 061_warehouse_intake_evidence.sql; warehouse-intake-dialog.tsx; warehouse-images.tsx; intake-evidence.test.ts; custody-safety.integration.test.ts; staff-page.spec.ts. Shared DB migration applied 4 October 2026 after backup/isolated rehearsal; durable media/application deployment and manual acceptance remain pending. See warehouse-intake-evidence.md and database-warehouse-recovery.md. |
| BR-35, BR-69 | FR-CHAT-01, FR-CHAT-02 | UC-034, UC-040, UC-041, UC-042, UC-044, UC-045, UC-106, UC-107, UC-120 | contact-photo.use-cases.ts/repository.ts; contact-photo-questions.ts; claim.use-cases.ts/routes/repository.ts; lost-contact-photo-gate.tsx; claims-page.tsx; claim-chat-image.tsx; claim-evidence-panel.tsx. 6 October follow-up: >=50% boundary, immediate room/checked IMAGE, Finder-only photo-analysis suggestions with no room-read fallback, one-click ordinary-text send/collapse and reopen/retry without losing drafts, top Finder actions, communication-only meetup excluded by warehouse verified-recipient SQL, protected two-participant PHOTO/IMAGE uploads and focused evidence form. Coverage: contact-photo.use-cases.test.ts, contact-photo-questions.test.ts, claim-verification.use-cases.test.ts, lost-custody-return.integration.test.ts, custody-safety.integration.test.ts, lost-contact-photo.spec.ts, claims-resilience.spec.ts. No new DDL. Shared 062 rollout is dated evidence only; real-provider, deployment and manual acceptance remain pending. UC-120 is now Partial, no UC becomes Implemented. Communication-only proposal does not complete appointment UC-128. See lost-contact-photo-rules.md. |
| BR-61 | FR-MATCH-06, FR-MATCH-07 | UC-026, UC-028 | Source-owner filtering occurs in buildStoredResults before totals/slicing; serializer only maps/redacts. matching.use-cases.test.ts and custody-safety.integration.test.ts cover pageSize=1 for owner/Staff/Admin and keep inactive permitted history/viewer feedback scope. |
| BR-64 | NFR-DATA-01–02 | UC-098–UC-100 | matching-recovery-supersession.ts, migration runner/preflight, immutable 054/057, additive 060; matching-refresh.integration.test.ts verifies three upgrade paths, ledger/timestamps/legacy labels and schema drift |

No new UC is introduced. UC-097 notification delivery remains Planned and is not conflated with this scheduler. Evidence and rollout limitations: [matching-feedback-review.md](matching-feedback-review.md).
