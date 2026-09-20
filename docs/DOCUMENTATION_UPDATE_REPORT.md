# Báo cáo đồng bộ tài liệu LNFS

> Historical architecture notice (2026-09-09): Java source/runtime/build has been retired and removed. Backend paths below describe the earlier layout. Current Node.js-only architecture and source mapping: [Clean Architecture](CLEAN_ARCHITECTURE.md). Product/ticket findings and prior verification results remain historical evidence.


Cập nhật: **01/09/2026**

> **Historical snapshot.** Báo cáo này ghi nhận đợt đồng bộ ngày 01/09/2026. Trạng thái hiện tại sau remediation ngày 06/09/2026 nằm tại [LNFS_AUDIT_FIX_REPORT_2026-09-06.md](LNFS_AUDIT_FIX_REPORT_2026-09-06.md) và các tài liệu nguồn sự thật đã được cập nhật. Các số liệu 47/7/46, 108 test, 16 Playwright và các nhận định “chưa có claim runtime” bên dưới không còn là current status.

## 1. Phạm vi và phương pháp

Đợt này đọc và đối chiếu repository mới fptu-lost-found-system-main theo prompt master. Code, test và configuration được ưu tiên hơn tài liệu cũ. Không sửa source runtime, không chạy migration, không thao tác destructive trên Aiven/shared DB và không sửa Jira.

Repository có:

- apps/api-node: Node.js/Express API, migrations, services, repositories, validators và tests.
- apps/web: React/TypeScript/Vite/React Router, pages, components và Playwright tests.
- apps/java-admin-service: Spring Boot health skeleton.
- docs: bộ tài liệu Markdown hiện hành.
- Không có thư mục/project Android, iOS, Expo, React Native hoặc Flutter trong workspace.
- Không có docs report DOCX, XLSX, XLS, PDF, meeting record hoặc WBS spreadsheet.

## 2. Evidence đã kiểm tra

### Runtime/source

- Node app mount auth, posts, staff, handover-points và admin routes trong apps/api-node/src/app.ts.
- Web routes trong apps/web/src/main.tsx gồm login/register/reset, home, profile, posts, my-posts, detail, matches, staff và admin.
- Auth có OTP/SMTP, password, JWT access/refresh, logout và reset password.
- Post/catalog/media/matching/Gemini/warehouse được kiểm tra qua route, service, repository, validator và tests.
- Java chỉ có JavaAdminServiceApplication và Actuator health.
- Không tìm thấy Socket.IO server, native mobile project, manifest hoặc service worker.
- Migration files hiện có từ 001_auth.sql đến 038_seed_default_handover_point.sql; migration runner có checksum/attempt handling.

### Commands

| Command | Result |
| --- | --- |
| npm test | PASS: 53 tests pass, 1 DB integration test skip an toàn; Web TypeScript check pass |
| npm run build | PASS: API TypeScript build và Web Vite production build |
| npm run build:java | BLOCKED: lệnh đã được gọi nhưng máy không có Maven trong PATH; chưa kết luận Java source lỗi |
| npm --workspace @lnfs/web run e2e:home | PASS: 16/16 Playwright tests, gồm auth resilience, post creation, matching view, mobile layout, Staff warehouse và Admin handover/map |
| npm run migrate | Không chạy; tránh tác động Aiven/shared DB |
| git diff --check | PASS: không có whitespace error |
| Markdown relative-link scan | PASS: tất cả link tương đối trong README/docs resolve được |
| Legacy UC checklist count | PASS: 100 ID duy nhất; 47 Done, 7 Partial, 46 Planned |
| Jira | Không có connector/quyền truy cập trong workspace |

## 3. File đã cập nhật

