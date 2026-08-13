# FPTU Lost & Found System (LNFS)

Hệ thống quản lý đồ thất lạc dành cho FPT University Da Nang. LNFS hỗ trợ sinh viên, giảng viên, staff và admin đăng bài LOST/FOUND, tìm kiếm đồ vật, nhận gợi ý matching, gửi claim kèm bằng chứng, đặt lịch nhận đồ và quản lý đồ lưu kho.

## Phạm vi hệ thống

### Web application

* Đăng ký, đăng nhập, OTP email, quên mật khẩu và quản lý hồ sơ.
* Đăng/tìm kiếm/lọc bài LOST và FOUND.
* Upload ảnh đồ vật và quản lý bài đăng cá nhân.
* Matching suggestion giữa các bài LOST/FOUND.
* Claim đồ vật, upload evidence và theo dõi trạng thái claim.
* Appointment, handover point và quy trình nhận/trả đồ.
* Realtime chat và notification.
* Admin: quản lý user, role, category, khu vực, handover point, warehouse, cấu hình, moderation, dashboard và export statistics.
* Feedback, reputation và activity history.

### Mobile application

* Authentication, profile và avatar.
* Xem board, tìm kiếm/lọc, xem chi tiết bài đăng.
* Tạo và quản lý bài LOST/FOUND từ mobile.
* Upload ảnh từ camera hoặc gallery.
* Claim, evidence, appointment, handover map, realtime chat và notification.

### AI/OCR assistance

* Phân tích ảnh đồ vật, OCR evidence, gợi ý tag/category.
* Hỗ trợ matching và review confidence.
* AI/OCR chỉ đóng vai trò hỗ trợ quyết định; không tự động xác nhận chủ sở hữu hoặc auto-accept claim.

## Architecture

* **Frontend Web:** React + TypeScript.
* **Mobile:** Mobile client sử dụng API chung của LNFS.
* **Core API:** Node.js + Express.
* **Business/Admin extension:** Java Spring Boot.
* **Database:** MySQL 8+.
* **Media storage:** Cloudinary.
* **Realtime:** Socket.IO.
* **Email:** Gmail SMTP với App Password.

### Runtime ownership

Node.js là core API và owner chính của authentication, posts, media, matching, Socket.IO, notifications, migrations và các write flow hiện tại.

Java Spring Boot được dùng cho các business/admin extension như claim transition, handover, warehouse và AI/OCR integration.

Mỗi business flow chỉ có **một runtime writer**. Không được để Node.js và Java cùng ghi dữ liệu/state cho cùng một flow.

## Roles

| Role       | Description                            |
| ---------- | -------------------------------------- |
| `USER`     | Người dùng đã đăng ký hệ thống         |
| `STUDENT`  | Sinh viên FPT University               |
| `LECTURER` | Giảng viên FPT University              |
| `STAFF`    | Nhân viên hỗ trợ vận hành Lost & Found |
| `ADMIN`    | Quản trị viên hệ thống                 |

## Requirements

* Node.js 20+
* MySQL 8+
* Java 21 + Maven
* Gmail account đã bật 2-Step Verification để tạo App Password
* Cloudinary account nếu chạy upload media thật

## Configuration

1. Tạo file `.env` từ `.env.example` tại root project.
2. Điền cấu hình MySQL, JWT, SMTP, Cloudinary và các service cần thiết.
3. Không commit `.env`, certificate, password, token hoặc credentials lên Git.

Ví dụ cấu hình Gmail SMTP:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@gmail.com
SMTP_PASS=your-16-character-gmail-app-password
SMTP_FROM="FPTU Lost & Found <your-gmail-address@gmail.com>"
```

Không dùng mật khẩu Gmail chính. Vào Google Account → Security → 2-Step Verification → App passwords để tạo App Password.

## Shared cloud database

Nhóm dùng chung MySQL cloud cho môi trường development. Mỗi thành viên chạy web/API trên máy riêng, nhưng `.env` trỏ đến cùng database cloud.

Ví dụ:

```env
DB_HOST=mysql-your-service.aivencloud.com
DB_PORT=14025
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=your-cloud-password
DB_SSL=true
DB_SSL_CA_PATH=certs/aiven-ca.pem
```

Quy tắc database chung:

* Không dùng `DROP DATABASE`, `TRUNCATE` hoặc sửa schema thủ công.
* Mọi thay đổi schema phải đi qua migration mới.
* Chỉ một người chạy migration trên database chung sau khi đã review.
* Không commit certificate hoặc credentials.
* Dùng account demo riêng khi test; không dùng account admin cá nhân để test chung.
* Nếu cần seed/demo data, dùng database riêng như `team_demo`.

## Run locally

```bash
npm install
npm run check:env
npm run migrate
npm run dev
```

Default URLs:

* Web: `http://localhost:5173`
* Node API health: `http://localhost:3001/api/health`
* Java health service: `http://localhost:8081/actuator/health`

## Testing

```bash
npm test
npm run build
```

Trước khi chuyển ticket sang Done:

1. Chạy test liên quan và tự test chức năng.
2. Tạo branch theo format `feature/LNFS-xx-short-name`.
3. Commit có Jira key, ví dụ: `feat(LNFS-52): add claim evidence validation`.
4. Tạo Pull Request và gắn link PR vào Jira.
5. Cập nhật checklist, status và test evidence trong ticket.

## Core API modules

| Module                 | Main capabilities                                                              |
| ---------------------- | ------------------------------------------------------------------------------ |
| Authentication         | OTP registration, login, refresh token, logout, password reset, profile        |
| Posts & Media          | LOST/FOUND posts, search/filter, upload/delete media, board                    |
| Matching               | Normalize text, calculate match score, save suggestions and explanation        |
| Claims                 | Submit claim, evidence, duplicate prevention, review workflow                  |
| Handover & Appointment | Handover points, appointments, receipt/return flow                             |
| Warehouse              | Stored items, condition logs, retention deadline, overdue handling             |
| Realtime               | Claim chat, images, seen/unread, notifications                                 |
| Admin                  | User/role, category, area, configuration, moderation, dashboard, report export |
| AI/OCR                 | Image analysis, OCR, tags, category suggestion and review confidence           |

## Security notes

* API không trả OTP, password hoặc refresh token trong JSON/log.
* Refresh token chỉ lưu trong cookie `HttpOnly`.
* `COOKIE_SECURE=false` chỉ dùng khi local HTTP.
* Khi deploy HTTPS, đặt `COOKIE_SECURE=true` và cấu hình đúng `FRONTEND_URL`.
* Media private không được public raw URL; chỉ truy cập qua cơ chế được xác thực.
* Chỉ owner được sửa/xóa bài đăng của mình.
* Admin-only endpoints phải kiểm tra role; `STAFF` không được có quyền tương đương `ADMIN`.

## Team workflow

* Jira quản lý backlog, sprint, task và trạng thái công việc.
* Discord dùng cho announcement, daily scrum, dev discussion và review.
* Git dùng branch, commit và Pull Request để theo dõi contribution.
* Mỗi người chỉ làm và đặc tả Use Case thuộc chức năng mình phụ trách.
* Không chuyển ticket sang Done nếu chưa có commit/PR, test evidence và Jira checklist.

## Reference project

Codebase này được xây mới, chỉ tham khảo project cũ về workspace structure, controller/service/repository separation, sequential migrations và API conventions.

Không sao chép `node_modules`, `.git`, `.env`, credentials, database dump, dữ liệu người dùng hoặc lịch sử commit.
