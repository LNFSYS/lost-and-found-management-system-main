# Checklist Use Case

Cập nhật: 26/08/2026

## Quy ước

- `[x] Done`: có runtime implementation trong codebase mới và có bằng chứng build/test phù hợp.
- `[ ] Partial`: có một phần implementation nhưng chưa hoàn chỉnh end-to-end.
- `[ ] Planned`: chưa có runtime; migration/schema không đủ để tick.
- `[ ] Deferred`: future enhancement được nêu rõ và không thuộc current development scope.

Tổng quan audit: **47 Done, 7 Partial, 46 Planned, 0 Deferred**.

## Authentication và authorization

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-001 | Xác thực JWT tại Node.js API | Done | `auth.middleware.ts` |
| [x] | UC-002 | Phân quyền User/Student/Lecturer/Staff/Admin tại backend | Done | `requireAnyRole`, admin routes |
| [ ] | UC-003 | Yêu cầu người claim bổ sung thông tin | Planned | Chưa có claim runtime |
| [ ] | UC-004 | Chấp nhận claim với transaction/row lock | Planned | Chưa có claim runtime |
| [ ] | UC-005 | Từ chối claim kèm lý do | Planned | Chưa có claim runtime |
| [ ] | UC-006 | Hủy claim theo trạng thái hợp lệ | Planned | Chưa có claim runtime |
| [ ] | UC-007 | Khóa ghi khi chuyển trạng thái claim | Planned | Chưa có claim runtime |

## Handover, warehouse và appointment

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-008 | Tạo điểm bàn giao | Done | Admin API/UI, validation và `admin-handover.spec.ts` |
| [x] | UC-009 | Cập nhật điểm bàn giao | Done | PATCH Admin API, form chỉnh sửa và marker picker |
| [x] | UC-010 | Đóng/mở điểm bàn giao | Done | Admin toggle `isActive`; public query chỉ lấy điểm active |
| [x] | UC-011 | Xác nhận tiếp nhận vật phẩm tại điểm bàn giao | Done | Staff warehouse API/UI tạo `warehouse_items` và log `RECEIVED` |
| [x] | UC-012 | Chuyển vật phẩm sang trạng thái lưu kho | Done | PATCH warehouse status `STORED`, yêu cầu storage code |
| [x] | UC-013 | Ghi nhận tình trạng vật phẩm khi tiếp nhận | Done | Condition notes bắt buộc khi receive và hiển thị trên Staff UI |
| [x] | UC-014 | Xác nhận trả vật phẩm cho người nhận | Done | State transition `RETURNED` ghi `returned_at` và storage log |
| [x] | UC-015 | Ghi storage log cho thao tác kho | Done | `storage_logs` lưu actor, action, from/to status, note |
| [ ] | UC-016 | Kiểm tra thời hạn lưu kho | Planned | Chưa có runtime |
| [ ] | UC-017 | Xác định vật phẩm đủ điều kiện xử lý quá hạn | Planned | Chưa có runtime |
| [ ] | UC-018 | Tạo đơn xử lý/thanh lý vật phẩm quá hạn | Planned | Chưa có runtime |
| [ ] | UC-019 | Tạo đợt quyên góp vật phẩm | Planned | Chưa có runtime |
| [ ] | UC-020 | Gửi cảnh báo kho cho Staff/Admin | Planned | Chưa có runtime |
| [ ] | UC-021 | Tạo lịch trả đồ sau accepted claim | Planned | Chưa có runtime |
| [ ] | UC-022 | Từ chối lịch hẹn kèm lý do | Planned | Chưa có runtime |
| [ ] | UC-023 | Đổi lịch hoặc hủy lịch trả đồ | Planned | Chưa có runtime |
| [ ] | UC-024 | Hoàn tất lịch hẹn và cập nhật resolved | Planned | Chưa có runtime |
| [ ] | UC-025 | Tính reputation sau business event | Planned | Chưa có runtime |

## Custom AI training roadmap

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [ ] | UC-026 | Thu thập dữ liệu training hợp lệ | Planned | Chưa có pipeline |
| [ ] | UC-027 | Gắn nhãn TRUE_MATCH/FALSE_MATCH | Planned | Schema foundation only |
| [ ] | UC-028 | Ẩn danh dữ liệu training | Planned | Chưa có pipeline |
| [ ] | UC-029 | Huấn luyện model từ dữ liệu đã gắn nhãn | Planned | Chưa có model artifact |
| [ ] | UC-030 | Đánh giá và lưu phiên bản model | Planned | Chưa có evaluation pipeline |

