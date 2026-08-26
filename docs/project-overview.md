# Tổng quan dự án FPTU Lost & Found System

Cập nhật: 26/08/2026

## 1. Định vị dự án

FPTU Lost & Found System là **Web Application with Progressive Web App (PWA) support** dành cho quy trình Lost & Found tại FPT University Đà Nẵng. Hệ thống hỗ trợ sinh viên, giảng viên và bộ phận vận hành ghi nhận đồ mất/nhặt được, tìm báo cáo liên quan, quản lý kho và từng bước hoàn thiện quy trình xác minh, hẹn lịch và bàn giao.

**Current implementation baseline** đã có authentication, quản lý bài LOST/FOUND, Gemini-assisted image/OCR analysis, rule-based/hybrid matching và một operational warehouse flow trên Node.js. Claim/evidence, appointment, warehouse disposition, realtime và PWA infrastructure vẫn nằm trong planned complete product scope.

Current delivery channel là responsive web. Native mobile app là future enhancement; PWA chưa được xem là hoàn thành cho đến khi có manifest, service worker, installability, offline/error fallback và browser/device verification. Không mô tả dự án hiện tại là production-ready, production microservices hoặc custom-trained AI system.

LNFS chọn hướng PWA vì người dùng thường truy cập dịch vụ Lost & Found khi phát sinh nhu cầu cụ thể, không nhất thiết cài một native app dùng hằng ngày. Một shared web codebase có thể cung cấp trải nghiệm responsive, dễ tiếp cận và có khả năng cài đặt sau khi PWA infrastructure hoàn thiện.

## 2. Bài toán

Quy trình Lost & Found thủ công trong campus thường gặp các vấn đề:

- Thông tin mất/nhặt đồ nằm rải rác ở nhiều nhóm và phòng ban.
- Người dùng khó tìm bài đối ứng nếu cách mô tả khác nhau.
- Người nhặt được đồ không biết nên cung cấp thông tin nào mà vẫn bảo vệ chi tiết nhận dạng.
- Dữ liệu danh mục và địa điểm không đồng nhất.
- Việc trả đồ cần một quy trình xác minh của con người, không thể dựa hoàn toàn vào điểm matching.

Current release giải quyết phần đầu và một phần vận hành của hành trình: tạo dữ liệu có cấu trúc, hỗ trợ điền bài từ ảnh, hiển thị board, tính gợi ý tương đồng có giải thích và tiếp nhận/lưu/trả vật phẩm trong kho nội bộ.

## 3. Actor và quyền hiện tại

| Actor/role | Khả năng hiện có |
| --- | --- |
| Guest | Truy cập trang auth; board hiện nằm sau route guard trong web hiện tại |
| `USER` | Quyền nền được gán cho tài khoản đã đăng ký |
| `STUDENT` | Đăng nhập, hồ sơ, tạo/quản lý bài, xem board và matching của bài được phép |
| `LECTURER` | Cùng nhóm chức năng người dùng như Student |
| `STAFF` | Quản lý warehouse item, trạng thái, retention deadline, điểm bàn giao và storage log; không truy cập Admin catalog API |
| `ADMIN` | Quản lý category, area và building; truy cập admin route |

Backend luôn là nơi quyết định quyền. Frontend route guard chỉ hỗ trợ trải nghiệm và không thay thế authorization ở API.

## 4. Phạm vi sản phẩm

### 4.1 Current implementation baseline

Đã triển khai và có runtime evidence:

- Đăng ký bằng email OTP qua SMTP.
- Đăng nhập email/password.
- JWT access token và refresh token cookie `HttpOnly`.
- Refresh, logout, forgot/reset password.
- Xem và cập nhật profile cơ bản.
- JWT middleware và role guard.
- Tạo, cập nhật trạng thái và xóa mềm bài `LOST`/`FOUND`.
- Board, tìm kiếm, lọc, sắp xếp, phân trang, bài của tôi và trang chi tiết.
- Category hai cấp: nhóm chính và danh mục cụ thể.
- Area/building catalog và danh sách handover point đang hoạt động cho form tạo bài.
- Upload, đọc qua media proxy và xóa ảnh bài đăng.
- Chế độ `PRIVATE_DETAILS` cho bài `FOUND` với serializer hạn chế dữ liệu public.
- Gemini-assisted image analysis cho tối đa 5 ảnh, trả bản nháp có thể chỉnh sửa.
- Rule-based/hybrid matching có text, category, location, time, image tags và safe OCR tags.
- Lưu kết quả matching, score tier, explanation và manual recalculation có rate limit.
- Admin CRUD category, area, building và handover point; quản lý ảnh map, marker, giờ hoạt động, contact và active state.
- Staff warehouse operations: list/filter, receive, store, return, retention deadline, item count theo handover point và storage log.
- React Router cho các route auth, home, board, my posts, detail, matching, profile, staff và admin.
- Responsive layouts và mobile viewport browser tests cho các màn hình chính.

