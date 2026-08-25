# Ma trận truy vết

Cập nhật: 26/08/2026

Ma trận này liên kết business rule, requirement, use case và bằng chứng code của **codebase mới**. Bảng tồn tại trong migration nhưng không có route/service không được xem là implementation evidence.

Historical alias: `FR-MOBILE-01` được thay bằng `FR-PWA-01` từ ngày 26/08/2026; các mapping hiện hành dùng ID PWA.

## 1. Implemented/partial traceability

| Business rules | Requirements | Use cases | Status | Code/test evidence |
| --- | --- | --- | --- | --- |
| BR-01, BR-02 | FR-AUTH-01 | UC-031, UC-032 | Implemented | `auth.routes.ts`, `auth.service.ts`, `auth.repository.ts`, `001_auth.sql` |
| BR-03, BR-04, BR-05 | FR-AUTH-02, FR-AUTH-03 | UC-033 đến UC-036 | Implemented | Auth service/repository, `security.test.ts`, `auth.validator.test.ts` |
| BR-03, BR-04 | FR-AUTH-04 | UC-037 đến UC-039 | Partial | `/auth/me`, `/auth/profile`, `profile-page.tsx`; avatar/activity/reputation chưa có |
| BR-06, BR-26 | FR-ROLE-01 | UC-001, UC-002, UC-062 | Implemented | `auth.middleware.ts`, `admin.routes.ts`, `route-guard.tsx` |
| BR-07, BR-08, BR-09 | FR-POST-01, FR-POST-02 | UC-040 đến UC-043 | Implemented | `post.routes.ts`, `post.service.ts`, `post.validator.ts`, validator tests |
| BR-10, BR-11 | FR-BOARD-01, FR-PRIVPOST-01 | UC-044 đến UC-047, UC-054 | Partial | Post serializer/repository; claim privacy chưa có |
| BR-12, BR-13 | FR-CATALOG-01, FR-ADMIN-01 | UC-055, UC-064, UC-065 | Implemented | `admin-catalog.*`, `admin-page.tsx`, catalog queries |
| BR-14, BR-15 | FR-MEDIA-01 | UC-048, UC-050 | Implemented local | `media.ts`, media tests, post media route/service |
| BR-30 | FR-MEDIA-01 | UC-048 | Implemented local | `media-storage.ts`, `media-storage.test.ts`; missing local media trả 404 có kiểm soát |
| BR-16, BR-17, BR-18 | FR-AI-01, FR-AI-02 | UC-086, UC-088, UC-091 | Implemented/partial privacy hardening | `gemini-image.service.ts`, Gemini tests, `story-post-form.tsx` |
| BR-19, BR-20 | FR-MATCH-01 | UC-068 | Implemented | `matching.service.ts`, candidate repository queries |
| BR-21, BR-22, BR-23 | FR-MATCH-02 | UC-069, UC-070, UC-091 | Implemented | `matching.engine.ts`, matching engine tests |
| BR-24, BR-25 | FR-MATCH-03 | UC-071, UC-072, UC-075, UC-076 | Implemented | `matching.repository.ts`, post match routes, `post-matches-page.tsx` |
| BR-09, BR-42 | FR-HANDOVER-01 | UC-008 đến UC-010, UC-055 đến UC-058 | Partial | Post/staff catalog và handover counts có runtime; Admin marker/hours management chưa có |
| BR-32, BR-42 | FR-STAFF-01, FR-WAREHOUSE-01, NFR-AUDIT-01 | UC-011 đến UC-015, UC-058 đến UC-061 | Implemented/partial warehouse scope | `staff.routes.ts`, `warehouse.service.ts`, `warehouse.repository.ts`, `warehouse.service.test.ts`, `staff-page.tsx`, `staff-page.spec.ts` |
| BR-06, BR-26, BR-31 | FR-ADMIN-02 | UC-063, UC-066, UC-067, UC-084, UC-085 | Partial | `admin-page.tsx` có catalog statistics/CRUD; user/moderation/export/config chưa có |
| BR-27 | NFR-DATA-01 | N/A | Implemented | `run-migrations.ts`, `schema_migrations` checksum |
| BR-28 | FR-JAVA-01, FR-JAVA-02 | N/A | Skeleton/Planned | `JavaAdminServiceApplication.java`, Java README; không có business controller |
| BR-41 | FR-PWA-01, NFR-PWA-01 | UC-093 đến UC-100 | Partial/Planned | Responsive CSS, mobile viewport tests và browser file input đã có; không có manifest/service worker/installability/offline fallback |
| BR-03, BR-06, BR-14 | NFR-SEC-01, NFR-SEC-02, NFR-SEC-03, NFR-VALID-01 | UC-001, UC-002, UC-031 đến UC-036, UC-040, UC-041, UC-048 | Implemented cho module hiện tại | Security/auth utilities, middleware, rate limiters, Zod validators và tests |
| BR-10, BR-15, BR-25 | NFR-PRIV-01 | UC-048, UC-050, UC-054, UC-076 | Partial | Post/media/match privacy có code; claim evidence privacy chưa có runtime |
| BR-20, BR-24 | NFR-PERF-01 | UC-047, UC-068, UC-075 | Implemented ở tested baseline | Board pagination, bounded matching candidates và rerun rate limit; chưa load test |
| BR-19, BR-27, BR-42 | NFR-TEST-01 | N/A | Partial | Node unit tests, guarded DB integration suite, Playwright tests và build; coverage chưa bao phủ complete product scope |
| BR-17, BR-22, BR-36 | NFR-AI-01 | UC-070, UC-086, UC-088 đến UC-092 | Implemented/Planned theo module | Draft/matching không tự xác minh; claim review support chưa có runtime |
| BR-27, BR-28 | NFR-DATA-02 | N/A | Process requirement | README cấm destructive test trên shared Aiven DB; DB integration suite chỉ chấp nhận local `_test` |
| BR-27 | NFR-OBS-01 | N/A | Partial | `/api/health`, `/api/ready`; structured logging/graceful shutdown cần hoàn thiện |

