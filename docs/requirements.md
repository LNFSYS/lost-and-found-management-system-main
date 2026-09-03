# Yêu cầu hệ thống LNFS

Cập nhật: **03/09/2026**

## 1. Quy ước status

- **Implemented:** có runtime code cho mục tiêu trong repository.
- **Verified:** implementation có test/build/manual evidence được ghi rõ.
- **Partial:** mới đáp ứng một phần acceptance criteria.
- **Planned:** thuộc phạm vi mục tiêu nhưng chưa có runtime evidence.
- **TBD:** cần mentor, team hoặc đơn vị vận hành quyết định.

Requirements target bao phủ Web Application, PWA và Native Mobile. Status bên dưới chỉ phản ánh repository hiện tại; không suy ra từ migration, mockup hoặc ticket.

## 2. Functional requirements

### 2.1 Web, authentication và authorization

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-WEB-01 | Web cung cấp board, bài của tôi, post detail, tạo/cập nhật/đóng/xóa mềm LOST/FOUND, tìm kiếm, lọc, sắp xếp và phân trang. | UC-040–UC-047 | P0 | Implemented |
| FR-AUTH-01 | User yêu cầu OTP email, xác thực OTP và tạo tài khoản với audience Student/Lecturer; email FPT/edu không bắt buộc. | UC-031, UC-032 | P0 | Implemented |
| FR-AUTH-02 | User đăng nhập password, nhận access token, refresh session và logout. | UC-033–UC-035 | P0 | Implemented |
| FR-AUTH-03 | User yêu cầu và hoàn tất reset password bằng mã có hạn dùng. | UC-036 | P0 | Implemented |
| FR-AUTH-04 | User xem/cập nhật profile cơ bản, quản lý avatar Cloudinary và xem activity/reputation. | UC-037–UC-039 | P1 | Implemented; Cloudinary live upload/delivery/cleanup smoke test pass, full UI/device QA còn pending |
| FR-ROLE-01 | Backend xác thực JWT và kiểm tra USER/STUDENT/LECTURER/STAFF/ADMIN; Staff không truy cập Admin API. | UC-001, UC-002, UC-062 | P0 | Implemented |
| FR-BOARD-01 | Guest chỉ xem public content; protected client xử lý loading, empty, error và unauthorized state. | UC-044–UC-047 | P0 | Implemented/Partial theo màn hình |

### 2.2 LOST/FOUND, catalog và media

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-POST-01 | User đăng nhập tạo LOST hoặc FOUND với title, description, category cụ thể, thời gian, liên hệ và location hợp lệ. | UC-040, UC-041 | P0 | Implemented |
| FR-POST-02 | Owner được update, close hoặc soft-delete bài của mình; status phải qua validation/state rule hiện tại. | UC-042, UC-043 | P0 | Implemented |
| FR-CATALOG-01 | Form dùng category hai cấp, area, building và handover point active. | UC-055, UC-064, UC-065 | P0 | Implemented |
| FR-MEDIA-01 | Owner upload, xem qua protected media proxy và xóa media bài đăng; API kiểm MIME, size, signature và count. | UC-048, UC-050 | P0 | Implemented trên local storage |
| FR-MEDIA-02 | Media dùng shared object storage để nhiều máy/instance không tạo reference file local bị thiếu. | UC-048, UC-050 | P0 | Planned |
| FR-PRIVPOST-01 | FOUND có private attributes; public response che contact, vị trí chi tiết, media/tín hiệu nhạy cảm theo authorization. | UC-041, UC-044, UC-054 | P0 | Partial |
| FR-HANDOVER-01 | Public chỉ thấy điểm bàn giao active; Admin CRUD/toggle map, marker, giờ hoạt động và hard-delete guard; Staff/Admin xem số item theo điểm. | UC-008–UC-010, UC-055–UC-058 | P0 | Implemented |

