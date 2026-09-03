# Checklist Use Case LNFS

Cập nhật: **03/09/2026**

## 1. Quy ước và tổng hợp

Mỗi dòng có actor, mục tiêu, status và evidence/gap. Preconditions chung là actor có quyền phù hợp; trigger là thao tác actor hoặc sự kiện hệ thống; postcondition chỉ được coi là đạt khi status có runtime evidence. Các ngoại lệ, privacy note và business rule chi tiết nằm trong LNFS_BUSINESS_PROCESS_A_TO_Z.md và business-rules.md.

- [x] **Done/Implemented:** 55 UC có runtime và evidence phù hợp với baseline hiện tại.
- [ ] **Partial:** 7 UC mới đáp ứng một phần acceptance criteria.
- [ ] **Planned:** 38 UC chưa có runtime evidence.
- [ ] **Deferred:** 0 UC.
- Tổng: **100 ID duy nhất từ UC-001 đến UC-100**.

Không tick Done chỉ vì migration, schema, Jira ticket, UI mockup hoặc test file chưa chạy.

## 2. Checklist theo actor và domain

| Done | UC | Actor | Use case | Status | Evidence hoặc gap |
| --- | --- | --- | --- | --- | --- |
| [x] | UC-001 | System/User | Xác thực JWT tại Node.js API | Done | auth.middleware.ts |
| [x] | UC-002 | System/Admin/Staff | Phân quyền User/Student/Lecturer/Staff/Admin tại backend | Done | auth middleware, admin/staff routes |
| [ ] | UC-003 | Owner/Finder | Yêu cầu người claim bổ sung thông tin | Planned | Chưa có claim/chat runtime |
| [ ] | UC-004 | Finder | Chấp nhận claim với transaction/row lock | Planned | Chưa có claim runtime |
| [ ] | UC-005 | Finder | Từ chối claim kèm lý do | Planned | Chưa có claim runtime |
| [ ] | UC-006 | Claimant | Hủy claim theo trạng thái hợp lệ | Planned | Chưa có claim runtime |
| [ ] | UC-007 | System | Khóa ghi khi chuyển trạng thái claim | Planned | Chưa có claim runtime |
| [x] | UC-008 | Admin | Tạo điểm bàn giao | Done | Admin API/UI, validation, admin-handover.spec.ts |
| [x] | UC-009 | Admin | Cập nhật điểm bàn giao | Done | PATCH API, form và marker picker |
| [x] | UC-010 | Admin | Đóng/mở điểm bàn giao | Done | Admin toggle, public active-only query |
| [x] | UC-011 | Staff/Admin | Xác nhận tiếp nhận vật phẩm tại điểm bàn giao | Done | Warehouse API/UI và RECEIVED log |
| [x] | UC-012 | Staff/Admin | Chuyển vật phẩm sang trạng thái lưu kho | Done | Warehouse state transition STORED |
| [x] | UC-013 | Staff/Admin | Ghi nhận tình trạng vật phẩm khi tiếp nhận | Done | Condition notes và Staff UI |
| [x] | UC-014 | Staff/Admin | Xác nhận trả vật phẩm cho người nhận | Done | RETURNED transition và storage log |
| [x] | UC-015 | Staff/Admin | Ghi storage log cho thao tác kho | Done | storage_logs actor/action/from-to/note |
| [ ] | UC-016 | Staff/Admin | Kiểm tra thời hạn lưu kho | Planned | Chưa có overdue runtime |
| [ ] | UC-017 | Staff/Admin | Xác định vật phẩm đủ điều kiện xử lý quá hạn | Planned | Policy/disposition chưa đủ |
| [ ] | UC-018 | Staff/Admin | Tạo đơn xử lý hoặc thanh lý vật phẩm quá hạn | Planned | Chưa có disposition order |
| [ ] | UC-019 | Staff/Admin | Tạo đợt quyên góp vật phẩm | Planned | Chưa có donation flow |
| [ ] | UC-020 | System | Gửi cảnh báo kho cho Staff/Admin | Planned | Chưa có notification runtime |
| [ ] | UC-021 | Owner/Finder | Tạo lịch trả đồ sau accepted verification | Planned | Chưa có appointment runtime |
| [ ] | UC-022 | Owner/Finder | Từ chối lịch hẹn kèm lý do | Planned | Chưa có appointment runtime |
| [ ] | UC-023 | Owner/Finder | Đổi lịch hoặc hủy lịch trả đồ | Planned | Chưa có appointment runtime |
| [ ] | UC-024 | Owner/Finder | Hoàn tất lịch hẹn và cập nhật resolved | Planned | Chưa có appointment runtime |
| [ ] | UC-025 | System | Tính reputation sau business event | Planned | Chưa có reputation runtime |
| [ ] | UC-026 | Admin/System | Thu thập dữ liệu training hợp lệ | Planned | Chưa có pipeline |
| [ ] | UC-027 | Admin/Reviewer | Gắn nhãn TRUE_MATCH hoặc FALSE_MATCH | Planned | Schema foundation only |
| [ ] | UC-028 | System | Ẩn danh dữ liệu training | Planned | Chưa có pipeline |
| [ ] | UC-029 | AI Engineer | Huấn luyện model từ dữ liệu đã gắn nhãn | Planned | Chưa có model artifact |
| [ ] | UC-030 | AI Engineer | Đánh giá và lưu phiên bản model | Planned | Chưa có evaluation pipeline |
| [x] | UC-031 | Guest | Yêu cầu OTP đăng ký qua email | Done | auth route/service và SMTP |
| [x] | UC-032 | Guest | Xác thực OTP và tạo tài khoản | Done | Auth transaction |
| [x] | UC-033 | User | Đăng nhập bằng email/password | Done | Login route/service |
| [x] | UC-034 | User | Làm mới access token | Done | Refresh rotation transaction |
| [x] | UC-035 | User | Đăng xuất và revoke refresh token | Done | Logout route/service |
| [x] | UC-036 | User | Đặt lại mật khẩu bằng mã email | Done | Forgot/reset routes |
| [x] | UC-037 | User | Xem và cập nhật profile cơ bản | Done | auth me/profile và profile page |
| [x] | UC-038 | User | Quản lý avatar người dùng | Done | Cloudinary avatar API, MIME/signature/size validation, cleanup tests; cần manual Cloudinary QA |
| [x] | UC-039 | User | Xem activity, reputation và feedback sau trả đồ | Done | Activity/reputation API owner-scoped, profile UI và auth tests |
| [x] | UC-040 | Student/Lecturer | Tạo bài LOST qua API | Done | Post create route/service/UI |
| [x] | UC-041 | Student/Lecturer | Tạo bài FOUND qua API | Done | FOUND validation và UI |
| [x] | UC-042 | Owner | Cập nhật bài của owner | Done | PATCH post + owner guard |
| [x] | UC-043 | Owner | Đóng hoặc xóa mềm bài của owner | Done | Status update + DELETE |
| [x] | UC-044 | Guest/User | Xem chi tiết bài bằng route riêng | Done | Post detail API/page |
| [x] | UC-045 | User | Xem danh sách bài của tôi | Done | posts/mine và my-posts |
| [x] | UC-046 | Guest/User | Xem board LOST/FOUND | Done | List board API/page |
| [x] | UC-047 | Guest/User | Tìm kiếm, lọc, sắp xếp và phân trang bài | Done | Query validator/repository/UI |
| [x] | UC-048 | Owner | Upload ảnh bài đăng | Done | Multer, media validation/proxy |
| [ ] | UC-049 | Claimant | Upload ảnh bằng chứng claim | Planned | Claim evidence runtime chưa có |
| [x] | UC-050 | Owner | Xóa ảnh bài đăng khỏi media storage hiện tại | Done | Owner-guarded delete |
| [x] | UC-051 | Client | Cung cấp public config cho client validation | Done | Public route allowlist, typed parsing và service test |
| [ ] | UC-052 | Owner | Gửi claim cho bài FOUND | Planned | Schema only |
| [ ] | UC-053 | System | Ngăn duplicate claim cho cùng bài | Planned | Constraint foundation, chưa có API |
| [ ] | UC-054 | Claimant/Owner/Reviewer | Kiểm soát quyền xem claim evidence/private data | Partial | Post privacy có; claim privacy chưa có |
| [x] | UC-055 | User | Lấy danh sách handover point đang hoạt động cho form | Done | posts/catalog |
| [x] | UC-056 | Admin | Quản lý handover point qua Admin API | Done | Admin CRUD, toggle và delete guard |
| [x] | UC-057 | Admin | Lưu campus map và marker point | Done | Map upload, URL/path validation, X/Y picker |
| [x] | UC-058 | Staff/Admin | Đếm item lưu tại handover point | Done | Warehouse handoverCounts |
| [x] | UC-059 | Staff/Admin | Quản lý warehouse item qua API | Done | Staff warehouse list/create |
| [x] | UC-060 | Staff/Admin | Cập nhật trạng thái warehouse item | Done | Warehouse PATCH state machine |
| [x] | UC-061 | Staff/Admin | Lưu retention deadline cho warehouse item | Done | Deadline từ received_at và config |
| [x] | UC-062 | Staff/Admin | Giới hạn Staff thấp hơn Admin | Done | Backend/frontend guards và tests |
| [x] | UC-063 | Admin | Quản lý user qua Admin API | Done | Admin CRUD, atomic profile/role/status update, last-admin lock, audit và tests |
| [x] | UC-064 | Admin | Quản lý nhóm và danh mục vật phẩm | Done | Admin catalog API/UI |
| [x] | UC-065 | Admin | Quản lý area và building | Done | Admin catalog API/UI |
| [x] | UC-066 | Admin | Moderate post và xử lý report | Done | Admin report API/UI, target derived from report, last-admin guard và service tests |
| [x] | UC-067 | Admin | Hiển thị admin dashboard overview toàn hệ thống | Done | KPI/trend/status API/UI, date-window tests và current snapshot contract |
| [x] | UC-068 | System | Chạy matching sau khi tạo hoặc cập nhật post | Done | Best-effort hook trong post service |
| [x] | UC-069 | System | Chuẩn hóa text tiếng Việt cho matching | Done | Matching engine và tests |
| [x] | UC-070 | System | Tính tiered score từ text/category/location/time/image/OCR | Done | Matching engine và tests |
| [x] | UC-071 | System | Lưu kết quả matching | Done | Matching repository và `match_results`; chỉ trả cặp LOST/FOUND còn active |
| [x] | UC-072 | Owner | Trả danh sách bài tương tự | Done | Match API/page; source owner hoặc Staff/Admin |
| [ ] | UC-073 | System | Gửi notification khi có match mới | Planned | Chưa có notification runtime |
| [ ] | UC-074 | System | Kiểm tra gợi ý theo chu kỳ 10 phút | Planned | Chưa có scheduler/client polling |
| [x] | UC-075 | Owner | Tính lại matching theo quyền và rate limit | Done | Recalculate endpoint, backend ownership/role guard và service test |
| [x] | UC-076 | Owner | Giải thích lý do và điểm thành phần của match | Done | Explanation JSON/UI; raw private signals được redact với người không có quyền |
| [ ] | UC-077 | System | Khởi tạo Socket.IO server | Planned | Không có dependency/runtime |
| [ ] | UC-078 | System | Xác thực socket bằng JWT | Planned | Chưa có socket server |
| [ ] | UC-079 | Owner/Finder | Tạo hoặc join claim chat room | Planned | Chưa có claim/socket runtime |
| [ ] | UC-080 | Owner/Finder | Gửi và nhận realtime message | Planned | Chưa có runtime |
| [ ] | UC-081 | Owner/Finder | Gửi ảnh trong realtime chat | Planned | Chưa có runtime |
| [ ] | UC-082 | Owner/Finder | Hiển thị seen và unread realtime | Planned | Chưa có runtime |
| [ ] | UC-083 | System | Gửi realtime notification cho chat/claim/appointment | Planned | Chưa có runtime |
| [x] | UC-084 | Admin | Export báo cáo thống kê | Done | Aggregate CSV/JSON export, allowlist và audit tests |
| [x] | UC-085 | Admin | Quản lý system configuration | Done | Admin CRUD, typed validation, public-safe route, history UI/API, audit và migration 039 |
| [x] | UC-086 | User | Phân tích ảnh vật phẩm bằng Gemini provider | Done | Gemini service/tests/UI |
| [ ] | UC-087 | System | Trích OCR từ claim evidence | Planned | Chưa có claim evidence runtime |
| [x] | UC-088 | User | Gợi ý tag và danh mục từ ảnh post | Done | Gemini mapping và tests |
| [ ] | UC-089 | Finder | Đánh giá claim evidence | Planned | Chưa có runtime |
| [ ] | UC-090 | System | Tính ownership review confidence | Planned | Chưa có runtime |
| [x] | UC-091 | System | Dùng image/safe OCR tags làm tín hiệu matching | Done | AI tags và matching engine |
| [ ] | UC-092 | Finder/Staff | Hiển thị review confidence cho Finder/Staff | Planned | Chưa có claim review UI |
| [ ] | UC-093 | User | Xác thực và duy trì phiên qua PWA | Partial | Manifest/service worker/session flow có; cần manual installability/device evidence |
| [ ] | UC-094 | User | Xem và cập nhật profile/activity qua PWA | Partial | Profile/activity/PWA shell có; cần manual offline/device evidence |
| [ ] | UC-095 | Guest/User | Duyệt, tìm kiếm, lọc và xem detail trên mobile browser | Partial | Responsive page/mobile viewport test; chưa installable |
| [ ] | UC-096 | User | Tạo và quản lý bài LOST/FOUND qua PWA | Partial | Responsive flow có; chưa offline/installability |
| [ ] | UC-097 | User | Chụp/chọn và upload ảnh qua mobile browser | Partial | File input multiple có; camera/device matrix chưa có |
| [ ] | UC-098 | User | Gửi evidence, quản lý claim và xem trạng thái qua PWA | Planned | Claim/evidence runtime chưa có |
| [ ] | UC-099 | User | Xem điểm bàn giao và quản lý appointment qua PWA | Planned | Appointment runtime chưa có |
| [ ] | UC-100 | User | Nhận notification, dùng communication và retry an toàn qua PWA | Planned | Notification/service worker/offline runtime chưa có |

