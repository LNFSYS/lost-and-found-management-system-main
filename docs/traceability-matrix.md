# Ma trận truy vết LNFS

Cập nhật: **06/09/2026**

## 1. Quy tắc

Nguồn status là code/test hiện tại. Mỗi dòng liên kết business rules (BR), requirement (FR/NFR), use case (UC) và evidence path. Migration, Jira ticket, mockup hoặc class skeleton không tự tạo evidence runtime.

## 2. Ma trận chính

| Business rules | Requirement | Use cases | Status | Evidence hoặc gap |
| --- | --- | --- | --- | --- |
| BR-01–BR-06 | FR-AUTH-01–03, FR-ROLE-01 | UC-001, UC-002, UC-031–UC-036 | Implemented/Verified | apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts; auth.use-cases.ts; auth.middleware.ts; auth.validator.test.ts; security.test.ts |
| BR-07–BR-12 | FR-WEB-01, FR-POST-01, FR-POST-02, FR-BOARD-01 | UC-040–UC-047 | Implemented/Verified | post.routes.ts; post.use-cases.ts; post.repository.ts; post.validator.ts; posts-page.tsx; post-detail-page.tsx; post validator tests |
| BR-10, BR-15, BR-18 | FR-PRIVPOST-01, FR-MEDIA-01 | UC-041, UC-044, UC-048, UC-050, UC-054 | Implemented current scope | post.repository.ts visibility predicates; media.ts; media-storage.ts; post/match/private-evidence serializer and authorization tests; guided private answers chưa có |
| BR-13 | FR-CATALOG-01, FR-ADMIN-01 | UC-064, UC-065 | Implemented/Verified | admin-catalog.repository.ts; admin-catalog.use-cases.ts; admin-page.tsx; catalog tests |
| BR-16–BR-18 | FR-AI-01, FR-AI-02 | UC-086, UC-088, UC-091 | Implemented/Verified | gemini-image-analyzer.ts; gemini-image.service.test.ts; story-post-form.tsx |
| BR-19–BR-25 | FR-MATCH-01–03 | UC-068–UC-072, UC-075, UC-076 | Implemented/Verified | matching.use-cases.ts; matching.engine.ts; matching.repository.ts; matching.engine.test.ts; post-matches-page.tsx |
| BR-26 | FR-HANDOVER-01 | UC-008–UC-010, UC-055–UC-058 | Implemented/Verified | handover.routes.ts; admin.routes.ts; admin-catalog.*; admin-handover.spec.ts |
| BR-32, BR-39 | FR-STAFF-01, FR-WAREHOUSE-01 | UC-011–UC-015, UC-058–UC-062 | Implemented/Partial | staff.routes.ts; warehouse.use-cases.ts; warehouse.repository.ts; warehouse.use-cases.test.ts; staff-page.tsx; staff-page.spec.ts |
| BR-27 | NFR-DATA-01 | N/A | Implemented/Verified | migration-runner.ts; migration-runner.test.ts; numbered SQL migrations |
| BR-28 | NFR-ARCH-01; FR-JAVA-01 retired | N/A | Implemented | src/main composition; application ports; domain policies; scripts/check-architecture.mjs; Java source/build removed |
| BR-29, BR-30 | FR-MEDIA-02, NFR-PORT-01 | UC-048, UC-050 | Partial/Planned | Local media/evidence 404 handling có; shared object storage và multi-instance test chưa có |
| BR-31 | FR-AUDIT-01 | UC-064, UC-065 | Planned | Catalog audit before/after chưa có runtime evidence |
| BR-33–BR-36 | FR-VERIFY-01, FR-VERIFY-02, FR-CLAIM-01 | UC-003–UC-007, UC-049, UC-052–UC-054, UC-087–UC-092 | Partial | claim.routes.ts, claim.use-cases.ts, claim.repository.ts, claims-page.tsx; participant privacy, pagination, state-lock và idempotency tests; guided questions/review confidence/appointment chưa có |
| BR-37 | FR-APPT-01, FR-HANDOVER-02 | UC-021–UC-024 | Planned | Chưa có appointment và dual-confirmation runtime |
| BR-38, BR-40, BR-42 | FR-CUSTODY-01, FR-WAREHOUSE-02 | UC-016–UC-020 | Planned/TBD | Disposition/custody guard và policy trường chưa có hoặc chưa được xác nhận |
| BR-41, BR-43 | FR-CHAT-01, FR-RT-01 | UC-077–UC-083 | Partial/Planned | Private REST text room, participant guard, retry idempotency, cursor history và claim notifications có; Socket.IO, image chat, seen/unread realtime và escalation review chưa có |
| BR-40 | FR-TRAIN-01 | UC-026–UC-030 | Planned | Chưa có dataset pipeline, evaluation hoặc model artifact |
| BR-41 | FR-PWA-01, NFR-PWA-01 | UC-093–UC-100 | Partial | Manifest, service worker, offline shell và privacy-safe cache có; device matrix/manual evidence còn thiếu |
| BR-41 | FR-MOBILE-01, FR-MOBILE-02, NFR-MOBILE-01 | UC-M01–UC-M12 | Planned | Không tìm thấy project Android/iOS/Expo/React Native/Flutter |
| BR-03, BR-06, BR-14 | NFR-SEC-01–03, NFR-VALID-01 | UC-001, UC-002, UC-031–UC-036, UC-040, UC-041, UC-048 | Implemented/Verified current scope | Zod validators, auth utilities, middleware, rate limiters và tests |
| BR-10, BR-15, BR-25 | NFR-PRIV-01 | UC-048, UC-050, UC-054, UC-076 | Implemented current API scope | Post/media/matching serializer, private search predicates, participant authorization và evidence proxy; local shared-storage deployment risk còn lại |
| BR-20, BR-24 | NFR-PERF-01 | UC-047, UC-068, UC-075 | Implemented current baseline | Board pagination, candidate bound, time window và rerun rate limit; chưa load test |
| BR-19, BR-27, BR-39 | NFR-TEST-01 | N/A | Partial | API 137 pass/1 skip, Web typecheck, Playwright 23/23 và build pass; isolated MySQL integration chưa chạy, complete return flow chưa có |
| BR-27, BR-28 | NFR-DATA-02 | N/A | Process rule | README yêu cầu không destructive test trên Aiven/shared DB |
| BR-27 | NFR-OBS-01 | N/A | Partial | /api/health và /api/ready có; graceful shutdown/observability cần verify thêm |
| BR-31 | NFR-AUDIT-01 | UC-015, UC-064–UC-067 | Implemented/Partial | Warehouse storage log, admin user/config và moderation audit đã có; catalog audit và toàn bộ domain transition còn thiếu |

