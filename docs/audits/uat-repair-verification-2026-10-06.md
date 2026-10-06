# Kết quả sửa UAT - 06/10/2026

## Phạm vi và kết luận

Thực hiện [kế hoạch sửa UAT](../plans/uat-repair-plan-2026-10-06.md) tại `<workspace>`, nhánh `dev`, dirty worktree dựa trên `195b134c34c3cee559187bfee13d05e78abf3bfe`. Giữ nguyên implementation lịch hẹn/hành trình và việc tổ chức tài liệu đã có. Chưa commit, push, merge hoặc chứng nhận deployment. Không sử dụng project cũ.

| Mục | Kết quả hiện tại | Điều kiện còn lại |
| --- | --- | --- |
| UAT-01 | Backup được bảo vệ, restore và rehearsal 063 trên bản sao đã PASS; shared Aiven vẫn pending 063 | Phê duyệt riêng cho migration write, rollout/restart đúng candidate và UAT lịch hẹn/trả trực tiếp thực tế |
| UAT-02 | Đã sửa limiter, xử lý refresh tạm thời và fencing phiên; unit/browser/HTTP với cookie + SQL thật đã PASS | Smoke trên shared runtime sau rollout; sizing NAT lớn và kiểm tra nhiều instance riêng |
| UAT-03 | Đã tách loading/error/ready và fencing popup; regression desktop/mobile đã PASS | Kiểm tra lại popup trên shared runtime với vật phẩm/người nhận thật |

Đây là bằng chứng mới bổ sung, không thay snapshot [UAT gốc](real-workflow-uat-2026-10-06.md) hay điểm audit lịch sử. Không thêm UC ID hoặc nâng status UC chỉ vì bug fix/test pass.

## UAT-02: Khôi phục phiên

- [Auth routes](../../apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts): refresh có bucket riêng `120 request / 60 giây / IP`; register/reset giữ nguyên `10 / 15 phút`. Login và OTP giữ limiter riêng. `Retry-After` và headers chuẩn do thư viện cung cấp.
- Ngân sách 120 là ceiling ban đầu cho workload kiểm tra tương đương 10 phiên, mỗi phiên tối đa 12 lần cold-start/401 recovery trong một phút; không phải số liệu tải thực tế hay bảo đảm phục vụ toàn campus. Các request invalid cũng tiêu thụ ngân sách. Cần đo peak chung NAT và điều chỉnh có kiểm soát trước rollout lớn.
- Vẫn dùng key IP/IPv6 chuẩn của thư viện và cấu hình trust proxy hiện có, không tin user/header/cookie tự khai để đổi key. Auth service vẫn xác minh cookie và rotate trong transaction. Không bỏ rate limit hoặc bypass session validation.
- Limiter dùng MemoryStore theo process. Chưa có shared store hay global quota nhiều instance; khởi động lại có thể reset bucket. Đây là giới hạn triển khai cần review, không được gọi là rate limit phân tán.
- [API client](../../apps/web/src/services/api.ts), [AuthProvider](../../apps/web/src/context/auth-context.tsx), [RouteGuard](../../apps/web/src/components/route-guard.tsx): 429/5xx/network không bị coi là logout; coalesce refresh, tôn trọng Retry-After, timeout 30 giây, cooldown ít nhất 2 giây. Bootstrap tự thử tối đa 3 lần rồi cần thao tác thử lại.
- Bootstrap thất bại chưa mở nội dung được bảo vệ và không tự redirect login. Refresh 401/403 thật vẫn xóa phiên/fail closed. Logout/đổi account làm vô hiệu phản hồi refresh cũ; kết quả logout cũ không xóa phiên vừa đăng nhập. Request/media cũ không được retry bằng phiên mới.
- Draft của trang đang mở không bị xóa bởi redirect giả khi refresh gặp lỗi tạm thời. Retry không chứng nhận mutation đã rollback hoặc tự replay thao tác nghiệp vụ chưa rõ kết quả.

Regression bền vững: [auth.routes.test.ts](../../apps/api-node/src/modules/auth/interfaces/http/auth.routes.test.ts) và [auth-resilience.spec.ts](../../apps/web/tests/auth-resilience.spec.ts). Có quota độc lập, request 121 bị 429, spoofed header/invalid cookie, delayed bootstrap, hard reload, Retry-After, 503/network, bounded retry, revoked refresh và late logout/account switch. Unit router dùng controller fixture; không gọi đó là kiểm thử token SQL thật.

Kiểm tra bổ sung trên helper loopback: 3 browser cookie contexts, 3 account fixture, cùng IP, 30 lần refresh/đọc `/me` dùng SQL + cookie rotation thật. Làm cạn bucket credential không chặn refresh; logout khiến refresh của context đó 401, context khác vẫn 200. Lượt cuối chạy qua Node test runner, tự kết thúc, 1/1 PASS. Không dùng tài khoản hay DB Aiven. Đây là HTTP acceptance qua `context.request`, không thay ba phiên UI UAT thực tế trên shared runtime; hard reload UI được kiểm tra riêng trong Playwright suite.

