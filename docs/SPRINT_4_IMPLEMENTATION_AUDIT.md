# LNFS Sprint 4 Implementation Audit

Cập nhật: **02/09/2026**
Nguồn Jira: **LNFS Sprint 4, sprint ID 70, snapshot 01/09/2026**
Kho đối chiếu: **fptu-lost-found-system-main**

> Đây là audit từ snapshot offline, không phải truy vấn Jira trực tiếp. Trạng thái Jira được giữ nguyên như snapshot; trạng thái code chỉ được kết luận từ runtime source, test và command đã chạy. Không chỉnh Jira, không chạy migration trên Aiven/shared DB.

> Cập nhật phiên làm việc ngày 02/09/2026: sau snapshot trên, migration `039_admin_user_and_config_audit.sql` đã được chạy thành công trên shared Aiven bằng `npm run migrate`. Đã xác minh `schema_migrations`, bảng `admin_audit_logs` và các cột audit mới trong `config_history`. Các nhận định “chưa chạy migration” bên dưới phản ánh snapshot trước cập nhật.

## 1. Kết luận nhanh

Sprint 4 có hướng nghiệp vụ đúng nhưng backlog **chưa đủ chuẩn để giữ nguyên và đánh dấu Done**. Có ba nhóm vấn đề chính:

- LNFS-56 đã có implementation và test thực tế nhưng Jira vẫn To Do.
- LNFS-50 đã có API/UI runtime cho system configuration/public config; đợt hardening này bổ sung history, audit và bảo vệ key nhạy cảm.
- LNFS-52, LNFS-53, LNFS-54, LNFS-58, LNFS-62, LNFS-63 phụ thuộc lẫn nhau và đang gom quá nhiều claim, chat, appointment, handover, notification và PWA vào một sprint 9 ngày.
- LNFS-57 ghi Java AI/OCR nhưng kiến trúc repository xác định Node.js là core API; Java chỉ là health skeleton.
- LNFS-62 và LNFS-63 là ticket umbrella lớn, có nhiều phần trùng với các ticket khác và không nên dùng như story triển khai độc lập.

| Chỉ số | Kết quả |
| --- | ---: |
| Tổng ticket trong snapshot | 17 |
| Jira Done | 2 |
| Jira To Do | 15 |
| Code verified baseline | 3 |
| Code partial | 7 |
| Chưa có runtime hoặc sai ownership | 8 |
| Blocked bởi dependency/artifact | 1 |
| Estimate/story point trong snapshot | Không có |

## 2. Audit từng ticket

