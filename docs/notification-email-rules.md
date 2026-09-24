# Quy tắc gửi thông báo email LNFS

Cập nhật: **21/09/2026**

## 1. Phạm vi và trạng thái

Tài liệu này quy định cách LNFS chuyển các sự kiện nghiệp vụ đã commit thành thông báo in-app, PWA push và email. Đây là **target policy, trạng thái Planned** cho notification delivery; email OTP đăng ký và reset password hiện có không phải bằng chứng rằng luồng email nghiệp vụ bên dưới đã hoàn thành.

Node.js là owner duy nhất của notification event, preference, outbox và delivery state. Client không được tự quyết định rằng một email đã gửi thành công.

## 2. Thứ tự kênh

1. Lưu business event và notification in-app trong cùng transaction hoặc bằng transactional outbox. In-app là bản ghi người dùng nhìn thấy chính thức.
2. Gửi realtime/PWA push khi kênh khả dụng và người dùng cho phép.
3. Với sự kiện cần chú ý nhưng không khẩn cấp, chỉ gửi email fallback sau **5–10 phút** nếu notification vẫn chưa đọc.
4. Gộp sự kiện tần suất cao thành digest; không gửi một email cho từng tin nhắn chat.
5. Lỗi email không rollback nghiệp vụ đã commit và không làm thay đổi claim, appointment, custody hoặc return state.

## 3. Ma trận sự kiện

| Nhóm | Sự kiện | Người nhận | Mặc định | UC nguồn |
| --- | --- | --- | --- | --- |
| Security | OTP đăng ký, reset password, cảnh báo thay đổi bảo mật | Chủ tài khoản | Email ngay, bắt buộc khi cần hoàn tất thao tác | UC-001, UC-006 |
| Matching | Có match mới đạt ngưỡng | Chủ bài liên quan | In-app ngay; email delayed-unread hoặc digest | UC-097 |
| Claim | Claim mới hoặc trạng thái claim thay đổi | Claimant, Finder | In-app/PWA ngay; email theo preference | UC-123 |
| Chat | Có tin nhắn mới từ participant còn lại | Participant còn lại | In-app/realtime ngay; một email sau 5–10 phút nếu vẫn unread, có coalescing | UC-124 |
| Verification | Có câu hỏi, yêu cầu thêm thông tin hoặc quyết định cần xử lý | Participant cần hành động | In-app/PWA ngay; email action-required | UC-107, UC-108, UC-123 |
| Appointment | Đề xuất, xác nhận, đổi lịch, hủy, nhắc lịch hoặc no-show | Hai participant | In-app/PWA ngay; email theo preference, reminder được deduplicate | UC-125, UC-128–UC-136 |
| Handover | Cần xác nhận đã giao/đã nhận hoặc kết quả return | Hai participant | In-app/PWA ngay; email action-required | UC-137–UC-140 |
| Custody | Transfer request, Staff accept/reject, intake hoặc custody state đổi | Finder và Staff liên quan | In-app/PWA ngay; email action-required | UC-141–UC-147 |
| Operations | Custody/warehouse task overdue, legal hold hoặc approval cần xử lý | Staff/Admin có quyền | In-app ngay; email urgent hoặc digest theo policy | UC-150–UC-156 |
| Feedback | Return hoàn tất và feedback đã mở | Participant đủ điều kiện | Một thông báo/email; không lặp sau khi đã feedback | UC-058–UC-060 |

## 4. Mức ưu tiên

| Mức | Cách gửi |
| --- | --- |
| Mandatory security | Gửi ngay; không cho tắt email cần thiết để hoàn tất hoặc bảo vệ tài khoản. |
| Action required | In-app/PWA ngay; email ngay hoặc delayed-unread theo preference. |
| Activity | In-app ngay; email delayed-unread hoặc digest. |
| Operational digest | Gộp theo người nhận, loại sự kiện và khoảng thời gian; sự kiện legal hold khẩn cấp không chờ digest. |

## 5. Privacy và nội dung email

