# Ma trận truy vết

Cập nhật: 21/08/2026

Ma trận này liên kết business rule, requirement, use case và bằng chứng code của **codebase mới**. Bảng tồn tại trong migration nhưng không có route/service không được xem là implementation evidence.

## 1. Implemented/partial traceability

| Business rules | Requirements | Use cases | Status | Code/test evidence |
| --- | --- | --- | --- | --- |
| BR-01, BR-02 | FR-AUTH-01 | UC-031, UC-032 | Implemented | `auth.routes.ts`, `auth.service.ts`, `auth.repository.ts`, `001_auth.sql` |
| BR-03, BR-04, BR-05 | FR-AUTH-02, FR-AUTH-03 | UC-033 đến UC-036 | Implemented | Auth service/repository, `security.test.ts`, `auth.validator.test.ts` |
| BR-06, BR-26 | FR-ROLE-01 | UC-001, UC-002, UC-062 | Implemented | `auth.middleware.ts`, `admin.routes.ts`, `route-guard.tsx` |
| BR-07, BR-08, BR-09 | FR-POST-01, FR-POST-02 | UC-040 đến UC-043 | Implemented | `post.routes.ts`, `post.service.ts`, `post.validator.ts`, validator tests |
| BR-10, BR-11 | FR-BOARD-01, FR-PRIVPOST-01 | UC-044 đến UC-047, UC-054 | Partial | Post serializer/repository; claim privacy chưa có |
| BR-12, BR-13 | FR-CATALOG-01, FR-ADMIN-01 | UC-055, UC-064, UC-065 | Implemented | `admin-catalog.*`, `admin-page.tsx`, catalog queries |
| BR-14, BR-15 | FR-MEDIA-01 | UC-048, UC-050 | Implemented local | `media.ts`, media tests, post media route/service |
| BR-16, BR-17, BR-18 | FR-AI-01, FR-AI-02 | UC-086, UC-088, UC-091 | Implemented/partial privacy hardening | `gemini-image.service.ts`, Gemini tests, `story-post-form.tsx` |
| BR-19, BR-20 | FR-MATCH-01 | UC-068 | Implemented | `matching.service.ts`, candidate repository queries |
| BR-21, BR-22, BR-23 | FR-MATCH-02 | UC-069, UC-070, UC-091 | Implemented | `matching.engine.ts`, matching engine tests |
| BR-24, BR-25 | FR-MATCH-03 | UC-071, UC-072, UC-075, UC-076 | Implemented | `matching.repository.ts`, post match routes, `post-matches-page.tsx` |
| BR-27 | NFR-DATA-01 | N/A | Implemented | `run-migrations.ts`, `schema_migrations` checksum |
| BR-28 | FR-JAVA-01, FR-JAVA-02 | N/A | Skeleton/Planned | Java app + Java README; không có business controller |

## 2. Planned traceability

| Business rules | Requirements | Use cases | Status | Required evidence before Done |
| --- | --- | --- | --- | --- |
| BR-29, BR-30 | FR-MEDIA-02, NFR-PORT-01 | UC-048, UC-050 | Planned | Object-storage adapter, migration/compatibility, missing-object test |
| BR-31 | FR-ADMIN-01, NFR-AUDIT | UC-064, UC-065 | Planned | Audit table/repository, actor test |
| BR-32 | FR-STAFF-01 | UC-062 | Partial | Staff API/UI + role matrix integration test |
| BR-33, BR-34 | FR-CLAIM-01, FR-CLAIM-02 | UC-003 đến UC-007, UC-052, UC-053 | Planned | Claim routes/service/repository, race-condition test |
| BR-35, BR-36 | FR-EVIDENCE-01 | UC-049, UC-054, UC-087 đến UC-092 | Planned | Protected evidence proxy, privacy/authorization tests |
| BR-37 | FR-APPT-01 | UC-021 đến UC-024 | Planned | Appointment API/state machine/concurrency test |
| BR-38 | FR-WAREHOUSE-01 | UC-011 đến UC-020, UC-059 đến UC-061 | Planned | Warehouse API, disposition guard and lifecycle tests |
| BR-39 | FR-RT-01 | UC-077 đến UC-083 | Planned | Socket server, JWT room tests, reconnect/unread tests |
| BR-40 | FR-TRAIN-01 | UC-026 đến UC-030 | Planned | Dataset policy, training/eval pipeline and model artifact |
| BR-41 | FR-MOBILE-01 | UC-093 đến UC-100 | Deferred | Mobile workspace, API contract tests and device verification |

## 3. Frontend route evidence

| User capability | Route | Evidence |
| --- | --- | --- |
| Authentication | `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth pages, `auth-context.tsx` |
| Story/create post | `/home` | `home-page.tsx`, `story-post-form.tsx`, Playwright story tests |
| Board/my posts | `/posts`, `/my-posts` | `posts-page.tsx`, posts Playwright tests |
| Post detail | `/posts/:postId` | `post-detail-page.tsx` |
| Matching detail | `/posts/:postId/matches` | `post-matches-page.tsx` |
| Profile | `/profile` | `profile-page.tsx` |
| Staff | `/staff` | Guarded placeholder only |
| Admin catalog | `/admin` | `admin-page.tsx` |

## 4. Verification map

| Check | Command | Coverage |
| --- | --- | --- |
| API unit tests | `npm --workspace @lnfs/api-node test` | Auth validation/security, CORS, media, Gemini, matching |
| Web typecheck | `npm --workspace @lnfs/web run lint` | TypeScript frontend |
| API + web build | `npm run build` | Compile/bundle |
| Browser tests | `npm --workspace @lnfs/web run e2e:home` | Home, board, detail, create-post UI |
| Migration | `npm run migrate` | Apply pending migrations to configured DB; không dùng shared DB cho destructive test |

## 5. Consistency rule

Khi đổi một UC thành Done, phải cập nhật đồng thời:

1. [use-case-checklist.md](use-case-checklist.md)
2. [requirements.md](requirements.md)
3. [business-rules.md](business-rules.md)
4. Ma trận này
5. Test evidence hoặc command tái lập được
