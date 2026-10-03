# Yêu cầu hệ thống LNFS

Cập nhật mapping: **02/10/2026**. Status catalogue lấy từ `origin/dev` (`ef78a53`); bằng chứng chưa merge trên `feat/lnfs-55` xem [audit và verification](LNFS-55-SAFETY-VERIFICATION.md).

## 1. Quy ước status

- **Implemented:** có runtime code cho mục tiêu trong repository.
- **Verified:** implementation có test/build/manual evidence được ghi rõ.
- **Partial:** mới đáp ứng một phần acceptance criteria.
- **Planned:** thuộc phạm vi mục tiêu nhưng chưa có runtime evidence.
- **TBD:** cần mentor, team hoặc đơn vị vận hành quyết định.

Requirements target bao phủ Web Application, PWA và Native Mobile. Status bên dưới chỉ phản ánh repository hiện tại; không suy ra từ migration, mockup hoặc ticket.

## 2. Functional requirements

### 2.1 Web, authentication và authorization

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-WEB-01 | Web cung cấp board, bài của tôi, post detail, tạo/cập nhật/đóng/xóa mềm LOST/FOUND, tìm kiếm, lọc, sắp xếp và phân trang. | UC-013–UC-025 | P0 | Implemented |
| FR-AUTH-01 | User yêu cầu OTP email, xác thực OTP và tạo tài khoản với audience Student/Lecturer; email FPT/edu không bắt buộc. | UC-001, UC-002 | P0 | Implemented |
| FR-AUTH-02 | User đăng nhập password, nhận access token, refresh session và logout. | UC-003–UC-005 | P0 | Implemented |
| FR-AUTH-03 | User yêu cầu và hoàn tất reset password bằng mã có hạn dùng. | UC-006, UC-007 | P0 | Implemented |
| FR-AUTH-04 | User xem/cập nhật profile cơ bản, quản lý avatar Cloudinary và xem activity/reputation. | UC-008–UC-012 | P1 | Implemented; activity có feedback/reputation event an toàn, full UI/device QA còn pending |
| FR-ROLE-01 | Backend xác thực JWT và kiểm tra USER/STUDENT/LECTURER/STAFF/ADMIN; Staff không truy cập Admin API. | UC-003, UC-008, UC-062–UC-068 | P0 | Implemented |
| FR-BOARD-01 | Guest chỉ xem public content; protected client xử lý loading, empty, error và unauthorized state. | UC-013–UC-015 | P0 | Implemented/Partial theo màn hình |

### 2.2 LOST/FOUND, catalog và media

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-POST-01 | User đăng nhập tạo LOST hoặc FOUND với title, description, category cụ thể, thời gian, liên hệ và location hợp lệ. | UC-018, UC-019 | P0 | Implemented |
| FR-POST-02 | Owner được update, close hoặc soft-delete bài của mình; status phải qua validation/state rule hiện tại. | UC-021, UC-022 | P0 | Implemented |
| FR-CATALOG-01 | Form dùng category hai cấp, area, building và handover point active. | UC-016, UC-061, UC-069–UC-081 | P0 | Implemented |
| FR-MEDIA-01 | Owner upload, xem qua protected media proxy và xóa media bài đăng; API kiểm MIME, size, signature và count. | UC-023–UC-025 | P0 | Implemented trên local storage |
| FR-MEDIA-02 | Media dùng shared object storage để nhiều máy/instance không tạo reference file local bị thiếu. | UC-023–UC-025, UC-044, UC-045 | P0 | Planned |
| FR-PRIVPOST-01 | FOUND có private attributes; public response che contact, vị trí chi tiết, media/tín hiệu nhạy cảm theo authorization. | UC-015, UC-019, UC-024, UC-028 | P0 | Implemented current post/search/match/private-media scope; guided private answers chưa có |
| FR-HANDOVER-01 | Public chỉ thấy điểm bàn giao active; Admin CRUD/toggle map, marker, giờ hoạt động và hard-delete guard; Staff/Admin xem số item theo điểm. | UC-049, UC-050, UC-078–UC-081 | P0 | Implemented |

