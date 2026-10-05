# Tổng quan dự án FPTU Lost & Found System

Cập nhật hiện trạng: **05/10/2026**, theo bản sửa audit trên `dev` và rollout ảnh kho đã được cho phép. Trạng thái commit/push/CI được ghi riêng trong [audit 05/10](full-system-audit-2026-10-05.md); kết quả lịch sử ở mục 11 được giữ nguyên và không chứng nhận deployment mới.

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
- Post/claim media qua Cloudinary authenticated và protected proxy, validation MIME/signature/size/count; đọc tương thích và fallback local khi chưa cấu hình ở scope hiện có.
- Gemini-assisted multi-image analysis tạo title/description/category/tags draft có thể chỉnh sửa.
- Hybrid/rule-based matching dùng text normalization tiếng Việt, category, location, time, image/OCR tags, tier, score breakdown và explanation.
- Claim request/decision, participant-scoped private text room, cursor-paginated history, private evidence proxy và claim notification feed; đây là current partial peer-return runtime.
- Staff custody/walk-in nhận đồ vật lý không cần duyệt request trước, có ảnh tình trạng riêng và đối chiếu thông tin nguồn; kho có receive/store/reserve/return, retention deadline, storage log và API disposition có gate. Staff có thể xác minh claimant sau intake với lý do/audit, không giả danh Finder hay tự accept claim lúc nhập kho.
- LOST direct contact cần private photo check trên 60% và confidence tối thiểu 60%; điểm chỉ mở giao tiếp, không chứng minh người gửi đang giữ đồ hay quyền sở hữu.
- Matching có feedback/dismissal theo actor, phân trang trước serializer và periodic refresh với lease/fencing/retry hữu hạn.
- Authenticated SSE thông báo workflow, giới hạn theo user/participant. Sửa audit 05/10 đóng stream khi access token hết hạn, kiểm tra session trước delivery/heartbeat và fail closed khi revalidation lỗi/quá hạn.
- Ảnh intake/return kho mới dùng Cloudinary authenticated khi cấu hình; production không fallback ghi local. Proxy Staff/Admin và khả năng đọc ảnh local cũ được giữ.
- PWA manifest, service worker, application shell và offline fallback không cache API/private data.

### 4.2 Partial

- Responsive web có mobile viewport checks, PWA manifest, service worker và privacy-safe offline shell; device/installability evidence vẫn cần manual QA.
- Warehouse có receive/store/return và retention deadline; overdue disposition/donation/transfer/disposal documents chưa đủ.
- Manual browser/device QA cho toàn bộ admin/profile vẫn cần bổ sung evidence; Cloudinary authenticated upload/delivery/cleanup smoke test đã pass.
- Post/claim có Cloudinary adapter và local fallback. Warehouse intake/return dùng Cloudinary authenticated, production không ghi fallback local; đã chuyển đủ 16 reference kho local sau backup/restore và giữ file gốc. Test API/provider thật qua process độc lập, restart và quyền Staff/Admin đã pass trên DB cô lập; chưa chứng nhận topology production hay toàn bộ ảnh post/claim. Xem [rollout ảnh kho](warehouse-media-rollout.md); DB Aiven không lưu bytes ảnh.
- CI MySQL 8.0/8.4 và browser phải chạy trên đúng commit ứng viên; bằng chứng commit/push/CI xem follow-up audit, không dùng run cũ. Các extension chưa được nghiệm thu deployment/manual không được gọi là production-ready.

### 4.3 Planned product scope

Luồng nghiệp vụ mục tiêu là:

LOST/FOUND post → matching suggestion → private verification chat → Finder decision → meetup → dual-confirmed direct handover

Phạm vi còn thiếu gồm representative photo/AI quality evaluation, full multiple-claimant acceptance, peer appointment/dual handover, đầy đủ seen/unread/push, PWA device/installability và Native Mobile. Claim/private text chat/guided verification/evidence/claim notification/SSE và canonical Staff custody return đã có runtime; peer-to-peer return journey đầy đủ vẫn chưa hoàn thành.

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
  API --> Media[Cloudinary authenticated media]
  API --> Local[Legacy local media / development fallback]
  API --> SMTP[SMTP email - optional]
  API --> Gemini[Gemini image analysis - optional]
  API --> Avatar[Cloudinary authenticated avatar]
~~~

Node.js + TypeScript là backend và write/migration owner duy nhất. Java skeleton đã được gỡ ngày 09/09/2026. Backend dùng Clean Architecture modular monolith: `interfaces -> application -> domain`, `infrastructure -> application ports`; `src/main` khởi tạo và inject adapter. Xem [dependency rules](CLEAN_ARCHITECTURE.md) và [draw.io](LNFS_NODE_ONLY_ARCHITECTURE.drawio).

Bounded contexts mục tiêu:

