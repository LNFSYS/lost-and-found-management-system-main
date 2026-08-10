# Tổng quan dự án FPTU Lost & Found System

Cập nhật lần cuối: 09/08/2026

## 1. Giới thiệu

FPTU Lost & Found System là hệ thống web/backend hỗ trợ quản lý quy trình báo mất, báo nhặt được, đối chiếu, xác minh và bàn giao đồ thất lạc trong khuôn viên FPT University Đà Nẵng.

Hệ thống được định vị là **MVP/campus pilot** cho quy trình Lost & Found trong trường, tập trung vào luồng nghiệp vụ chính:

```text
Đăng LOST/FOUND
-> Gợi ý matching
-> Gửi claim kèm bằng chứng
-> Staff/Admin hoặc chủ bài FOUND review
-> Đặt lịch bàn giao
-> Quản lý điểm bàn giao/kho
-> Thông báo realtime/chat
-> Dashboard vận hành
```

Dự án không nên được trình bày là hệ thống production-ready hoàn chỉnh, không claim mobile hoàn thiện và không claim custom AI training đã production. Mobile, custom AI training/MLOps và tích hợp camera campus là các hướng mở rộng.

## 2. Vấn đề cần giải quyết

Trong môi trường campus, đồ thất lạc thường được xử lý rời rạc qua bảo vệ, phòng ban, nhóm mạng xã hội hoặc trao đổi trực tiếp. Cách làm này gây ra nhiều vấn đề:

- Người mất đồ khó biết nên tìm ở đâu hoặc hỏi ai.
- Người nhặt được đồ không có quy trình thống nhất để bàn giao.
- Staff khó quản lý vật phẩm đang lưu giữ, thời hạn lưu kho và trạng thái xử lý.
- Việc xác minh chủ sở hữu dễ cảm tính nếu không có bằng chứng rõ ràng.
- Các bài báo mất và nhặt được khó được đối chiếu tự động.
- Admin khó theo dõi hiệu quả vận hành, khu vực hay xảy ra thất lạc và các điểm bàn giao.

Hệ thống giải quyết vấn đề bằng cách gom toàn bộ quy trình Lost & Found vào một nền tảng có phân quyền, dữ liệu tập trung, matching có giải thích, evidence review, appointment, warehouse/handover và notification realtime.

## 3. Mục tiêu sản phẩm

Mục tiêu chính:

- Giúp Student/Lecturer dễ đăng bài LOST/FOUND và tìm vật phẩm liên quan.
- Giúp người nhặt được đồ bàn giao đúng nơi, hạn chế lộ thông tin nhạy cảm.
- Giúp người mất đồ gửi claim có bằng chứng thay vì chỉ mô tả miệng.
- Giúp Staff/Admin xác minh bằng chứng, điều phối lịch bàn giao và quản lý kho.
- Giúp hệ thống gợi ý match dựa trên mô tả, danh mục, vị trí, thời gian, ảnh, OCR/tag.
- Giúp ban vận hành có dashboard, báo cáo và cấu hình nghiệp vụ.

Nguyên tắc quan trọng:

- AI/OCR/matching chỉ hỗ trợ ra quyết định.
- Evidence confidence là chỉ số hỗ trợ review, không phải xác nhận sở hữu tuyệt đối.
- Quyết định trả đồ cuối cùng vẫn cần người có thẩm quyền review.

## 4. Đối tượng sử dụng

| Vai trò | Mục tiêu sử dụng | Quyền chính |
| --- | --- | --- |
| Guest | Xem bảng tin công khai, đăng ký/đăng nhập | Xem bài public, tìm kiếm cơ bản |
| Student | Báo mất, báo nhặt được, gửi claim, nhận đồ | Đăng LOST/FOUND, upload ảnh/bằng chứng, chat, đặt lịch |
| Lecturer | Tương tự Student nhưng thuộc nhóm giảng viên | Đăng bài, claim, chat, appointment |
| Staff | Xử lý vận hành Lost & Found | Review claim, quản lý kho, điểm bàn giao, lịch hẹn, báo cáo vận hành |
| Admin | Quản trị toàn hệ thống | Quản lý user, danh mục, khu vực, cấu hình, dashboard, moderation, warehouse |
| System | Tự động hóa nghiệp vụ nền | Matching, notification, expiration job, warehouse alert, appointment reminder |

