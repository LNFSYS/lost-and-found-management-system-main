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

- Candidate commit/push và link CI: chưa chốt trong lúc soạn receipt.
- Trước rollout: chỉ được có pending 063; checksum nguồn phải khớp bản đã rehearsal, target phải đúng Aiven đã review.
- Backup được bảo vệ và restore/rehearsal phải đạt trước khi ghi shared schema. Không chạy destructive integration trên Aiven, replay migration đã applied, sửa checksum hoặc xóa ledger.
- Schema triển khai trước app/worker sử dụng bảng mới. Rollback app giữ additive schema/history, không DROP 063.
- Chưa áp dụng 063 tại thời điểm tạo receipt này; kết quả thực hiện được bổ sung bên dưới sau khi kiểm tra.

## Kiểm tra trước push

- `npm test`: 401 PASS, 0 FAIL, 30 opt-in SQL skips; architecture và Web typecheck đạt, process tự kết thúc.
- `npm run build`: API/Web đạt. Playwright toàn bộ: 105 PASS, 0 FAIL, 0 SKIP, hai workers.
- `npm audit --omit=dev`: 0 vulnerabilities. UC catalogue giữ 168 = 129 Implemented + 20 Partial + 19 Planned.
- 35 Markdown files, 355 local links, 0 broken; `git diff --check` đạt.
- Backup mới được bảo vệ ngoài Git: 64 bảng/4.426 dòng; restore, bảo toàn dữ liệu/schema/ledger cũ, additive 2 bảng và repeated runner đều PASS. Aiven chưa ghi. Helper MySQL 9.3 loopback 33319, không thay CI 8.0/8.4.
- Full API/SQL trên helper cô lập đang chạy trong lúc chốt candidate; không dùng 30 skips làm bằng chứng SQL đã pass.

## Giới hạn nghiệm thu

CI/local SQL/browser, smoke HTTP trên shared runtime và email được SMTP tiếp nhận là các lớp bằng chứng khác nhau. Không tự xác nhận vật phẩm đã bàn giao, không tạo feedback/reputation giả, không suy ra email tới inbox từ outbox.

Manual UAT vật phẩm/người nhận thật, inbox của người nhận được phép, accessibility thiết bị/screen reader và kiểm thử tải/failover còn cần release owner nghiệm thu riêng. Giữ nguyên các warnings lịch sử 053/055; việc áp dụng 063 không giải quyết được giới hạn SQL gốc.
