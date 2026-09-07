# LNFS Audit and Fix Report

Cập nhật: **06/09/2026**  
Repository: `fptu-lost-found-system-main`  
Branch: `fix/audit-remediation-2026-09-06`  
Audit source: `docs/LNFS_FULL_AUDIT_AND_FIX_PROMPT.md`

> Đây là báo cáo implementation/remediation từ checkout local. Không chạy migration, test destructive hoặc truy cập Aiven/shared database trong phiên này. Không ghi secret thật, token, OTP hoặc dữ liệu production vào repository.

> Snapshot lịch sử 06/09. Phiên 07/09 đã đọc Aiven và chạy MySQL isolated thật; xem [reconciliation report](AIVEN_SCHEMA_RECONCILIATION_2026-09-07.md). Các giới hạn DB chưa kiểm thử bên dưới mô tả phiên cũ, không ghi đè evidence mới.

## 1. Tested Scope

Đã đối chiếu source, route/controller/service/repository/validator, migrations, frontend route/page, PWA files, Java skeleton, CI workflow, test files và tài liệu chính.

Current runtime được kiểm tra gồm:

- Authentication, OTP/reset token protection, JWT/session authorization và error mapping.
- LOST/FOUND post, private visibility, merged update validation, state transition, media proxy và matching.
- Claim request/decision/withdraw, participant-scoped private room, text message, evidence proxy và claim notification feed.
- Claim list/message pagination, stable retry idempotency và notification unread total.
- Admin/Staff routes, warehouse/handover/catalog hiện có, PWA/browser flows và Java health skeleton.

## 2. Baseline Commands

| Command | Result |
| --- | --- |
| `npm --workspace @lnfs/api-node run test` | **PASS**: 137 pass, 1 skipped DB integration test |
| `npm --workspace @lnfs/web run lint` | **PASS**: TypeScript check |
| `npm run build` | **PASS**: API TypeScript + Web Vite production build |
| `npm --workspace @lnfs/web run e2e:home` | **PASS**: 23/23 Playwright tests |
| `npm run build:java` | **BLOCKED**: Maven không có trong PATH; Java source chưa được kết luận lỗi |
| `npm run migrate` | **NOT RUN**: tránh tác động Aiven/shared DB |

DB integration test bị skip vì checkout này không có MySQL test database riêng được cấu hình. CI có MySQL service riêng nhưng chưa được chạy từ checkout local này.

## 3. Bug Status

| ID | Status | Evidence | Limitation |
| --- | --- | --- | --- |
| B01 OTP counter rollback | **Fixed in code** | `auth.service.ts`, `auth.repository.ts`, `auth.repository.test.ts`; failure update được commit ngoài transaction, cap bởi `max_attempts`, kiểm tra expiry/consumed | Chưa chạy repeated/concurrent OTP thật trên isolated MySQL |
| B02 private search inference | **Fixed in code** | `post.repository.ts` visibility predicate áp dụng trước search/filter/count; `post.repository.test.ts` kiểm tra outsider/owner/staff SQL policy | Chưa chạy API integration với dữ liệu MySQL thật |
| B03 legacy feedback index | **Fixed by forward migration** | `046_feedback_idempotency_legacy_cleanup.sql`; migration test bắt buộc dùng existence `> 0`, không sửa checksum 044 | Chưa apply hoặc inspect `INFORMATION_SCHEMA` trên Aiven/isolated DB |
| B04 closed post mutation | **Fixed in code** | `post.service.ts` transition table, merged-state validation, owner row lock; `post.service.test.ts` terminal/mixed update cases | Admin exception policy chưa có và không được tự thêm |
| B05 stale claim room | **Fixed in code** | `claims-page.tsx` AbortController + generation guard + reset on failure; `claims-resilience.spec.ts` delayed A → switch B → send B message | Browser test mock API; chưa chạy multi-instance/live network |
| B06 chat history cap | **Fixed in code** | API `before`/`beforeId` cursor, `hasMore`/`nextCursor`; UI load older, merge/dedupe; validator/service tests | Chưa chạy 51+ rows trên MySQL integration |
| B07 unread total | **Fixed in code** | `countUnreadForUser`, notification service response `unreadTotal`, UI badge/mark-all state; service test | Chưa test realtime update vì realtime transport chưa có |
| B08 JSON 413 | **Fixed in code** | auth parser maps `entity.too.large` to JSON 413 `PAYLOAD_TOO_LARGE`; app test covers oversized and malformed JSON | Multipart limit remains provider-specific and not expanded in this task |

## 4. Security and Reliability Risks

| ID | Status | Evidence / decision |
| --- | --- | --- |
| R01 Shared media/evidence storage | **Partial / deployment blocker** | Post media và claim evidence vẫn ở local filesystem. Không gọi local disk là shared storage. Cần persistent/shared object storage trước multi-instance hoặc ephemeral deployment. Avatar đã dùng Cloudinary authenticated storage theo existing scope. |
| R02 Chat retry idempotency | **Fixed current scope** | UI giữ cùng `clientMessageId` khi retry logical send; server đã có unique client key/upsert; repository test kiểm tra idempotency SQL. |
| R03 Claim N+1/polling | **Fixed current scope** | Claim participants batch query, claim list pagination, message cursor, poll overlap guard và cancellation khi đổi room/unmount. Chưa load-test. |
| R04 Auth infrastructure errors | **Fixed current scope** | JWT invalid/expired tiếp tục 401; session-store/database failure đi qua error middleware thành 5xx thay vì invalid-token 401. Distributed limiter vẫn cần trước horizontal scale-out. |
| R05 CI critical paths | **Partial** | CI thêm isolated MySQL verify job hiện có và Playwright browser job. Local API/Web/browser pass; DB integration bị skip do thiếu dedicated local test DB; CI run chưa được xác nhận trong phiên. |
| R06 Documentation drift | **Fixed for current docs** | README, docs index, project overview, requirements, business rules, traceability, use-case checklist, A–Z process, Node/Java boundary, Sprint 4 audit và report này đã cập nhật. Report cũ được gắn Historical notice. |

