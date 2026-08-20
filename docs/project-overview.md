# Tổng quan dự án FPTU Lost & Found System

Cập nhật: 21/08/2026

## 1. Định vị dự án

FPTU Lost & Found System là hệ thống web/backend hỗ trợ sinh viên và giảng viên FPT University Đà Nẵng đăng thông tin đồ bị mất hoặc nhặt được, tìm các báo cáo liên quan và theo dõi kết quả đối chiếu.

Codebase hiện tại là **MVP đang phát triển**, tập trung vào nền tảng authentication, quản lý bài LOST/FOUND, phân tích ảnh hỗ trợ và rule-based/hybrid matching. Các module claim, evidence verification, appointment, warehouse, handover operations và realtime mới có một phần schema từ project tham khảo; chưa có runtime API/UI hoàn chỉnh trong codebase này.

Không mô tả dự án hiện tại là production-ready, production microservices hoặc custom-trained AI system.

## 2. Bài toán

Quy trình Lost & Found thủ công trong campus thường gặp các vấn đề:

- Thông tin mất/nhặt đồ nằm rải rác ở nhiều nhóm và phòng ban.
- Người dùng khó tìm bài đối ứng nếu cách mô tả khác nhau.
- Người nhặt được đồ không biết nên cung cấp thông tin nào mà vẫn bảo vệ chi tiết nhận dạng.
- Dữ liệu danh mục và địa điểm không đồng nhất.
- Việc trả đồ cần một quy trình xác minh của con người, không thể dựa hoàn toàn vào điểm matching.

MVP hiện tại giải quyết phần đầu của hành trình: tạo dữ liệu có cấu trúc, hỗ trợ điền bài từ ảnh, hiển thị board và tính các gợi ý tương đồng có giải thích.

## 3. Actor và quyền hiện tại

| Actor/role | Khả năng hiện có |
| --- | --- |
| Guest | Truy cập trang auth; board hiện nằm sau route guard trong web hiện tại |
| `USER` | Quyền nền được gán cho tài khoản đã đăng ký |
| `STUDENT` | Đăng nhập, hồ sơ, tạo/quản lý bài, xem board và matching của bài được phép |
| `LECTURER` | Cùng nhóm chức năng người dùng như Student |
| `STAFF` | Qua được staff route guard; trang staff hiện là placeholder, chưa có API vận hành |
| `ADMIN` | Quản lý category, area và building; truy cập admin route |

Backend luôn là nơi quyết định quyền. Frontend route guard chỉ hỗ trợ trải nghiệm và không thay thế authorization ở API.

## 4. Phạm vi hiện tại

### 4.1 Đã triển khai

- Đăng ký bằng email OTP qua SMTP.
- Đăng nhập email/password.
- JWT access token và refresh token cookie `HttpOnly`.
- Refresh, logout, forgot/reset password.
- Xem và cập nhật profile cơ bản.
- JWT middleware và role guard.
- Tạo, cập nhật trạng thái và xóa mềm bài `LOST`/`FOUND`.
- Board, tìm kiếm, lọc, sắp xếp, phân trang, bài của tôi và trang chi tiết.
- Category hai cấp: nhóm chính và danh mục cụ thể.
- Area/building/handover-point catalog cho form tạo bài.
- Upload, đọc qua media proxy và xóa ảnh bài đăng.
- Chế độ `PRIVATE_DETAILS` cho bài `FOUND` với serializer hạn chế dữ liệu public.
- Gemini-assisted image analysis cho tối đa 5 ảnh, trả bản nháp có thể chỉnh sửa.
- Rule-based/hybrid matching có text, category, location, time, image tags và safe OCR tags.
- Lưu kết quả matching, score tier, explanation và manual recalculation có rate limit.
- Admin CRUD category, area và building.
- React Router cho các route auth, home, board, my posts, detail, matching, profile, staff và admin.

### 4.2 Mới ở mức partial

- Staff: đã có role guard và placeholder page, chưa có dashboard/API nghiệp vụ.
- Admin dashboard: mới có số liệu và CRUD catalog, chưa có users/moderation/report/config toàn hệ thống.
- Handover point: form catalog đọc được danh sách điểm đang hoạt động; chưa có trang bản đồ và admin management trong codebase mới.
- Media privacy: proxy/authorization có nền tảng, nhưng storage là local filesystem nên chưa phù hợp nhiều máy hoặc deploy nhiều instance.
- Database: có nhiều bảng dành cho flow tương lai, nhưng route/service chưa tồn tại.
- Test: có unit test và Playwright UI tests; chưa có database integration/E2E cho toàn bộ endpoint hiện hành.

### 4.3 Chưa triển khai runtime

- Claim, claim evidence và ownership review confidence.
- Appointment, handover completion và return feedback.
- Warehouse lifecycle, retention và disposition.
- Notification, Socket.IO chat và unread badge.
- Admin user/role management, moderation, reports, config history.
- Reputation/activity history.
- Java business endpoints.
- Expo/mobile app trong codebase mới.
- Custom model training/MLOps.

## 5. Kiến trúc hiện tại