## 3. Ghi chú nghiệp vụ mục tiêu

- Luồng chính là Owner tạo LOST, Finder tạo FOUND và tiếp tục giữ vật phẩm.
- Matching chỉ tạo gợi ý có giải thích; không tự xác minh ownership, accept claim hoặc return item.
- Finder xác minh qua conversation riêng, dùng guided questions mà không lộ private answer trước cho Owner.
- Appointment cần hai bên cùng xác nhận; direct handover cần Finder xác nhận đã giao và Owner xác nhận đã nhận.
- Staff custody/warehouse là nhánh optional hoặc escalation, không phải default flow.
- PWA là phần mở rộng của Web; Native Mobile là scope mục tiêu riêng nhưng repository hiện chưa có project.
- Native Mobile target có thể dùng nhóm ID UC-M01–UC-M12 sau khi team phê duyệt mapping; không cộng vào 100 UC hiện tại khi chưa có quyết định chính thức.

## 3A. Native Mobile target checklist (không cộng vào 100 UC legacy)

| UC | Actor | Use case | Status | Gap |
| --- | --- | --- | --- | --- |
| UC-M01 | Student/Lecturer | Đăng nhập và duy trì session trên Native Mobile | Planned | Chưa có mobile project |
| UC-M02 | Student/Lecturer | Tạo bài LOST trên Native Mobile | Planned | Chưa có mobile project |
| UC-M03 | Student/Lecturer | Tạo bài FOUND trên Native Mobile | Planned | Chưa có mobile project |
| UC-M04 | User | Upload/chụp ảnh trên Native Mobile | Planned | Chưa có mobile project/device evidence |
| UC-M05 | Owner | Xem matching và explanation trên Native Mobile | Planned | Chưa có mobile project |
| UC-M06 | Owner/Finder | Gửi claim/evidence qua Native Mobile | Planned | Claim runtime và mobile project chưa có |
| UC-M07 | Owner/Finder | Chat riêng và gửi ảnh qua Native Mobile | Planned | Realtime runtime và mobile project chưa có |
| UC-M08 | Owner/Finder | Dùng guided verification questions trên Native Mobile | Planned | Chưa có verification runtime |
| UC-M09 | Owner/Finder | Đề xuất và xác nhận appointment trên Native Mobile | Planned | Chưa có appointment runtime |
| UC-M10 | Owner/Finder | Xác nhận direct handover hai chiều trên Native Mobile | Planned | Chưa có handover runtime |
| UC-M11 | User | Nhận notification trên Native Mobile | Planned | Chưa có notification/mobile runtime |
| UC-M12 | User | Xử lý session, permission và lỗi mạng trên Native Mobile | Planned | Chưa có mobile project/release test |

## 4. Điều kiện chuyển status

1. Có route/service/repository hoặc UI thực thi mục tiêu.
2. Có validation, authorization và privacy control phù hợp.
3. Build/typecheck liên quan pass.
4. Có test hoặc manual evidence tái lập được.
5. Requirement, business rule và traceability đã cập nhật.
6. Nếu là PWA/native mobile phải có evidence đúng channel, không lấy responsive Web làm bằng chứng native.