### 2.3 AI-assisted draft và hybrid matching

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-AI-01 | User gửi tối đa 5 ảnh hợp lệ để Gemini tạo title, description, category suggestion, visual attributes và safe visible text. | UC-017 | P1 | Implemented |
| FR-AI-02 | Phân tích ảnh chỉ tạo draft có thể sửa; không tự đăng bài hoặc xác minh ownership. | UC-017 | P0 | Implemented |
| FR-MATCH-01 | Create/update post chạy bounded best-effort matching với bài đối nghịch đang hoạt động. | UC-029 | P0 | Implemented |
| FR-MATCH-02 | Matching dùng text normalization tiếng Việt, category, location, time, image tags và safe OCR tags với weight/threshold. | UC-030 | P0 | Implemented |
| FR-MATCH-03 | Kết quả lưu score thành phần, tier, matcher version và explanation; owner có thể xem/re-run theo quyền và rate limit. | UC-026–UC-028, UC-031 | P0 | Implemented |
| FR-MATCH-04 | New-match notification must remain privacy-safe and must not decide ownership or change workflow state. | UC-097 | P1 | Planned; notification producer excluded from this matching change |
| FR-MATCH-06 | GET and recalculate return total/page/pageSize/hasMore with stable ordering, actor-scoped ratings and persisted dismissals. Page size defaults to 20, maximum 50. | UC-026, UC-027, UC-098, UC-099 | P0 | Branch implementation; real HTTP pagination/recalculate regressions |
| FR-MATCH-07 | Only the source owner can rate/dismiss eligible suggestions; exact correlation-key replays are idempotent and conflicting reuse returns 409. Refresh never clears feedback/dismissals or changes ownership, claim, appointment or custody. | UC-098, UC-099 | P0 | Partial pending merge/manual role QA; API/UI and SQL evidence in matching review |
| FR-MATCH-08 | Periodic refresh uses stored signals, active non-deleted posts, just-in-time claims, unique lease tokens and heartbeat. Only current leases may persist results/complete/fail; five attempts maximum, 15-minute failure backoff, ineligible posts stop permanently. | UC-100 | P0 | Partial pending merge/rollout; isolated SQL concurrency and retry regressions |
| FR-TRAIN-01 | Custom model chỉ được công bố sau dataset hợp pháp, anonymization, labeling, evaluation, versioning và inference artifact. | UC-101–UC-105 | P2 | Planned |

### 2.4 Peer verification, chat và appointment

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-VERIFY-01 | Owner gửi verification request cho FOUND; Finder giữ item và quyết định qua conversation riêng. | UC-034–UC-036 | P0 | Implemented: claim bắt đầu `PENDING`; `ACCEPT / OPEN_CONVERSATION` chỉ mở room và chuyển `CONVERSATION_OPEN`, chưa xác minh ownership |
| FR-VERIFY-02 | Finder dùng guided questions; Owner trả lời mà không xem trước private answer/attribute; hỗ trợ thêm thông tin, accept, decline hoặc escalate. | UC-106–UC-114 | P0 | Partial theo catalogue dev: guided template và human decision có runtime; không dùng automatic answer matching. Câu trả lời có thể nằm trong private chat có participant guard. Staff review/full goal/privacy QA còn mở |
| FR-CLAIM-01 | User tạo claim không trùng; evidence private được upload và chỉ actor có quyền mới xem. | UC-032–UC-038, UC-043–UC-045 | P0 | Implemented current API/UI scope; claim evidence còn local filesystem, chưa deploy-safe multi-instance |
| FR-APPT-01 | Chỉ accepted verification mới tạo appointment; hai bên đề xuất, accept, reschedule/cancel và complete. | UC-126–UC-133 | P1 | Eligibility policy implemented: chỉ claim `ACCEPTED` đủ điều kiện; appointment runtime vẫn Planned theo LNFS-54 |
| FR-HANDOVER-02 | Direct return cần Finder xác nhận HANDED_OVER và Owner xác nhận RECEIVED; chỉ dual confirmation mới thành RETURNED. | UC-136–UC-139 | P0 | Planned |
| FR-FEEDBACK-01 | Participant chỉ gửi một feedback sau completed return có dual confirmation hoặc custody outcome được ủy quyền; feedback tạo reputation event idempotent theo appointment và profile activity chỉ trả dữ liệu an toàn. | UC-058–UC-060, UC-012 | P1 | Implemented runtime; dev còn phụ thuộc completed return; branch feat/lnfs-55 thêm authorized custody completion với participant thật |
| FR-CHAT-01 | Conversation gắn đúng Owner–Finder–LOST–FOUND, hỗ trợ text/image, room isolation, retry, seen/unread và report/block. | UC-039–UC-042, UC-119–UC-122, UC-093 | P1 | Partial: private REST text room, isolation, retry idempotency và pagination có; image/seen/report/block chưa có |
| FR-RT-01 | Realtime transport được JWT-authenticated và không broadcast private data cho actor ngoài room. | UC-119, UC-121–UC-125 | P1 | Planned |