## 5. Phạm vi MVP

Phạm vi hiện tại của MVP:

- Web app responsive cho Guest, Student/Lecturer, Staff và Admin.
- Node.js API là backend core cho demo và runtime chính.
- MySQL schema, migration, seed data và các job nền.
- Rule-based/hybrid matching có Google Vision OCR/tag hỗ trợ khi provider được cấu hình.
- Claim/evidence flow với review confidence.
- Appointment, handover point và warehouse lifecycle.
- Realtime notification/chat bằng Socket.IO.
- Staff/Admin dashboard, config, report và moderation.
- Java/Spring Boot service là business/admin extension, không phải microservice production hoàn chỉnh.
- Expo mobile là prototype/MVP phụ, không phải trọng tâm Review 1 hoặc core deliverable hiện tại.

Ngoài phạm vi core hiện tại:

- Native mobile hardening: push notification, offline queue, device farm, packaging.
- Custom trained AI model production, MLOps, model registry, deployed inference endpoint.
- Tích hợp trực tiếp camera campus/NVR.
- Production observability đầy đủ, load test lớn, backup/restore drill theo provider.
- Enrollment verification nâng cao bằng nguồn dữ liệu chính thức của trường.

## 6. Kiến trúc tổng quan

```text
React Web App
  -> Node.js API
      -> MySQL
      -> Cloudinary/private media proxy
      -> Google Vision OCR/tags
      -> Socket.IO realtime
      -> Scheduled jobs
  -> Java/Spring Boot extension
      -> Shared MySQL schema
      -> JWT-compatible business/admin extension
```

### Frontend Web

Web app dùng React + TypeScript + Vite. Đây là giao diện chính cho demo MVP:

- Public board và post detail.
- Create LOST/FOUND.
- My posts.
- Claim/evidence/appointment/chat.
- Handover point map.
- Staff dashboard.
- Admin dashboard/config/report/warehouse.

### Node.js API

Node.js là core API và write owner chính của MVP. Node xử lý:

- Auth, OTP, Google OAuth MVP, JWT/refresh token.
- Posts, media upload, private media proxy.
- Matching, match explanations, feedback.
- Claims, evidence, proof vault, verification questions.
- Appointments, warehouse, handover point.
- Admin/staff operations.
- Notification, chat, Socket.IO.
- Migration, seed data, scheduled jobs.

### Java/Spring Boot Extension

Java service tồn tại để thành viên chuyên Java có phần backend/business logic phù hợp. Với MVP hiện tại:

- Java là extension/business-service layer.
- Node vẫn là owner core demo flow.
- Java không nên được trình bày là production microservice hoàn chỉnh.
- Nếu một flow được route sang Java trong tương lai, phải có một writer duy nhất cho flow đó và có integration test.

### Database và media

- MySQL là nguồn dữ liệu chính.
- Cloudinary dùng cho ảnh/media; private media không trả raw URL cho user không có quyền.
- Protected image được truy cập qua authenticated API proxy.
- Các migration mới có feature flag mặc định tắt cho tính năng AI/private assistance trước khi bật ở môi trường demo/pilot.

## 7. Module chức năng chính

### 7.1 Auth và account

Hệ thống hỗ trợ:

- Đăng ký bằng email OTP.
- Không bắt buộc email FPT/edu vì sinh viên hiện có thể không được cấp email FPT.
- Đăng nhập email/password.
- Google OAuth MVP.
- Forgot/reset password.
- Refresh token, logout và session invalidation khi account/role/password thay đổi.
- Phân quyền theo role và audience: Student, Lecturer, Staff, Admin.

### 7.2 Public board và post management

Người dùng có thể:

- Xem bảng tin LOST/FOUND công khai.
- Search/filter/sort theo tên, trạng thái, danh mục, khu vực, thời gian.
- Mở post detail bằng route riêng thay vì popup.
- Tạo LOST/FOUND post.
- Upload ảnh vật phẩm.
- Chỉnh sửa, đóng hoặc xóa mềm bài của mình.
- Báo cáo vi phạm bài đăng.

