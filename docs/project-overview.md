# Tổng quan dự án FPTU Lost & Found System

Cập nhật: **06/09/2026**

## 1. Định vị

LNFS là hệ thống quản lý đồ thất lạc và đồ nhặt được cho FPT University Đà Nẵng. Sản phẩm mục tiêu có ba delivery channel dùng chung API và luật nghiệp vụ:

1. **Web Application:** channel hiện có, dùng trên desktop/laptop và cho các màn hình vận hành.
2. **Progressive Web App (PWA):** phần mở rộng của web responsive, dự kiến có installability, application shell, safe retry và hỗ trợ camera/gallery trên mobile browser.
3. **Native Mobile Application:** scope mục tiêu bắt buộc theo kế hoạch, dùng chung backend với Web/PWA. Repository hiện tại chưa có mobile project nên trạng thái là Planned — project not created yet.

Không gọi hệ thống hiện tại là production-ready, production microservices hoặc custom-trained AI. Gemini/OCR và matching chỉ là decision support; quyết định xác minh và trả đồ phải có con người.

## 2. Bài toán và mục tiêu

Quy trình thủ công thường phân tán ở group chat, quầy bảo vệ, phòng công tác sinh viên hoặc tin nhắn cá nhân. Người mất khó tìm đúng bài nhặt được; người nhặt khó xác định chủ sở hữu mà không làm lộ đặc điểm riêng; nhân viên thiếu lịch sử và trạng thái nhất quán.

LNFS hướng tới:

- ghi nhận LOST/FOUND có cấu trúc, vị trí và thời gian;
- hỗ trợ tìm kiếm và hybrid/rule-based matching có giải thích;
- giữ private attributes cho bước xác minh;
- hỗ trợ trao đổi giữa Finder và Owner;
- cung cấp nhánh Staff custody/warehouse khi cần;
- ghi lại appointment, handover, thông báo và audit khi các module tương ứng hoàn thiện;
- cung cấp một nền tảng chung cho Web, PWA và Native Mobile.

## 3. Actor

| Actor | Vai trò |
| --- | --- |
| Guest | Xem nội dung public và đi tới đăng ký/đăng nhập. |
| Student/Lecturer | Tạo LOST/FOUND, xem board, tìm kiếm, quản lý bài của mình. |
| Finder | Người đang giữ vật phẩm FOUND trong luồng peer-to-peer mục tiêu. |
| Owner | Người tạo LOST report và gửi yêu cầu xác minh cho FOUND phù hợp. |
| Staff | Xử lý vận hành kho/tiếp nhận khi có escalation hoặc custody; quyền thấp hơn Admin. |
| Admin | Quản trị catalog, điểm bàn giao và các chức năng quản trị được cấp. |
| System | Tính matching, tạo draft AI, lưu trạng thái và phát sinh sự kiện. |
| External services | SMTP và Gemini API tùy cấu hình; không được coi là nguồn quyết định sở hữu. |

## 4. Phạm vi

### 4.1 Current implementation baseline

Đã có runtime evidence trong repository:

- Auth email OTP/SMTP, password login, JWT access/refresh, logout, forgot/reset password và profile cơ bản.
- Profile avatar qua Cloudinary authenticated delivery, activity/reputation summary và owner-scoped profile activity endpoint.
- Backend role guard cho USER, STUDENT, LECTURER, STAFF, ADMIN; frontend route guard cho Web.
- Tạo/cập nhật/đóng/xóa mềm bài LOST/FOUND; board, my posts, detail, search/filter/sort/pagination.
- Category hai cấp, campus area, building và public active-only handover point catalog.
- Admin CRUD/toggle điểm bàn giao, map image upload, marker coordinates và guard không xóa điểm còn appointment/reference vận hành.
- Admin moderation/report, dashboard KPI theo kỳ, current snapshot, status breakdown và aggregate CSV/JSON export; moderation target được suy ra từ report.
- Post media local storage qua protected proxy, validation MIME/signature/size/count.
- Gemini-assisted multi-image analysis tạo title/description/category/tags draft có thể chỉnh sửa.
- Hybrid/rule-based matching dùng text normalization tiếng Việt, category, location, time, image/OCR tags, tier, score breakdown và explanation.
- Claim request/decision, participant-scoped private text room, cursor-paginated history, private evidence proxy và claim notification feed; đây là current partial peer-return runtime.
- Staff warehouse receive/store/return, retention deadline, handover counts và storage log.
- PWA manifest, service worker, application shell và offline fallback không cache API/private data.

