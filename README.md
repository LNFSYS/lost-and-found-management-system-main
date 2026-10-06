# FPTU Lost & Found System

## Định vị sản phẩm

**Software type:** Web Application with Progressive Web App (PWA) support and a Native Mobile Application.

LNFS là hệ thống Lost & Found cho FPT University Đà Nẵng. Sản phẩm mục tiêu có ba kênh dùng chung backend, authentication, authorization, validation, privacy rules và business state transitions:

- **Web Application:** kênh hiện có, dùng trên desktop/laptop và cung cấp các màn hình vận hành Staff/Admin.
- **PWA:** phần mở rộng của web responsive, hướng tới installability, offline application shell và camera/gallery trên mobile browser. Không gọi PWA là native app và không giả định toàn bộ workflow chạy offline.
- **Native Mobile Application:** phạm vi sản phẩm bắt buộc theo kế hoạch, nhưng **chưa có project hoặc implementation evidence trong repository hiện tại**; trạng thái là `Planned — project not created yet`.

Current repository là baseline Web + Node.js API. Native Mobile, PWA infrastructure và các workflow peer-return nâng cao được theo dõi riêng trong tài liệu để không nhầm planned scope với tính năng đã triển khai.

## Baseline hiện tại

Đã có code runtime và bằng chứng test phù hợp cho:

- Đăng ký email OTP qua SMTP, đăng nhập password, JWT access/refresh, logout, forgot/reset password và profile cơ bản.
- Role guard `USER`, `STUDENT`, `LECTURER`, `STAFF`, `ADMIN`; Admin và Staff có vùng vận hành khác nhau.
- Tạo/cập nhật/đóng/xóa mềm bài `LOST` và `FOUND`, board, bài của tôi, chi tiết bài, tìm kiếm, lọc, sắp xếp và phân trang.
- Category hai cấp, khu vực, tòa nhà và điểm bàn giao active-only; Admin quản lý điểm bàn giao, ảnh map, marker, giờ hoạt động và hard-delete guard.
- Upload media bài đăng qua local protected media proxy, có kiểm tra loại, kích thước và file signature.
- Gemini-assisted multi-image analysis tạo bản nháp có thể chỉnh sửa; không tự đăng bài và không tự xác minh quyền sở hữu.
- Hybrid/rule-based matching với text normalization tiếng Việt, category, location, time, image/OCR tags, tier, score breakdown và explanation.
- Claim peer-to-peer, participant authorization, private text/image room, guided ownership questions, explicit Finder decision, unread/read, private evidence proxy và in-app notifications đã có runtime. SSE backend có; immediate Web chat subscriber/PWA push còn thiếu.
- Local lịch hẹn có danh sách/chi tiết, đề xuất thời gian/điểm, accept/reject/cancel, nhắc email, no-show và xác nhận bàn giao hai bên; Admin có audit search/export, User có hành trình vật phẩm từ Bài của tôi. Migration 063 chưa áp dụng Aiven; xem [rollout và bằng chứng](docs/runbooks/appointment-journey-rollout.md).
- Staff warehouse operations: tiếp nhận, lưu, trả, retention deadline, handover counts và storage log.

Các mục trên là **current implementation baseline**, không đồng nghĩa mọi workflow trong product scope đã hoàn tất end-to-end.

## Phạm vi mục tiêu

Luồng nghiệp vụ mục tiêu là:

`LOST/FOUND post → matching suggestion → claim/private verification chat → finder decision → meetup → dual-confirmed direct handover`

Staff custody/warehouse là nhánh hỗ trợ hoặc escalation khi Finder không thể tiếp tục giữ đồ, có dispute, item nhạy cảm/nguy hiểm hoặc policy yêu cầu chuyển vào kho. Basic appointment và dual physical handover đã có local runtime; counter-proposal/rescheduling, realtime Web delivery và PWA/native mobile nâng cao vẫn chưa hoàn tất. Matching ảnh hỗ trợ trao đổi, không thay thế kiểm tra vật lý hoặc cho phép Staff trả đồ.

## Trạng thái chưa có runtime evidence