FOUND post có thể có chế độ `PRIVATE_DETAILS` để hạn chế lộ thông tin nhạy cảm như vị trí chính xác, contact, mô tả nhận dạng hoặc ảnh gốc cho public viewer.

### 7.3 Matching

Matching hiện tại là rule-based/hybrid, không phải custom trained AI production model.

Các tín hiệu chính:

- Text similarity từ title/description.
- Category.
- Location/building/room.
- Time proximity.
- Image tags từ Google Vision nếu có.
- OCR/serial-like tokens nếu có.
- Penalty/cap khi khác category xa hoặc lệch thời gian lớn.

Score tier:

| Score | Ý nghĩa |
| --- | --- |
| `< 45%` | Bỏ qua |
| `45-59%` | Lưu candidate yếu, không popup |
| `60-74%` | Hiển thị gợi ý |
| `75-84%` | Notify nhẹ |
| `>= 85%` | High confidence advisory, vẫn không tự trả đồ |

Matching có explanation để Staff/Admin hoặc người dùng hiểu vì sao hai bài được gợi ý giống nhau: trùng token, danh mục, vị trí, thời gian, OCR/tag hoặc penalty.

### 7.4 Claim và evidence verification

Claim chỉ áp dụng cho bài FOUND đủ điều kiện. Người claim phải cung cấp bằng chứng sở hữu.

Luồng chính:

```text
User mở FOUND post
-> Gửi claim
-> Upload evidence/private proof
-> Chủ bài FOUND hoặc Staff/Admin review
-> Có thể yêu cầu bổ sung thông tin
-> Accept hoặc reject claim
-> Nếu accept thì mở appointment/chat
```

Evidence verification gồm:

- Mô tả claim.
- Ảnh/bằng chứng người claim cung cấp.
- Private Proof Vault nếu người dùng có proof riêng.
- Verification questions theo vật phẩm nếu bật.
- Evidence Consistency Map cho reviewer.
- Review confidence hỗ trợ đánh giá.

Hệ thống không trả lời cho claimant biết từng câu đúng/sai theo kiểu lộ đáp án. Secret answer và private signal phải được bảo vệ.

### 7.5 Appointment và handover

Sau khi claim được accept, các bên có thể tạo lịch bàn giao.

Appointment hỗ trợ:

- Tạo lịch sau accepted claim.
- Chọn điểm bàn giao trong campus hoặc nhập custom meeting location.
- Accept/reject/reschedule/cancel.
- Complete handover.
- Upload proof image sau bàn giao.
- Feedback sau khi hoàn tất.
- Notification reminder.

Mỗi claim chỉ có một active appointment tại một thời điểm để tránh xung đột.

### 7.6 Handover point

Trang điểm bàn giao giúp user biết nên đến đâu để nhận/trả đồ:

- Hiển thị danh sách điểm bàn giao.
- Hiển thị bản đồ campus bằng ảnh có marker.
- Marker có vị trí tương ứng với khu vực/tòa nhà.
- Có trạng thái active/temporary closed.
- Có giờ hoạt động, người/đơn vị phụ trách và số vật phẩm đang lưu giữ.
- Admin/Staff có thể tạo/sửa/tạm đóng/xóa mềm điểm bàn giao.

### 7.7 Warehouse

Warehouse dùng cho Staff/Admin quản lý vật phẩm đang lưu giữ.

Chức năng chính:

- Ghi nhận vật phẩm vào kho.
- Gắn item với FOUND post hoặc handover point nếu có.
- Theo dõi trạng thái: received/stored/overdue/disposed/donated/transferred/returned.
- Tính retention deadline theo policy.
- Cảnh báo gần hết hạn.
- Cảnh báo capacity.
- Xử lý quá hạn bằng dispose/donate/transfer/extend.
- Chặn dispose/donate/transfer nếu còn claim hoặc appointment pending/active.
- Lưu storage log/audit cho các thay đổi quan trọng.

Retention policy có thể khác nhau theo loại vật phẩm, ví dụ giấy tờ/thẻ, điện tử/giá trị cao, đồ thường, đồ dễ hỏng/vệ sinh.

### 7.8 Realtime notification và chat

