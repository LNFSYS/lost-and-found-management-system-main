# Aiven Schema Reconciliation

Ngày: **07/09/2026** (Asia/Bangkok)
Repository: `fptu-lost-found-system-main`
Branch: `fix/aiven-schema-migration-reconciliation`
Baseline: `f5640ac`

**Trạng thái: sửa code và kiểm thử isolated đã có evidence; shared Aiven chưa thay đổi, chưa Done toàn bộ rollout.**
Không sửa Jira, không triển khai ticket tương lai, không merge/push main. Node.js vẫn là migration/write owner; Java giữ nguyên health skeleton.

## 1. Khảo sát và nguyên nhân

Đã đọc README, overview, requirements, business rules, Node/Java boundary, checklist, Sprint 4 audit, audit/fix report và migration runner/SQL liên quan.
Aiven được kết nối bằng cấu hình hiện tại với TLS verification, chỉ đọc metadata và COUNT; không lấy dữ liệu người dùng, OTP, token hoặc secrets vào báo cáo.

| Kiểm tra | Kết quả |
| --- | --- |
| Aiven target | `defaultdb`, MySQL 8.4.8, TLS AES-256-GCM |
| Tables | 49, bao gồm 2 bảng ledger/attempt; không có bảng ngoài nguồn migration |
| Local SQL files | 43 file, numbering 001–046 có khoảng trống hợp lệ |
| Applied local checksums | 39 khớp, không có checksum mismatch trong 39 file này |
| Chưa ghi nhận | 043, 044, 045, 046 |
| Legacy version | `040_peer_claim_conversations.sql`; checksum khớp 045 hiện tại |
| Incomplete attempts | Không thấy FAILED/RUNNING ở snapshot đọc lại |
| Schema claim/chat | Dry-run kiểm columns/defaults/collation, enum, generated expression, indexes, FK, engines và participant backfill: READY |
| Schema feedback | Chưa có 5 cột của 043; SQL probe trước đó trả 1054, code runtime cần các cột này |

Các cột thiếu: `return_appointments.finder_confirmed_at`, `owner_confirmed_at`, `custody_authorized_by`, `custody_authorized_at`; `return_feedback.idempotency_key`.

Git `afabe4c` import domain migrations từ project cũ; `88aedf0` merge đổi tên migration claim. Không phải bằng chứng Aiven trỏ nhầm database cũ. So sánh trước đó cho thấy endpoint/database cấu hình hai repo khác nhau, nhưng việc từng restore dữ liệu lịch sử không thể xác minh chỉ từ schema.

## 2. Thay đổi triển khai

| Vấn đề | Sửa và evidence |
| --- | --- |
| Runner có thể chạy 043/044 rồi mới lỗi trùng cột ở 045 | Preflight toàn bộ ledger/attempt trước mọi DDL; unknown version và mismatch đều chặn ngay |
| Hai operator chạy migration cùng lúc | Named lock theo database, giữ cùng connection cho cả phiên; reconciliation apply dùng cùng lock; release lỗi thì destroy connection |
| Alias 040/045 | Công cụ mặc định read-only dry-run. Chỉ đổi tên đúng ledger/attempt sau checksum và schema verification; checksum và timestamps giữ nguyên |
| Reconciliation ghi một phần | Hai UPDATE và hậu kiểm nằm trong transaction; fault-injection trên MySQL thật chứng minh rollback giữ ledger cũ |
| MySQL DDL auto-commit | RUNNING/FAILED attempt giữ dấu vết; cấm retry tự động khi chưa reconcile; không hứa rollback DDL |
| Ledger success và attempt completion tách rời | Ghi hai metadata changes trong một transaction sau DDL thành công |
| Bulk checksum repair không kiểm schema | Giữ diagnosis; chặn `--apply` trước khi mở connection, không còn UPDATE hàng loạt |
| Feedback retry đồng thời | Reproduced `ER_DUP_ENTRY` trên MySQL thật. Khóa appointment và kiểm participant trước consistent reads; retry cùng key trả bản ghi đã commit |
| SQL error có thể chứa giá trị nhạy cảm | Migration/diagnosis CLI log error code hoặc thông báo kiểm soát, không log raw provider SQL values |