### 2.5 Staff custody, warehouse, admin và audit

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-STAFF-01 | Staff có operational dashboard với quyền thấp hơn Admin; frontend ẩn menu không thay thế backend guard. | UC-050–UC-057 | P1 | Implemented cho warehouse scope |
| FR-CUSTODY-01 | Finder có thể yêu cầu chuyển item cho Staff khi không thể giữ, có dispute, sensitive item hoặc policy yêu cầu. Staff intake mới tạo custody. | UC-141–UC-147 | P1 | Planned |
| FR-WAREHOUSE-01 | Staff/Admin receive/store/return item, retention deadline, storage log và handover counts. | UC-050–UC-057 | P1 | Partial: receive/store/return đã có; disposition chưa đủ |
| FR-WAREHOUSE-02 | Overdue item chỉ được dispose/donate/transfer khi không còn claim/appointment/dispute pending và có chứng từ. | UC-148–UC-158 | P1 | Planned |
| FR-ADMIN-01 | Admin CRUD/toggle category group, category con, area, building và handover point. | UC-061, UC-069–UC-081 | P0 | Implemented |
| FR-ADMIN-02 | Admin quản lý user, moderation, report, export, config và dashboard toàn hệ thống. | UC-062–UC-068, UC-082–UC-085, UC-087–UC-096, UC-165 | P1 | Implemented cho scope hiện tại; KPI snapshot đã tách contract |
| FR-AUDIT-01 | Sensitive state transition và admin action lưu actor, action, before/after, lý do và timestamp. | UC-056, UC-090, UC-163, UC-164, UC-166 | P1 | Partial |

### 2.6 PWA và Native Mobile

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-PWA-01 | Web responsive có manifest, installability, service worker, application shell, safe offline/error fallback, retry và mobile-browser camera/gallery. Transaction chỉ thành công sau server confirmation. | N/A (delivery channel) | P1 | Partial: manifest/service worker/offline shell đã có; device matrix và manual installability evidence còn thiếu |
| FR-MOBILE-01 | Native Mobile dùng chung API/auth/authorization/privacy/state rules, có auth, LOST/FOUND, matching, chat/image, meetup/handover và notification. | UC-M01–UC-M12 | P1 | Planned — project chưa được tạo |
| FR-MOBILE-02 | Native Mobile có navigation, session refresh, upload, permission, device test và release build. | UC-M01–UC-M12 | P1 | Planned — công nghệ TBD |
| FR-JAVA-01 | Java health skeleton cũ; giữ ID để truy vết lịch sử. | N/A | Retired | Ngừng sử dụng và đã gỡ ngày 09/09/2026; Node.js là backend duy nhất |

### 2.7 Notification delivery

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-NOTIFY-01 | Business event đã commit tạo notification in-app làm bản ghi chính thức; PWA push và email chỉ là delivery channel, không tự thay đổi business state. | UC-097, UC-123–UC-125, UC-147, UC-150 | P0 | Partial: claim/chat đã tạo in-app notification và transactional email outbox trong cùng workflow; các producer/PWA khác vẫn mở |
| FR-NOTIFY-02 | New-message email chỉ gửi sau 5–10 phút nếu notification vẫn unread, phải gộp nhiều message cùng room và hủy delivery chưa gửi khi user đã đọc. | UC-124 | P1 | Partial: delayed-unread, read-before-send cancellation và coalescing cùng room đã có; cần runtime evidence worker cô lập |
| FR-NOTIFY-03 | Authenticated User cấu hình kênh và tần suất theo nhóm sự kiện, gồm immediate, delayed-unread, digest và quiet hours; security email bắt buộc không được tắt. | UC-168 | P1 | Partial: Web/PWA preference cho claim/chat và security-email bypass đã có; các nhóm event/PWA push còn lại chưa đầy đủ |
| FR-NOTIFY-04 | Email phải privacy-safe, không chứa message body, evidence, verification answer, OCR/raw AI output, contact riêng, vị trí chính xác, storage URL hoặc secret; deep link luôn kiểm tra lại authorization. | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 | P0 | Partial: template HTML/text chỉ có metadata và authenticated deep link, worker kiểm tra verified/active/access; provider/runtime evidence còn mở |