| BR-31, BR-43 | FR-ADMIN-02 | UC-066, UC-067, UC-084 | Implemented/Verified current scope | admin-reporting.service/repository, admin-page.tsx, moderation/KPI/export tests; moderation target được suy ra từ report và KPI snapshot tách khỏi metrics theo kỳ |
| BR-07, BR-41 | FR-AUTH-04 | UC-038, UC-039 | Implemented/Verified current scope | Cloudinary avatar adapter, live authenticated upload/signed delivery/cleanup smoke test, profile activity API/UI và avatar cleanup tests; full UI/device QA còn cần chạy |

## 3. Channel evidence

| Channel | Evidence hiện tại | Status |
| --- | --- | --- |
| Web | apps/web/src/main.tsx, pages, components, Playwright tests | Implemented cho baseline |
| PWA | Responsive CSS, manifest.webmanifest, sw.js, offline shell và mobile viewport/file input | Partial: device/installability evidence còn thiếu |
| Native Mobile | Không có thư mục/project mobile | Planned — project not created yet |
| Backend/API | Node.js Clean Architecture: modules/domain/application/infrastructure/interfaces + main/shared | Implemented theo module; advanced claim/realtime vẫn partial/planned |
| Java | Không còn source/runtime/build trong repository | Retired 09/09/2026 |
| Database | 001–046 migrations và checksum runner | Schema/migration implemented; migration 046 là corrective cleanup cho legacy feedback index, chưa áp dụng lên Aiven/shared DB; không thay thế business runtime evidence |
| Test | Node tests và Web typecheck; một DB integration test skip an toàn khi thiếu local _test DB | Partial |

## 4. UC status totals

Checklist giữ 100 ID duy nhất UC-001 đến UC-100:

- 56 Done/Implemented có code và evidence kiểm tra.
- 18 Partial sau khi bổ sung claim/chat/PWA scope hiện tại.
- 26 Planned.
- 0 Deferred.

UC-M01–UC-M12 là nhóm mobile target riêng, không cộng vào 100 UC legacy cho tới khi team phê duyệt ID mapping. Khi thêm UC mobile vào SRS, cần tạo mapping chính thức, không tự trùng ID.

## 5. Verification rules

- Link evidence phải trỏ tới file thực tế.
- Status chỉ nâng sau code + test/build/evidence tương ứng.
- Requirements không có UC hoặc evidence phải ghi Planned/TBD.
- Peer-to-peer flow là target main flow; Staff custody là optional/escalation.
- Native Mobile không được ghi implemented khi repository chưa có project.
- Jira/sprint/assignee chưa xác minh vì không có connector trong workspace.