## Account và profile

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-031 | Yêu cầu OTP đăng ký qua email | Done | Auth route/service + SMTP |
| [x] | UC-032 | Xác thực OTP và tạo tài khoản | Done | Transaction trong auth service |
| [x] | UC-033 | Đăng nhập bằng email/password | Done | Login route/service |
| [x] | UC-034 | Làm mới access token | Done | Refresh rotation transaction |
| [x] | UC-035 | Đăng xuất và revoke refresh token | Done | Logout route/service |
| [x] | UC-036 | Đặt lại mật khẩu bằng mã email | Done | Forgot/reset routes |
| [x] | UC-037 | Xem và cập nhật profile cơ bản | Done | `/auth/me`, `/auth/profile` |
| [ ] | UC-038 | Quản lý avatar người dùng | Planned | Chưa có route/storage |
| [ ] | UC-039 | Xem activity, reputation và feedback sau trả đồ | Planned | Chưa có runtime |

## LOST/FOUND posts và media

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-040 | Tạo bài LOST qua API | Done | Post create route/service/UI |
| [x] | UC-041 | Tạo bài FOUND qua API | Done | Post create + FOUND validation |
| [x] | UC-042 | Cập nhật bài của owner | Done | PATCH post + owner guard |
| [x] | UC-043 | Đóng hoặc xóa mềm bài của owner | Done | Status update + DELETE |
| [x] | UC-044 | Xem chi tiết bài bằng route riêng | Done | Post detail API/page |
| [x] | UC-045 | Xem danh sách bài của tôi | Done | `/posts/mine`, `/my-posts` |
| [x] | UC-046 | Xem board LOST/FOUND | Done | List board API/page |
| [x] | UC-047 | Tìm kiếm, lọc, sắp xếp và phân trang bài | Done | Query validator/repository/UI |
| [x] | UC-048 | Upload ảnh bài đăng | Done | Multer + media validation/proxy |
| [ ] | UC-049 | Upload ảnh bằng chứng claim | Planned | Post `EVIDENCE` kind không phải claim flow |
| [x] | UC-050 | Xóa ảnh bài đăng khỏi media storage hiện tại | Done | Owner-guarded delete; local storage |
| [ ] | UC-051 | Cung cấp public config cho client validation | Planned | Chưa có public config route |
| [ ] | UC-052 | Gửi claim cho bài FOUND | Planned | Schema only |
| [ ] | UC-053 | Ngăn duplicate claim cho cùng bài | Planned | Constraint foundation, chưa có API |
| [ ] | UC-054 | Kiểm soát quyền xem claim evidence/private data | Partial | Post privacy có; claim chưa có |

## Catalog, staff và admin

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-055 | Lấy danh sách handover point đang hoạt động cho form | Done | `/posts/catalog` |
| [x] | UC-056 | Quản lý handover point qua Admin API | Done | `/api/admin/handover-points`, hard-delete guard và unit tests |
| [x] | UC-057 | Lưu campus map và marker point | Done | Multipart map upload, URL/path validation, X/Y từ 0–100 và Admin map picker |
| [x] | UC-058 | Đếm item lưu tại handover point | Done | Staff dashboard trả `handoverCounts` theo điểm bàn giao |
| [x] | UC-059 | Quản lý warehouse item qua API | Done | `/api/staff/warehouse-items` list/create |
| [x] | UC-060 | Cập nhật trạng thái warehouse item | Done | PATCH `/api/staff/warehouse-items/:id` theo state machine |
| [x] | UC-061 | Lưu retention deadline cho warehouse item | Done | Deadline tính từ `received_at` theo retention config/category |
| [x] | UC-062 | Giới hạn Staff thấp hơn Admin | Done | Backend/frontend guards; Staff warehouse page có operational flow và Playwright tests |
| [ ] | UC-063 | Quản lý user qua Admin API | Planned | Chưa có route |
| [x] | UC-064 | Quản lý nhóm và danh mục vật phẩm | Done | Admin catalog API/UI |
| [x] | UC-065 | Quản lý area và building | Done | Admin catalog API/UI |
| [ ] | UC-066 | Moderate post và xử lý report | Planned | Chưa có route |
| [ ] | UC-067 | Hiển thị admin dashboard overview toàn hệ thống | Partial | Mới có catalog statistics |

