# FPTU Lost & Found System

Web Application with Progressive Web App (PWA) support cho quy trình báo mất và báo nhặt đồ tại FPT University Đà Nẵng.

Current implementation baseline gồm authentication, LOST/FOUND posts, Gemini-assisted image/OCR draft, rule-based/hybrid matching có giải thích và Staff warehouse operations. Claim, evidence review, appointment, warehouse disposition, realtime và PWA infrastructure tiếp tục được hoàn thiện theo kế hoạch 9 sprint.

## Chức năng hiện có

- Đăng ký bằng email OTP qua Gmail/SMTP.
- Đăng nhập, JWT access token, refresh token cookie, logout.
- Quên/đặt lại mật khẩu và profile cơ bản.
- Role guard cho User/Student/Lecturer/Staff/Admin.
- Storytelling home tích hợp form tạo LOST/FOUND post.
- Board, My Posts, tìm kiếm/lọc/sắp xếp, post detail.
- Category hai cấp, area/building và public active-only handover-point catalog.
- Upload/xóa ảnh bài đăng qua protected media endpoint.
- `PRIVATE_DETAILS` cho bài FOUND.
- Gemini-assisted multi-image analysis tạo bản nháp chỉnh sửa được.
- Hybrid matching dùng text/category/location/time/image/safe OCR tags.
- Lưu score tier, explanation và manual recalculation.
- Admin CRUD category, area, building và điểm bàn giao; hỗ trợ ảnh map, kéo marker, giờ hoạt động, trạng thái và hard-delete guard.
- Staff warehouse operations: tiếp nhận, lưu/trả vật phẩm, retention deadline, thống kê điểm bàn giao và storage log.
- Responsive web cho desktop/mobile browser với Playwright mobile viewport checks.

## Chưa hoàn thành

- Claim/evidence, appointment, warehouse overdue/disposition, notification và Socket.IO chat.
- Admin user management, moderation, report, config và dashboard toàn hệ thống.
- Shared object storage; media hiện lưu local filesystem.
- Java business endpoints; Java hiện chỉ có health-check skeleton.
- PWA manifest, service worker, installability và safe offline/error fallback.
- Native mobile app và custom-trained AI model là future enhancements.

## Công nghệ

| Layer | Công nghệ |
| --- | --- |
| Web/PWA | React 18, TypeScript, Vite, React Router; PWA infrastructure đang Planned/Partial |
| Core API | Node.js, Express, TypeScript |
| Database | MySQL 8+ |
| Email | SMTP/Gmail App Password |
| Image assistance | Gemini API, tùy chọn |
| Current media storage | Protected local filesystem |
| Java | Spring Boot Actuator skeleton |
| Tests | Node test runner, TypeScript, Playwright |

Node.js là runtime/write owner duy nhất. Xem [ranh giới Node.js và Java](docs/node-java-service-boundary.md).

## Yêu cầu môi trường

- Node.js 20+
- npm 10+
- MySQL 8+ hoặc Aiven MySQL
- Gmail account đã bật 2-Step Verification và App Password nếu test email thật
- Java 21 + Maven chỉ khi chạy Java health skeleton

## Cấu hình

1. Cài dependencies:

```bash
npm install
```

2. Tạo `.env` ở root từ `.env.example`.

3. Điền các nhóm biến:

- `DB_*`: MySQL connection.
- `JWT_ACCESS_SECRET`: chuỗi bí mật dài và riêng cho môi trường.
- `SMTP_*`: SMTP host/user/App Password/from.
- `GEMINI_*`: tùy chọn, chỉ đặt server-side.
- `UPLOAD_DIR`: thư mục media local hiện tại.

Không commit `.env`, CA certificate, password, API key hoặc token. Nếu secret từng xuất hiện trong ảnh/chat/log công khai, hãy rotate secret đó.