Không thêm/sửa/xóa file SQL migration đã có. Không cần bảng nghiệp vụ mới: 043–046 đã chứa DDL cần thiết; blocker nằm ở lịch sử/runner. Không đổi API payload/response; feedback replay vẫn giữ contract hiện có.

## 3. Quyết định bảng chưa dùng

Tất cả các bảng dưới đây có 0 dòng trong kiểm tra COUNT read-only; chưa tìm thấy tham chiếu trực tiếp trong production Node runtime. Không coi đây là quyền được xóa. Cần owner/team chốt scope, không tự ghi tên assignee từ phỏng đoán.

| Bảng | Nguồn | Quyết định / ownership |
| --- | --- | --- |
| claim_state_logs | 002 | Giữ/hoãn; runtime mới dùng claim_audit_events nhưng chưa duyệt bỏ legacy audit |
| match_feedback, match_suggestion_impressions | 016 | Giữ; schema training/evaluation, ngoài runtime hiện tại; owner chưa xác minh |
| matching_jobs | 020 | Giữ; queue planned, không nhầm với matching đồng bộ hiện có |
| item_verification_questions, claim_verification_answers | 029 | Giữ; guided verification thuộc phạm vi LNFS-53, không lấy phần người khác |
| claim_verification_assignments | 032 | Giữ; phụ thuộc guided question/claim domain |
| private_proofs, claim_private_proofs | 034 | Giữ; vault và liên kết proof/claim, chưa có quyết định bỏ |
| lost_search_profiles, finder_scan_sessions | 036 | Giữ; assistance/finder scan planned |
| visual_hunt_feedback | 032 | Giữ; chưa có runtime consumer được xác minh |
| campus_radar_audit_logs | 030 | Giữ; phụ thuộc radar, không xóa riêng audit graph |

`campus_radar_events` và `campus_radar_alerts` còn được `admin-catalog.repository.ts` dùng trong delete guards. Xóa chúng sẽ phá thao tác catalog/location dù bảng đang trống.
Đã đối chiếu FK metadata và SQL definitions để nhận diện dependency. Phiên này không đề xuất DROP/CREATE replacement hoặc data archive khi chưa có quyết định scope. Bảng rỗng không phải nguyên nhân lỗi 1054.

## 4. Kiểm thử và command log

Test MySQL chạy trên instance mới riêng ở loopback port 33570, MySQL **9.3.0** có sẵn trên máy. Không dùng server MySQL local đang chạy sẵn hoặc credentials Aiven cho test. Test fixtures là dữ liệu tổng hợp `example.invalid`.