Realtime hỗ trợ:

- Notification khi có match tốt.
- Notification khi có claim mới.
- Notification khi claim được accept/reject/cancel hoặc cần bổ sung.
- Notification appointment.
- Warehouse/operational alert.
- Claim chat sau khi claim được accept.
- Chat text/image.
- Seen/read status.
- Unread badge.

Socket.IO dùng JWT auth, room isolation theo claim/user và có optional Redis adapter cho multi-instance deployment. Client vẫn có thể đọc notification đã lưu từ database nếu realtime bị gián đoạn.

### 7.9 Staff dashboard

Staff dashboard tập trung vào vận hành:

- Claim/evidence cần xử lý.
- Warehouse items.
- Handover/appointment.
- Overdue/capacity alerts.
- Report/feedback liên quan vận hành.

Staff có quyền thấp hơn Admin và không nên thấy các chức năng quá quyền như cấu hình hệ thống nhạy cảm hoặc quản lý toàn bộ user/role.

### 7.10 Admin dashboard

Admin có quyền quản trị rộng:

- Dashboard metric.
- Quản lý user.
- Quản lý category.
- Quản lý area/building/location.
- Quản lý handover points.
- Quản lý warehouse.
- Moderation.
- Report và CSV export.
- Return feedback.
- Config và config history/rollback.

### 7.11 Reputation và feedback

Hệ thống có reputation để khuyến khích hành vi tốt:

- Cộng điểm khi claim/return thành công.
- Trừ điểm với claim sai nhiều lần hoặc vi phạm.
- Hiển thị lịch sử reputation cho user.
- Cho feedback sau khi bàn giao hoàn tất.
- Admin/Staff có thể review negative feedback/flag user.

Reputation chỉ hỗ trợ đánh giá hành vi, không tự động quyết định trả đồ.

## 8. Luồng nghiệp vụ chính

### 8.1 Luồng người mất đồ

Actor chính: Student/Lecturer.

Điều kiện bắt đầu: người dùng đã đăng nhập và muốn tìm lại vật phẩm bị mất.

1. Người dùng chọn đăng bài `LOST`.
2. Người dùng nhập thông tin vật phẩm: tiêu đề, mô tả, danh mục, thời gian mất, khu vực/tòa nhà/phòng hoặc vị trí tự nhập.
3. Người dùng tải ảnh vật phẩm nếu có. Với vật phẩm cần xác minh mạnh, người dùng có thể nhập dấu hiệu riêng như phụ kiện, vết xước, bốn số cuối serial hoặc mô tả nhận dạng mà người ngoài khó biết.
4. Hệ thống validate dữ liệu: bài phải có danh mục, mô tả, contact, thời gian không ở tương lai và vị trí hợp lệ.
5. Sau khi bài được tạo, hệ thống đưa bài vào hàng đợi matching để so với các bài `FOUND` đang mở.
6. Matching tính điểm dựa trên mô tả, danh mục, vị trí, thời gian, ảnh, OCR/tag và các penalty nếu khác ngữ cảnh.
7. Nếu có candidate đủ ngưỡng, hệ thống hiển thị gợi ý cho người mất đồ qua popup/notification hoặc trang gợi ý matching.
8. Người dùng mở bài `FOUND` nghi là vật phẩm của mình để xem thông tin công khai. Nếu bài `FOUND` ở chế độ private-details, hệ thống chỉ hiển thị thông tin đã được redaction.
9. Người dùng gửi claim, nhập mô tả sở hữu và tải bằng chứng như ảnh cũ, hóa đơn, serial, phụ kiện, đặc điểm riêng hoặc private proof.
10. Claim chuyển sang trạng thái `PENDING`. Chủ bài `FOUND`, Staff hoặc Admin có thể review.
11. Reviewer kiểm tra evidence, review confidence, Evidence Consistency Map và có thể yêu cầu bổ sung thông tin nếu chưa đủ.
12. Nếu bằng chứng không đủ, claim bị reject hoặc yêu cầu thêm thông tin.
13. Nếu bằng chứng đủ, claim được accept. Hệ thống mở luồng appointment/chat cho các bên liên quan.
14. Người mất đồ và người giữ đồ/Staff thống nhất điểm bàn giao, thời gian và bằng chứng cần mang theo.
15. Khi bàn giao xong, appointment được complete, bài đăng được cập nhật trạng thái phù hợp và hệ thống có thể ghi feedback/reputation.