## 5. Migration Decision

CI follow-up: migration 046 creates a dedicated `reviewer_id` support index before dropping the legacy unique index. The existing `fk_return_feedback_reviewer` foreign key is preserved.

- Không chỉnh sửa migration đã có checksum.
- Tạo `apps/api-node/src/migrations/046_feedback_idempotency_legacy_cleanup.sql` để xóa legacy index khi index tồn tại; logic detection dùng `COUNT(*) > 0`.
- Migration 046 **chưa được áp dụng lên Aiven/shared database**. Chỉ chạy sau review trên đúng database target và có backup/rollback procedure của nhóm.
- Không chạy migration hoặc destructive test trên shared Aiven trong audit này.

## 6. API Contract Changes

- `GET /api/posts` và related board queries áp dụng visibility SQL; user thường chỉ thấy public post và post private của chính mình, Staff/Admin có review scope.
- `PATCH /api/posts/:id` validate merged state và centralized transition rule; content của terminal post bị khóa.
- `GET /api/claims?page=&pageSize=` trả `{ items, total, page, pageSize, hasMore }`.
- `GET /api/claims/:claimId/messages?limit=&before=&beforeId=` trả `{ room, items, hasMore, nextCursor }`.
- `GET /api/notifications` trả list cùng `unreadTotal` authoritative.
- Oversized JSON trả HTTP `413` với code `PAYLOAD_TOO_LARGE`.
- Auth session dependency failure không bị map thành 401 invalid token.

Các thay đổi giữ Node.js là API/migration/write owner. Không thêm Java business flow, không tự động xác minh ownership và không expose raw private storage URL.

## 7. Tests Added or Updated

- `apps/api-node/src/repositories/auth.repository.test.ts`
- `apps/api-node/src/repositories/claim.repository.test.ts`
- `apps/api-node/src/migrations/migration-runner.test.ts`
- `apps/api-node/src/repositories/post.repository.test.ts`
- `apps/api-node/src/services/post.service.test.ts`
- `apps/api-node/src/services/claim.service.test.ts`
- `apps/api-node/src/services/notification.service.test.ts`
- `apps/api-node/src/validators/claim.validator.test.ts`
- `apps/api-node/src/middlewares/auth.middleware.test.ts`
- `apps/api-node/src/app.test.ts`
- `apps/web/tests/claims-resilience.spec.ts`

## 8. Current Checklist Snapshot

The legacy use-case checklist contains 100 IDs:

- **56 Done/Implemented** with current code and evidence.
- **18 Partial** where runtime exists but acceptance is incomplete or integration evidence is missing.
- **26 Planned** with no current runtime evidence.
- **0 Deferred**.

Partial/planned areas remain: appointment and dual-confirmed return, guided verification question/review confidence, realtime Socket.IO, image chat, seen/unread realtime, full warehouse disposition, shared media storage, PWA installability/device matrix, Native Mobile and custom-trained AI/MLOps.

## 9. Manual QA Checklist

- [x] API unit/service/repository/validator tests pass.
- [x] Web typecheck passes.
- [x] Production API/Web build passes.
- [x] Existing Playwright flows pass on desktop/tablet/mobile scope.
- [x] Delayed claim room A cannot overwrite selected room B in browser regression.
- [ ] Run migrations on a dedicated isolated MySQL test database.
- [ ] Verify B01 repeated wrong OTP, expiry, reuse and concurrent attempts on isolated MySQL.
- [ ] Verify B03 clean install/legacy upgrade/index shape and concurrent feedback inserts.
- [ ] Verify claim concurrency and 51+ message pagination on isolated MySQL.
- [ ] Manually verify Gmail SMTP, Gemini, Cloudinary and Aiven using rotated non-production credentials only.
- [ ] Verify PWA installability, offline behavior and device matrix.
- [ ] Verify deployment with shared object storage, health checks, logs, backup and rollback.

## 10. Git and Contribution Evidence

- Branch: `fix/audit-remediation-2026-09-06`.
- Commit/PR/Jira update: **not yet created or claimed in this report**.
- Jira connector and PR URL are not available in this workspace; no Jira status, assignee, PR link or contribution credit is fabricated.
- Before merge, review the diff, run CI, apply migration 046 only to the intended database and attach actual PR/Jira evidence.

## 11. Rollback Plan

1. For application changes, use a reviewed `git revert <remediation-commit>` on a new branch; do not reset or rewrite shared history.
2. For migration 046, do not invent an automatic down migration. Take a schema backup and have the database owner restore/recreate the legacy index only after verifying the target index shape and feedback data impact.
3. If CI fails, keep the branch open, fix the failing job and do not mark the audit complete.
4. If shared media is not available, do not deploy multiple API instances that rely on local post/evidence files.

## 12. Remaining Findings

- MySQL integration/concurrency evidence is still missing locally because no dedicated test database/container is available.
- Local post media and claim evidence are not suitable for multi-instance deployment.
- Java build is unverified because Maven is unavailable in PATH; Java remains a health skeleton.
- Full peer-return journey is not implemented; current claim/chat/evidence support must not be described as completed appointment/return verification.
- No production-readiness claim is made.