### 2.3 AI-assisted draft và hybrid matching

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AI-01 | User gửi tối đa 5 ảnh hợp lệ để Gemini tạo title, description, category suggestion, visual attributes và safe visible text. | UC-086, UC-088 | P1 | Implemented |
| FR-AI-02 | Phân tích ảnh chỉ tạo draft có thể sửa; không tự đăng bài hoặc xác minh ownership. | UC-086, UC-088, UC-091 | P0 | Implemented |
| FR-MATCH-01 | Create/update post chạy bounded best-effort matching với bài đối nghịch đang hoạt động. | UC-068 | P0 | Implemented |
| FR-MATCH-02 | Matching dùng text normalization tiếng Việt, category, location, time, image tags và safe OCR tags với weight/threshold. | UC-069, UC-070, UC-091 | P0 | Implemented |
| FR-MATCH-03 | Kết quả lưu score thành phần, tier, matcher version và explanation; owner có thể xem/re-run theo quyền và rate limit. | UC-071, UC-072, UC-075, UC-076 | P0 | Implemented |
| FR-MATCH-04 | Match notification/10-minute refresh không mở lại popup đã đóng và không auto chuyển trạng thái. | UC-073, UC-074 | P1 | Planned |
| FR-TRAIN-01 | Custom model chỉ được công bố sau dataset hợp pháp, anonymization, labeling, evaluation, versioning và inference artifact. | UC-026–UC-030 | P2 | Planned |

### 2.4 Peer verification, chat và appointment

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-VERIFY-01 | Owner gửi verification request cho FOUND; Finder giữ item và quyết định qua conversation riêng. | UC-003, UC-052 | P0 | Planned |
| FR-VERIFY-02 | Finder dùng guided questions; Owner trả lời mà không xem trước private answer/attribute; hỗ trợ thêm thông tin, accept, decline hoặc escalate. | UC-003–UC-007, UC-089–UC-092 | P0 | Planned |
| FR-CLAIM-01 | User tạo claim không trùng; evidence private được upload và chỉ actor có quyền mới xem. | UC-049, UC-052–UC-054 | P0 | Planned |
| FR-APPT-01 | Chỉ accepted verification mới tạo appointment; hai bên đề xuất, accept, reschedule/cancel và complete. | UC-021–UC-024 | P1 | Planned |
| FR-HANDOVER-02 | Direct return cần Finder xác nhận HANDED_OVER và Owner xác nhận RECEIVED; chỉ dual confirmation mới thành RETURNED. | UC-021–UC-024 | P0 | Planned |
| FR-CHAT-01 | Conversation gắn đúng Owner–Finder–LOST–FOUND, hỗ trợ text/image, room isolation, retry, seen/unread và report/block. | UC-077–UC-083 | P1 | Planned |
| FR-RT-01 | Realtime transport được JWT-authenticated và không broadcast private data cho actor ngoài room. | UC-077–UC-083 | P1 | Planned |

### 2.5 Staff custody, warehouse, admin và audit

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-STAFF-01 | Staff có operational dashboard với quyền thấp hơn Admin; frontend ẩn menu không thay thế backend guard. | UC-002, UC-062 | P1 | Implemented cho warehouse scope |
| FR-CUSTODY-01 | Finder có thể yêu cầu chuyển item cho Staff khi không thể giữ, có dispute, sensitive item hoặc policy yêu cầu. Staff intake mới tạo custody. | UC-016–UC-020 | P1 | Planned |
| FR-WAREHOUSE-01 | Staff/Admin receive/store/return item, retention deadline, storage log và handover counts. | UC-011–UC-015, UC-058–UC-061 | P1 | Partial: receive/store/return đã có; disposition chưa đủ |
| FR-WAREHOUSE-02 | Overdue item chỉ được dispose/donate/transfer khi không còn claim/appointment/dispute pending và có chứng từ. | UC-016–UC-020 | P1 | Planned |
| FR-ADMIN-01 | Admin CRUD/toggle category group, category con, area, building và handover point. | UC-008–UC-010, UC-064, UC-065 | P0 | Implemented |
| FR-ADMIN-02 | Admin quản lý user, moderation, report, export, config và dashboard toàn hệ thống. | UC-063, UC-066, UC-067, UC-084, UC-085 | P1 | Implemented cho scope hiện tại; KPI snapshot đã tách contract |
| FR-AUDIT-01 | Sensitive state transition và admin action lưu actor, action, before/after, lý do và timestamp. | UC-015, UC-018, UC-024, UC-063–UC-067 | P1 | Partial |