| Key | Jira snapshot | Code-verified status | Evidence hiện có | Acceptance/gap/conflict | Khuyến nghị |
| --- | --- | --- | --- | --- | --- |
| LNFS-47 | Done, P0, assignee field Võ Chiêu Quân; description ghi Tran The Luong | **Partial: core verified** | apps/api-node/src/routes/admin.routes.ts; admin-catalog.service.ts; admin-catalog.repository.ts; admin-catalog.validator.ts; apps/web/src/pages/admin-page.tsx; admin-catalog.service.test.ts; apps/web/tests/admin-handover.spec.ts | CRUD, active-only public query, map/marker validation và hard-delete guard có code/test. Guard active appointment được test ở service/UI nhưng không có appointment runtime để kiểm tra end-to-end. Branch/PR/Jira evidence không có trong repository. Assignee bị lệch. | Giữ ticket, bổ sung PR/Jira evidence và test integration với dữ liệu appointment thật trước khi coi hoàn toàn Done. Đồng bộ assignee. |
| LNFS-50 | Done, P0, assignee field/description Truong Quang Dat | **Implemented with hardening** | `apps/api-node/src/routes/config.routes.ts`, `admin.routes.ts`, typed validator/service/repository, Admin Config UI, `039_admin_user_and_config_audit.sql`, service/validator tests. | Public response chỉ allowlist key và parse typed value; admin CRUD có role guard, history, audit, pessimistic transaction lock và reject credential-like keys. Cần chạy migration trên môi trường triển khai sau khi review. | Giữ Done nếu gắn commit/PR/Jira evidence; không đưa secret vào system config, tiếp tục dùng environment secret. |
| LNFS-51 | To Do, P1, assignee field Truong Quang Dat; description ghi PHAM NGUYEN ANH KHOA | **Planned / not implemented** | apps/web/src/pages/profile-page.tsx chỉ có profile cơ bản; migration 018_return_feedback.sql là foundation. Không có feedback/reputation/activity route/service/UI. | Chưa có completed return runtime để kiểm tra eligibility, reputation event hoặc feedback duplication/authorization. Assignee bị lệch. | Giữ To Do nhưng tách feedback eligibility, reputation event và profile activity. Phụ thuộc dual-confirmed return của LNFS-54. |
| LNFS-52 | To Do, P0, assignee PHAM NGUYEN ANH KHOA | **Planned / not implemented** | Có schema foundation trong migration claim/private proof; không có claim/chat controller, route, service, repository hoặc Web page runtime. | Chưa có private conversation, duplicate-request guard, participant authorization, private attachment proxy, state transition hoặc notification. | Tách claim creation/conversation authorization và private evidence upload/access. Chỉ bắt đầu sau khi contract claim được chốt. |
| LNFS-53 | To Do, P0, assignee Tran The Luong | **Planned / not implemented** | Có migration 029_ai_verification_questions.sql và 032_ai_feedback_and_question_options.sql; không có runtime route/UI/service. | Chưa có Finder decision, reason audit, question isolation, secret-answer privacy hoặc competing claimant handling. Migration không phải evidence runtime. | Tách question template/read, Finder decision/state machine và privacy/security tests. |
| LNFS-54 | To Do, P0, assignee Võ Chiêu Quân | **Planned / not implemented** | Có appointment-related migrations; apps/api-node/src/routes không có appointment route/controller/service; không có Web appointment UI. | Chưa có mutual agreement, one active reservation, reschedule/cancel/no-show, dual confirmation hoặc direct-versus-custody audit. | Tách appointment lifecycle và handover confirmation. Chốt state machine trước khi viết UI. |
| LNFS-55 | To Do, P1, assignee Tran The Luong | **Partial** | apps/api-node/src/services/warehouse.service.ts; warehouse.controller.ts; staff.routes.ts; apps/web/src/pages/staff-page.tsx; warehouse.service.test.ts; migrations 014, 015, 037 | Receive/store/return, retention deadline, state transitions và logs đã có. Chưa có Finder transfer request, overdue alert/notification, authorized disposition approval, legal hold/dispute guard và disposition evidence. | Tách custody intake, overdue alert và disposition. Không auto-dispose; cần policy trường và approval matrix. |
| LNFS-56 | To Do, P1, assignee Võ Chiêu Quân | **Implemented and hardened; Jira status stale** | matching.engine.ts; matching.service.ts; matching.repository.ts; post.service.ts; apps/web/src/pages/post-matches-page.tsx; matching engine/service/repository/post-service tests; story-post-form.spec.ts | Baseline có normalize tiếng Việt, weighted tiered score, bounded candidates, persisted explanation, rate limit và Web analysis. Hardening ngày 02/09 bổ sung active-pair filtering, config fallback, ownership/role và private-signal tests. UC notification/polling vẫn planned theo LNFS-58. | Gắn branch, commit, test evidence và PR vào Jira rồi chuyển Done; không gộp notification/realtime của LNFS-58. |
| LNFS-57 | To Do, P1, assignee Tran The Luong | **Not implemented; wrong ownership** | AI hiện nằm ở apps/api-node/src/services/gemini-image.service.ts; Java chỉ có JavaAdminServiceApplication.java và Actuator health. | Không có Java AI/OCR endpoint, integration, persistence confidence hoặc claim-review runtime. Node là core/write owner. Google Vision/OCR trong description chưa có runtime evidence. | Đổi thành Node.js Gemini decision-support nếu cần. Java chỉ giữ health skeleton; tách OCR provider integration thành task riêng nếu có provider, privacy và test. |
| LNFS-58 | To Do, P1, assignee Truong Quang Dat | **Planned / not implemented** | apps/api-node/src/routes không có Socket.IO/chat/notification routes; Web không có conversation/message page; không có realtime runtime trong package/source. | Ticket quá rộng: chat, image message, retry/idempotency, seen/read, guided events, meetup events, notification, report/block, escalation. | Tách chat contract/room auth, text messages, private image messages, notification và retry/read state thành story nhỏ. |
| LNFS-59 | To Do, P1, assignee PHAM NGUYEN ANH KHOA | **Partial** | admin-catalog.service.ts; admin.routes.ts; apps/web/src/pages/admin-page.tsx có catalog/handover, user/config tabs và limited catalog stats. | Không có moderation/report route, dashboard toàn hệ thống hoặc export. Role guard cho current admin catalog/user/config có, nhưng acceptance dashboard/statistic chưa đủ. | Tách moderation/report, dashboard KPI và export. Xác định nguồn dữ liệu và expected counts trước test. |
| LNFS-60 | To Do, P1, assignee PHAM NGUYEN ANH KHOA | **Partial** | apps/web/src/main.tsx; route-guard.tsx; context/auth-context.tsx; auth pages; profile-page.tsx; responsive E2E. | Auth/refresh/profile cơ bản có. Chưa có manifest, service worker, installability, offline shell, avatar, activity hoặc reputation. Mobile phải hiểu là mobile-browser/PWA, không phải native mobile. | Tách PWA foundation khỏi profile/activity. Thêm installability/device matrix và privacy-safe offline acceptance criteria. |
| LNFS-61 | To Do, P1, assignee field Truong Quang Dat; description ghi PHAM NGUYEN ANH KHOA | **Partial** | apps/web/src/pages/posts-page.tsx; post-detail-page.tsx; story-post-form.tsx; post.routes.ts; posts-page.spec.ts; story-post-form.spec.ts | Responsive board, detail, LOST/FOUND management và multi-image input có. Chưa có PWA installability/service worker/offline behavior/device matrix. Assignee bị lệch. | Ghi rõ Web baseline đã có; tách PWA shell/caching khỏi board/post UX. Đồng bộ assignee. |
| LNFS-62 | To Do, P1, assignee Võ Chiêu Quân | **Planned / not implemented** | Không có claim/chat/appointment/notification runtime trong route/page inventory. | Trùng với LNFS-52 đến LNFS-58, gom toàn bộ peer-return journey và PWA vào một ticket. | Không giữ dạng story lớn. Đổi thành PWA integration test/release checklist sau khi feature nền hoàn thành. |
| LNFS-63 | To Do, P0, assignee Võ Chiêu Quân | **Blocked / not ready** | Existing Playwright tests pass baseline: auth, posts, matching, mobile layout, Staff warehouse, Admin handover/map. | Chưa có P2P E2E từ claim đến private chat, guided questions, meetup và dual handover; chưa có custody alternative E2E, notification, no-show, dispute, PWA installability/offline evidence. Phụ thuộc LNFS-52 đến LNFS-62. | Để cuối sprint dưới dạng release gate. Không đánh dấu Done bằng test baseline hiện tại. |
| LNFS-80 | To Do, Report 3, assignee Tran The Luong | **Partial / blocked by missing artifact** | Có project-overview.md, requirements.md, traceability-matrix.md, use-case-checklist.md; không có file Report 3/SRS artifact trong workspace. | Acceptance yêu cầu content được chèn vào Report 3 và bao phủ Web/Mobile, nhưng chưa có template/file Report 3. Mobile cần tách PWA và Native Mobile planned. | Giữ task documentation nhưng tạo/đính kèm đúng Report 3 template trước. |
| LNFS-81 | To Do, Report 3, assignee Võ Chiêu Quân | **Partial / blocked by missing artifact** | Có business-rules.md, requirements.md, LNFS_BUSINESS_PROCESS_A_TO_Z.md và audit report này; không có Report 3 artifact. | NFR/business rules đã chuẩn hóa trong Markdown nhưng chưa được chèn vào Report 3; chưa có format chính thức từ team/mentor. | Giữ task; hoàn thiện Report 3 sau khi chốt format, priority, retention/disposition policy và Native Mobile capacity. |