### 4.2 Current implementation status: Partial

- Admin dashboard: mới có số liệu và CRUD catalog, chưa có users/moderation/report/config toàn hệ thống.
- Handover point: public endpoint/form chỉ đọc điểm active; Admin có CRUD/toggle, upload/URL ảnh map, marker picker, stored-item count và guard hard-delete khi còn active appointment.
- Media privacy: proxy/authorization có nền tảng, nhưng storage là local filesystem nên chưa phù hợp nhiều máy hoặc deploy nhiều instance.
- Warehouse: receive/store/return và logs đã chạy; overdue scanning, disposition guard, donation/transfer documents và liên kết claim/appointment chưa hoàn chỉnh.
- PWA: responsive web và mobile browser checks đã có; manifest, service worker, installability và offline shell chưa có.
- Database: có nhiều bảng dành cho planned scope, nhưng schema không được xem là runtime implementation.
- Test: có unit test, Playwright UI tests và DB integration suite opt-in có guard local-only; chưa có integration coverage cho toàn bộ endpoint hiện hành.

### 4.3 Planned complete product scope

- Claim, claim evidence và ownership review confidence.
- Appointment, handover completion và return feedback.
- Warehouse overdue/disposition workflow và chứng từ donation/transfer/disposal.
- Notification, Socket.IO chat và unread badge.
- Admin user/role management, moderation, reports, config history.
- Reputation/activity history.
- Java business endpoints.
- PWA manifest, service worker, install prompt, basic offline application shell và safe offline/error fallback.
- System integration, regression testing, server deployment, real-user feedback và release hardening.

### 4.4 Out of current development scope

- Native Android/iOS hoặc Expo/React Native application; đây là future enhancement sau Web + PWA.
- Custom model training/MLOps.

## 5. Kiến trúc hiện tại