Kết quả đầu ra: người mất đồ nhận lại vật phẩm hoặc claim bị từ chối/yêu cầu bổ sung với lý do rõ ràng.

### 8.2 Luồng người nhặt được đồ

Actor chính: Student/Lecturer/Staff.

Điều kiện bắt đầu: người dùng nhặt được vật phẩm hoặc Staff tiếp nhận vật phẩm tại điểm bàn giao/kho.

1. Người nhặt được chọn đăng bài `FOUND`.
2. Người dùng nhập tiêu đề, mô tả, danh mục, thời gian nhặt được và vị trí nhặt được.
3. Người dùng chọn nơi vật phẩm đang được giữ: tự giữ tạm, điểm bàn giao, hoặc chuyển vào kho nếu Staff/Admin xử lý.
4. Nếu vật phẩm có thông tin nhạy cảm, người dùng có thể chọn chế độ `PRIVATE_DETAILS` để tránh lộ vị trí chính xác, contact, ảnh gốc hoặc mô tả nhận dạng cho public viewer.
5. Người dùng tải ảnh vật phẩm. Hệ thống validate định dạng, kích thước và chữ ký file.
6. Sau khi bài được tạo, hệ thống enqueue matching với các bài `LOST` đang mở.
7. Nếu có bài `LOST` tương tự, hệ thống hiển thị gợi ý phù hợp và có thể gửi notification theo score tier.
8. Người mất đồ có thể gửi claim vào bài `FOUND`.
9. Chủ bài `FOUND`, Staff hoặc Admin xem claim, evidence và review confidence.
10. Nếu claim chưa đủ chứng cứ, reviewer yêu cầu bổ sung hoặc reject.
11. Nếu claim hợp lý, reviewer accept claim. Việc accept vẫn là quyết định của con người, không phải do AI tự động.
12. Sau khi accept, các bên tạo appointment hoặc chọn điểm bàn giao trong campus.
13. Nếu vật phẩm đang ở kho, Staff cập nhật warehouse item và gắn với lịch bàn giao.
14. Khi bàn giao hoàn tất, hệ thống ghi proof nếu có, cập nhật trạng thái appointment/post/warehouse và tạo feedback/reputation.

Kết quả đầu ra: vật phẩm được bàn giao cho đúng người hoặc tiếp tục được lưu giữ/chờ claim hợp lệ.

### 8.3 Luồng Staff xử lý claim

Actor chính: Staff.

Điều kiện bắt đầu: có claim mới, claim cần bổ sung thông tin hoặc vật phẩm đang được lưu tại điểm bàn giao/kho.

1. Staff đăng nhập vào staff dashboard.
2. Staff xem danh sách claim/evidence cần xử lý, các appointment sắp tới và warehouse alert.
3. Staff mở claim detail để xem bài `FOUND`, người claim, bằng chứng đã gửi và lịch sử xử lý.
4. Hệ thống hiển thị review confidence và Evidence Consistency Map cho Staff, gồm các tín hiệu như mô tả, vị trí, thời gian, ảnh, OCR/tag, private proof và câu hỏi xác minh.
5. Staff kiểm tra xem claim có đủ bằng chứng sở hữu hay không. Nếu cần, Staff yêu cầu người claim bổ sung thông tin.
6. Nếu bằng chứng yếu hoặc mâu thuẫn, Staff reject claim và ghi lý do.
7. Nếu bằng chứng hợp lý, Staff accept claim hoặc hỗ trợ chủ bài `FOUND` xử lý claim.
8. Sau khi claim được accept, Staff tạo hoặc xác nhận appointment tại điểm bàn giao phù hợp.
9. Nếu vật phẩm đang trong kho, Staff kiểm tra warehouse item, vị trí lưu giữ và tình trạng vật phẩm trước khi bàn giao.
10. Khi người nhận đến, Staff đối chiếu thông tin, cập nhật appointment complete, tải proof image nếu cần và cập nhật warehouse/post status.
11. Hệ thống gửi notification cho các bên và ghi activity/audit log.