## 3. Các acceptance criteria cần sửa chung

- “API/UI where applicable is integrated and manually tested” cần ghi endpoint, role, payload, error cases, test file và manual QA result cụ thể.
- “A branch, commits, PR link and Jira update are attached before Done” là release evidence, không thay thế acceptance criteria chức năng.
- Ticket Done phải có code, test và evidence link. Migration, bảng database hoặc mockup không đủ.
- Claim/evidence/chat/appointment phải có backend authorization, privacy boundary, state transition, idempotency/concurrency và negative tests.
- AI/matching chỉ là decision support; không tự accept claim, đổi ownership hoặc hoàn tất handover.
- PWA phải tách khỏi Native Mobile. Repository hiện có Web responsive và file input, nhưng chưa có manifest, service worker, installability, offline shell hoặc device/release evidence.

## 4. Xung đột backlog và đề xuất chuẩn hóa

### 4.1 Ownership

- Node.js là core API, migration owner và write owner.
- Java chỉ là Spring Boot health skeleton; không có login flow, AI flow hoặc domain write flow.
- LNFS-57 cần đổi ownership khỏi Java hoặc tách phần Java health/integration thành task khác.

### 4.2 Peer-to-peer business flow

Thứ tự đúng nên là:

1. Match suggestion/explanation (LNFS-56, đã có baseline).
2. Claim và private conversation (LNFS-52).
3. Guided questions và Finder decision (LNFS-53).
4. Mutual appointment (LNFS-54).
5. Dual handover confirmation (LNFS-54).
6. Feedback/reputation sau completed return (LNFS-51).
7. Custody/warehouse chỉ là escalation hoặc Finder transfer (LNFS-55).
8. Realtime, notification và PWA integration được kiểm tra sau khi domain contract ổn định (LNFS-58, LNFS-62, LNFS-63).

