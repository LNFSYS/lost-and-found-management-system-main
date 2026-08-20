# FPTU Lost & Found System

Web/backend MVP cho quy trình báo mất và báo nhặt đồ tại FPT University Đà Nẵng.

Phiên bản hiện tại tập trung vào authentication, LOST/FOUND posts, Gemini-assisted image draft và rule-based/hybrid matching có giải thích. Claim, evidence review, appointment, warehouse và realtime là các sprint tiếp theo, chưa phải chức năng runtime hoàn chỉnh trong codebase mới.

## Chức năng hiện có

- Đăng ký bằng email OTP qua Gmail/SMTP.
- Đăng nhập, JWT access token, refresh token cookie, logout.
- Quên/đặt lại mật khẩu và profile cơ bản.
- Role guard cho User/Student/Lecturer/Staff/Admin.
- Storytelling home tích hợp form tạo LOST/FOUND post.
- Board, My Posts, tìm kiếm/lọc/sắp xếp, post detail.
- Category hai cấp, area/building và handover-point catalog.
- Upload/xóa ảnh bài đăng qua protected media endpoint.
- `PRIVATE_DETAILS` cho bài FOUND.
- Gemini-assisted multi-image analysis tạo bản nháp chỉnh sửa được.
- Hybrid matching dùng text/category/location/time/image/safe OCR tags.
- Lưu score tier, explanation và manual recalculation.
- Admin CRUD category, area và building.

## Chưa hoàn thành

- Claim/evidence, appointment, warehouse, notification và Socket.IO chat.
- Staff operations dashboard; route hiện tại mới là placeholder.
- Admin user management, moderation, report, config và dashboard toàn hệ thống.
- Shared object storage; media hiện lưu local filesystem.
- Java business endpoints; Java hiện chỉ có health-check skeleton.
- Mobile và custom-trained AI model.

## Công nghệ

| Layer | Công nghệ |
| --- | --- |
| Web | React 18, TypeScript, Vite, React Router |
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

Migration runner lưu checksum. Nếu gặp `Migration checksum mismatch`, không sửa/bypass migration đã chạy; hãy khôi phục nội dung gốc hoặc tạo migration mới.

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
- Health: `http://localhost:3001/api/health`

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

> Đây là web/backend MVP đang phát triển cho Lost & Found campus. Authentication, post management, Gemini-assisted draft và hybrid matching đã có; claim, verification, appointment, warehouse, realtime, Java business extension và mobile là các bước tiếp theo.
