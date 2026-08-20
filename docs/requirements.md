# Yêu cầu chức năng và phi chức năng

Cập nhật: 21/08/2026

## 1. Quy ước trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| `Implemented` | Có runtime code và có thể kiểm tra trong codebase hiện tại |
| `Partial` | Có một phần route/UI/schema nhưng chưa hoàn chỉnh end-to-end |
| `Planned` | Chưa có runtime implementation |
| `Deferred` | Ngoài phạm vi web/backend ưu tiên hiện tại |

Migrations chỉ là bằng chứng schema, không đủ để đánh dấu một requirement là `Implemented`.

## 2. Functional requirements

### 2.1 Authentication và authorization

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AUTH-01 | Người dùng có thể yêu cầu OTP qua email, xác thực OTP và tạo tài khoản với audience role Student/Lecturer. Email FPT/edu không bắt buộc. | UC-031, UC-032 | P0 | Implemented |
| FR-AUTH-02 | Người dùng có thể đăng nhập bằng email/password, nhận access token, refresh phiên và logout. | UC-033, UC-034, UC-035 | P0 | Implemented |
| FR-AUTH-03 | Người dùng có thể yêu cầu và hoàn tất reset password bằng mã có hạn dùng. | UC-036 | P0 | Implemented |
| FR-AUTH-04 | Người dùng có thể xem và cập nhật profile cơ bản. Avatar, activity và reputation chưa thuộc runtime hiện tại. | UC-037, UC-038, UC-039 | P1 | Partial |
| FR-ROLE-01 | Backend phải kiểm tra JWT và role `USER/STUDENT/LECTURER/STAFF/ADMIN`; STAFF không được truy cập Admin API. | UC-001, UC-002, UC-062 | P0 | Implemented |

### 2.2 Posts, catalog và media

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-POST-01 | User đăng nhập có thể tạo bài `LOST` hoặc `FOUND` với title, description, danh mục con, thời gian, liên hệ và vị trí hợp lệ. | UC-040, UC-041 | P0 | Implemented |
| FR-POST-02 | Owner có thể cập nhật nội dung/trạng thái và xóa mềm bài của mình. | UC-042, UC-043 | P0 | Implemented |
| FR-BOARD-01 | Hệ thống cung cấp board, bài của tôi, chi tiết bài, search/filter/sort và pagination. | UC-044, UC-045, UC-046, UC-047 | P0 | Implemented |
| FR-CATALOG-01 | Form tạo bài phải dùng category hai cấp, area, building và danh sách handover point đang hoạt động. | UC-055, UC-064, UC-065 | P0 | Implemented |
| FR-MEDIA-01 | Owner có thể upload, xem qua media proxy và xóa tối đa số ảnh được cấu hình; API kiểm tra MIME, kích thước và file signature. | UC-048, UC-050 | P0 | Implemented với local storage |
| FR-MEDIA-02 | Media phải được lưu trên shared object storage để chạy nhiều máy/instance và không tạo DB reference tới file local bị thiếu. | UC-048, UC-050 | P0 | Planned |
| FR-PRIVPOST-01 | `PRIVATE_DETAILS` chỉ áp dụng cho `FOUND`; public serializer phải che contact, vị trí chi tiết, media và tín hiệu nhận dạng nhạy cảm. | UC-041, UC-044, UC-054 | P0 | Partial; post serializer có, claim chưa có |

### 2.3 Image assistance và matching

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AI-01 | User có thể gửi 1-5 ảnh hợp lệ để Gemini tạo title, description, category suggestion, visual attributes và safe visible text. | UC-086, UC-088 | P1 | Implemented |
| FR-AI-02 | Kết quả phân tích ảnh chỉ điền bản nháp có thể chỉnh sửa; không tự đăng bài hoặc xác minh sở hữu. | UC-086, UC-088, UC-091 | P0 | Implemented |
| FR-MATCH-01 | Sau create/update post, hệ thống chạy bounded best-effort matching với bài đối nghịch đang hoạt động. | UC-068 | P0 | Implemented |
| FR-MATCH-02 | Matching dùng text normalization tiếng Việt, category, location, time, image tags và safe OCR tags với weights/thresholds. | UC-069, UC-070, UC-091 | P0 | Implemented |
| FR-MATCH-03 | Kết quả matching phải được lưu, xếp tier, giải thích và trả cho post owner/Staff/Admin; manual rerun có rate limit. | UC-071, UC-072, UC-075, UC-076 | P0 | Implemented |
| FR-MATCH-04 | Matching notification và chu kỳ kiểm tra 10 phút không được làm popup mở lại ngay sau khi user đóng. | UC-073, UC-074 | P1 | Planned |
| FR-TRAIN-01 | Chỉ gọi custom model khi có dataset đã ẩn danh, labeling, evaluation, versioning và inference thật. | UC-026, UC-027, UC-028, UC-029, UC-030 | P2 | Planned |