## UAT-03: Popup trả đồ

[Staff page](../../apps/web/src/pages/staff-page.tsx) có trạng thái riêng loading, ready và load error. Submit bị chặn khi chưa biết review hoặc review thất bại, kể cả chọn người nhận không có account/claim; server vẫn là nơi quyết định quyền trả đồ.

Loading chỉ là status hiện hành, không còn lưu thành lỗi `claimId`. Retry giữ draft/proof. Xác minh/chọn claim chỉ xử lý lỗi tương ứng, không xóa lỗi điện thoại, giấy tờ, checkbox, proof hoặc lỗi nghiệp vụ chưa giải quyết. Reply của item/generation cũ không sửa recipients, draft, error hay busy của form mới, kể cả A -> B -> A. Post-return refresh không tải logs vào một popup chi tiết khác.

Retry review không đổi generation của toàn popup, nên không làm mất kết quả proof upload đang chờ. Upload/verify/return busy vẫn chặn thao tác đóng phù hợp; khi hoàn tất, Escape và focus restoration hoạt động lại. Không bỏ gate competing claim, dispute, identity, private proof, EXPIRED/disposition hoặc legal hold.

Regression [staff-page.spec.ts](../../apps/web/tests/staff-page.spec.ts): delayed load, programmatic submit khi chưa ready, fail/retry, giữ draft, lỗi field không bị xóa, A -> B -> A success/failure, retry trong lúc upload proof, busy/Escape và mobile 390px/desktop 1440px. Screenshot nằm trong ignored `test-results/home`; kiểm tra tự động không chứng nhận screen-reader/device conformance toàn bộ.

## UAT-01: Backup và rehearsal 063

- Preflight read-only Aiven: **59 source, 61 applied ledger entries, 28 APPLIED attempts**, pending duy nhất `063_appointment_workflow.sql`. Target được kiểm tra là MySQL **8.4.8**; không ghi schema, ledger hoặc dữ liệu nghiệp vụ.
- Snapshot DB consistent read-only: **64 bảng, 4.421 dòng**. AES-256-GCM, key riêng, kiểm tra decrypt round-trip; directory ngoài Git có Windows ACL chỉ owner/SYSTEM. Không đưa backup/key/recipient data vào artifact public.
- Phát hiện SQL mode `ANSI` khiến SHOW CREATE bỏ engine/table options. Đã sửa [captureRecoveryBackup](../../apps/api-node/src/migrations/database-recovery-backup.ts) chụp native DDL trong session read-only rồi khôi phục SQL mode, quoting và timezone, kể cả lỗi. Unit failure-path và SQL restore regression đã PASS. Không đổi global/session của API đang phục vụ người dùng.
- Hai snapshot thử trước khi sửa ANSI không đạt rehearsal và **không được dùng làm restore-ready evidence**. Snapshot được chấp nhận: `lnfs-20261006093602263.aes`; receipt `063-rehearsal.json` cùng directory được bảo vệ, dưới `<protected-backup-dir>`. Không công bố key.
- Restore mọi row/column trên DB loopback generated `_test`, kiểm tra FK; không allowlist orphan để vượt lỗi. Chạy runner trên bản restore: chỉ thêm **2 bảng rỗng**, không đổi schema/dữ liệu bảng cũ. Ledger/attempt cũ giữ nguyên; chỉ thêm một APPLIED 063 ở mỗi bảng tương ứng.
- Clone sau rehearsal: **62 applied ledger entries, 29 APPLIED attempts**, pending rỗng. Chạy runner lần hai không thay đổi dữ liệu/ledger hay replay. Clone được drop sau đối chiếu; backup vẫn giữ ở nơi được bảo vệ.
- Rehearsal và SQL dùng MySQL **9.3.0**, loopback `127.0.0.1:33309`, không phải CI MySQL 8.0/8.4 và không chứng nhận tương thích hoàn toàn với shared target chỉ từ test này.
- Backup này là snapshot schema/data DB, không phải full provider/media backup. Không chuyển/xóa ảnh, không rerun rollout 16 ảnh kho. Migration 063 additive không đổi media hoặc dữ liệu cũ.

**Chưa có phê duyệt migration write trong đợt này.** Shared 063 vẫn pending, nên appointment endpoint trên shared DB vẫn có thể báo 503 schema-required. Backup/rehearsal PASS không tự cho phép chạy migration. Sau phê duyệt, đọc lại preflight; chỉ chạy nếu pending đúng 063 và target/SQL không đổi. Nếu acknowledgement mất, đối soát schema/ledger/attempt authoritative, không replay SQL mù.