Kết quả đầu ra: claim được xử lý minh bạch, có log và vật phẩm chỉ được bàn giao khi đủ điều kiện.

### 8.4 Luồng quản lý kho

Actor chính: Staff/Admin.

Điều kiện bắt đầu: vật phẩm được chuyển vào kho hoặc cần theo dõi thời hạn lưu giữ.

1. Staff/Admin tiếp nhận vật phẩm từ người nhặt được, điểm bàn giao hoặc bảo vệ.
2. Staff/Admin tạo warehouse item với tên vật phẩm, mã lưu kho, danh mục, trạng thái, vị trí kệ/ngăn và mô tả ngắn.
3. Nếu vật phẩm liên quan tới bài `FOUND`, Staff/Admin gắn warehouse item với bài tương ứng.
4. Hệ thống xác định retention deadline theo policy: giấy tờ/thẻ, điện tử/giá trị cao, đồ thường, đồ dễ hỏng/vệ sinh.
5. Hệ thống theo dõi sức chứa kho và cảnh báo khi gần đầy hoặc vật phẩm gần hết hạn lưu giữ.
6. Khi có claim được accept, Staff kiểm tra item trong kho và đưa vào luồng appointment/handover.
7. Nếu vật phẩm quá hạn nhưng còn claim hoặc appointment pending/active, hệ thống chặn dispose/donate/transfer.
8. Nếu vật phẩm quá hạn và không còn ràng buộc xử lý, Staff/Admin chọn disposition hợp lệ: extend, transfer, donate hoặc dispose.
9. Với mỗi thay đổi quan trọng, hệ thống ghi storage log/audit log.
10. Admin/Staff có thể xem danh sách vật phẩm, lọc theo trạng thái, xuất CSV và theo dõi báo cáo.

Kết quả đầu ra: kho có dữ liệu rõ ràng, vật phẩm không bị xử lý sai khi còn claim/appointment và mọi thay đổi đều có log.

### 8.5 Luồng Admin quản trị

Actor chính: Admin.

Điều kiện bắt đầu: Admin cần quản trị dữ liệu nền, kiểm duyệt hoặc theo dõi hiệu quả vận hành.

1. Admin đăng nhập vào admin dashboard.
2. Admin xem tổng quan hệ thống: số bài LOST/FOUND, claim, item đã trả, khu vực hay mất đồ, warehouse status và report.
3. Admin quản lý user, role, trạng thái tài khoản và các giới hạn quyền.
4. Admin quản lý danh mục vật phẩm, khu vực, tòa nhà, điểm bàn giao và marker trên bản đồ campus.
5. Admin kiểm duyệt bài viết, xử lý report và ẩn/xóa mềm nội dung vi phạm.
6. Admin quản lý warehouse policy, retention period, capacity và các trạng thái disposition.
7. Admin cấu hình matching threshold/weight, post expiration, notification/email rule và feature flags.
8. Admin xem config history và rollback khi cần.
9. Admin xem report, export CSV, theo dõi feedback tiêu cực và reputation issue.
10. Các thao tác quan trọng được ghi log để phục vụ audit và review sau này.

Kết quả đầu ra: hệ thống có dữ liệu nền ổn định, cấu hình rõ ràng, vận hành có kiểm soát và có bằng chứng audit.

### 8.6 Luồng matching và notification nền

Actor chính: System.

Điều kiện bắt đầu: có bài LOST/FOUND mới, bài được cập nhật hoặc Admin yêu cầu re-run matching.

1. Khi post được tạo/cập nhật, hệ thống đưa job matching vào hàng đợi nền.
2. Worker lấy candidate theo phạm vi đã giới hạn, ưu tiên các bài khác loại `LOST` vs `FOUND`, còn mở và có liên quan về danh mục/vị trí/thời gian.
3. Hệ thống tính từng thành phần điểm: text, category, location, time, image tags, OCR/serial-like tokens và penalty.
4. Hệ thống tạo explanation để người dùng/reviewer hiểu lý do match.
5. Match dưới ngưỡng thấp bị bỏ qua hoặc chỉ lưu nội bộ.
6. Match đủ ngưỡng suggestion được hiển thị cho người dùng.
7. Match tốt hơn có thể tạo notification, nhưng vẫn không tự đổi post sang returned/resolved.
8. Người dùng có thể dismiss popup; hệ thống không mở lại liên tục ngay sau khi đóng.
9. Admin có thể re-run matching khi thay đổi cấu hình hoặc dữ liệu.