### Gmail SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-address@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="FPTU Lost & Found <your-address@gmail.com>"
```

Không dùng mật khẩu Gmail chính.

### Gemini

```env
GEMINI_API_KEY=your-server-side-key
GEMINI_MODEL=your-supported-gemini-model
GEMINI_TIMEOUT_MS=30000
```

API key không được đặt trong biến `VITE_*`. Nếu provider chưa cấu hình hoặc lỗi, user vẫn có thể nhập form thủ công.

### Aiven MySQL

```env
DB_HOST=your-service.aivencloud.com
DB_PORT=your-port
DB_NAME=defaultdb
DB_USER=your-user
DB_PASSWORD=your-password
DB_SSL=true
DB_SSL_CA_PATH=certs/aiven-ca.pem
```

CA certificate và `.env` phải nằm ngoài Git. Không tắt TLS verification để né lỗi certificate.

## Migration

```bash
npm run check:env
npm run migrate
```

Migration runner lưu checksum sau khi toàn bộ file migration chạy thành công. Vì MySQL DDL có thể auto-commit, runner còn lưu trạng thái vào `schema_migration_attempts`. Nếu một lần chạy bị dở dang, runner sẽ dừng và yêu cầu kiểm tra/reconcile schema thủ công; hệ thống không tự rollback hoặc tự chạy lại một migration có khả năng đã áp dụng một phần.

Nếu gặp `Migration checksum mismatch`, không sửa/bypass migration đã chạy; hãy khôi phục nội dung gốc hoặc tạo migration mới. Nếu gặp `incomplete attempt`, đọc migration được nêu trong lỗi, đối chiếu schema thực tế rồi chỉ xóa attempt marker sau khi đã xử lý an toàn.

Quy tắc khi dùng DB chung:

1. Chỉ một thành viên chạy migration sau khi PR được review.
2. Không `DROP`, `TRUNCATE` hoặc sửa schema thủ công.
3. Không chạy test destructive trên shared DB.
4. Tách database dev/demo/test khi có thể.

## Chạy local

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- Liveness: `http://localhost:3001/api/health`
- Readiness (kiểm tra DB): `http://localhost:3001/api/ready`

Chạy riêng:

```bash
npm run dev:web
npm run dev:api
```

Java health skeleton:

```bash
npm run dev:java
```

## Test và build

```bash
npm test
npm run build
npm --workspace @lnfs/web run e2e:home
```

DB integration tests chỉ được chạy với một MySQL local riêng; script từ chối host remote/Aiven và yêu cầu tên database kết thúc bằng `_test`:

```powershell
$env:LNFS_DB_INTEGRATION="1"
$env:LNFS_TEST_DB_HOST="127.0.0.1"
$env:LNFS_TEST_DB_PORT="3306"
$env:LNFS_TEST_DB_NAME="lnfs_integration_test"
$env:LNFS_TEST_DB_USER="your_test_user"
$env:LNFS_TEST_DB_PASSWORD="your_test_password"
npm --workspace @lnfs/api-node run test:db-integration
```

Không trỏ các biến `LNFS_TEST_DB_*` vào Aiven/shared DB.

Playwright có thể cần cài browser lần đầu:

```bash
npx playwright install chromium
```

## Lưu ý media khi làm việc nhóm

Post media đang được ghi vào `UPLOAD_DIR` trên từng máy, trong khi metadata nằm trong MySQL. Nếu cả nhóm dùng chung Aiven DB, ảnh do máy A upload sẽ không tự xuất hiện trên máy B. Khi đó API có thể gặp file reference không tồn tại.

Giải pháp ngắn hạn là cùng test trên một API host có persistent volume. Giải pháp đúng trước staging là chuyển sang Cloudinary/S3-compatible shared object storage và vẫn bảo vệ private media bằng signed/authenticated access.

## Cấu trúc

```text
apps/
  api-node/            Node.js core API và migrations
  web/                 React web app
  java-admin-service/  Spring Boot health skeleton
docs/                  Tài liệu phạm vi, requirement, rules và checklist
scripts/               Kiểm tra môi trường
```

## Tài liệu

Bắt đầu tại [docs/README.md](docs/README.md).

- [Project overview](docs/project-overview.md)
- [Requirements](docs/requirements.md)
- [Business rules](docs/business-rules.md)
- [Traceability](docs/traceability-matrix.md)
- [Use-case checklist](docs/use-case-checklist.md)

## Cách mô tả trung thực

> LNFS là Web Application with PWA support đang được phát triển cho Lost & Found campus. Current implementation đã có authentication, post management, Gemini-assisted image/OCR draft, hybrid matching và Staff warehouse operations; claim, appointment, realtime, PWA infrastructure và server deployment đang được hoàn thiện. Native mobile và custom model training là future enhancements.