## Hybrid matching

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-068 | Chạy matching sau khi tạo/cập nhật post | Done | Best-effort hook trong post service |
| [x] | UC-069 | Chuẩn hóa text tiếng Việt cho matching | Done | Matching engine + tests |
| [x] | UC-070 | Tính tiered score từ text/category/location/time/image/OCR | Done | Matching engine + tests |
| [x] | UC-071 | Lưu kết quả matching | Done | Matching repository + `match_results` |
| [x] | UC-072 | Trả danh sách bài tương tự | Done | Match API/page |
| [ ] | UC-073 | Gửi notification khi có match mới | Planned | Chưa có notification runtime |
| [ ] | UC-074 | Kiểm tra gợi ý theo chu kỳ 10 phút | Planned | Chưa có scheduler/client polling |
| [x] | UC-075 | Tính lại matching theo quyền và rate limit | Done | Recalculate endpoint |
| [x] | UC-076 | Giải thích lý do và điểm thành phần của match | Done | Explanation JSON + UI |

## Realtime, report và configuration

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [ ] | UC-077 | Khởi tạo Socket.IO server | Planned | Không có dependency/runtime |
| [ ] | UC-078 | Xác thực socket bằng JWT | Planned | Chưa có socket server |
| [ ] | UC-079 | Tạo/join claim chat room | Planned | Chưa có claim/socket runtime |
| [ ] | UC-080 | Gửi/nhận realtime message | Planned | Chưa có runtime |
| [ ] | UC-081 | Gửi ảnh trong realtime chat | Planned | Chưa có runtime |
| [ ] | UC-082 | Hiển thị seen và unread realtime | Planned | Chưa có runtime |
| [ ] | UC-083 | Gửi realtime notification cho chat/claim/appointment | Planned | Chưa có runtime |
| [ ] | UC-084 | Export báo cáo thống kê | Planned | Chưa có route |
| [ ] | UC-085 | Quản lý system configuration | Planned | Matching chỉ đọc config nội bộ |

## Gemini-assisted analysis và evidence support

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [x] | UC-086 | Phân tích ảnh vật phẩm bằng Gemini provider | Done | Gemini service/tests/UI |
| [ ] | UC-087 | Trích OCR từ claim evidence | Planned | Chưa có claim evidence runtime |
| [x] | UC-088 | Gợi ý tag và danh mục từ ảnh post | Done | Gemini mapping + tests |
| [ ] | UC-089 | Đánh giá claim evidence | Planned | Chưa có runtime |
| [ ] | UC-090 | Tính ownership review confidence | Planned | Chưa có runtime |
| [x] | UC-091 | Dùng image/safe OCR tags làm tín hiệu matching | Done | AI tags + matching engine |
| [ ] | UC-092 | Hiển thị review confidence cho finder/staff | Planned | Chưa có claim review UI |

## Progressive Web App

| Done | UC | Use case | Status | Evidence |
| --- | --- | --- | --- | --- |
| [ ] | UC-093 | Xác thực và duy trì phiên qua PWA | Partial | Auth/refresh chạy trên responsive web; chưa có manifest, service worker hoặc installability |
| [ ] | UC-094 | Xem và cập nhật profile/activity qua responsive PWA | Partial | Profile cơ bản đã có; avatar/activity/reputation và PWA infrastructure chưa có |
| [ ] | UC-095 | Duyệt, tìm kiếm, lọc và xem chi tiết bài trên mobile browser | Partial | Board/detail responsive và mobile viewport test đã có; chưa có installable PWA/offline shell |
| [ ] | UC-096 | Tạo và quản lý bài LOST/FOUND qua PWA | Partial | Responsive create/manage post flow và browser tests đã có; chưa có PWA installability/offline behavior |
| [ ] | UC-097 | Chụp/chọn và upload ảnh qua mobile browser được hỗ trợ | Partial | File input hỗ trợ multiple image upload; chưa có camera capture/device compatibility evidence |
| [ ] | UC-098 | Gửi evidence, quản lý claim và xem trạng thái qua PWA | Planned | Claim/evidence runtime chưa có |
| [ ] | UC-099 | Xem thông tin bàn giao và quản lý appointment qua PWA | Planned | Chưa có user handover/appointment runtime |
| [ ] | UC-100 | Nhận notification, dùng communication và xử lý offline/retry an toàn qua PWA | Planned | Chưa có notification/communication/service worker/offline runtime |

## Điều kiện tick Done

Không tick UC chỉ vì migration đã có table/column. Một UC cần tối thiểu:

1. Route/service/repository hoặc UI thực thi đúng mục tiêu.
2. Backend validation và authorization phù hợp.
3. Build pass.
4. Test trực tiếp hoặc bằng chứng kiểm tra tái lập được.
5. Requirement, business rule và traceability đã đồng bộ.
