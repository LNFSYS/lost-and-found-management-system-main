# Tài liệu FPTU Lost & Found System

Cập nhật: **07/10/2026**. Code, tests, cấu hình và receipt đúng candidate là nguồn sự thật; implementation không tự đồng nghĩa với deployment hay nghiệm thu thực tế.

## Bắt đầu từ đây

- [Rà soát trước publish 07/10](audits/publish-review-2026-10-07.md): privacy scan, matching email, điều hướng thông báo và giao diện lịch hẹn; trạng thái CI candidate theo PR `dev-clean`.
- [Chuẩn bị PR dev vào main](audits/dev-main-release-2026-10-06.md): phạm vi lọc tài liệu, candidate/CI, rollout 063 và các giới hạn nghiệm thu.
- [Kết quả sửa UAT](audits/uat-repair-verification-2026-10-06.md): refresh, popup trả đồ, backup/restore và regression.
- [Kế hoạch UAT](plans/uat-repair-plan-2026-10-06.md) và [UAT thực tế](audits/real-workflow-uat-2026-10-06.md): finding gốc, checklist và evidence.
- [Rollout lịch hẹn/hành trình](runbooks/appointment-journey-rollout.md): schema, policy, rollback và acceptance.
- [Tổng quan dự án](overview/project-overview.md): actor, scope, architecture và giới hạn hiện tại.

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| [overview/](overview/) | Tổng quan và quy trình A-Z |
| [requirements/](requirements/) | BR, FR/NFR, UC và traceability |
| [architecture/](architecture/) | Kiến trúc Node.js, mapping source và sơ đồ |
| [sequences/](sequences/README.md) | Sequence từng UC trong 3.1–3.17, chia thư mục Đạt / Trần Thế Lượng / Khoa / Q; nguồn PlantUML và PNG |
| [workflows/](workflows/) | Quy tắc chat, ảnh, kho và email |
| [audits/](audits/) | Bằng chứng audit/UAT theo từng candidate |
| [runbooks/](runbooks/) | Rollout, recovery, backup và đối soát media |
| [plans/](plans/) | Checklist sửa lỗi và nghiệm thu |
| [archive/](archive/) | Reconciliation lịch sử còn cần đối soát ledger |

Root `docs/` chỉ giữ mục lục. Sáu báo cáo cũ dư thừa đã được bỏ khỏi cây hiện hành; xem [phạm vi lọc](audits/dev-main-release-2026-10-06.md). Nội dung đã commit vẫn có trong Git history. Không xóa audit tháng 10, receipt UAT/backup hoặc giới hạn migration để làm checklist trông hoàn tất.

## Yêu cầu và phạm vi

| Tài liệu | Vai trò |
| --- | --- |
| [Business process A-Z](overview/LNFS_BUSINESS_PROCESS_A_TO_Z.md) | Luồng nghiệp vụ mục tiêu |
| [Requirements](requirements/requirements.md) | FR/NFR và trạng thái |
| [Business rules](requirements/business-rules.md) | Quy tắc enforce/partial/planned |
| [Use cases](requirements/uc.md) | Catalogue 168 UC và ownership |
| [Traceability](requirements/traceability-matrix.md) | BR → FR/NFR → UC → evidence |

Catalogue hiện tại: **168 UC = 129 Implemented + 21 Partial + 18 Planned**. UC-097 có producer/email/popup; CI candidate, deployment và inbox acceptance được theo dõi riêng trong [publish review](audits/publish-review-2026-10-07.md) và [quy tắc matching notification](workflows/matching-notification-rules.md). [Đối chiếu UC 06/10](audits/uc-status-review-2026-10-06.md) là snapshot trước đợt xây lịch hẹn/hành trình, không ghi đè catalogue mới.

Web là channel hiện có; PWA có manifest/service worker/offline shell nhưng còn cần device/installability acceptance. Native Mobile thuộc scope mục tiêu, trạng thái `Planned - project not created yet`. Node.js/TypeScript là backend và business/migration write owner duy nhất; Java đã ngừng sử dụng. Không tự bịa trạng thái Jira hoặc các report bên ngoài chưa được cung cấp.

## Kiến trúc và workflow

| Tài liệu | Nội dung |
| --- | --- |
| [Clean Architecture](architecture/CLEAN_ARCHITECTURE.md) | Module contracts và dependency rules |
| [Source map](architecture/CLEAN_ARCHITECTURE_FILE_MAP.md) | Mapping source |
| [Sơ đồ draw.io](architecture/LNFS_NODE_ONLY_ARCHITECTURE.drawio) | System/FE/BE packages, giữ template |
| [LOST contact photo](workflows/lost-contact-photo-rules.md) | Finder liên hệ LOST không phải tạo FOUND giả |
| [Warehouse intake evidence](workflows/warehouse-intake-evidence.md) | Ảnh SOURCE_POST/INTAKE/RETURN và tiếp nhận |
| [Warehouse policy](workflows/warehouse-retention-and-status-rules.md) | Retention, hold, disposition và quyền trả đồ |
| [Notification email](workflows/notification-email-rules.md) | Preference, retry, lease và delivery limits |