```text
React + TypeScript + Vite
        |
        | HTTP/JSON + HttpOnly refresh cookie
        v
Node.js + Express + TypeScript
        |
        +--> MySQL (schema, auth, posts, catalog, matching)
        +--> Gmail/SMTP (OTP và reset password)
        +--> Gemini API (phân tích ảnh tùy chọn)
        +--> Local protected media directory (hiện tại)

Java/Spring Boot
        +--> Actuator health skeleton, chưa tham gia business flow
```

### 5.1 Frontend

Frontend nằm tại `apps/web` và dùng:

- React 18 và TypeScript.
- React Router cho navigation/route guard.
- Vite cho dev/build.
- Playwright cho browser tests.
- Storytelling home kết hợp form tạo bài thực tế.

Các route chính:

| Route | Mục đích |
| --- | --- |
| `/login`, `/register` | Authentication |
| `/forgot-password`, `/reset-password` | Khôi phục mật khẩu |
| `/home` | Storytelling và tạo LOST/FOUND post |
| `/posts` | Board |
| `/my-posts` | Bài của người dùng hiện tại |
| `/posts/:postId` | Chi tiết bài |
| `/posts/:postId/matches` | Phân tích matching đã lưu |
| `/profile` | Hồ sơ |
| `/staff` | Placeholder đã guard |
| `/admin` | Quản lý catalog dành cho Admin |

### 5.2 Node.js API

API nằm tại `apps/api-node` và chia theo route/controller/service/repository/validator.

Route family hiện hành:

- `/api/auth`: OTP, register, login, refresh, logout, password reset, profile.
- `/api/posts`: board, catalog, mine, image analysis, CRUD post, matching, media.
- `/api/admin`: CRUD category, area và building; toàn bộ route yêu cầu `ADMIN`.
- `/api/health`: liveness cơ bản.

Node.js là schema owner và write owner duy nhất.

### 5.3 Java

`apps/java-admin-service` chỉ có Spring Boot application và Actuator. Không có controller/service/repository nghiệp vụ. Chi tiết tại [node-java-service-boundary.md](node-java-service-boundary.md).

## 6. Luồng hiện hành

### 6.1 Đăng ký và đăng nhập

```text
Nhập email + thông tin tài khoản
-> Yêu cầu OTP
-> API tạo OTP đã hash, có hạn dùng và gửi qua SMTP
-> Người dùng nhập OTP
-> API tạo user + roles trong transaction
-> Tạo access token + refresh session
-> Web chuyển tới /home
```

Refresh token được lưu dạng hash trong database và gửi cho trình duyệt qua cookie `HttpOnly`. Logout revoke refresh token hiện tại.

### 6.2 Tạo bài LOST/FOUND thủ công

```text
Chọn LOST hoặc FOUND
-> Chọn nhóm chính
-> Chọn danh mục cụ thể thuộc nhóm
-> Nhập thời gian, vị trí, mô tả, liên hệ
-> FOUND chọn nơi lưu/điểm bàn giao và có thể bật PRIVATE_DETAILS
-> API validate quan hệ category/location/handover
-> Tạo post OPEN
-> Upload ảnh nếu có
-> Chạy matching best-effort
-> Mở trang kết quả matching hoặc My Posts
```

Lỗi matching không rollback bài đăng hợp lệ.

### 6.3 Tạo bản nháp từ ảnh

```text
Chọn 1-5 ảnh
-> Người dùng chủ động bấm Phân tích ảnh
-> API kiểm tra MIME, chữ ký file, số lượng và tổng dung lượng
-> Gemini trả title/description/category/tags/safe visible text
-> Backend map category về danh mục con thật trong DB
-> Web điền form nháp
-> Người dùng kiểm tra/chỉnh sửa
-> Chỉ khi bấm Đăng bài thì post mới được lưu
```

Gemini không tự suy luận quyền sở hữu, không tự đăng bài và không auto-return vật phẩm.

### 6.4 Matching

```text
Post được tạo/cập nhật
-> Lấy tập bài đối nghịch LOST/FOUND đang hoạt động
-> Giới hạn candidate theo config
-> Chuẩn hóa text tiếng Việt
-> Tính component scores
-> Áp dụng penalty/cap
-> Lưu match_results từ weak threshold trở lên
-> Trả score, tier và explanation cho actor có quyền
```

Tier mặc định:

| Score | Tier | Hành vi hiện tại |
| --- | --- | --- |
| `< 45%` | Bỏ qua | Không lưu |
| `45-59%` | `WEAK` | Lưu để phân tích, không tự notify |
| `60-74%` | `SUGGESTION` | Hiển thị gợi ý |
| `75-84%` | `NOTIFY` | Tier tư vấn; notification chưa triển khai |
| `>= 85%` | `HIGH_CONFIDENCE` | Tương đồng cao nhưng vẫn cần con người xác minh |

Các tín hiệu hiện tại gồm text, category, location, time, image tags và safe OCR tags. Explanation hiển thị điểm thành phần và lý do/cap có liên quan. Bài `PRIVATE_DETAILS` được redaction tín hiệu thô cho actor không đủ quyền.

## 7. Dữ liệu và migration

