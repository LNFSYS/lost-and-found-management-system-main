# Chuẩn bị PR dev vào main - 06/10/2026

## Phạm vi

Theo yêu cầu mới, được phép lọc tài liệu thừa, commit/push `dev`, kiểm tra CI đúng candidate và áp dụng riêng migration `063_appointment_workflow.sql` lên Aiven sau các kiểm tra an toàn. Chuẩn bị PR vào `main`; không tự coi merge Git là triển khai production hoặc nghiệm thu bàn giao vật lý.

Implementation và các sửa UAT được ghi trong [biên bản sửa UAT](uat-repair-verification-2026-10-06.md). Các báo cáo cũ là snapshot tại thời điểm thực hiện, không bị sửa lại để giả chứng nhận candidate mới.

## Lọc tài liệu

Bỏ 6 tài liệu không còn làm nguồn hướng dẫn hiện hành:

- `archive/DOCUMENTATION_UPDATE_REPORT.md`: báo cáo đồng bộ 01/09, số liệu và kiến trúc đã được thay thế.
- `archive/ADMIN_USER_CONFIG_IMPLEMENTATION_REPORT_2026-09-02.md`: báo cáo feature cũ; code/tests và catalogue hiện tại giữ yêu cầu tương ứng.
- `archive/LNFS_AUDIT_FIX_REPORT_2026-09-06.md`: snapshot runtime cũ, đã có audit hệ thống và UAT mới.
- `archive/SPRINT_4_IMPLEMENTATION_AUDIT.md`: snapshot Jira offline và implementation đã lỗi thời, không dùng làm trạng thái sprint hiện tại.
- `archive/SPRINT_4_PWA_PROFILE_ACTIVITY_QA.md`: checklist cũ, không chứng nhận device/production acceptance hiện tại.
- `node-java-service-boundary.md`: kiến trúc Java đã ngừng sử dụng; thay bằng Clean Architecture Node.js hiện hành.

Nội dung đã commit trước đây vẫn tra được trong lịch sử Git; không sửa lịch sử hoặc xóa bằng chứng backup. Giữ BR/FR/UC/traceability, kiến trúc, các audit tháng 10, UAT, runbook media và các bằng chứng migration 053/055. Giữ reconciliation 07/09 vì còn phục vụ đối soát ledger.

## Candidate, CI và rollout

- Candidate code đã commit/push: `d7dd7fad270be493d58ca11cf05e1eb00d9f7a8e`; [CI đúng SHA](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37454919148) đạt cả MySQL 8.0, 8.4 và browser.
- Trước rollout: chỉ được có pending 063; checksum nguồn phải khớp bản đã rehearsal, target phải đúng Aiven đã review.
- Backup được bảo vệ và restore/rehearsal phải đạt trước khi ghi shared schema. Không chạy destructive integration trên Aiven, replay migration đã applied, sửa checksum hoặc xóa ledger.
- Schema triển khai trước app/worker sử dụng bảng mới. Rollback app giữ additive schema/history, không DROP 063.
- `063` đã áp dụng sau CI xanh, backup/restore và phê duyệt trong yêu cầu release; receipt và giới hạn bên dưới. Commit tài liệu receipt sau đó phải có CI riêng đúng HEAD trước khi chốt PR.

## Kiểm tra trước push

- `npm test`: 401 PASS, 0 FAIL, 30 opt-in SQL skips; architecture và Web typecheck đạt, process tự kết thúc.
- `npm run build`: API/Web đạt. Playwright toàn bộ: 105 PASS, 0 FAIL, 0 SKIP, hai workers.
- `npm audit --omit=dev`: 0 vulnerabilities. UC catalogue giữ 168 = 129 Implemented + 20 Partial + 19 Planned.
- 35 Markdown files, 355 local links, 0 broken; `git diff --check` đạt.
- Backup mới được bảo vệ ngoài Git: 64 bảng/4.426 dòng; restore, bảo toàn dữ liệu/schema/ledger cũ, additive 2 bảng và repeated runner đều PASS. Aiven chưa ghi. Helper MySQL 9.3 loopback 33319, không thay CI 8.0/8.4.
- Full API/SQL trên helper cô lập: 469 PASS, 0 FAIL, 0 SKIP; không dùng 30 skips làm bằng chứng SQL đã pass. Browser rerun xác nhận native exit 0, 105/105; lượt đầu có PowerShell NativeCommandError do warning NO_COLOR/FORCE_COLOR, không có assertion thất bại.