- Email chỉ nêu loại sự kiện, thời gian, tên hiển thị an toàn và deep link cần đăng nhập.
- Không đưa message body, private evidence, câu trả lời xác minh, expected answer, OCR/raw AI output, contact riêng, vị trí chính xác, storage URL hoặc secret/token vào subject/body.
- Không tiết lộ sự tồn tại của claim, custody record hoặc moderation case cho người không có quyền xem entity đó.
- Deep link phải đi qua authentication và authorization hiện hành; có link không đồng nghĩa có quyền.
- Log delivery chỉ chứa identifier tối thiểu, template/version, provider result và lỗi đã redact.

## 6. Preference và thời gian yên lặng

- UC-168 cho phép cấu hình theo nhóm sự kiện: PWA push, email ngay, email delayed-unread, digest, quiet hours hoặc tắt kênh optional.
- Chỉ gửi tới email đã xác minh. Đổi email hoặc khóa tài khoản phải vô hiệu delivery target cũ.
- Quiet hours dùng timezone của người dùng; action khẩn cấp có thể được policy cho phép vượt quiet hours.
- Unsubscribe chỉ áp dụng cho email optional. Security email không dùng cùng unsubscribe scope.
- Preference mới chỉ áp dụng cho delivery attempt tương lai; không xóa notification hoặc audit history.

## 7. Reliability, retry và chống gửi trùng

- Mỗi delivery có idempotency key từ `recipient + event + channel + policy/version`.
- Worker phải kiểm tra authorization, preference và unread condition ngay trước khi gửi delayed email.
- Tin nhắn chat trong cùng room được coalesce thành một email trong cửa sổ chờ; mở room hoặc mark-read sẽ hủy email chưa gửi.
- Retry dùng bounded exponential backoff với jitter; permanent failure dừng retry và được quan sát qua structured log/metric.
- Provider timeout hoặc duplicate callback không được tạo email trùng hay thay đổi business state.
- Template phải versioned; payload outbox lưu dữ liệu tối thiểu và không lưu private message/evidence để tiện render email.

## 8. Acceptance và negative tests

- Sự kiện chỉ được enqueue sau khi business transaction commit; rollback không gửi email.
- Notification đã đọc trước hạn không tạo delayed email.
- Nhiều message liên tiếp trong một room chỉ tạo một email tổng quát, không chứa nội dung chat.
- Retry/provider callback không tạo delivery trùng.
- Người không còn quyền trên entity không nhận email hoặc mở được deep link.
- Preference optional được tôn trọng; security email bắt buộc không bị tắt nhầm.
- Email không lộ private evidence, OCR, expected answer, contact, vị trí chính xác hoặc token.
- Lỗi SMTP/provider không rollback claim, appointment, custody, return hoặc feedback.

## 9. Traceability

| Business rules | Requirements | Use cases |
| --- | --- | --- |
| BR-47–BR-52 | FR-NOTIFY-01–FR-NOTIFY-04, NFR-MAIL-01–NFR-MAIL-02 | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 và các UC nguồn trong ma trận sự kiện |
## Runtime implementation (Story notification email)

The Node.js notification module now owns optional email preferences and a MySQL-backed transactional outbox (`052_notification_email_delivery.sql`). Chat and claim transactions enqueue only a notification identifier and recipient/entity metadata; private message and evidence content is never stored in the outbox. `GET/PUT /api/notifications/preferences` are authenticated and scoped to the token subject.

The API process runs the bounded worker when `NOTIFICATION_EMAIL_WORKER_ENABLED=true`; a standalone worker entrypoint is also available. The worker re-checks account status, verified email, entity access, preference, quiet hours, and unread state immediately before SMTP delivery. It coalesces pending chat rows for a room, uses stable idempotency message identifiers, redacted error codes, and bounded retry. OTP and password-reset delivery remains owned by Auth and is not routed through this optional queue.

Runtime evidence still required: applying migration 052 to the target database, SMTP provider acceptance with a real App Password, and end-to-end worker execution against an isolated MySQL instance. UC-168 therefore remains Partial until those checks are attached.