- Automated evidence confidence và multiple-claimant reservation policy end-to-end.
- Counter-proposal và mutually agreed rescheduling; basic booking/dual-confirmation có local code, shared schema/deployment và manual UAT chưa hoàn tất.
- Immediate Web chat SSE subscriber và full PWA notification/push matrix; image message và persisted unread/read đã có.
- Overdue disposition, donation/transfer/disposal document flow và dispute escalation.
- PWA installability và browser/device verification đầy đủ; manifest, service worker, offline shell và mobile-browser flow đã có ở mức hiện tại.
- Native Mobile Application.
- Custom-trained AI model, MLOps hoặc production model registry.
- Full rollout media ngoài kho: Cloudinary authenticated/protected proxy đã có; legacy local reads và local fallback theo từng module vẫn cần theo dõi riêng. Không chạy lại đợt 16 ảnh kho đã chuyển.

## Kiến trúc hiện tại

```text
Web / PWA -> Node.js + TypeScript modular monolith -> MySQL
                 main: constructs and injects adapters
                 interfaces/http -> application -> domain
                 infrastructure -> application ports
                 adapters: SMTP, Gemini, Cloudinary, private local media
Native Mobile (planned) -> same API/auth/business rules
```

Node.js là backend, business-write owner và migration owner duy nhất. Toàn bộ Java skeleton/build đã được gỡ; không có microservice Java. Xem [Clean Architecture và dependency rules](docs/architecture/CLEAN_ARCHITECTURE.md), [mapping source](docs/architecture/CLEAN_ARCHITECTURE_FILE_MAP.md) và [draw.io ba trang](docs/architecture/LNFS_NODE_ONLY_ARCHITECTURE.drawio).

## Yêu cầu môi trường

- Node.js 20+
- npm 10+
- MySQL 8+ hoặc Aiven MySQL có TLS
- SMTP provider và Gmail App Password nếu cần gửi email thật
- Gemini API key tùy chọn, chỉ đặt server-side

## Cấu hình local

```bash
npm install
```

Tạo `.env` ở root từ `.env.example`, sau đó điền `DB_*`, `JWT_*`, `SMTP_*` và tùy chọn `GEMINI_*`. Không commit `.env`, API key, password, token hoặc CA certificate. Nếu credential từng bị lộ, cần rotate ngay; không đưa secret vào issue, log hoặc tài liệu.

Ví dụ Aiven MySQL:

```env
DB_HOST=your-service.aivencloud.com
DB_PORT=your-port
DB_NAME=defaultdb
DB_USER=your-user
DB_PASSWORD=your-password
DB_SSL=true
DB_SSL_CA_PATH=certs/aiven-ca.pem
```

Không tắt TLS verification để né lỗi certificate. Khi dùng database chung, chỉ một người được chạy migration sau khi review; không chạy test destructive trên database chung. Nên tách database dev/demo/test.

### Migration reconciliation

Với database cũ có claim được tạo trước khi participant được backfill đầy đủ, chạy lệnh idempotent sau một lần trước khi migrate:

```bash
npm run migrate:repair-claim-participants
```

Lệnh chỉ bổ sung participant còn thiếu, không xóa hoặc cập nhật claim hiện có. Trường hợp self-claim (người nhận và người đăng là cùng tài khoản) được xem là hợp lệ theo khóa `(claim_id, user_id)`.

Trước khi migrate DB đã dùng nhánh claim cũ, chạy `npm run migrate:reconcile-claim` (mặc định **read-only dry-run**).
Nếu kết quả là `READY`, DB còn tên `040_peer_claim_conversations.sql` trong khi source dùng `045`; không chạy lại DDL đó.
Công cụ chỉ đối soát alias này sau khi kiểm tra checksum, columns/defaults, generated expression, indexes, foreign keys và participant backfill.
Apply cần backup/restore rehearsal, maintenance window, phê duyệt của DB owner và xác nhận endpoint/database cụ thể.
Quy trình, SQL và trạng thái Aiven nằm trong [báo cáo reconciliation 07/09](docs/archive/AIVEN_SCHEMA_RECONCILIATION_2026-09-07.md).