Kết quả đầu ra: người dùng nhận gợi ý phù hợp, reviewer có giải thích, hệ thống không tự ra quyết định sở hữu.

### 8.7 Luồng hỗ trợ AI/private assistance

Actor chính: User, Staff/Admin, System.

Điều kiện bắt đầu: feature flag tương ứng đã bật trên schema demo/pilot đã qua migration/E2E.

1. AI-assisted draft giúp user upload một ảnh và nhận draft mô tả có thể chỉnh sửa trước khi đăng.
2. Search Companion hỏi thêm thông tin còn thiếu cho bài LOST, ví dụ màu sắc, phụ kiện, vị trí, thời gian, bốn số cuối serial.
3. Finder Quick Scan cho người nhặt được chụp/upload ảnh, xem LOST candidates và tạo FOUND draft nếu chưa có match phù hợp.
4. Private Proof Vault cho user lưu bằng chứng riêng tư như serial, hóa đơn, ảnh trước khi mất hoặc mô tả đặc điểm bí mật.
5. Evidence Consistency Map cho reviewer xem độ nhất quán giữa claim, proof, post, matching và OCR/tag.
6. Recovery Timeline hiển thị tiến trình xử lý bài/claim theo quyền của từng user.
7. Campus Radar và Visual Hunt hỗ trợ Staff/Admin theo dạng decision support, không tự kết luận và không nhận diện danh tính người.

Kết quả đầu ra: AI giúp giảm thao tác và tăng chất lượng review, nhưng toàn bộ quyết định sở hữu/bàn giao vẫn do con người xử lý.

## 9. AI-assisted features hiện tại

Các tính năng AI hỗ trợ user/staff hiện tại:

| Tính năng | Mục đích | Ghi chú an toàn |
| --- | --- | --- |
| AI-assisted draft | Gợi ý draft từ một ảnh khi user tạo bài | Không tự đăng bài |
| Google Vision OCR/tag | Trích tag/OCR hỗ trợ matching | Phụ thuộc provider/config |
| Private Proof Vault | Lưu private proof của user | Secret hash-only, media qua proxy |
| Evidence Consistency Map | So sánh evidence và tín hiệu matching cho reviewer | Reviewer-only, human decision required |
| Search Companion | Hỏi thêm thông tin cho bài LOST | Không lộ FOUND private details |
| Recovery Timeline | Hiển thị hành trình xử lý bài/claim | Role-aware privacy |
| Finder Quick Scan | Người nhặt upload/chụp ảnh để xem LOST candidates và tạo FOUND draft | Advisory, không auto-match |
| Campus Radar | Phân tích aggregate mất đồ theo khu vực/sự kiện | Không dùng dữ liệu cá nhân |
| Visual Hunt | Staff/Admin scan ảnh/video frame để tìm candidate | Không nhận diện mặt, không tự kết luận |

Feature flags cho các tính năng mới mặc định tắt sau migration và chỉ nên bật khi migration/E2E trên schema isolated đã pass.

## 10. Security và privacy

Các nguyên tắc bảo mật/chống lộ dữ liệu:

- JWT auth và role guard cho API cần đăng nhập.
- Staff có quyền thấp hơn Admin.
- Private media không trả raw Cloudinary/storage URL cho user không có quyền.
- Claim evidence chỉ hiển thị cho claimant, post owner, Staff/Admin có quyền.
- Chat room được isolate theo claim.
- Socket event phải xác thực và không phát sang user không liên quan.
- Secret answer, private proof và ownership signal không lưu plaintext.
- FOUND private details được backend redaction ở public view/suggestion/notification.
- AI/matching không tự xác nhận chủ sở hữu.
- Các response phụ thuộc người xem dùng chính sách chống cache nhầm dữ liệu riêng tư.

## 11. Dữ liệu và cấu hình