Rollback app giữ additive schema/history, không DROP hoặc backfill dual confirmation legacy. Hai warnings lịch sử 053/055 giữ nguyên; không sửa checksum, xóa ledger, tự dựng SQL gốc hoặc sửa custody link chưa có bằng chứng.

## Verification

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` bình thường | API 401 PASS, 0 FAIL, 30 opt-in SQL skips; architecture 2/2 và Web typecheck PASS; process tự kết thúc |
| Full API với SQL bật | 469 PASS, 0 FAIL, 0 SKIP; helper UTC, 2 test workers; không chỉ focused tests |
| `npm run build` | API/Web PASS |
| Toàn bộ Playwright | 105 PASS, 0 FAIL, 0 SKIP; 2 workers, có regression proof/review cuối |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Architecture | 204 production files, 0 violations, gồm type dependency cycles |
| UC catalogue | 168 IDs: 129 Implemented, 20 Partial, 19 Planned; không đổi catalogue trong đợt sửa lỗi |
| Aiven migration preflight | Read-only PASS với pending 063 và warnings lịch sử 053/055, không phải deployment PASS |
| Protected backup/restore/rehearsal | PASS, source DB write=false |

Lệnh full SQL: tại `apps/api-node`, `node ../../node_modules/tsx/dist/cli.mjs --import ./src/test/setup-env.ts --test --test-concurrency=2 "src/**/*.test.ts"`, với `LNFS_DB_INTEGRATION=1`, `LNFS_TEST_DB_*` trỏ loopback `_test` riêng. Không đổi runner mặc định của repo, không force-exit/skip để che lỗi. Browser: `node ../../node_modules/@playwright/test/cli.js test --workers=2 --reporter=line` tại `apps/web`. Logs local trong ignored `test-results/uat-repair` chỉ chứa receipt/test fixtures; backup thật ở ngoài cây đó.

Các lượt không xanh trước receipt cuối được giữ riêng: cấu hình helper cũ sai credential; hai journey tests fail do server dùng timezone Windows thay UTC; rehearsal ANSI thiếu options; browser fixture nền gây refresh nhiễu, phone blur làm vị trí nút đổi, và test logout kỳ vọng `/home` thay vì đúng redirect-back `/profile`. Đã sửa harness/config hoặc code đúng nguyên nhân rồi chạy lại; không bỏ assertions privacy, field validation, auth hoặc workflow để lấy PASS. Helper HTTP standalone ban đầu thiếu teardown pool ngoài test runner; đã drain pool của đúng helper và chạy lại dưới test runner có teardown, không sửa/đóng pool API thật.

`git diff --check` PASS; 40 Markdown files/371 local links, không có link đích bị thiếu. MySQL helper 33309 đã shutdown sau kiểm tra; API 3001/Vite 5173 được giữ nguyên. Công cụ chặn xóa generated datadir `test-results/uat-repair/mysql`; thư mục được giới hạn ACL owner/SYSTEM nhưng vẫn còn trên máy và cần cleanup được phê duyệt theo môi trường. **Không nén/upload toàn bộ cây `test-results/` local**: datadir/redo/undo có thể chứa byte của rehearsal dù clone đã DROP; chỉ chia sẻ log/screenshot đã review. Backup AES/key nằm riêng ngoài Git. Đợt này không gửi artifact lên remote.

## Những việc chưa được chứng nhận

- Rollout 063 và candidate API/worker trên Aiven; UAT lại FOUND/LOST/photo-backed LOST -> lịch hẹn -> dual completion, mismatch/correction, no-show, legacy và nhánh kho.
- Inbox nhận email thật, reminder đúng giờ, consent/preference/quiet hours/digest, hủy/custody và shutdown với provider thật. Isolated SQL đã kiểm tra outbox, cancellation, lease/slow-send/drain, không giả email đến inbox.
- Bàn giao ngoài đời, giấy tờ/người nhận/vật phẩm thật và biên bản được phép lưu. Không tạo xác nhận vật lý giả, reputation hay feedback giả để đóng checklist.
- Sizing NAT/global limiter store, tải/failover nhiều instance, SMTP/DB/provider downtime theo SLO được duyệt; không stress shared Aiven.
- Manual keyboard/screen-reader/device, security/privacy assessment sâu hơn; browser/SQL regression không thay chứng nhận tổng thể.
- CI MySQL 8.0/8.4 và browser trên candidate SHA mới sau khi được yêu cầu commit/push. Chưa có SHA/CI/deployment mới; không dùng CI của HEAD cũ để chứng nhận dirty worktree.

Không tuyên bố UAT-01 hoàn tất hoặc main/production sẵn sàng khi các gate trên chưa có bằng chứng.