| Command/thao tác | Kết quả |
| --- | --- |
| `git status --short --branch`, `git rev-parse`, `git log`, `git show`, `rg`, đọc docs/config/migration | Đã khảo sát; giữ nguyên file ideas untracked của người dùng |
| `git switch -c fix/aiven-schema-migration-reconciliation` | PASS |
| Node read-only Aiven metadata/checksum/COUNT probes | PASS; snapshot ở mục 1, không mutation |
| `npm run migrate:reconcile-claim` | PASS, `mode=dry-run`, `before=READY`, `after=READY`; không cập nhật Aiven |
| `mysqld --no-defaults --initialize-insecure` rồi khởi động riêng, bind loopback/mysqlx off | PASS; mật khẩu test được đặt ngay sau bootstrap |
| `npm --workspace @lnfs/api-node run build` | Ban đầu FAIL do fixture thiếu trường email; đã sửa, lần build sau PASS |
| `npm --workspace @lnfs/api-node run test:db-integration` | Test cũ PASS 5/5; suite mới ban đầu FAIL, tái hiện feedback retry duplicate. Sau sửa: **PASS 11/11**, 0 skip |
| `npm test` với `LNFS_DB_INTEGRATION=1` và `LNFS_TEST_DB_*` local | PASS cuối: **152 tests, 0 fail, 0 skip**, kèm Web `tsc --noEmit` |
| `npm run build` | PASS API TypeScript + Web TypeScript/Vite; không có script backend lint riêng |
| `npm run check:env` | PASS, không in secrets; không thay cho DB schema check |
| `npm --workspace @lnfs/web run e2e:home` | Lượt chạy đồng thời DB tests: 16 pass/7 fail do browser contexts bị đóng; không kết luận là bug UI |
| `npm --workspace @lnfs/web run e2e:home -- --workers=1` | Rerun PASS **23/23** sau DB tests. PowerShell/npm không forward workers flag, thực tế vẫn 6 workers; không phải evidence single-worker |
| `mysqldump` + `mysql source` trên DB local mô phỏng legacy | PASS backup/restore rehearsal, có warning charset cp1258 chuyển sang utf8mb4 |
| Node so sánh bản restore rồi reconcile/apply/upgrade local | PASS: 49 bảng, column metadata, ledger và row counts khớp; alias thành canonical; đủ 43 migration; rerun PASS |
| `git diff --check` | PASS; Git chỉ cảnh báo LF/CRLF, không sửa SQL checksum |
| `npm run migrate` trên shared Aiven | NOT RUN |
| Java build, SMTP/Gemini/Cloudinary live calls | NOT RUN, ngoài phạm vi sửa DB này |
| GitHub Actions | Đã cập nhật matrix MySQL 8.0/8.4; chưa push/quan sát CI remote, không tuyên bố CI xanh |

Coverage mới: fresh DB; legacy alias upgrade; repeat runs; checksum/schema/index/FK mismatch; missing participant backfill; transaction rollback giữa hai ledger UPDATE; lock còn giữ sau COMMIT; partial DDL/FAILED attempt; private room participant/outsider; concurrent message idempotency; competing accepted claims và active appointments; concurrent feedback retry với một reputation event; key reuse giữa hai appointments; one-sided confirmation bị chặn; feedback outsider bị 403.

Claim/appointment concurrency ở đây gồm kiểm constraint bằng SQL fixture, không thay cho full service/UI claim-to-return journey. Browser suite dùng API mocks hiện có; real DB integration suite mới gọi repository/service thật. Không triển khai appointment lifecycle hoặc guided questions từ các fixtures này.

## 5. Runbook shared Aiven: CHỜ PHÊ DUYỆT

1. Review nhánh/CI trên MySQL 8.4; chốt maintenance window và một operator. Tắt runner cũ, tránh DDL/manual writes đồng thời.
2. Backup thực tế Aiven bằng tài khoản phù hợp; bảo vệ dump ngoài Git, hạn chế quyền truy cập. Restore vào môi trường riêng và kiểm schema, ledger, dữ liệu trước khi thay đổi shared DB. **Rehearsal local bên trên không phải backup/restore của Aiven.**
3. Xác minh endpoint, database, TLS và Git commit; chạy dry-run. Nếu checksum/schema/backfill lệch thì dừng, không ép APPLIED.
4. Sau khi người dùng/DB owner xác nhận, chạy CLI có endpoint/database explicit. Ví dụ PowerShell (placeholder, chưa thực thi trên shared DB):

```powershell
npm.cmd --% --workspace @lnfs/api-node run migrate:reconcile-claim -- --apply --confirm-endpoint HOST:PORT --confirm-database DATABASE
```

Thay HOST:PORT/DATABASE bằng target đã review; không đưa password vào command. Chế độ apply chỉ có các mutation sau, kèm kiểm tra affectedRows và hậu kiểm trong transaction:

```sql
START TRANSACTION;
UPDATE schema_migrations
SET version = '045_peer_claim_conversations.sql'
WHERE version = '040_peer_claim_conversations.sql';
UPDATE schema_migration_attempts
SET version = '045_peer_claim_conversations.sql'
WHERE version = '040_peer_claim_conversations.sql' AND status = 'APPLIED';
COMMIT;
```

