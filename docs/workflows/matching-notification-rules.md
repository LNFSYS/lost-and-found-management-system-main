# Thông báo matching mới

Cập nhật: **07/10/2026**. Phạm vi implementation và các snapshot local ở dưới không tự chứng nhận deployment. Receipt publish/verification mới: [publish review](../audits/publish-review-2026-10-07.md); trạng thái CI đúng candidate xem PR được liên kết trong receipt đó.

## Quy tắc

- Sau khi tạo bài, Web mở kết quả matching. Nếu trang đầu không có kết quả đạt **60%**, chủ bài thấy popup một lần, có nút xem bài đăng cộng đồng và đóng thông báo. API lỗi không được coi là không có kết quả. Mở lại bài cũ, tải lại trang hoặc chỉ xem kết quả không tạo popup/email mới.
- Matching khi tạo/cập nhật bài, tính lại hoặc refresh định kỳ tạo thông báo cho **cả chủ LOST và chủ FOUND** khi một cặp đạt **từ 60% trở lên**. Ngưỡng email này độc lập với tier NOTIFY 75%; không thay thuật toán, threshold hiển thị, claim hay quyền nhận đồ.
- Cả hai bài phải còn `OPEN`/`MATCHED`, chưa xóa và khác chủ. Bài `CLOSED`, `RESOLVED`, `EXPIRED`, `HIDDEN` hoặc trạng thái khác không đủ điều kiện. Không thông báo lại gợi ý mà chính người nhận đã ẩn.
- Notification `MATCH_FOUND`, outbox `MATCH` và marker `is_notified` ghi cùng transaction; mỗi cặp/người nhận có dedupe key riêng. Tính lại từ bài đối nghịch hoặc nhiều worker không được tạo thư lặp cho cùng cặp. Mỗi transaction xử lý tối đa 100 cặp; phần còn lại được xét ở lượt refresh sau.
- Chỉ deadlock có rollback đã xác nhận được retry, tối đa ba lần. Không retry transaction có kết quả commit chưa xác định hoặc lỗi mất kết nối như một rollback giả.
- Email dùng preference nghiệp vụ `claimMode` hiện có, hiển thị trong nhóm **Gợi ý matching và trạng thái yêu cầu**. Mặc định gửi ngay; tắt email, delayed-unread, digest và quiet hours vẫn được tôn trọng. Không thêm migration hay thay cài đặt của người dùng.
- Worker kiểm tra đúng cặp và quyền chủ bài, trạng thái cả hai bài, score, dismissal, tài khoản active và email đã xác minh. Kiểm tra lại trước SMTP sau khi gia hạn lease; thư không còn hợp lệ bị hủy, không gọi SMTP. Email đã được SMTP tiếp nhận không thể thu hồi nếu bài đóng sau bước này.
- Email chỉ có nội dung thông báo tổng quát và link cần đăng nhập `/posts/:postId/matches`; không chứa ảnh, mô tả riêng, điểm chi tiết, địa chỉ email người kia hay vị trí vật phẩm. Digest nhiều bài dẫn về trang thông báo.
- Notification in-app vẫn là bản ghi chính thức. Lỗi SMTP không thay đổi post/claim/custody; policy lease, uncertainty và retry hiện có giữ nguyên.

## Nội dung popup

**Chưa có gợi ý phù hợp**

Bài đăng của bạn đã được lưu. Khi có kết quả mới khớp từ 60% trở lên, chúng tôi sẽ thông báo đến email của bạn theo cài đặt thông báo. Trong thời gian chờ, bạn có thể kiểm tra các bài đăng cộng đồng. Bài đã đóng sẽ không nhận thông báo matching mới.

## Kiểm chứng và giới hạn

