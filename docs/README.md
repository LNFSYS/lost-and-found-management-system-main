# Tài liệu FPTU Lost & Found System

Cập nhật: **03/09/2026**

## 1. Mục đích

Bộ tài liệu này mô tả phạm vi, nghiệp vụ, requirement, kiến trúc và bằng chứng implementation của repository `fptu-lost-found-system-main`. Code, test và configuration là nguồn sự thật chính; tài liệu chỉ được nâng status khi có evidence tái lập được.

**Software type thống nhất:** Web Application with Progressive Web App (PWA) support and a Native Mobile Application.

- Web là channel hiện có.
- PWA là phần mở rộng của web responsive; manifest, service worker và offline shell đã có, còn cần device/installability evidence.
- Native Mobile là scope mục tiêu bắt buộc theo kế hoạch, nhưng hiện chưa có project trong repository và phải ghi `Planned — project not created yet`.

## 2. Thứ tự nguồn sự thật

1. Code, test, configuration và deployment evidence trong repository.
2. Jira hiện tại nếu có connector/quyền truy cập và có thể kiểm tra trực tiếp.
3. Quyết định phạm vi, nghiệp vụ của nhóm.
4. Tài liệu cũ.

Jira connector không được cung cấp trong workspace này; sprint, assignee, lịch sử ticket và trạng thái Jira chưa được xác minh. Không tự bịa hoặc sửa lịch sử Jira.

## 3. Trạng thái tài liệu

| Status | Ý nghĩa |
| --- | --- |
| `Implemented` | Có runtime code cho mục tiêu; chưa mặc định là đã kiểm tra đầy đủ mọi channel. |
| `Verified` | Có test/build/manual evidence vừa được chạy và ghi rõ trong report. |
| `Partial` | Có một phần runtime hoặc một phần acceptance criteria. |
| `Planned` | Có trong scope/roadmap nhưng chưa có runtime evidence. |
| `TBD` | Cần mentor, team hoặc đơn vị vận hành quyết định. |
| `Historical` | Thông tin cũ chỉ để tham khảo, không dùng làm current status. |

Không đánh dấu Done chỉ vì có migration, schema, ticket, mockup, skeleton hoặc test file chưa chạy.

## 4. Nguồn tài liệu chính

| Tài liệu | Vai trò |
| --- | --- |
| [project-overview.md](project-overview.md) | Định vị, scope, actor, kiến trúc, luồng và baseline hiện tại |
| [LNFS_BUSINESS_PROCESS_A_TO_Z.md](LNFS_BUSINESS_PROCESS_A_TO_Z.md) | Nguồn nghiệp vụ đầy đủ và luồng peer-to-peer mục tiêu |
| [requirements.md](requirements.md) | Functional/non-functional requirements và status |
| [business-rules.md](business-rules.md) | Luật đang enforce, partial hoặc planned |
| [traceability-matrix.md](traceability-matrix.md) | Mapping BR → FR/NFR → UC → evidence |
| [use-case-checklist.md](use-case-checklist.md) | 100 UC duy nhất, actor, điều kiện, status và evidence |
| [node-java-service-boundary.md](node-java-service-boundary.md) | Ownership Node.js/Java và one-writer rule |
| [DOCUMENTATION_UPDATE_REPORT.md](DOCUMENTATION_UPDATE_REPORT.md) | Biên bản đối chiếu code và cập nhật tài liệu gần nhất |
| [SPRINT_4_IMPLEMENTATION_AUDIT.md](SPRINT_4_IMPLEMENTATION_AUDIT.md) | Audit 17 Jira ticket Sprint 4 từ snapshot offline |

## 5. Snapshot implementation ngày 03/09/2026

**Đã có bằng chứng runtime/test:**

- Auth email OTP/SMTP, password login, JWT access/refresh, logout, reset password và profile cơ bản.
- Web board, my posts, post detail, create/update/close/soft-delete, search/filter/sort/pagination.
- Category hai cấp, area, building, handover-point public active-only và Admin CRUD/map/marker.
- Post media local protected proxy, validation và xóa media; avatar dùng Cloudinary authenticated storage và protected proxy.
- Admin moderation/report, dashboard KPI theo kỳ, current snapshot và aggregate CSV/JSON export.
- Gemini-assisted multi-image draft; hybrid/rule-based matching có tier và explanation.
- Staff warehouse receive/store/return, retention deadline, handover counts và storage log.

**Partial hoặc planned:**

- Claim/evidence, private verification chat, guided questions, multiple claimant, meetup và direct dual handover.
- Socket.IO realtime, notification, unread/seen và image chat.
- Warehouse overdue/disposition và claim/chat/appointment workflow đầy đủ.
- PWA device matrix/installability QA và shared storage cho media bài đăng.
- Native Mobile Application.
- Shared object storage và Java business endpoints.

## 6. Evidence đã kiểm tra

- API unit/service/repository/validator tests: **108 pass, 1 skip an toàn** cho DB integration chưa có MySQL local `_test`.
- `npm test`: pass, gồm API tests và web TypeScript check.
- `npm run build`: pass cho API và Web production build.
- `npm run build:java`: chưa chạy được vì Maven không có trong `PATH`.
- `npm --workspace @lnfs/web run e2e:home`: **PASS 16/16**, gồm auth resilience, post creation, matching view, mobile layout, Staff warehouse và Admin handover/map.
- Không chạy migration hoặc test destructive trên Aiven/shared DB.
- Repository có 100 UC duy nhất từ `UC-001` đến `UC-100`.

## 7. Tài liệu bên ngoài còn thiếu

Không tìm thấy Report 1, Report 2, Report 3/SRS, Report 4/Design, Report 5/Implementation and Testing, DOCX, XLSX, XLS, PDF, meeting records hoặc WBS spreadsheet trong workspace hiện tại. Không tạo bản thay thế giả. Khi nhóm cung cấp, cần đồng bộ theo bộ tài liệu này và giữ style/TOC/layout gốc.

## 8. Quy tắc cập nhật

1. Mọi status phải trỏ tới route/service/UI/test path có thật.
2. Peer-to-peer là luồng chính trong tài liệu mục tiêu; Staff custody/warehouse là optional hoặc escalation.
3. Gemini/OCR và matching chỉ là decision support; không gọi custom-trained AI khi chưa có model artifact/evaluation.
4. Java chỉ là health skeleton cho tới khi có API contract, JWT compatibility, integration test và một write owner rõ ràng.
5. Native Mobile được giữ trong scope mục tiêu nhưng không ghi implemented khi chưa có project.
6. Sau thay đổi lớn phải cập nhật ngày audit, report và traceability.