### 2.4 Admin và staff

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-ADMIN-01 | Admin có thể CRUD/toggle nhóm danh mục, danh mục con, area và building. | UC-064, UC-065 | P0 | Implemented |
| FR-ADMIN-02 | Admin có dashboard toàn hệ thống, user management, moderation, report/export và config management. | UC-063, UC-066, UC-067, UC-084, UC-085 | P1 | Partial; mới có catalog statistics |
| FR-STAFF-01 | Staff có dashboard vận hành với quyền thấp hơn Admin. | UC-002, UC-062 | P1 | Partial; guard có, page là placeholder |
| FR-HANDOVER-01 | User xem điểm bàn giao; Admin quản lý marker, giờ hoạt động và số item lưu giữ. | UC-008, UC-009, UC-010, UC-055, UC-056, UC-057, UC-058 | P1 | Partial; catalog read-only có |

### 2.5 Core workflow tiếp theo

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-CLAIM-01 | User gửi claim cho bài FOUND, upload private evidence và không thể tạo duplicate claim. | UC-049, UC-052, UC-053, UC-054 | P0 | Planned |
| FR-CLAIM-02 | Reviewer yêu cầu thêm thông tin, accept/reject/cancel theo state machine và transaction lock. | UC-003, UC-004, UC-005, UC-006, UC-007 | P0 | Planned |
| FR-EVIDENCE-01 | Hệ thống cung cấp advisory evidence confidence cho reviewer nhưng không auto-verify ownership. | UC-087, UC-089, UC-090, UC-092 | P1 | Planned |
| FR-APPT-01 | Accepted claim có thể tạo, reject, reschedule/cancel và complete appointment. | UC-021, UC-022, UC-023, UC-024 | P1 | Planned |
| FR-WAREHOUSE-01 | Staff/Admin quản lý receive/store/return, storage log và retention/disposition. | UC-011 đến UC-020, UC-059 đến UC-061 | P1 | Planned |
| FR-RT-01 | Socket.IO hỗ trợ JWT, room isolation, chat text/image, seen/unread và notification. | UC-077 đến UC-083 | P1 | Planned |
| FR-REP-01 | Hệ thống ghi reputation và feedback sau business event hợp lệ. | UC-025, UC-039 | P2 | Planned |

### 2.6 Java và mobile

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-JAVA-01 | Java service có health endpoint; chưa sở hữu flow nghiệp vụ. | N/A | P2 | Implemented skeleton |
| FR-JAVA-02 | Trước khi Java nhận một domain phải có API contract, JWT compatibility test và one-writer rule. | UC-004, UC-008, UC-015 | P2 | Planned |
| FR-MOBILE-01 | Mobile dùng chung API cho auth, posts, claim, handover và realtime. | UC-093 đến UC-100 | P2 | Deferred |

## 3. Non-functional requirements

| ID | Requirement | Priority | Status |
| --- | --- | --- | --- |
| NFR-SEC-01 | Password, OTP và refresh token không được lưu plaintext; secrets không xuất hiện trong source/log. | P0 | Implemented cho auth hiện tại |
| NFR-SEC-02 | Endpoint protected phải trả 401/403 đúng và có backend authorization. | P0 | Implemented cho route hiện tại |
| NFR-SEC-03 | Auth, image analysis và manual matching rerun phải có rate limit. | P0 | Implemented |
| NFR-VALID-01 | Payload/query/params và upload phải được validate ở backend. | P0 | Implemented cho module hiện tại |
| NFR-PRIV-01 | Private post/media/matching signals không được lộ cho actor không có quyền. | P0 | Partial; cần integration tests |
| NFR-DATA-01 | Migration phải tuần tự, checksum-protected và không sửa file đã chạy. | P0 | Implemented |
| NFR-DATA-02 | Shared DB phải tách dev/demo/test và tránh destructive test. | P0 | Process requirement |
| NFR-PERF-01 | Board phải pagination; matching phải giới hạn candidate và rate-limit rerun. | P0 | Implemented cho MVP scale |
| NFR-PORT-01 | Media phải tồn tại sau restart/deploy và truy cập được từ mọi API instance. | P0 | Not met với local storage |
| NFR-TEST-01 | API/web phải build; logic quan trọng có unit/browser tests. | P0 | Partial |
| NFR-CI-01 | Pull request phải tự động chạy test/build với MySQL isolated. | P1 | Planned |
| NFR-OBS-01 | API có structured request log, readiness và graceful shutdown. | P1 | Planned trong codebase mới |
| NFR-AUDIT-01 | Thao tác quản trị và transition nghiệp vụ nhạy cảm phải lưu actor, action, before/after và timestamp. | P1 | Planned |
| NFR-AI-01 | AI/matching chỉ là decision support; human verification bắt buộc trước khi trả đồ. | P0 | Implemented trong module hiện tại |

## 4. Release gate cho trạng thái Done

Một requirement chỉ được chuyển sang `Implemented` khi có:

1. Runtime route/service/UI phù hợp, không chỉ migration.
2. Backend authorization và validation.
3. Test hoặc lệnh kiểm tra tái lập được.
4. Documentation và traceability cập nhật.
5. Không có lỗi blocker trong flow chính.