- Regression ứng dụng/repository: hai người nhận, replay, read-only GET không tạo email, dismissal, rollback và giới hạn retry deadlock.
- SQL cô lập dùng schema migration hiện hành và MySQL **9.3.0** local, không trỏ Aiven. Tám tình huống con đã pass, gồm 59.9%/60%, hai lượt matching đồng thời, rollback outbox, đóng bài trước gửi và trong lease renewal, preference disabled và score giảm/dismissal. Transport được thay bằng bộ ghi nhận gửi, không phải bằng chứng Gmail đã nhận thư.
- Playwright kiểm tra popup LOST/FOUND desktop/mobile, focus trap, Escape, focus restoration, không lặp khi reload, nút cộng đồng, weak-only results, lỗi API và link từ notification. Trước sửa bổ sung menu chuông bên dưới, toàn bộ lượt chạy lại với một worker đạt **113/113**, không skip. Lượt trước bị gián đoạn, có timeout và `ERR_NETWORK_IO_SUSPENDED`, không được tính là đạt; không thay assertion hay timeout để chạy lại.
- `npm test` bình thường: **411 pass, 0 fail, 31 skip** (442 tests); các test SQL cần cờ integration nên không chạy trong lượt mặc định. Riêng integration matching-email trên DB cô lập đạt **9 pass, 0 fail, 0 skip** (test cha và tám tình huống con).
- `npm run build` API/Web đạt; `npm audit --omit=dev` có **0 vulnerabilities**; architecture check có **0 violations**. UC catalogue: **168 UC = 129 Implemented + 21 Partial + 18 Planned**; UC-097 vẫn Partial.
- Cần CI MySQL **8.0/8.4** và browser trên candidate mới sau khi được yêu cầu commit/push. CI của `6296694` không chứng nhận thay đổi local này.
- Trước rollout phải stop/drain worker cũ rồi dùng worker mới có template `MATCH`; không để worker cũ xử lý outbox của producer mới.
- Cần nghiệm thu một email matching thật trong inbox/spam với cấu hình deployment, preference và URL thực tế. Automated integration dùng transport giả trên DB cô lập, không gửi SMTP thật; chưa kiểm chứng thư mà API đang chạy có thể gửi. Không replay migration hoặc sửa ledger Aiven.
- Các cặp lịch sử chưa từng được đánh dấu `is_notified` cũng có thể nhận thông báo lần đầu khi được tính lại. Trước rollout cần kiểm tra lượng bài mở và nhịp worker; không tự sửa marker/ledger để che lịch sử.

## Sửa bổ sung điều hướng thông báo

- Menu chuông trước đó chỉ điều hướng claim/lịch hẹn, nên notification matching bị đánh dấu đã đọc nhưng không mở trang đích. Menu chuông, toast và trang thông báo nay dùng chung `notificationDestination`.
- `POST_MATCH` mở `/posts/:id/matches`; `POST` mở bài đăng; `CLAIM` mở cuộc trao đổi; lịch hẹn và nhắc lịch mở lịch tương ứng; `CUSTODY_REQUEST` mở chi tiết custody trên trang thông báo. Entity không hỗ trợ hoặc thiếu ID dẫn về `/notifications`, không dựng đường dẫn ngoài hệ thống.
- Việc điều hướng không chờ API đánh dấu đã đọc. Khi nội dung đích không còn truy cập được, trang đích vẫn giữ kiểm tra quyền và hiển thị lỗi như trước.
- Menu trên màn hình nhỏ căn theo thanh đầu trang thay vì riêng nút chuông, tránh bị cắt mép trái. Đã kiểm tra ảnh chụp và bounds ở 320/390/768 px.
- Kiểm chứng sau sửa: Web build đạt; **38/38 Playwright** đạt với một worker, không skip (18 kiểm thử điều hướng thông báo và 20 kiểm thử đăng bài/matching). Đây là lượt regression liên quan, không phải chạy lại toàn bộ suite 113 tests kể trên.
- Lượt kiểm thử tăng cường đầu tiên bị dừng vì fixture lỗi API dùng nhầm cấu trúc JSON lồng; fixture được sửa theo contract `error`/`message` hiện hành, giữ nguyên assertion trước khi chạy lại đạt. Không thay backend contract hay timeout để che lỗi.
- Các lượt kiểm tra trong phần này là snapshot local trước publish `dev-clean`. Trạng thái commit/push và CI mới theo [publish review](../audits/publish-review-2026-10-07.md); chưa chứng nhận deployment hoặc inbox matching.

## Traceability

UC-097, UC-026, UC-029, UC-100, UC-168; FR-MATCH-04, FR-NOTIFY-01–04; BR-47–BR-52. Không tạo UC mới và không nâng UC-097 thành Implemented chỉ bằng automated tests. Quy tắc SMTP chung: [notification-email-rules.md](notification-email-rules.md).