Không nên dùng Staff làm reviewer mặc định cho claim peer-to-peer. Staff chỉ tham gia khi có escalation, sensitive item, dispute hoặc transfer-to-custody.

### 4.3 Priority và capacity

- Jira system priority của snapshot là Medium, trong khi label/summary dùng P0/P1. Cần chọn một nguồn priority chính hoặc ghi mapping chính thức.
- Sprint chạy từ 01/09 đến 09/09 nhưng không có estimate/story point. Với 15 ticket To Do, nhiều ticket epic-sized, rủi ro overcommit cao.
- LNFS-52, LNFS-53, LNFS-54, LNFS-58, LNFS-62, LNFS-63 không nên được coi là các story nhỏ độc lập.

### 4.4 Trùng hoặc gộp scope

- LNFS-56 trùng implementation hiện tại, nên chuyển Done/hardening.
- LNFS-60 có profile/reputation/activity, trùng một phần LNFS-51.
- LNFS-62 trùng phần lớn LNFS-52 đến LNFS-58 và nên trở thành integration/release checklist.
- LNFS-63 là release gate, không phải ticket có thể hoàn thành trước các dependency.
- LNFS-59 nên tách moderation, dashboard và export.
- LNFS-55 nên tách custody intake, overdue alert và disposition approval.

## 5. Commands và evidence đã chạy

Các command dưới đây được chạy trên repository fptu-lost-found-system-main; source runtime không bị sửa trong đợt audit này.

| Command | Kết quả |
| --- | --- |
| npm run test | **PASS**: 84 API test pass, 1 DB integration test skip an toàn; Web TypeScript check pass |
| npm run build | **PASS**: API TypeScript build và Web Vite production build |
| npm --workspace @lnfs/web run e2e:home | **PASS 16/16**: auth resilience, post creation, matching view, mobile layout, Staff warehouse và Admin handover/map |
| npm run build:java | **BLOCKED**: máy không có Maven trong PATH; chưa kết luận Java source lỗi |
| npm run migrate | **Không chạy** để tránh tác động Aiven/shared DB; migration 039 đã được thêm và cần apply ở môi trường triển khai |
| git diff --check | **PASS** |
| Markdown relative-link scan | **PASS**: link tương đối trong README/docs resolve được |

Các test hiện tại chưa bao phủ claim, private evidence, realtime chat, appointment, dual handover, notification, PWA installability/offline và native mobile.

## 6. Trạng thái theo channel

| Channel | Status | Evidence/gap |
| --- | --- | --- |
| Web | **Implemented baseline** | Auth, board, my posts, detail, LOST/FOUND, catalog, handover admin, Gemini draft, matching, Staff warehouse |
| PWA | **Partial** | Responsive/mobile-browser flow và file input có; manifest, service worker, installability, offline shell, device matrix chưa có |
| Native Mobile | **Planned — project not created** | Không có Android/iOS/Expo/React Native/Flutter project trong repository |
| Node.js API | **Core/write owner** | Auth, posts, catalog, matching, warehouse, Gemini, admin user và system config route/service hiện có |
| Java | **Health skeleton only** | Chỉ Actuator health; không sở hữu AI, auth hoặc domain write |
| Database | **Migration foundation** | Có schema cho nhiều planned domain nhưng không dùng schema thay runtime evidence; không chạy migration audit trên Aiven |

## 7. Blockers và quyết định cần xác nhận

- Cần quyền/connector Jira để xác nhận branch, PR, Jira history, exact assignee và system priority.
- Cần Report 3 template/artifact để hoàn thành LNFS-80 và LNFS-81 đúng acceptance.
- Cần team chốt Native Mobile framework, capacity và sprint tương ứng.
- Cần chốt retention/disposition policy, sensitive-item policy và quyền Staff khi escalation.
- Cần chốt realtime transport, notification provider và shared object storage.
- Cần claim/appointment state machine trước khi viết các ticket phụ thuộc.

## 8. Verdict

**Sprint 4 backlog vẫn chưa nên đánh dấu Done hàng loạt.** LNFS-50 đã có runtime và hardening trên nhánh triển khai này; LNFS-47/LNFS-56 vẫn cần commit/PR/Jira evidence. Cần sửa ownership LNFS-57 và tách các ticket lớn trước khi giao sprint. LNFS-63 chỉ được dùng làm release gate sau khi các dependency thực sự có runtime và test.

Không có Jira issue nào được thay đổi từ audit này.