### 4.2 Partial

- Responsive web có mobile viewport checks, PWA manifest, service worker và privacy-safe offline shell; device/installability evidence vẫn cần manual QA.
- Warehouse có receive/store/return và retention deadline; overdue disposition/donation/transfer/disposal documents chưa đủ.
- Manual browser/device QA cho toàn bộ admin/profile vẫn cần bổ sung evidence; Cloudinary authenticated upload/delivery/cleanup smoke test đã pass.
- Claim evidence và post media vẫn local filesystem nên chưa phù hợp nhiều máy/instance dùng chung database; shared object storage là deployment blocker.

### 4.3 Planned product scope

Luồng nghiệp vụ mục tiêu là:

LOST/FOUND post → matching suggestion → private verification chat → Finder decision → meetup → dual-confirmed direct handover

Phạm vi target còn gồm guided questions, evidence review/confidence, multiple claimant policy end-to-end, realtime chat/notification, appointment, escalation/report, PWA installability và Native Mobile. Claim/private text chat/evidence/claim notification đã có runtime một phần, nhưng chưa phải full return journey.

### 4.4 Future/TBD

- Native Mobile implementation và công nghệ cụ thể.
- Custom AI training/MLOps sau khi có dataset hợp pháp, anonymization, label và evaluation.
- Shared object storage, production deployment, monitoring, backup và load testing.
- Retention/disposition policy cần FPT University xác nhận.
- Sprint dates, assignee và ticket status cần đối chiếu Jira trực tiếp.

## 5. Kiến trúc và ownership

~~~mermaid
flowchart LR
  Web[Web Application] --> API[Node.js / Express API]
  PWA[PWA target - same web client] --> API
  Mobile[Native Mobile - planned] --> API
  API --> DB[(MySQL / Aiven target)]
  API --> Media[Local media storage - current]
  API --> SMTP[SMTP email - optional]
  API --> Gemini[Gemini image analysis - optional]
  Java[Java Spring Boot health skeleton] -. no business ownership .-> API
~~~

Node.js là runtime và write owner duy nhất của các flow đang chạy, đồng thời là owner của migrations. Java hiện chỉ có Spring Boot Actuator health endpoint; chưa có controller/service/repository nghiệp vụ, chưa tích hợp JWT hay frontend.

Bounded contexts mục tiêu:

| Context | Current owner/status |
| --- | --- |
| Auth/account | Node.js, implemented |
| Posts/catalog/media | Node.js, implemented; media shared storage planned |
| Matching/AI assistance | Node.js, implemented theo rule-based/Gemini-assisted scope |
| Claim/evidence/private text chat | Node.js, current partial runtime; private local storage và review workflow còn gap |
| Appointment/dual handover | Chưa có runtime; phải chọn một write owner trước khi làm |
| Handover point catalog | Node.js, implemented cho public active-only và Admin CRUD |
| Warehouse | Node.js, implemented một phần cho Staff operations |
| Claim notification | Node.js, REST/in-app current scope |
| Realtime transport | Chưa có runtime |
| Native Mobile | Client planned, dùng shared API |

Không cho Node và Java cùng ghi một business flow/table nếu chưa có API contract, transaction/integration test và one-writer rule.

## 6. Luồng hiện tại có thể kiểm tra

### 6.1 Auth và session

1. Guest nhập email và thông tin đăng ký.
2. API gửi OTP qua SMTP; OTP/token được bảo vệ theo auth service và có expiry/rate limit.
3. API xác thực OTP rồi tạo tài khoản với audience role hợp lệ; client không tự cấp Staff/Admin.
4. User đăng nhập bằng email/password.
5. Access token dùng cho protected API; refresh token cookie được rotate; logout revoke session.
6. Forgot/reset password dùng OTP có hạn dùng và một lần.
7. Web route guard đưa user chưa đăng nhập về login; role không đủ được đưa về home.

### 6.2 Tạo và quản lý bài

1. User chọn hướng LOST hoặc FOUND trên home storytelling.
2. User có thể nhập form thủ công hoặc gửi tối đa 5 ảnh cho Gemini-assisted draft.
3. Draft chỉ điền title, description, category suggestion, tags và visible text; user phải review/chỉnh sửa.
4. User chọn category cụ thể sau nhóm chính, thời gian, area/building và địa điểm hợp lệ.
5. FOUND phải có nơi lưu/địa điểm hợp lệ; LOST không dùng handover point như nơi bàn giao.
6. API validate merged state, lưu post và media; owner có thể update/close/soft-delete theo quyền.
7. Board public không trả post hidden/deleted và public serializer che private fields.