| Context | Current owner/status |
| --- | --- |
| Auth/account | Node.js, implemented |
| Posts/catalog/media | Node.js, implemented; media shared storage planned |
| Matching/AI assistance | Node.js, implemented theo rule-based/Gemini-assisted scope |
| Claim/evidence/private text chat | Node.js, guided Finder review và Staff post-intake verification; provider/manual acceptance và full escalation review còn gap |
| Appointment/dual handover | Peer appointment/dual confirmation Planned; canonical custody completed return và participant feedback đã có, không đồng nhất hai nhánh |
| Handover point catalog | Node.js, implemented cho public active-only và Admin CRUD |
| Warehouse | Node.js, implemented một phần cho Staff operations |
| Claim notification | Node.js, REST/in-app và transactional email outbox; provider/full-producer acceptance còn mở |
| Realtime transport | Node.js, authenticated user-scoped SSE; full chat presence/seen/unread/PWA push còn Partial/Planned |
| Native Mobile | Client planned, dùng shared API |

Module chỉ truy cập module khác qua public application contract. Application không import MySQL, Express, provider SDK hoặc environment; transaction context không chứa `PoolConnection` trong core.

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
2. Finder dùng `ACCEPT / OPEN_CONVERSATION`, request thêm thông tin hoặc decline; action mở room không phải ownership verification. Decision và withdrawal dùng claim row lock/state guard/idempotency.
3. Khi Finder mở conversation, claim chuyển `CONVERSATION_OPEN`; chỉ final human decision `ACCEPTED` mới đủ điều kiện cho appointment.
4. Tin nhắn text có idempotency key, cursor pagination; Web merge/deduplicate theo message ID. Read và mutation callbacks được guard theo room/generation; phản hồi trễ không thay message, draft, quyết định hay evidence của phòng mới.
5. Evidence chỉ đi qua endpoint được authorization; API không trả raw storage URL. Cloudinary authenticated là nguồn cloud, local fallback/ảnh cũ cần đối soát trước multi-instance.
6. Guided questions theo category, hashed answer comparison, Finder confidence/reason, append-only audit và correction đã có trên Web/PWA. Appointment và dual handover chưa có.

### 6.4 Catalog và warehouse hiện tại

1. Admin quản lý category, area, building và handover point.
2. Điểm bàn giao có map image, marker X/Y từ 0–100, opening hours, active flag và liên kết area/building.
3. Public API chỉ trả điểm active; Admin có thể tạm đóng/mở.
4. Staff/Admin tạo warehouse item, tiếp nhận, lưu kho hoặc trả đồ theo state transition.
5. Mỗi transition warehouse ghi actor/action/from-to/status note vào storage log.
6. Retention deadline được tính theo thời điểm nhận và policy hiện có. Overdue disposition là planned/partial, chưa được hiểu là tự động thanh lý.

## 7. Luồng nghiệp vụ mục tiêu: peer-to-peer first

Luồng sau là target end-to-end. Current runtime mới bao phủ đến claim/private text verification ở mức Partial; các bước meetup/return chưa có đầy đủ:

1. Owner tạo LOST report với public description và private details nếu cần.
2. Finder tạo FOUND report và tiếp tục giữ vật phẩm; mặc định không chuyển thẳng vào Staff custody.
3. Matching gợi ý các LOST/FOUND đối ứng và giải thích tín hiệu tương đồng.
4. Owner gửi verification request cho FOUND phù hợp.
5. Finder thực hiện `ACCEPT / OPEN_CONVERSATION`; hệ thống mở conversation riêng đúng cặp Owner–Finder–LOST–FOUND và giữ claim ở `CONVERSATION_OPEN`.
6. Finder dùng guided questions theo category; Owner trả lời qua private answer control mà không xem expected answer.
7. Finder chọn `NEED_MORE_INFO`, final `ACCEPTED`, `REJECTED`, hoặc custody escalation. Trong `dev`, custody giữ claim status, request và escalation history riêng; tạo request đi thẳng vào hàng đợi tiếp nhận vật lý. `PENDING` và legacy `ACCEPTED` có thể intake một lần; chưa nhận đồ thì chưa đổi custodian, intake không resolve post hay xác minh sở hữu. Staff verification sau intake có audit và giữ các gate tranh chấp/hold; canonical return mới hoàn tất trả đồ. Peer appointment vẫn cần `ACCEPTED`. Xem [warehouse rules](warehouse-retention-and-status-rules.md).
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
- Claim và warehouse evidence hiện có protected access; không trả raw storage URL cho actor không có quyền. Warehouse proxy chỉ Staff/Admin; similarity không xác minh ngầm quyền sở hữu.
- Thẻ sinh viên, CCCD, ngân hàng, điện thoại/laptop, chìa khóa, tiền, thuốc và vật nguy hiểm cần policy vận hành riêng; phần chưa được trường xác nhận ghi TBD.

## 10. Database, migration và media

Migrations SQL nằm tại apps/api-node/src/migrations, được chạy theo thứ tự và kiểm tra checksum. Các migration mới gồm additive `059_direct_return_recipient.sql`, `060_matching_refresh_leases.sql`, `061_warehouse_intake_evidence.sql`, `062_lost_contact_photo_checks.sql`. Không giả định mọi số giữa 001–062 đều có file hoặc ledger khớp một-một. Preflight Aiven ngày 05/10 pass: 58 source migrations, 61 applied ledger entries, 28 APPLIED attempts, không pending/superseded. Historical compatibility/scope warning 053/055 còn nguyên; original custody-time 055 chưa có SQL được xác minh. Sửa audit 05/10 không đổi SQL/checksum/ledger, không cần migration schema mới. Schema không thay thế runtime evidence.