Runner kiểm tra toàn bộ ledger trước DDL, dùng một connection giữ named lock theo database cho cả phiên migration.
DDL MySQL không rollback toàn bộ được; attempt lỗi phải điều tra schema trước khi retry.
`migrate:diagnose-checksums` chỉ đọc; `migrate:repair-checksums` bị chặn để không ghi đè checksum hàng loạt.

## Chạy và kiểm tra

```bash
npm run check:env
npm run migrate
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- Liveness: `http://localhost:3001/api/health`
- Readiness: `http://localhost:3001/api/ready`

Các lệnh kiểm tra có sẵn:

```bash
npm test
npm run build
npm run check:architecture
npm --workspace @lnfs/web run e2e:home
```

Database integration test chỉ được trỏ vào MySQL local riêng có tên kết thúc bằng `_test`; không dùng Aiven/shared DB. `npm --workspace @lnfs/api-node run test:db-integration` chạy cả runtime và migration upgrade tests khi `LNFS_DB_INTEGRATION=1` cùng `LNFS_TEST_DB_*` được cấu hình. Migration suite tạo/xóa database test ngẫu nhiên riêng, nên test user cần quyền CREATE/DROP DATABASE trên MySQL isolated. CI cấu hình MySQL 8.0/8.4 và browser job Playwright. Dependency direction và circular dependency được kiểm tra tự động trong `npm test`.


## Media và làm việc nhóm

Metadata media nằm trong MySQL; bytes ảnh không nằm trong Aiven. Avatar và các adapter post/claim/kho dùng Cloudinary `authenticated`; private media được đọc qua proxy kiểm tra quyền, không gửi signed provider URL cho client.

Ảnh tiếp nhận và ảnh trả đồ của kho trên production không ghi fallback local: thiếu cấu hình hoặc Cloudinary lỗi sẽ báo lỗi. Adapter vẫn hỗ trợ đọc reference local cũ. Đợt rollout kho đã chuyển 16 reference sau backup/restore và giữ nguyên file nguồn; không có nghĩa toàn bộ ảnh post/claim đã migrate.

Post/claim còn fallback ghi local khi chưa cấu hình Cloudinary; kho chỉ cho phép fallback ghi local ngoài production. Những reference local cần đúng volume `UPLOAD_DIR`, nên chưa có bảo đảm đọc được giữa hai instance không dùng chung disk. Xem [rollout ảnh kho](docs/runbooks/warehouse-media-rollout.md) và [đối soát upload chưa rõ kết quả](docs/runbooks/media-upload-reconciliation.md). Bằng chứng kiểm thử có kiểm soát không thay thế nghiệm thu cấu hình/deployment thực tế.

## Tài liệu chính

- [Tài liệu index](docs/README.md)
- [Kế hoạch xử lý các vấn đề UAT 06/10](docs/plans/uat-repair-plan-2026-10-06.md)
- [Báo cáo kiểm thử thực tế 06/10](docs/audits/real-workflow-uat-2026-10-06.md)
- [Tổng quan dự án](docs/overview/project-overview.md)
- [Quy trình nghiệp vụ A–Z](docs/overview/LNFS_BUSINESS_PROCESS_A_TO_Z.md)
- [Requirements](docs/requirements/requirements.md)
- [Business rules](docs/requirements/business-rules.md)
- [Traceability matrix](docs/requirements/traceability-matrix.md)
- [Use-case catalogue](docs/requirements/uc.md)
- [Notification email rules](docs/workflows/notification-email-rules.md)
- [Clean Architecture](docs/architecture/CLEAN_ARCHITECTURE.md)
- [Lịch sử đối soát schema](docs/archive/AIVEN_SCHEMA_RECONCILIATION_2026-09-07.md)
- [Phạm vi lọc tài liệu và rollout 06/10](docs/audits/dev-main-release-2026-10-06.md)

## Cách trình bày trung thực

> LNFS là Web Application với định hướng PWA và Native Mobile dùng chung backend. Baseline hiện tại tập trung vào authentication, LOST/FOUND post, catalog, Gemini-assisted draft, hybrid matching và Staff warehouse operations. Peer-to-peer verification, realtime, PWA infrastructure và Native Mobile được quản lý theo trạng thái implementation thực tế; custom AI training là hướng nghiên cứu mở rộng.