## 2. Planned traceability

| Business rules | Requirements | Use cases | Status | Required evidence before Done |
| --- | --- | --- | --- | --- |
| BR-29 | FR-MEDIA-02, NFR-PORT-01 | UC-048, UC-050 | Planned | Object-storage adapter, migration/compatibility và cross-instance test |
| BR-31 | FR-ADMIN-01, NFR-AUDIT-01 | UC-064, UC-065 | Planned | Audit table/repository, actor test |
| BR-33, BR-34 | FR-CLAIM-01, FR-CLAIM-02 | UC-003 đến UC-007, UC-052, UC-053 | Planned | Claim routes/service/repository, race-condition test |
| BR-35, BR-36 | FR-EVIDENCE-01 | UC-049, UC-054, UC-087 đến UC-092 | Planned | Protected evidence proxy, privacy/authorization tests |
| BR-37 | FR-APPT-01 | UC-021 đến UC-024 | Planned | Appointment API/state machine/concurrency test |
| BR-38 | FR-WAREHOUSE-01 remainder | UC-016 đến UC-020 | Planned | Disposition guard, overdue lifecycle and alert tests |
| BR-39 | FR-RT-01 | UC-077 đến UC-083 | Planned | Socket server, JWT room tests, reconnect/unread tests |
| N/A | FR-MATCH-04 | UC-073, UC-074 | Planned | Notification policy, scheduler/polling và dismissal-state tests |
| N/A | FR-REP-01 | UC-025, UC-039 | Planned | Reputation/feedback service, event rules và UI/tests |
| BR-40 | FR-TRAIN-01 | UC-026 đến UC-030 | Planned | Dataset policy, training/eval pipeline and model artifact |
| N/A | NFR-CI-01 | N/A | Planned | CI workflow với isolated MySQL, test/build gates và secret-safe configuration |

## 3. Frontend route evidence

| User capability | Route | Evidence |
| --- | --- | --- |
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth pages, `auth-context.tsx` |
| Story/create post | `/home` | `home-page.tsx`, `story-post-form.tsx`, Playwright story tests |
| Board/my posts | `/posts`, `/my-posts` | `posts-page.tsx`, posts Playwright tests |
| Post detail | `/posts/:postId` | `post-detail-page.tsx` |
| Matching detail | `/posts/:postId/matches` | `post-matches-page.tsx` |
| Profile | `/profile` | `profile-page.tsx` |
| Staff warehouse | `/staff` | `staff-page.tsx`, `staff-page.spec.ts` |
| Admin catalog | `/admin` | `admin-page.tsx` |

## 4. Verification map

| Check | Command | Coverage |
| --- | --- | --- |
| API unit tests | `npm --workspace @lnfs/api-node test` | Auth validation/security, CORS, media, Gemini, matching, warehouse |
| Web typecheck | `npm --workspace @lnfs/web run lint` | TypeScript frontend |
| API + web build | `npm run build` | Compile/bundle |
| Browser tests | `npm --workspace @lnfs/web run e2e:home` | Home, board, detail, create-post UI, Staff warehouse |
| Migration | `npm run migrate` | Apply pending migrations to configured DB; không dùng shared DB cho destructive test |

## 5. Consistency rule

Khi đổi một UC thành Done, phải cập nhật đồng thời:

1. [use-case-checklist.md](use-case-checklist.md)
2. [requirements.md](requirements.md)
3. [business-rules.md](business-rules.md)
4. Ma trận này
5. Test evidence hoặc command tái lập được