```text
React + TypeScript + Vite
Responsive Web UI + planned PWA layer
(manifest, service worker, installability, offline shell)
        |
        | HTTP/JSON + HttpOnly refresh cookie
        v
Node.js + Express + TypeScript
        |
        +--> MySQL (schema, auth, posts, catalog, matching, warehouse)
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
- Responsive CSS; mobile viewport browser tests cho home và board.

PWA status hiện tại là `Partial`: repository chưa có manifest, service worker, install prompt hoặc offline application shell. File input hỗ trợ chọn/upload ảnh trong mobile browser, nhưng chưa có device compatibility evidence cho camera capture.

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
| `/staff` | Staff warehouse operations |
| `/admin` | Quản lý catalog dành cho Admin |

### 5.2 Node.js API

API nằm tại `apps/api-node` và chia theo route/controller/service/repository/validator.

Route family hiện hành:

- `/api/auth`: OTP, register, login, refresh, logout, password reset, profile.
- `/api/posts`: board, catalog, mine, image analysis, CRUD post, matching, media.
- `/api/staff`: warehouse catalog, list/create/update item và storage logs; yêu cầu `STAFF` hoặc `ADMIN`.
- `/api/admin`: CRUD category, area và building; toàn bộ route yêu cầu `ADMIN`.
- `/api/health`: liveness cơ bản.
- `/api/ready`: readiness kiểm tra kết nối MySQL và trả `503` không lộ chi tiết kết nối khi DB chưa sẵn sàng.

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

### 6.5 Staff warehouse operations

```text
Staff/Admin mở /staff
-> API kiểm tra JWT và role STAFF/ADMIN
-> Xem thống kê kho, số vật phẩm theo điểm bàn giao và danh sách có phân trang/lọc
-> Tiếp nhận vật phẩm với điểm bàn giao, tình trạng và thông tin vị trí
-> API tính retention deadline theo nhóm vật phẩm
-> Tạo warehouse item và storage log RECEIVED trong cùng transaction
-> Khi đổi trạng thái, API khóa row, kiểm tra state transition và yêu cầu storage code nếu STORED
-> Ghi actor, action, from/to status, condition/note và timestamp vào storage log
```

Flow hiện tại hỗ trợ receive/store/claim-state/return/expire/dispose/donate/transfer theo transition map, nhưng chưa có scheduler đánh dấu quá hạn, guard claim/appointment, chứng từ disposition hoặc complete claim-to-handover workflow. Vì vậy các UC overdue/disposition vẫn Planned.

## 7. Dữ liệu và migration

Migration Node.js là nguồn schema duy nhất. `schema_migrations` chỉ lưu checksum sau khi toàn bộ file chạy thành công. `schema_migration_attempts` ghi `RUNNING`/`FAILED`/`APPLIED` để phát hiện lần chạy có thể đã áp dụng DDL một phần; runner dừng và yêu cầu reconcile thủ công thay vì tuyên bố rollback an toàn hoặc tự retry phá dữ liệu.

Nhóm bảng đang được runtime sử dụng trực tiếp:

- `users`, `roles`, `user_roles`.
- `email_otps`, `refresh_tokens`, `password_reset_tokens`.
- `posts`, `post_media`, `ai_tags`, `match_results`.
- `item_categories`, `campus_areas`, `campus_buildings`; `handover_points` có public active-only read và Admin management runtime.
- `config_entries` cho một số matching weights/thresholds đọc nội bộ.

Runtime hiện dùng thêm `warehouse_items`, `storage_logs` và retention config cho Staff warehouse operations. Các bảng claim, appointment, notification, chat, reputation, radar, proof vault và finder scan vẫn là schema foundation; sự tồn tại của bảng không được dùng làm bằng chứng UC đã Done.

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

- Chạy và mở rộng DB integration suite trên MySQL local `_test` cho auth/post/media/matching permissions; suite từ chối Aiven/shared DB.
- Chuyển media sang object storage dùng chung.
- Bổ sung audit log cho admin catalog writes.
- Readiness hiện kiểm tra DB; SMTP/Gemini vẫn là dependency tùy chọn và chưa nằm trong readiness gate.

## 10. Kiểm thử

Hiện có:

- Unit tests cho auth validation/security, CORS và media signature.
- Unit tests cho Gemini category mapping/multi-image behavior.
- Unit tests cho matching score, tier, cap và redaction.
- HTTP integration tests cho malformed JSON, API 404 và liveness/readiness.
- Test transaction cho post/analysis tags, media slot locking và lỗi filesystem.
- DB integration suite opt-in, có guard chỉ cho MySQL local và database hậu tố `_test`.
- Playwright tests cho home responsive, board/filter/detail và storytelling create-post flow.
- Playwright tests cho thông báo reset password và logout khi API lỗi.
- Playwright tests cho Staff warehouse receive/update/log flow.
- TypeScript build cho API và web.

Kết quả xác minh ngày 26/08/2026:

- `npm test`: 47 API tests pass, 1 DB integration test safety-skip; web TypeScript check pass.
- `npm run build`: Node.js API và React web build pass.
- `npm --workspace @lnfs/web run e2e:home`: 14/14 Playwright tests pass.
- `npm run build:java`: không chạy được vì môi trường chưa có `mvn`; chưa kết luận Java source lỗi.

Chưa có:

- Bằng chứng chạy DB integration suite trên một MySQL isolated thực tế của team.
- E2E auth OTP thật với SMTP sandbox.
- Concurrency tests cho claim/appointment vì runtime chưa triển khai.
- Load test và query-plan benchmark.
- CI workflow trong codebase mới.

## 11. Kế hoạch 9 sprint trong 19 tuần

| Sprint | Thời gian | Trọng tâm và release evidence |
| --- | --- | --- |
| Sprint 1 | 01/08/2026–10/08/2026 | Khởi tạo dự án, Report 1, nền tảng requirement và authentication theo lịch sử thực tế |
| Sprint 2 | 11/08/2026–18/08/2026 | Post/catalog foundation, Report 1 và requirement/design/test evidence tương ứng |
| Sprint 3 | 19/08/2026–16/09/2026 | Cập nhật Report 1–2, hoàn thiện task đang thực hiện, đồng bộ backlog và tài liệu |
| Sprint 4 | 17/09/2026–30/09/2026 | Claim/evidence/privacy flow; cập nhật Report 3–5 trong cùng sprint |
| Sprint 5 | 01/10/2026–14/10/2026 | Review, appointment và handover workflow; state/sequence/test evidence |
| Sprint 6 | 15/10/2026–28/10/2026 | Warehouse overdue/disposition, audit và operational hardening |
| Sprint 7 | 29/10/2026–11/11/2026 | Matching/AI/OCR decision support, notification và hoàn thiện PWA |
| Sprint 8 | 12/11/2026–25/11/2026 | Full integration, system/regression testing, server deployment và release validation |
| Sprint 9 | 26/11/2026–13/12/2026 | Real-user feedback/UAT, P0/P1 fixes, regression, final documentation và demo |

Mỗi sprint phải cập nhật theo chiều ngang: requirement/SRS (Report 3), analysis/design (Report 4), implementation, test evidence (Report 5), Sprint Review và release/document synchronization. Không di chuyển ticket lịch sử đã Done chỉ để roadmap trông thuận lợi hơn.

## 12. Planned effort và capacity

Tổng planned effort là **416 man-days**. Planning envelope là **456 man-days**, gồm **40 man-days reserve** cho rủi ro, integration và defect variance.

| # | WBS item | Complexity | Man-days |
| --- | --- | ---: | ---: |
| 1 | Authentication and account management | Medium | 20 |
| 2 | LOST/FOUND posts, media, category, area, building, search and filtering management | Complex | 40 |
| 3 | Administration foundation, warehouse and operational management | Complex | 64 |
| 4 | Claim, evidence, review, appointment, handover and audit flow | Complex | 80 |
| 5 | Matching suggestions, match explanation and AI/OCR decision support | Complex | 80 |
| 6 | Realtime notification and communication support | Medium | 28 |
| 7 | Progressive Web App | Medium | 20 |
| 8 | Integration, testing, fixing, documentation, deployment and final preparation | Complex | 84 |
|  | **Total** |  | **416** |

| Work category | Man-days | Percentage |
| --- | ---: | ---: |
| Requirements Analysis and SRS | 48 | 11.5% |
| System and Database Design | 52 | 12.5% |
| Coding and Implementation | 190 | 45.7% |
| Testing and Bug Fixing | 56 | 13.5% |
| Project Management and Scrum Activities | 36 | 8.7% |
| Documentation, Final Review and Demonstration Preparation | 34 | 8.2% |
| **Total** | **416** | **100%** |

Milestone Timeliness Target: **95%**. Allocation phần trăm có sai số làm tròn nhỏ; tổng effort bắt buộc giữ ở 416 man-days.

## 13. Deployment và feedback strategy

1. Hoàn thành core workflows và PWA, đồng bộ requirement/design/test evidence trong sprint tương ứng.
2. Chạy integration, system và regression tests trên môi trường tách khỏi shared Aiven development database.
3. Chuẩn bị server configuration, shared media storage, secrets management, health/readiness và rollback procedure.
4. Deploy release candidate lên server và hoàn tất release validation.
5. Cho real users sử dụng trong phạm vi campus pilot, thu feedback có kiểm soát.
6. Phân loại P0/P1/P2, fix lỗi, regression test và cập nhật tài liệu/demo.

Repository hiện chưa có CI/CD workflow, container/deployment manifest hoặc PWA runtime evidence; vì vậy deployment là planned deployment, không phải trạng thái đã hoàn thành.

## 14. Cách trình bày đồ án

Nên nói:

> LNFS là Web Application with Progressive Web App support cho quy trình Lost & Found campus. Current implementation đã có authentication, quản lý bài LOST/FOUND, Gemini-assisted image/OCR draft, hybrid matching có giải thích và Staff warehouse operations. Claim, appointment, realtime, PWA infrastructure và server deployment đang được hoàn thiện theo kế hoạch 9 sprint; AI chỉ hỗ trợ quyết định và mọi xác minh sở hữu vẫn cần con người.

Không nên nói:

- “Toàn bộ flow Lost & Found đã production-ready.”
- “Hệ thống dùng custom AI model đã train.”
- “Node và Java là production microservices hoàn chỉnh.”
- “Media đã dùng Cloudinary” khi runtime còn lưu filesystem local.
- “PWA đã hoàn thành” khi chưa có manifest/service worker/installability/offline fallback.
- “Native mobile app đã hoàn thành.”

## 15. Tài liệu liên quan

- [Requirements](requirements.md)
- [Business rules](business-rules.md)
- [Traceability matrix](traceability-matrix.md)
- [Use case checklist](use-case-checklist.md)
- [Node.js/Java boundary](node-java-service-boundary.md)
