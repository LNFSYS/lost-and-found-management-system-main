# Quy tắc gửi thông báo email LNFS

Cập nhật: **07/10/2026**

## 1. Phạm vi và trạng thái

Tài liệu này quy định cách LNFS chuyển các sự kiện nghiệp vụ đã commit thành thông báo in-app, PWA push và email. Toàn bộ ma trận kênh/sự kiện là **target policy**; runtime hiện tại ở mức **Partial**, gồm preference/outbox, claim/chat/custody producer và worker có unit/SQL evidence. Các producer/PWA và real-provider acceptance còn thiếu được giữ rõ bên dưới. OTP đăng ký/reset password không phải bằng chứng hoàn thành toàn bộ notification delivery.

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
| Matching | Cặp mới đạt từ 60%, hai bài còn mở và khác chủ | Cả chủ LOST và chủ FOUND | In-app; email theo nhóm preference nghiệp vụ hiện có, mặc định immediate; disabled/delayed-unread/digest/quiet hours được tôn trọng | UC-097 |
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
- Stable `Message-ID`/idempotency headers are correlation values, not proof of provider deduplication. Known SMTP failures are retried with bounded backoff; when transport times out after the provider may have accepted the message, the outbox item is marked uncertain/quarantined and is not retried, avoiding a second send at the cost of possible non-delivery. Exactly-once requires a provider/adapter idempotency contract that the current SMTP transport does not expose.
- Worker renews its live lease every one-third of the lease period and checks it before SMTP. Expired `PROCESSING` rows are `CANCELLED` with `SMTP_LEASE_EXPIRED_UNCERTAIN`, not reclaimed by another worker. This also conservatively cancels a crashed pre-send attempt; in-app notification is still available.
- Only explicit `NOT_SENT` delivery errors may re-enter bounded retry. Unknown transport failures and accepted sends whose DB acknowledgement fails never retry automatically. Token/expiry fences prevent stale acknowledgement, defer or retry from reviving a cancelled row.
- SMTP bounds are DNS 10s, connection 15s, greeting 15s and socket idle 30s. These are stage/idle timeouts, not a guarantee of total send duration. See [Nodemailer SMTP options](https://nodemailer.com/smtp).
- Rollout must stop/drain every older API/standalone email worker before starting this version. An older worker can still reclaim expired processing rows; do not run mixed reclaim policies. Do not automatically requeue uncertain CANCELLED rows without independent provider evidence that no delivery occurred.
- On SIGINT/SIGTERM, both entrypoints stop polling and claiming additional outbox items, wait for the current SMTP attempt, DB acknowledgement/cancellation and lease heartbeat, then close the pool. Repeated signals share the same shutdown. The API also drains active HTTP requests and schema checks; it ends SSE subscriptions and rejects late SSE connections so streams cannot prevent shutdown. A disabled standalone worker closes its unused pool and exits naturally. Forced termination cannot provide these guarantees; deployment grace must allow the drain to complete.
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
- Child-process regressions exercise both actual entrypoints with slow success/uncertain SMTP, repeated signals and a disabled worker. A real loopback HTTP request finishes before pool closure; schema checks and post-send DB writes remain usable throughout the drain. Processes must exit without force-exit.

## 9. Traceability

| Business rules | Requirements | Use cases |
| --- | --- | --- |
| BR-47–BR-52, BR-67 | FR-NOTIFY-01–FR-NOTIFY-06, NFR-MAIL-01–NFR-MAIL-02 | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 và các UC nguồn trong ma trận sự kiện |
## Runtime implementation (Story notification email)

Local follow-up ngày 7 October bổ sung producer matching riêng; xem [matching notification rules](matching-notification-rules.md) cho chống lặp, kiểm tra bài đóng trước SMTP và giới hạn inbox/CI/deployment. UC-097 hiện Partial; các snapshot và bằng chứng provider cũ không chứng nhận template/producer mới.

The Node.js notification module now owns optional email preferences and a MySQL-backed transactional outbox (`052_notification_email_delivery.sql`). Chat and claim transactions enqueue only a notification identifier and recipient/entity metadata; private message and evidence content is never stored in the outbox. `GET/PUT /api/notifications/preferences` are authenticated and scoped to the token subject.

The API process runs the bounded worker when `NOTIFICATION_EMAIL_WORKER_ENABLED=true`; a standalone worker entrypoint is also available. The worker re-checks account status, verified email, entity access, preference, quiet hours, and unread state immediately before SMTP delivery. It coalesces pending chat rows for a room, keeps digest categories separate, includes an authenticated deep link in both HTML and text, uses stable correlation identifiers, redacted error codes, and bounded retry. OTP and password-reset delivery remains owned by Auth and is not routed through this optional queue.

Migration 052 is applied to the target database. On 4 October the full isolated SQL suite passed, including a slow-send two-worker scenario with a 3-second lease, no second send during the 4-second mocked SMTP call, and cancellation/fencing of expired processing rows. Unit tests cover heartbeat cleanup/loss, explicit NOT_SENT retry, unknown outcome and failed post-send acknowledgement. This is real MySQL worker evidence with a mock transport, not a real SMTP-provider delivery receipt. Current counts and commands: [dev audit fixes](../audits/dev-main-audit-fixes.md).

Remaining acceptance covers the real provider, full producer/PWA matrix and provider/adapter idempotency behavior. UC-168 remains Partial: current SMTP cannot guarantee exactly-once; conservative uncertainty cancellation may lose an optional email. Stop/drain all older API and standalone email workers before enabling this version, and never automatically requeue uncertain CANCELLED rows without independent delivery evidence.

## Local appointment reminders - 6 October 2026

Appointment proposals, accept/reject/cancel, reminder/no-show and peer outcomes now create in-app notifications plus optional outbox in the same business transaction. UC-125 is Partial because counter-proposal/rescheduling/full channels remain missing; UC-134 implements the local scheduler. New migration 063 is isolated-tested only, not applied to Aiven.

`APPOINTMENT_REMINDER_MINUTES` defaults to 30 (1-1440). A coalesced 60-second task locks the claim/appointment and conditionally sets the reminder marker, so concurrent workers queue at most one reminder per attempt/recipient. Existing claim preference, quiet hours, unread cancellation and worker lease/uncertainty rules apply; no new preference category or provider guarantee is invented. Final delivery checks require accepted future appointment, accepted participant consent and no pending/intaked custody. Cancellation/no-show suppresses queued reminder delivery; SMTP already accepted before a cancellation race cannot be recalled.

Privacy-safe email uses `/appointments/:id` behind authentication, never a place/time/private note/evidence snapshot. Default immediate mode attempts prompt delivery; disabled/digest/quiet-hours, downtime, slow SMTP or uncertainty quarantine may mean no reminder arrives before the meeting. In-app remains canonical. Actual provider/manual acceptance and exact new candidate CI remain separate from mock-transport/SQL/browser results. Both entrypoints keep their SMTP drain; the API also drains the reminder task before pool closure. Details and evidence: [appointment-journey-rollout.md](../runbooks/appointment-journey-rollout.md).