### Finding của CI candidate đầu

[CI của 4fe8211](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37453993012): MySQL 8.4 đạt, MySQL 8.0 có 468 PASS/1 FAIL, browser bị skip. Không dùng run này để cho phép rollout.

Ca hai reminder workers vẫn enqueue đúng một reminder/two outbox rows, nhưng đọc lease ngay có thể thấy 0. Fixture dùng JavaScript time có milliseconds; MySQL DATETIME(0) có thể làm tròn due_at lên giây kế tiếp, trong khi claimDue so với UTC_TIMESTAMP() không có phần lẻ. Probe cô lập xác nhận 12:00:00.900 được lưu thành 12:00:01 và chưa đủ điều kiện ở 12:00:00. Không phải mất outbox hay gửi trùng.

Sửa clock fixture sang UTC_TIMESTAMP() authoritative của DB và thêm assertion cả hai reminder đã đến hạn. Giữ nguyên concurrency, số outbox, lease eligibility và no-show assertions; không skip hoặc giảm yêu cầu nghiệm thu. Candidate mới phải chạy lại toàn bộ CI; chưa ghi Aiven trong lúc xử lý finding này.

### CI sau sửa và rollout Aiven

- `d7dd7fa`: cả hai job MySQL 8.0/8.4 có 469 PASS, 0 FAIL, 0 SKIP; browser 105 PASS, 0 FAIL. Build, architecture (204 files/0 violations), UC catalogue và audit production (0 vulnerabilities) đạt. CI candidate đầu bị đỏ được giữ làm lịch sử, không dùng thay receipt xanh.
- Backup mới trước write: 64 bảng/4.426 dòng, AES-256-GCM, key riêng, ACL owner/SYSTEM, ngoài Git. Decrypt/restore, đối chiếu dữ liệu/schema/ledger cũ, chạy additive 063 và repeated runner trên MySQL 9.3 loopback đều PASS. Không công bố backup, key hoặc datadir như artifact.
- Runner giữ named lock trên cùng connection, kiểm tra target/pending/checksum với rehearsal trước DDL. Chỉ áp dụng `063_appointment_workflow.sql` trên Aiven MySQL 8.4.8 lúc `2026-10-06T11:19:52.254Z`; không chạy SQL tay hoặc replay migrations cũ.
- Checksum 063: `cb0d1fb77848364ff62aaefd521ec6ea3896e2e2715174da236fd59cf54a575f`. Hai bảng `appointment_events`, `return_appointment_workflows` đã có; ledger cũ được bảo toàn. Postflight read-only: 59 source migrations, 62 applied entries, 29 APPLIED attempts, `pending: []`, không có superseded pending.
- Warnings 053/055 còn nguyên: scope lịch sử 053 khác runtime recovery, SQL gốc 055 chưa tìm được. Không sửa checksum/ledger, không chứng nhận effects lịch sử thiếu bằng chứng, không chạy lại rollout 16 ảnh kho.

### Shared Smoke sau rollout

Local API/Web trong workspace chính dùng shared Aiven; đây không phải deployment cloud production. Ba browser context đăng nhập thật bằng tài khoản UAT được người dùng cho phép; tái sử dụng fixture tổng hợp trước đó, không tạo hoặc tự xác nhận bàn giao vật lý.