Các nhóm dữ liệu chính:

- Users, roles, audience role.
- Posts, post media, reports.
- Match results, match feedback, match suggestion impressions.
- Claims, claim evidence, private proofs, verification answers.
- Appointments, appointment proof, return feedback.
- Handover points, campus areas/buildings.
- Warehouse items, storage logs, retention policies.
- Notifications, chat rooms, chat messages.
- Config entries, config history.
- AI/Radar/Visual Hunt/Finder/Search Companion related records.

Admin có thể cấu hình một số chính sách như expiration, matching threshold/weight, notification rule, retention policy và feature flags. Một số feature mới cần migration và E2E pass trước khi bật ở môi trường demo/pilot.

## 12. Trạng thái kiểm thử và readiness

Trạng thái hiện tại:

- Core web/backend đã có nhiều unit/API/E2E smoke coverage.
- Có Playwright cho routing, post creation, claim, staff review, appointment, proof, feedback và admin navigation.
- Có migration smoke script và OpenAPI drift check.
- Có CI cho API/web/mobile typecheck, MySQL isolated smoke, Java build và một số E2E.
- Một số verification vẫn phụ thuộc môi trường: schema isolated sạch checksum, Google Vision billing/quota, Maven local, provider backup/restore, phone-camera HTTPS rehearsal.

Readiness nên trình bày là:

> Source/build/test gates cho MVP web/backend đang tốt, nhưng release/pilot thật vẫn cần chạy migration/E2E trên database isolated sạch, kiểm tra provider credential và rehearsal demo environment.

## 13. Ranh giới trình bày khi bảo vệ

Nên nói:

- "MVP web/backend cho quy trình Lost & Found campus."
- "Google Vision hỗ trợ OCR/tag."
- "Rule-based/hybrid matching có score tier và explanation."
- "Evidence confidence hỗ trợ human review."
- "Node.js là core API, Java là business extension."
- "Mobile/custom AI training/camera campus là future enhancement."

Không nên nói:

- "Production-ready hoàn chỉnh."
- "Custom AI model đã train và deploy production."
- "Mobile app hoàn chỉnh."
- "Microservices production hoàn chỉnh."
- "Hệ thống tự xác minh chắc chắn chủ sở hữu."
- "Camera campus đã tích hợp thật" nếu chưa có quyền truy cập camera/NVR.

## 14. Hướng phát triển tiếp theo

Các hướng phát triển hợp lý sau MVP:

- Chạy benchmark dữ liệu lớn và tối ưu query/matching.
- Bổ sung notification digest và chống spam popup tốt hơn.
- Hoàn thiện mobile push/offline/device test.
- Tích hợp nguồn enrollment chính thức nếu trường cung cấp.
- Thu thập feedback label để huấn luyện model nhỏ cho reranking sau khi đủ dữ liệu.
- Thêm model registry/inference endpoint khi custom AI thật sự đủ điều kiện.
- Tích hợp camera campus/NVR ở dạng Campus Camera Assisted Search với phân quyền, audit log, privacy policy và không nhận diện danh tính người nếu chưa được phép.
- Tăng coverage cho reconnect/offline, provider backup/restore và staging deployment.

## 15. Tài liệu liên quan

| File | Nội dung |
| --- | --- |
| `docs/Overall/architecture.md` | Kiến trúc kỹ thuật, API, migration, runtime boundary |
| `docs/Overall/mvp-scope-and-future-work.md` | Phạm vi MVP và future work |
| `docs/Overall/node-java-service-boundary.md` | Ranh giới Node.js và Java |
| `docs/Overall/thesis-defense-guide-2026.md` | Script bảo vệ, demo flow, Q&A |
| `docs/Requirements and Business Rules/requirements.md` | Functional/non-functional requirements |
| `docs/Requirements and Business Rules/business-rules.md` | Business rules |
| `docs/Requirements and Business Rules/traceability-matrix.md` | Traceability requirement/business rule/use case |
| `docs/Checklist/master-dev-checklist.md` | Use case assignment/status chính |
| `docs/Checklist/pending-tasks.md` | Backlog còn lại |
| `docs/Checklist/release-checklist.md` | Checklist trước demo/release |