| File | Thay đổi |
| --- | --- |
| README.md | Định vị Web + PWA support + Native Mobile target; baseline, gap, setup và shared DB/media warning |
| docs/README.md | Tài liệu index, source-of-truth rule, status glossary, snapshot và evidence |
| docs/project-overview.md | Actor, scope channel, architecture, current flow, peer-to-peer target flow, state model và roadmap |
| docs/LNFS_BUSINESS_PROCESS_A_TO_Z.md | Nguồn nghiệp vụ A–Z: peer-to-peer, chat/question, claimant, meetup, dual confirmation, custody, warehouse, privacy, KPI và TBD |
| docs/requirements.md | FR-WEB, FR-PWA, FR-MOBILE, FR-CHAT, FR-VERIFY, FR-APPT, FR-HANDOVER, FR-CUSTODY, FR-WAREHOUSE, FR-AUDIT và NFR status |
| docs/business-rules.md | Luật auth/post/privacy/matching/warehouse/peer flow và status Enforced/Partial/Planned/TBD |
| docs/traceability-matrix.md | Mapping BR → FR/NFR → UC → evidence theo channel |
| docs/use-case-checklist.md | Giữ 100 UC duy nhất, 47 Done, 7 Partial, 46 Planned; thêm actor và gap evidence |
| docs/node-java-service-boundary.md | One-writer rule, ownership matrix và điều kiện Java nhận domain |
| apps/java-admin-service/README.md | Ghi đúng Java là health skeleton, không có business ownership/integration |
| docs/SPRINT_4_IMPLEMENTATION_AUDIT.md | Audit 17 ticket Sprint 4: Jira snapshot so với code, test evidence, dependency và backlog gap |

Prompt docs/CODEX_MASTER_UPDATE_PROMPT.md được giữ nguyên làm instruction input, không dùng làm evidence implementation.

## 4. Status hiện tại

### Web

Implemented baseline: auth, role guard, posts, media, catalog, handover point management, Gemini draft, hybrid matching và Staff warehouse operations.

Partial/planned: claim/evidence, peer chat, guided questions, meetup, dual handover, notification, moderation, full admin dashboard/config và disposition.

### PWA

Partial target: responsive Web, mobile browser viewport checks và file input. Chưa có manifest, installability, service worker, offline application shell, safe offline transaction controls hoặc device matrix.

### Native Mobile

Planned — project not created yet. Không có implementation evidence; công nghệ chưa được quyết định. Không gọi PWA là native app.

### Backend

Node.js là core API, migration owner và write owner. Java chỉ là health skeleton. Shared object storage, deployment/rollback/monitoring và multi-instance media chưa có evidence đầy đủ.

## 5. Mâu thuẫn đã giải quyết

- PWA-only được đổi thành Web + PWA support + Native Mobile target.
- Native Mobile không bị xóa khỏi product scope nhưng được ghi Planned vì repository chưa có project.
- Staff-first được đổi thành peer-to-peer first: Finder giữ item; Staff custody là optional/escalation.
- Matching/AI được mô tả là rule-based/hybrid và Gemini-assisted decision support, không phải custom-trained model.
- Schema có claims/appointments/chat không còn được dùng làm bằng chứng runtime nếu route/UI/test chưa có.
- Java không còn được mô tả là business microservice; Node giữ one-writer ownership.
- Sprint/Jira/assignee không được khẳng định vì không có connector để xác minh.

## 6. Use-case và traceability

Checklist giữ 100 ID legacy từ UC-001 đến UC-100:

- 47 Done/Implemented có code và evidence hiện tại.
- 7 Partial.
- 46 Planned.
- 0 Deferred.

Nhóm Native Mobile target được ghi riêng là UC-M01–UC-M12 để tránh tự ý đổi/trùng ID legacy. Team cần phê duyệt mapping trước khi đưa vào SRS chính thức.

## 7. Gap còn lại

- Implement và test peer-to-peer claim/evidence/chat/guided question.
- Implement appointment mutual agreement và dual-confirmed handover.
- Implement notification/realtime room isolation và attachment privacy.
- Hoàn thiện overdue/disposition với policy trường, order, approval và guard.
- Chuyển media sang shared object storage trước multi-instance staging.
- Tạo PWA manifest/service worker/offline/error fallback và device verification.
- Tạo Native Mobile project theo technology decision.
- Bổ sung CI workflow, load test, UAT, deployment smoke và rollback evidence.
- Cài Maven để build Java.
- Cung cấp Report 1–5 và meeting/WBS spreadsheet để đồng bộ trực tiếp.

## 8. Quyết định cần team/mentor

- Native Mobile dùng Expo, React Native, Flutter hay công nghệ khác.
- Sprint dates, assignee, ticket status và Jira history.
- FPT University retention/disposition policy và sensitive-item routing.
- Staff access scope với escalated chat/evidence.
- Shared object storage, deployment platform, monitoring, backup và rollback.
- Notification provider/realtime transport.
- Dataset hợp pháp và tiêu chí evaluation nếu làm custom AI training.

## 9. Quy tắc sau audit

Chỉ nâng status khi có runtime implementation, validation/authorization/privacy, test/build evidence, channel verification và traceability. Không gọi product production-ready, Java production microservices, PWA/native mobile completed hoặc custom-trained AI nếu thiếu evidence tương ứng.