Đây là mô tả SQL của tool, **không phải hướng dẫn chạy SQL thô bỏ qua preflight**. Canonical và legacy cùng tồn tại, attempt chưa hoàn tất, sai schema/checksum hoặc target không khớp đều bị chặn. Không thay checksum, timestamps hoặc business rows.

5. Sau reconciliation, review và chạy `npm run migrate` trên đúng target: dự kiến áp dụng 043, 044 và 046, bỏ qua 045 đã đối soát. 043 bổ sung confirmation/idempotency fields, custody FK và unique indexes; 044 tạo index scoped theo appointment; 046 bỏ legacy index với reviewer FK support còn nguyên.
6. Xác minh 43 file khớp ledger, attempts APPLIED, 5 cột mới và indexes/FK đúng; smoke test feedback/claim/chat bằng tài khoản test được phép. Lưu evidence trước/sau rồi mới đánh dấu rollout Done.

## 6. Rollback và hạn chế

- Trước COMMIT, alias tool rollback cả ledger/attempt nếu có lỗi; test fault-injection đã chứng minh điều này.
- Sau khi chỉ đổi alias nhưng chưa chạy DDL mới: DB owner có thể duyệt rename ngược đúng hai bản ghi, kiểm checksum/timestamps và giữ maintenance window. Không áp dụng ngược trên DB fresh vốn dùng 045 từ đầu.
- Sau DDL 043/044/046: không tự DROP cột/bảng hoặc giả định ROLLBACK khôi phục DDL. Ưu tiên forward correction; nếu restore backup phải kiểm soát các writes phát sinh sau backup và kế hoạch downtime.
- Named lock chỉ bảo vệ các client dùng cùng giao thức; không ngăn DBA chạy SQL ngoài tool hoặc runner phiên bản cũ.
- MySQL local là 9.3; matrix 8.0/8.4 cần CI remote xác nhận trước rollout Aiven 8.4.
- Backup/restore dữ liệu shared, production smoke test, CI remote và phê duyệt vẫn pending. Không xóa bảng planned và không đánh dấu ticket thành viên khác Done.
- Lỗi browser context đóng ở lượt đầu chưa tái hiện khi rerun riêng; không thay timeout/test logic để che lỗi.

Nguồn kỹ thuật: [MySQL 8.4 implicit commits](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html), [MySQL locking functions](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html).

## 7. Files thay đổi

- Migration tooling: `migration-state.ts`, `migration-runner.ts`, `claim-schema-verification.ts`, `reconcile-claim-migration.ts`, `run-reconciliation.ts`, `run-migrations.ts` trong `apps/api-node/src/migrations/`.
- Tests: `migration-runner.test.ts`, `integration/database.integration.test.ts`, `integration/migration-reconciliation.integration.test.ts`.
- Runtime fix: `apps/api-node/src/services/return-feedback.service.ts`.
- Scripts/config: root `package.json`, API `package.json`, `scripts/repair-migration-checksums.mjs`, `.github/workflows/ci.yml`.
- Docs: README, docs index, overview, requirements, business rules, use-case checklist, cross-link audit/Sprint 4 lịch sử và report này.
- **Không đổi migration SQL, .env, certs, dữ liệu thật hoặc file ideas untracked có sẵn.**

## 8. Checklist triển khai

- [x] Đọc tài liệu và xác minh Aiven read-only.
- [x] Preflight/lock và alias tool mặc định dry-run.
- [x] Fix feedback concurrency bằng evidence MySQL thật.
- [x] Fresh/upgrade/partial-failure/rollback và browser regression có evidence.
- [x] Synthetic local backup/restore rehearsal.
- [x] Phân loại bảng, giữ nguyên scope của thành viên khác.
- [x] Cập nhật CI config và tài liệu.
- [ ] CI remote pass và reviewed PR.
- [ ] Backup/restore thực tế Aiven và DB owner approval.
- [ ] Apply shared Aiven, smoke test và rollout evidence.