Migration Node.js là nguồn schema duy nhất. `schema_migrations` lưu checksum để ngăn sửa migration đã chạy.

Nhóm bảng đang được runtime sử dụng trực tiếp:

- `users`, `roles`, `user_roles`.
- `email_otps`, `refresh_tokens`, `password_reset_tokens`.
- `posts`, `post_media`, `ai_tags`, `match_results`.
- `item_categories`, `campus_areas`, `campus_buildings`, `handover_points` ở mức catalog.
- `config_entries` cho một số matching weights/thresholds đọc nội bộ.

Các bảng claim, appointment, warehouse, notification, chat, reputation, radar, proof vault và finder scan là schema foundation được mang sang để phát triển sau. Sự tồn tại của bảng không được dùng làm bằng chứng UC đã Done.

Khi dùng shared cloud MySQL:

1. Không sửa migration đã chạy.
2. Chỉ thêm migration mới.
3. Chỉ một người chạy migration sau review.
4. Không chạy test destructive trên DB chung.
5. Tách database dev/demo/test nếu có thể.

## 8. Media storage

Code hiện tại lưu file tại `UPLOAD_DIR` (mặc định `apps/api-node/uploads`) và lưu URI nội bộ dạng `private://post-media/...` trong DB. Client chỉ nhận URL proxy `/api/posts/:postId/media/:mediaId`.

Giới hạn hiện tại:

- File không tự đồng bộ giữa máy của các thành viên.
- Shared Aiven DB có thể tham chiếu file chỉ tồn tại trên máy người upload.
- Restart/deploy sang máy mới có thể mất media nếu volume không persistent.
- Scale nhiều API instance không an toàn nếu không có shared object storage.

Cloudinary/S3-compatible storage là việc cần làm trước shared staging/deployment. Sau khi chuyển, private media vẫn phải đi qua signed/authenticated access; không trả raw private URL.

## 9. Security hiện tại

- Password hash bằng bcrypt.
- OTP và refresh token không lưu plaintext.
- OTP có expiry và giới hạn số lần thử.
- Auth endpoints có rate limit cơ bản.
- Refresh token dùng cookie `HttpOnly`.
- JWT session version được kiểm tra lại với DB.
- `helmet` và CORS allowlist được cấu hình.
- Zod validate request payload/query/params.
- Admin API bắt buộc role `ADMIN`.
- Owner guard áp dụng cho update/delete post và media.
- Upload kiểm tra MIME, kích thước và file signature.
- Gemini key chỉ dùng server-side.

Khoảng trống cần hardening:

- Bổ sung integration test với MySQL cho auth/post/media/matching permissions.
- Chuyển media sang object storage dùng chung.
- Chuẩn hóa lỗi file media không còn tồn tại thành 404 thay vì lỗi 500 không xử lý.
- Bổ sung audit log cho admin catalog writes.
- Thêm readiness check cho DB/SMTP/Gemini tùy môi trường.

## 10. Kiểm thử

Hiện có:

- Unit tests cho auth validation/security, CORS và media signature.
- Unit tests cho Gemini category mapping/multi-image behavior.
- Unit tests cho matching score, tier, cap và redaction.
- Playwright tests cho home responsive, board/filter/detail và storytelling create-post flow.
- TypeScript build cho API và web.

Chưa có:

- API integration test chạy trên MySQL isolated.
- E2E auth OTP thật với SMTP sandbox.
- Concurrency tests cho claim/appointment vì runtime chưa triển khai.
- Load test và query-plan benchmark.
- CI workflow trong codebase mới.

## 11. Roadmap hợp lý

Thứ tự phát triển được đề xuất:

1. Hoàn thiện shared object storage và media error handling.
2. Thêm API integration tests + CI.
3. Triển khai claim/evidence với privacy và transaction lock.
4. Triển khai appointment/handover.
5. Triển khai warehouse lifecycle.
6. Thêm notification/realtime sau khi claim flow ổn định.
7. Mở rộng admin/staff dashboard.
8. Chỉ sau đó cân nhắc Java ownership cho một domain riêng.
9. Mobile và custom model training để future scope.

## 12. Cách trình bày đồ án

Nên nói:

> Nhóm đang xây dựng web/backend MVP cho Lost & Found campus. Phiên bản hiện tại đã hoàn thành authentication, quản lý bài LOST/FOUND, Gemini-assisted draft và rule-based/hybrid matching có giải thích. Các bước claim, verification, appointment và warehouse là roadmap tiếp theo; Java hiện là extension skeleton.

Không nên nói:

- “Toàn bộ flow Lost & Found đã production-ready.”
- “Hệ thống dùng custom AI model đã train.”
- “Node và Java là production microservices hoàn chỉnh.”
- “Media đã dùng Cloudinary” khi runtime còn lưu filesystem local.
- “Mobile đã hoàn thành.”

## 13. Tài liệu liên quan

- [Requirements](requirements.md)
- [Business rules](business-rules.md)
- [Traceability matrix](traceability-matrix.md)
- [Use case checklist](use-case-checklist.md)
- [Node.js/Java boundary](node-java-service-boundary.md)