### 6.3 Matching

1. Create/update post gọi matching best-effort với candidate đối nghịch còn hoạt động.
2. Engine normalize tiếng Việt và tính điểm text, category, location, time, image tags và safe OCR tags.
3. Candidate bị giới hạn theo số lượng và cửa sổ thời gian; có penalty/cap cho category/time không phù hợp.
4. Kết quả được lưu cùng score thành phần, tier, matcher version và explanation.
5. Owner có thể xem/recalculate bằng endpoint được bảo vệ và rate-limited.
6. Score chỉ là gợi ý; không tự accept claim, xác minh sở hữu hay đổi trạng thái returned.

### 6.5 Claim, private chat và evidence hiện tại

1. Owner tạo claim từ cặp LOST/FOUND có matching đạt ngưỡng; backend tự suy ra Finder và khóa cặp trong transaction.
2. Finder có thể accept, request thêm thông tin hoặc decline; decision và withdrawal dùng claim row lock/state guard.
3. Khi được chấp nhận, hệ thống mở private room cho đúng claimant/Finder; người ngoài nhận phản hồi không tiết lộ claim.
4. Tin nhắn text có idempotency key, cursor pagination; Web merge và deduplicate theo message ID, polling không chồng request và hủy khi đổi room.
5. Evidence chỉ đi qua endpoint được authorization; API không trả raw storage URL. Local filesystem hiện chưa phù hợp multi-instance.
6. Claim notification hiện là REST/in-app feed với `unreadTotal`; match notification, realtime transport, guided questions, appointment và dual handover chưa có.

### 6.4 Catalog và warehouse hiện tại

1. Admin quản lý category, area, building và handover point.
2. Điểm bàn giao có map image, marker X/Y từ 0–100, opening hours, active flag và liên kết area/building.
3. Public API chỉ trả điểm active; Admin có thể tạm đóng/mở.
4. Staff/Admin tạo warehouse item, tiếp nhận, lưu kho hoặc trả đồ theo state transition.
5. Mỗi transition warehouse ghi actor/action/from-to/status note vào storage log.
6. Retention deadline được tính theo thời điểm nhận và policy hiện có. Overdue disposition là planned/partial, chưa được hiểu là tự động thanh lý.

## 7. Luồng nghiệp vụ mục tiêu: peer-to-peer first

Luồng sau là target end-to-end. Current runtime bao phủ claim/private text verification và Finder decision; các bước meetup/return chưa có đầy đủ:

1. Owner tạo LOST report với public description và private details nếu cần.
2. Finder tạo FOUND report và tiếp tục giữ vật phẩm; mặc định không chuyển thẳng vào Staff custody.
3. Matching gợi ý các LOST/FOUND đối ứng và giải thích tín hiệu tương đồng.
4. Owner gửi verification request cho FOUND phù hợp.
5. Hệ thống mở conversation riêng đúng cặp Owner–Finder–LOST–FOUND (current partial runtime).
6. Finder dùng guided questions theo category; Owner trả lời mà không được xem trước private answer/attribute.
7. Finder chọn `REQUEST_MORE_INFO`, `VERIFY_FOR_MEETUP`, `DECLINE` hoặc `ESCALATE_TO_CUSTODY`; `OPEN_CONVERSATION` chỉ mở room.
8. Hai bên đề xuất và cùng xác nhận thời gian/địa điểm; appointment chỉ confirmed khi có mutual agreement.
9. Hai bên gặp trực tiếp; Finder xác nhận HANDED_OVER, Owner xác nhận RECEIVED.
10. Chỉ khi dual confirmation hợp lệ, hệ thống mới chuyển item sang RETURNED/đóng hồ sơ.
11. Dispute, no-show, harassment, sensitive item hoặc Finder không thể giữ đồ thì chuyển escalation/Staff custody với quyền tối thiểu và audit.

## 8. State model mục tiêu và mapping

FOUND item mục tiêu:

~~~text
REPORTED → HELD_BY_FINDER → CHATTING → RESERVED → MEETUP_SCHEDULED
→ HANDOVER_PENDING_CONFIRMATION → RETURNED → CLOSED
~~~