## 3. Non-functional requirements

| ID | Requirement | Priority | Status/evidence |
| --- | --- | --- | --- |
| NFR-ARCH-01 | Node.js-only modular monolith; dependency hướng vào core; port thuộc application/domain; module contract công khai; không có circular dependency. | P0 | `scripts/check-architecture.mjs`, `src/main`, `src/modules`, `src/shared`; xem `CLEAN_ARCHITECTURE.md` |
| NFR-SEC-01 | Password/OTP/refresh token được hash/protect; secret không xuất hiện trong source/log. | P0 | Implemented trong auth tests; production secret rotation vẫn là vận hành |
| NFR-SEC-02 | Protected route trả 401/403 đúng; backend authorization là nguồn quyết định. | P0 | Implemented cho current routes |
| NFR-SEC-03 | Auth, Gemini và matching rerun có rate limit phù hợp. | P0 | Implemented cho current module |
| NFR-VALID-01 | Payload/query/params/upload được validate tại backend và merged update state được kiểm tra. | P0 | Implemented cho current post/catalog module |
| NFR-PRIV-01 | Private post/media/match signal/evidence không lộ cho actor sai quyền. | P0 | Implemented authorization/proxy trong current API; shared local storage là deployment risk |
| NFR-DATA-01 | Migration order/history is checksum-protected; applied SQL and ledger checksums are immutable. Verified recovery 057 may supersede pending historical matching 054 without replay or fake APPLIED records. New lease columns use additive 060 with schema existence checks. | P0 | Exact SQL/checksum + schema-gated read-only plan; fresh/original-054/dev-057 isolated regression tests. Applying 060 to shared DB is a separate rollout. |
| NFR-DATA-02 | Shared Aiven/dev DB không dùng cho destructive test; integration test dùng database local riêng. | P0 | Process rule |
| NFR-PERF-01 | Board có pagination; matching có candidate limit/window và rerun rate limit. | P0 | Implemented ở tested baseline; chưa load test |
| NFR-PORT-01 | Media tồn tại sau restart/deploy và đọc được từ mọi instance. | P0 | Avatar dùng Cloudinary; media bài đăng vẫn local storage nên requirement tổng thể chưa đạt |
| NFR-TEST-01 | API/Web build pass và logic quan trọng có unit/browser/integration evidence. | P0 | Partial: API/Web/browser pass; 07/09 đã chạy isolated MySQL fresh/upgrade/concurrency. Full claim-to-return journey và CI remote vẫn chưa xác minh |
| NFR-CI-01 | Pull request tự chạy test/build với MySQL isolated. | P1 | Implemented workflow config; CI run chưa được quan sát từ checkout này |
| NFR-OBS-01 | Có health/readiness, structured request log và graceful shutdown. | P1 | Partial: health/readiness có; cần verify phần còn lại |
| NFR-AUDIT-01 | Admin và sensitive transitions có audit trail đủ actor/action/before-after/time. | P1 | Partial |
| NFR-AI-01 | AI/OCR/matching chỉ hỗ trợ quyết định; human verification bắt buộc trước trả đồ. | P0 | Implemented cho current AI/matching module; verification flow planned |
| NFR-PWA-01 | Cached/offline UI không lộ private data và không báo transaction trước server confirmation. | P0 | Implemented trong service worker/cache policy; cần manual device evidence |
| NFR-MOBILE-01 | Native Mobile parity phải dùng shared contract và có device/release evidence. | P1 | Planned |
| NFR-MAIL-01 | Notification delivery dùng transactional outbox, idempotency key, bounded retry/backoff, coalescing và observability; provider failure không rollback nghiệp vụ. | P0 | Partial: outbox, bounded retry, category-safe coalescing và observability có; SMTP không cung cấp exactly-once, timeout không xác định được bị quarantine để tránh retry trùng |
| NFR-MAIL-02 | Chỉ gửi tới email đã xác minh; template/version, unsubscribe scope, provider log và deep link phải bảo vệ privacy, secret và authorization. | P0 | Partial: eligibility/privacy/authenticated-link checks có; bằng chứng provider thật và full event matrix còn mở |