- Receipt chính: 69 PASS, 1 OBSERVED, 1 BLOCKED, 0 FAIL. Đã kiểm tra schema gate không còn 503, proposal/accept/reject/cancel, retry/version/participant gates, early no-show rejection, 12 refresh hợp lệ và 3 hard reload giữ phiên, journey privacy, audit search/CSV và mobile journey không tràn ngang.
- Scheduler thật tạo đúng một `REMINDER_QUEUED` cho attempt được kiểm tra. Read-only observation thấy hai immediate email outbox rows ở trạng thái PENDING; không chứng nhận SMTP/inbox từ trạng thái đó. Ba attempt tổng hợp của lượt smoke đã được hủy/đóng rõ ràng; không còn lịch của lượt này chờ gặp, không phát sinh physical confirmation/completed return/feedback giả.
- BLOCKED ban đầu của popup do trang kho chưa lọc không có item còn lưu. Follow-up lọc RECEIVED và mở popup trên hồ sơ hiện có đã PASS: loading claim kết thúc, không giữ lỗi loading cũ, field điện thoại lỗi đỏ, Escape/focus restoration và viewport 390px không tràn ngang. Chỉ đọc và sửa draft client; không gửi return, upload proof hoặc đổi trạng thái vật phẩm.
- Lượt popup harness đầu timeout vì `getByLabel(..., exact: true)` lấy cả text options trong label; đã giới hạn selector vào filter select và chạy lại đạt. Không sửa code/giảm gate để tạo PASS. Không có unhandled browser page errors trong receipt xanh.
- Receipts `063-rehearsal.json`, `063-applied.json`, `shared-smoke.json`, `shared-popup-smoke.json` và ảnh desktop/mobile ở thư mục backup được bảo vệ ngoài Git. Không đưa cookies, credentials, giấy tờ, ảnh hồ sơ hoặc raw provider references vào tài liệu/PR.
- Helper riêng loopback 33319 đã shutdown bình thường sau kiểm tra đúng port/datadir; giữ private datadir/backup, không publish artifact hoặc xóa ảnh nguồn. Không dừng API/Vite của người dùng. Link check sau follow-up: 35 Markdown files/360 local links/0 broken; UC 168 và status giữ nguyên, diff check đạt.

## PR và điều kiện Release

PR `dev` vào `main` phải dùng HEAD đã push và CI đúng SHA sau commit receipt. Giữ draft khi chưa có chấp thuận nghiệm thu còn thiếu; không tự merge `main` hoặc gọi API local là production deployment. Release owner cần kiểm tra inbox reminder được phép nhận và bàn giao vật phẩm/người nhận thật. Các case dual confirmation/mismatch/no-show/race có isolated SQL/browser evidence, không thay biên bản ngoài đời.

[PR #81](https://github.com/LNFSYS/lost-and-found-management-system-main/pull/81) đã mở draft, không có conflict. [CI HEAD bce29f1](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37457013637) đạt toàn bộ; [CI merge candidate đầu](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37457117504) đạt cả SQL jobs nhưng browser 104 PASS/1 FAIL. Không coi PR đã xanh từ CI của dev.

Browser finding ở `lost-contact-photo.spec.ts`: sau click upload evidence, assertion bộ đếm đọc ngay trước khi request đến route handler. Sửa test chờ đúng request, kiểm tra bytes và busy state khi response được giữ có kiểm soát, rồi chờ UI ghi nhận một evidence và đóng form; vẫn kiểm tra chỉ một upload, không skip/retry để lấy PASS. Không đổi production code, schema hoặc replay 063. HEAD sau sửa phải có CI push và merge candidate riêng; kết quả cuối nằm trong checklist PR, không thay lịch sử run đỏ.

Sau sửa test: repeat-each 10 ở mỗi viewport 1440/390 đạt 20/20; toàn bộ Playwright hai workers đạt 105/105, native exit 0. Lượt gọi qua npm workspace bị Windows argument parsing thành tên test đã dừng với `No tests found`; chạy trực tiếp Playwright CLI với đúng arguments, không chọn/bỏ test trong lượt full suite.

## Giới hạn nghiệm thu

CI/local SQL/browser, smoke HTTP trên shared runtime và email được SMTP tiếp nhận là các lớp bằng chứng khác nhau. Không tự xác nhận vật phẩm đã bàn giao, không tạo feedback/reputation giả, không suy ra email tới inbox từ outbox.

Manual UAT vật phẩm/người nhận thật, inbox của người nhận được phép, accessibility thiết bị/screen reader và kiểm thử tải/failover còn cần release owner nghiệm thu riêng. Giữ nguyên các warnings lịch sử 053/055; việc áp dụng 063 không giải quyết được giới hạn SQL gốc.