### 2.6 PWA và Native Mobile

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-PWA-01 | Web responsive có manifest, installability, service worker, application shell, safe offline/error fallback, retry và mobile-browser camera/gallery. Transaction chỉ thành công sau server confirmation. | UC-093–UC-100 | P1 | Partial: manifest/service worker/offline shell đã có; device matrix và manual installability evidence còn thiếu |
| FR-MOBILE-01 | Native Mobile dùng chung API/auth/authorization/privacy/state rules, có auth, LOST/FOUND, matching, chat/image, meetup/handover và notification. | UC-M01–UC-M12 | P1 | Planned — project chưa được tạo |
| FR-MOBILE-02 | Native Mobile có navigation, session refresh, upload, permission, device test và release build. | UC-M01–UC-M12 | P1 | Planned — công nghệ TBD |
| FR-JAVA-01 | Java Spring Boot cung cấp health endpoint nhưng chưa sở hữu flow nghiệp vụ. | N/A | P2 | Implemented skeleton |

## 3. Non-functional requirements

| ID | Requirement | Priority | Status/evidence |
| --- | --- | --- | --- |
| NFR-SEC-01 | Password/OTP/refresh token được hash/protect; secret không xuất hiện trong source/log. | P0 | Implemented trong auth tests; production secret rotation vẫn là vận hành |
| NFR-SEC-02 | Protected route trả 401/403 đúng; backend authorization là nguồn quyết định. | P0 | Implemented cho current routes |
| NFR-SEC-03 | Auth, Gemini và matching rerun có rate limit phù hợp. | P0 | Implemented cho current module |
| NFR-VALID-01 | Payload/query/params/upload được validate tại backend và merged update state được kiểm tra. | P0 | Implemented cho current post/catalog module |
| NFR-PRIV-01 | Private post/media/match signal/evidence không lộ cho actor sai quyền. | P0 | Partial; claim evidence chưa có runtime |
| NFR-DATA-01 | Migration tuần tự, checksum-protected; migration đã chạy không sửa. | P0 | Implemented trong migration runner/tests |
| NFR-DATA-02 | Shared Aiven/dev DB không dùng cho destructive test; integration test dùng database local riêng. | P0 | Process rule |
| NFR-PERF-01 | Board có pagination; matching có candidate limit/window và rerun rate limit. | P0 | Implemented ở tested baseline; chưa load test |
| NFR-PORT-01 | Media tồn tại sau restart/deploy và đọc được từ mọi instance. | P0 | Avatar dùng Cloudinary; media bài đăng vẫn local storage nên requirement tổng thể chưa đạt |
| NFR-TEST-01 | API/Web build pass và logic quan trọng có unit/browser/integration evidence. | P0 | Partial: claim/chat/PWA/mobile chưa có |
| NFR-CI-01 | Pull request tự chạy test/build với MySQL isolated. | P1 | Planned; chưa có workflow trong repository |
| NFR-OBS-01 | Có health/readiness, structured request log và graceful shutdown. | P1 | Partial: health/readiness có; cần verify phần còn lại |
| NFR-AUDIT-01 | Admin và sensitive transitions có audit trail đủ actor/action/before-after/time. | P1 | Partial |
| NFR-AI-01 | AI/OCR/matching chỉ hỗ trợ quyết định; human verification bắt buộc trước trả đồ. | P0 | Implemented cho current AI/matching module; verification flow planned |
| NFR-PWA-01 | Cached/offline UI không lộ private data và không báo transaction trước server confirmation. | P0 | Implemented trong service worker/cache policy; cần manual device evidence |
| NFR-MOBILE-01 | Native Mobile parity phải dùng shared contract và có device/release evidence. | P1 | Planned |

## 4. Acceptance và traceability

Mỗi requirement Implemented/Verified phải có route/service/UI/test path tồn tại. Requirement Planned/Partial phải ghi gap rõ ràng trong [traceability matrix](traceability-matrix.md), [use-case checklist](use-case-checklist.md) và [business rules](business-rules.md). Không dùng migration hoặc UI mockup thay cho runtime evidence.

## 5. Quyết định cần xác nhận

- Native Mobile framework và sprint/capacity.
- Retention/disposition policy của trường.
- Cloudinary đã dùng cho avatar; shared object storage cho media bài đăng và deployment platform vẫn cần xác nhận.
- Quyền Staff khi xem case escalation.
- Jira sprint dates, assignee, ticket history.