## 4. Acceptance và traceability

Mỗi requirement Implemented/Verified phải có route/service/UI/test path tồn tại. Requirement Planned/Partial phải ghi gap rõ ràng trong [traceability matrix](traceability-matrix.md), [use-case catalogue](uc.md) và [business rules](business-rules.md). Quy tắc delivery email chi tiết nằm trong [notification-email-rules.md](notification-email-rules.md). Không dùng migration hoặc UI mockup thay cho runtime evidence.

## 5. Quyết định cần xác nhận

- Native Mobile framework và sprint/capacity.
- Retention/disposition policy của trường.
- Cloudinary đã dùng cho avatar; shared object storage cho media bài đăng và deployment platform vẫn cần xác nhận.
- Quyền Staff khi xem case escalation.
- Jira sprint dates, assignee, ticket history.
## Story notification email — current evidence

Implemented in Node.js/Web: authenticated preference API and responsive Web/PWA screen, migration 052 outbox/preferences, transactional enqueue from claim/chat and claim-status notifications, read-before-send cancellation, category-safe digesting, privacy-safe SMTP adapter, retry/backoff worker and authenticated HTML/text deep links. API and Web builds pass; migration 052 is applied to the target database. Remaining Partial evidence is real-provider delivery, isolated worker integration, full producer matrix, and a provider/adapter idempotency contract; stable Message-ID alone is not exactly-once evidence.

## 6. Feature-branch safety requirements (not dev completion)

| ID | Requirement | UC | Priority | Status |
| --- | --- | --- | --- | --- |
| FR-CUSTODY-02 | Owned active undeleted FOUND, linked claim/room consent, actor-scoped immutable request payload, single physical intake, cancel/reject before intake and retained audit. | UC-141–UC-146 | P0 | Branch implementation; deployment/manual QA pending |
| FR-WAREHOUSE-03 | Generic PATCH cannot assign verified/terminal outcomes. Reservation, release with reason, Admin legal hold, separate Admin approval and execution-time gates use canonical workflows. | UC-053–UC-055, UC-151–UC-158 | P0 | Branch safety gates; full disposition-order/evidence UI remains Planned |
| FR-WAREHOUSE-04 | Same UTC physical-receipt policy for walk-in and custody: 120/90/3/60 days, no future receipt, bounded overrides; private proof references and authorized completed return feed participant-scoped feedback. | UC-052, UC-055, UC-057–UC-060, UC-146 | P0 | Branch implementation; school policy approval and multi-instance storage pending |
| FR-MATCH-05 | Generate only active matches; retain permitted inactive saved history on refresh; hide same-owner LOST and redact private/deleted/hidden candidates. Preserve FOUND source for LOST conversations. | UC-026–UC-031, UC-040, UC-042 | P0 | Branch implementation and real-SQL/HTTP regressions |
| FR-NOTIFY-05 | Custody lifecycle changes and email outbox share business transaction; dedupe per event/recipient, authorized custody deep link, realtime after commit. Overdue reminders never mutate item state. | UC-147, UC-150, UC-168 | P0 | Branch implementation; provider delivery/full overdue-task matrix pending |
| FR-STAFF-02 | Server pagination/filtering, latest-response guards, refresh counts/list/detail after mutation; custody is default with walk-in there. No custody claim when physical holder is unknown/already Staff. | UC-051–UC-056, UC-143–UC-146 | P1 | Branch implementation; desktop/mobile browser evidence in verification report |

Policy details: [warehouse-retention-and-status-rules.md](warehouse-retention-and-status-rules.md). No new UC is created for these bug fixes: existing actor goals cover the work. Walk-in items without a linked verified FOUND claim are not eligible for the claim-based return/feedback workflow; staff must establish that verified linkage rather than invent participants.