Matching/Gemini chỉ hỗ trợ quyết định, không chứng nhận quyền sở hữu. Staff tiếp nhận không tự trở thành Finder hoặc tự accept claim. Dual completion cần xác nhận vật lý hợp lệ; tranh chấp/custody/legal hold vẫn phải chặn outcome không hợp lệ.

## Runbooks và lịch sử DB

| Tài liệu | Nội dung |
| --- | --- |
| [Appointment/journey rollout](runbooks/appointment-journey-rollout.md) | Migration 063, schema-before-app, reminder và direct return |
| [Warehouse recovery](runbooks/database-warehouse-recovery.md) | Backup/rehearsal, ledger và liên kết cần review |
| [Warehouse media rollout](runbooks/warehouse-media-rollout.md) | Authenticated Cloudinary, 16 reference đã chuyển, không rerun |
| [Upload reconciliation](runbooks/media-upload-reconciliation.md) | Unknown INSERT/COMMIT outcome và cleanup an toàn |
| [Migration history review](audits/migration-history-review-2026-10-05.md) | Giới hạn SQL gốc 053/055 |
| [Reconciliation 07/09](archive/AIVEN_SCHEMA_RECONCILIATION_2026-09-07.md) | Snapshot lịch sử, không phải DB status hiện tại |

Không replay migration applied, sửa checksum hoặc xóa ledger. Shared DB chỉ được ghi theo phê duyệt, đúng scope, sau backup/restore/rehearsal. Receipt rollout mới nằm trong [release follow-up](audits/dev-main-release-2026-10-06.md); snapshot cũ ghi pending không chứng nhận trạng thái DB mới.

## Audit và verification

| Báo cáo | Phạm vi |
| --- | --- |
| [Audit 04/10](audits/full-system-audit-2026-10-04.md) | Actor journey và sửa lỗi đợt đầu |
| [Audit 05/10](audits/full-system-audit-2026-10-05.md) | A1/A2/A3 và release gates |
| [Re-audit 05/10](audits/full-system-re-audit-2026-10-05.md) | B1/B2/B3, media outcome và modal |
| [UAT thực tế 06/10](audits/real-workflow-uat-2026-10-06.md) | Các lỗi đã tái hiện trên shared runtime |
| [Sửa UAT 06/10](audits/uat-repair-verification-2026-10-06.md) | Local regression và backup rehearsal |
| [Matching feedback review](audits/matching-feedback-review.md) | Matching, pagination và periodic refresh |
| [Dev audit fixes](audits/dev-main-audit-fixes.md) | Candidate-specific repair evidence |
| [Intake/contact verification](audits/physical-intake-contact-verification.md) | Intake và LOST contact |
| [LNFS-53 verification](audits/LNFS-53-GUIDED-VERIFICATION.md) | Guided verification feature scope |
| [LNFS-55 verification](audits/LNFS-55-SAFETY-VERIFICATION.md) | Custody safety feature scope |
| [S4-P0 contract](audits/S4-P0-IMPLEMENTATION.md) | Contract lịch sử còn dùng đối chiếu |
| [Architecture verification](audits/CLEAN_ARCHITECTURE_VERIFICATION.md) | Receipt refactor, không thay receipt candidate mới |

Mỗi báo cáo chỉ chứng nhận scope/candidate/môi trường đã ghi. CI xanh của SHA cũ không chứng nhận dirty worktree. SQL destructive chỉ chạy trên loopback `_test`, không trỏ Aiven. Không upload toàn bộ local `test-results/`: helper datadir có thể chứa byte rehearsal riêng tư; chỉ chia sẻ log/screenshot đã review.

## Trạng thái và quy tắc cập nhật

- `Implemented`: có runtime cho actor goal, không mặc định được deployment/UAT nghiệm thu.
- `Verified`: có evidence vừa chạy cho scope và candidate cụ thể.
- `Partial` / `Planned` / `TBD`: thiếu acceptance/runtime hoặc quyết định scope.
- `Historical`: snapshot cũ, không dùng làm status hiện hành.

Không nâng UC/điểm audit chỉ vì tests pass; không tạo ID cho bug fix. Thay đổi rule hoặc actor goal mới phải có mapping BR/FR/UC/traceability. Giữ nguyên snapshot lịch sử, ghi follow-up mới. Report 1-5/SRS/Design, DOCX/XLSX/PDF/WBS/meeting records chưa được cung cấp thì ghi thiếu, không tạo chứng cứ thay thế giả.