Nhánh custody:

~~~text
HELD_BY_FINDER/CHATTING → TRANSFER_REQUESTED → IN_CUSTODY
→ STAFF_HANDOVER_SCHEDULED → STAFF_RETURNED → CLOSED
~~~

Warehouse exception:

~~~text
IN_CUSTODY → OVERDUE → TRANSFERRED/DISPOSED → CLOSED
~~~

Schema hiện tại có post status OPEN/MATCHED/RESOLVED/CLOSED/EXPIRED/HIDDEN, claim/appointment/warehouse enum trong migrations nhưng không đồng nghĩa các API flow đó đã có. Cần tạo mapping current → target và migration riêng trước khi đổi enum; không sửa migration đã chạy.

## 9. Privacy, AI và sensitive item

- Public description tách khỏi private verification attributes.
- Ảnh public phải tránh lộ toàn bộ serial, IMEI, QR/barcode, giấy tờ và thông tin liên hệ.
- Gemini/OCR chỉ đọc tín hiệu trong ảnh để hỗ trợ draft/matching; không suy đoán quyền sở hữu.
- Human verification bắt buộc trước khi trả đồ.
- Claim evidence trong tương lai phải có protected access; không trả raw storage URL cho actor không có quyền.
- Thẻ sinh viên, CCCD, ngân hàng, điện thoại/laptop, chìa khóa, tiền, thuốc và vật nguy hiểm cần policy vận hành riêng; phần chưa được trường xác nhận ghi TBD.

## 10. Database, migration và media

Migrations SQL nằm tại apps/api-node/src/migrations, được chạy theo thứ tự và kiểm tra checksum. Repository hiện có migration `001`–`046`; `046_feedback_idempotency_legacy_cleanup.sql` là forward corrective migration cho legacy feedback index và chưa được áp dụng lên Aiven/shared DB. Schema cho auth, posts, catalog, matching, claims, appointments, chat, notifications, warehouse, AI feedback và map/catalog không thay thế runtime evidence.

Khi dùng Aiven/shared MySQL:

- mỗi môi trường nên có database riêng;
- chỉ một người chạy migration sau review;
- không chạy test destructive trên shared DB;
- không commit .env, password, API key hay CA certificate;
- media local trên từng máy không đồng bộ theo database; trước staging cần shared object storage.

## 11. Kiểm thử và evidence

Evidence đã kiểm tra ngày 06/09/2026:

- `npm --workspace @lnfs/api-node run test`: 137 pass, 1 DB integration test skip an toàn vì thiếu MySQL local `_test`.
- `npm --workspace @lnfs/web run lint`: web TypeScript check pass.
- npm run build: API TypeScript build và Web production build pass.
- npm run build:java: chưa chạy được vì Maven không có trong PATH.
- `npm --workspace @lnfs/web run e2e:home`: 23/23 Playwright tests pass, gồm auth resilience, post creation, matching view, claim-room stale response, mobile layout, Staff warehouse và Admin handover/map.
- `.github/workflows/ci.yml`: có MySQL service riêng và browser job; workflow chưa được chạy từ checkout này.
- `npm --workspace @lnfs/api-node run test:db-integration`: test được skip an toàn vì chưa cấu hình MySQL local `*_test`; không chạy trên Aiven/shared DB.

Các gap còn lại: MySQL concurrency/migration integration chưa chạy, appointment dual confirmation, guided review, full warehouse disposition, shared media storage, PWA browser/device matrix, Native Mobile, load test, UAT và deployment rollback.

## 12. Deployment và roadmap

Current deployment evidence chưa chứng minh một production/staging environment hoàn chỉnh. Aiven là lựa chọn shared database đã được nhóm sử dụng, nhưng cần cấu hình TLS và tách môi trường. Web/API deployment, persistent media, secret management, health/readiness, monitoring, backup và rollback cần checklist riêng.

Không ghi sprint date, assignee hoặc Jira status nếu chưa được kiểm tra Jira. Ngày Sprint 4 nêu trong prompt là planning input cần verify lại, không phải evidence repository.

## 13. Tài liệu liên quan

- Quy trình nghiệp vụ A–Z: LNFS_BUSINESS_PROCESS_A_TO_Z.md
- Requirements: requirements.md
- Business rules: business-rules.md
- Traceability matrix: traceability-matrix.md
- Use-case checklist: use-case-checklist.md
- Node/Java boundary: node-java-service-boundary.md