Snapshot lịch sử 07/09/2026: Aiven có 49 bảng, 39/43 SQL khớp ledger và 043–046 chưa được ghi nhận ở thời điểm đó. Snapshot này không mô tả DB hiện tại. Bản 040_peer_claim_conversations khớp 045; không chạy lại migration đã áp dụng để sửa drift. Xem [snapshot reconciliation](archive/AIVEN_SCHEMA_RECONCILIATION_2026-09-07.md) và [bằng chứng recovery/rollout hiện tại](database-warehouse-recovery.md). Không xóa các bảng planned/legacy chỉ vì trống.

Khi dùng Aiven/shared MySQL:

- mỗi môi trường nên có database riêng;
- chỉ một người chạy migration sau review;
- không chạy test destructive trên shared DB;
- không commit .env, password, API key hay CA certificate;
- Production warehouse upload cần Cloudinary authenticated. Rollout 05/10 đã chuyển 16 ảnh kho và kiểm tra portability trên process độc lập; giữ backup/file gốc và xác nhận cấu hình production trước bỏ nguồn. Xem [runbook ảnh kho](warehouse-media-rollout.md).

## 11. Kiểm thử và evidence lịch sử

Các số bên dưới là snapshot tháng 09, không phải kết quả của bản mới. Kiểm thử audit 05/10 và sửa sau audit được ghi riêng trong [full-system-audit-2026-10-05.md](full-system-audit-2026-10-05.md); không dùng test xanh local để chứng nhận mọi UC hay CI của remote.

Refactor kiến trúc 09/09 có kết quả riêng tại [Clean Architecture verification](CLEAN_ARCHITECTURE_VERIFICATION.md): 156 API/unit/integration tests, 23 browser E2E, typecheck/build và dependency check pass. Scope chỉ thay đổi kiến trúc; không nâng trạng thái hoàn thành các workflow còn thiếu.

Evidence đã kiểm tra ngày 06/09/2026:

- `npm --workspace @lnfs/api-node run test`: 137 pass, 1 DB integration test skip an toàn vì thiếu MySQL local `_test`.
- `npm --workspace @lnfs/web run lint`: web TypeScript check pass.
- npm run build: API TypeScript build và Web production build pass.
- Java build thuộc snapshot cũ, đã ngừng sử dụng và gỡ ngày 09/09/2026.
- `npm --workspace @lnfs/web run e2e:home`: 23/23 Playwright tests pass, gồm auth resilience, post creation, matching view, claim-room stale response, mobile layout, Staff warehouse và Admin handover/map.
- `.github/workflows/ci.yml`: có MySQL service riêng và browser job; workflow chưa được chạy từ checkout này.
- `npm --workspace @lnfs/api-node run test:db-integration`: test được skip an toàn vì chưa cấu hình MySQL local `*_test`; không chạy trên Aiven/shared DB.

Cập nhật 07/09: API/unit/integration và Web typecheck pass với 152 tests, không skip; có MySQL local thật cho fresh/alias upgrade, partial DDL, ledger rollback, lock, feedback/chat retry và unique constraints. Đây không phải full claim-to-return UI evidence và không phải xác nhận CI từ xa. Evidence chi tiết nằm trong báo cáo reconciliation.

Gap hiện tại: peer appointment/dual confirmation, full escalation/disposition evidence UI, deployment production và media ngoài kho, PWA/device matrix, Native Mobile, load/failover và UAT. Backup/restore và CAS rollback ảnh kho đã có rehearsal cô lập 05/10, không phải nghiệm thu mọi khả năng recovery. Guided review/custody return đã có runtime; Aiven preflight 05/10 không còn pending migration nhưng không chứng minh toàn bộ tác động SQL lịch sử 053/055. Xem [history review](migration-history-review-2026-10-05.md).

## 12. Deployment và roadmap

Current deployment evidence chưa chứng minh một production/staging environment hoàn chỉnh. Aiven là lựa chọn shared database đã được nhóm sử dụng, nhưng cần cấu hình TLS và tách môi trường. Web/API deployment, persistent media, secret management, health/readiness, monitoring, backup và rollback cần checklist riêng.

Không ghi sprint date, assignee hoặc Jira status nếu chưa được kiểm tra Jira. Ngày Sprint 4 nêu trong prompt là planning input cần verify lại, không phải evidence repository.

## 13. Tài liệu liên quan

- Quy trình nghiệp vụ A–Z: LNFS_BUSINESS_PROCESS_A_TO_Z.md
- Requirements: requirements.md
- Business rules: business-rules.md
- Traceability matrix: traceability-matrix.md
- Use-case catalogue: uc.md
- Notification email rules: notification-email-rules.md
- Clean Architecture: CLEAN_ARCHITECTURE.md; Node/Java boundary cũ chỉ giữ làm lịch sử.
