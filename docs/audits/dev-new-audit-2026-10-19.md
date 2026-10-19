# Audit nhánh dev-new - 19/10/2026

## Kết luận

**Chưa nên merge vào main hoặc deploy candidate này.** Build API đang lỗi TypeScript, cổng kiểm tra kiến trúc không đạt, suite API/browser còn lỗi và có đường SSRF trong đăng ký browser push khi bật VAPID.

Đây là báo cáo kiểm tra, không phải biên bản đã sửa lỗi. Đợt này chỉ cập nhật nhánh local, chạy kiểm tra và tạo báo cáo; không sửa code nghiệp vụ, commit, push, merge hay chạy migration write.

## Phạm vi và phiên bản

| Nội dung | Giá trị |
| --- | --- |
| Candidate dev-new | `959e3cacbb73e1c9011954f46b659f7ae6c6c478` |
| Main dùng đối chiếu | `aa75e0d3298dfdbe1634b97c53736a7c96db3206` |
| Commit chung | `28067d34901fbf5788faf3b7dc7d66f1689ef05d` |
| Cập nhật local | Fetch origin và fast-forward dev-new từ `28067d3` lên `959e3ca` |
| Độ lệch hai nhánh | Main có 4 commit riêng; dev-new có 9 commit riêng |
| Phần thay đổi được audit | `git diff main...dev-new`: 95 file, 3.294 dòng thêm, 296 dòng xóa |

Các nhóm thay đổi chính:

- Chọn lịch hoàn trả đã hoàn tất trong hồ sơ để gửi feedback, không nhập UUID thủ công.
- Bộ lọc đồ quá hạn, điều kiện disposition, legal hold, lệnh xử lý, phê duyệt độc lập và chứng từ riêng tư trong kho.
- Giờ tiếp nhận custody, ngày nghỉ và thời gian Finder dự kiến mang đồ đến; migration `064`.
- Chat đẩy message bằng WebSocket qua thư viện `ws`; notification center nhận SSE. Đây **không phải Socket.IO**.
- Mở rộng notification theo nghiệp vụ, preference từng kênh, browser push/VAPID và outbox push; migration `065`.
- Lịch sử claim, giao diện hành trình vật phẩm, tài liệu BR/FR/UC và test liên quan.

Thư mục cache Expo `apps/mobile/.expo/` có sẵn ở máy, xuất hiện untracked vì nhánh này chưa có ignore tương ứng trên main. Không tính cache đó vào 95 file hoặc coi đó là thay đổi của dev-new; không xóa hay stage nó trong đợt audit.

## Findings

### D1 - P1: Build API không thành công

**Vị trí:** `apps/api-node/src/modules/claims/application/claim.use-cases.ts:1302`; `apps/api-node/src/modules/notifications/infrastructure/notification-email.repository.ts:260`.

`npm run build` dừng ở API với ba diagnostic:

```text
claim.use-cases.ts(1302,77): TS2339: Property 'roomId' does not exist on type 'never'.
claim.use-cases.ts(1302,104): TS2339: Property 'message' does not exist on type 'never'.
notification-email.repository.ts(260,13): TS2722: Cannot invoke an object which is possibly 'undefined'.
```

`chatSocketDelivery` được gán trong callback async nên control-flow analysis không nhận ra giá trị ở sau callback. `cancelPendingPush` là method optional trên port nhưng được gọi trực tiếp qua `this` trong implementation có contextual typing.

**Hướng sửa:** Trả dữ liệu cần publish qua kết quả thao tác hoặc dùng pattern thu hẹp kiểu đã có trong repo; làm rõ contract/implementation của method hủy push. Không dùng `any`, tắt strict hoặc bỏ bước build để che lỗi. Chạy lại cả API và Web build.

### D2 - P1: Cổng kiểm tra kiến trúc có 8 vi phạm

**Vị trí chính:** `apps/api-node/src/modules/claims/application/claim.use-cases.ts:34`; `apps/api-node/src/modules/warehouse/domain/intake-schedule.ts:2`; `apps/api-node/src/modules/realtime/interfaces/socket/chat-socket.server.ts:5`.

`npm test` dừng ở `check:architecture`, chưa chạy đến suite API hoặc lint Web. Checker báo:

| File | Vi phạm |
| --- | --- |
| `claims/application/claim.use-cases.ts` | Import sâu implementation của realtime; import domain của warehouse; import sâu port của system-config |
| `realtime/application/chat-socket.use-cases.ts` | Import sâu port của claims thay vì public contract |
| `warehouse/application/custody-request.use-cases.ts` | Import sâu port của system-config |
| `warehouse/domain/intake-schedule.ts` | Domain phụ thuộc application của system-config; đồng thời bypass public contract |
| `realtime/interfaces/socket/chat-socket.server.ts` | Interface phụ thuộc shared infrastructure CORS |

**Hướng sửa:** Tách việc đọc config khỏi domain policy thuần, dùng public application contract hoặc port nhỏ phù hợp, đặt/wire policy CORS đúng ranh giới hiện có. Không nới checker chỉ để cho nhánh xanh.

### D3 - P1: Push endpoint cho phép server tạo request tới mạng riêng

**Vị trí:** `apps/api-node/src/modules/notifications/interfaces/http/notification.validator.ts:20`; `apps/api-node/src/modules/notifications/infrastructure/web-push.delivery.ts:8`.

Endpoint do user gửi chỉ được kiểm tra là URL HTTPS. Khi VAPID được cấu hình, user đã xác thực có thể đăng ký endpoint trỏ loopback hoặc mạng riêng; worker đưa endpoint đó vào `web-push` mà không có chính sách hostname/IP đích.

Probe dùng khóa P-256/VAPID sinh tại chỗ xác nhận validator và `webpush.generateRequestDetails` đều chấp nhận HTTPS loopback IPv4/IPv6, RFC1918 và link-local; request được tạo có method POST. **Không gửi request tới các đích đó, không khai thác hạ tầng thật.** Khả năng truy cập thực tế còn phụ thuộc egress và TLS, nhưng biên kiểm tra đích đang thiếu.

**Hướng sửa:** Chỉ cho phép push provider được cấu hình và tin cậy; ràng buộc hostname/protocol/port, loại bỏ đích nội bộ và bảo vệ ở lúc kết nối để tránh DNS rebinding. Thêm regression cho địa chỉ IPv4/IPv6 nội bộ, hostname giả mạo, DNS và endpoint hợp lệ. Giữ nguyên kiểm tra khóa subscription; không ghi endpoint hoặc secret vào log.

### D4 - P2: Gợi ý matching mới không cập nhật chuông khi trang đang mở

**Vị trí:** `apps/web/src/components/notification-center.tsx:71`; `apps/api-node/src/modules/matching/application/matching.use-cases.ts:56`; `apps/api-node/src/main/services.ts:127`.

Notification center đã bỏ polling 10 giây và chỉ tải lại lúc mount hoặc SSE kết nối lại. Trong khi đó producer matching vẫn chỉ ghi notification + email/push outbox vào DB, không publish SSE; wiring matching cũng không nhận realtime notifier.

Khi SSE vẫn kết nối bình thường và có bài mới tạo match, notification tồn tại trong DB nhưng badge/list/toast không tự cập nhật. Mở chuông không gọi fetch mới. Người dùng phải tải lại trang hoặc đợi reconnect. Ca browser `notification-navigation.spec.ts:100` cũng không còn thấy matching toast.

**Hướng sửa:** Publish sự kiện matching sau commit qua contract phù hợp và cập nhật loại workflow/consumer, hoặc giữ một cơ chế resync dự phòng. Test notification mới phát sinh sau khi trang đã mở, không chỉ fixture có sẵn lúc tải trang; kiểm tra retry không phát trùng.

### D5 - P2: Tin nhắn nhận trực tiếp qua socket không được ghi nhận đã đọc

**Vị trí:** `apps/web/src/pages/claims-page.tsx:586`; `apps/api-node/src/modules/claims/application/claim.use-cases.ts:1151`.

Handler socket chèn message và đặt unread count local về 0 nhưng không gọi API ghi nhận đã đọc. Backend hiện chỉ `markMessagesRead` và hủy delayed-unread email khi đọc danh sách message qua HTTP. Polling room cũ đã bị bỏ; đồng bộ room mới chỉ chạy khi kết nối/reconnect.

Probe Playwright với socket được điều khiển đã mở phòng, hoàn tất initial sync, nhận một message mới và xác nhận message hiện trên màn hình nhưng không có thêm room-read request. Do đó DB có thể vẫn giữ message unread và email nhắc chưa đọc dù người nhận đang nhìn thấy tin nhắn. Không được coi việc set counter trên UI là read receipt bền vững.

**Hướng sửa:** Thêm/đấu nối thao tác read có quyền, gắn với message/cursor đã hiển thị trong phòng đang active và có visibility phù hợp; hủy delayed-unread delivery tương ứng. Test khi đang xem, tab nền, đổi phòng, reconnect và nhiều thiết bị.

### D6 - P2: CUSTODY_OVERDUE dùng sai nhóm preference ở in-app và push

**Vị trí:** `apps/api-node/src/modules/warehouse/application/custody-notifications.ts:53`; `apps/api-node/src/modules/notifications/application/notification-channels.ts:42`; `apps/api-node/src/modules/notifications/infrastructure/notification.repository.ts:56`; `apps/api-node/src/modules/notifications/infrastructure/notification-email.repository.ts:202`.

Producer xếp event `OVERDUE` vào nhóm OVERDUE khi enqueue email/push. Nhưng cả helper TypeScript lẫn CASE SQL lại xếp mọi type `CUSTODY_%`, bao gồm `CUSTODY_OVERDUE`, vào CUSTODY khi đọc feed hoặc claim outbox push.

Ví dụ bật OVERDUE và tắt CUSTODY: email được enqueue đúng, push được enqueue rồi bị filter/cancel theo CUSTODY, còn thông báo trong ứng dụng bị ẩn. Thiết lập ngược lại cũng có thể hiện cảnh báo trái với lựa chọn OVERDUE. Probe xác nhận bất nhất giữa producer và classifier; chưa chạy SQL end-to-end trên MySQL cô lập.

**Hướng sửa:** Chốt một mapping thống nhất, xử lý `CUSTODY_OVERDUE` trước prefix chung và đối chiếu mọi query/classifier. Test độc lập cả ba kênh với CUSTODY/OVERDUE bật tắt ngược nhau.

### D7 - P2: Socket chỉ kiểm tra quyền phòng lúc authenticate

**Vị trí:** `apps/api-node/src/modules/realtime/interfaces/socket/chat-socket.server.ts:128`; `apps/api-node/src/modules/realtime/interfaces/socket/chat-socket.server.ts:142`.

Trước mỗi message có revalidate session/account, nhưng không kiểm tra lại quyền participant/consent/trạng thái room. Nếu quyền phòng đã bị thu hồi trong khi session vẫn hợp lệ, message publish muộn hoặc đang chờ có thể vẫn được chuyển tới socket cũ.

Probe server WebSocket localhost xác nhận: authorize thành công lần đầu, đổi ACL sang từ chối, publish message và client vẫn nhận; `authorizeRoom` chỉ được gọi một lần. Đây là kiểm thử ACL có điều khiển, **không phải bằng chứng đã khai thác qua UI hoặc DB thật**.

**Hướng sửa:** Revalidate quyền phòng trước khi chuyển nội dung riêng tư hoặc đóng/invalidate subscription khi quyền thay đổi, với timeout fail closed. Thêm test race thu hồi quyền trong khi validation/delivery đang chờ và disconnect trong lúc kiểm tra.

### D8 - P2: Regression suite chưa được cập nhật cùng thay đổi contract

**Vị trí:** `apps/api-node/src/migrations/historical-migration.test.ts:13`; `apps/api-node/src/modules/claims/interfaces/http/claim.validator.ts:68`; `apps/web/tests/claims-resilience.spec.ts:146`.

Khi chạy riêng suite API để không bị architecture gate che mất kết quả, có 4 test fail:

| Test | Nguyên nhân quan sát |
| --- | --- |
| Historical 053 / forward migration count | Assert cứng 59 trong khi đã thêm 064/065, hiện có 61 forward files |
| LOST không có Finder photo không được custody | Fixture thiếu thời gian tiếp nhận mới nên bị chặn trước điều kiện ảnh cần kiểm tra |
| Custody escalation tạo một pending request | Fixture thiếu `requestedIntakeAt` bắt buộc mới |
| Validator verification / idempotency | Payload custody cũ thiếu trường thời gian mới |

Suite browser có 4 test fail:

| Test | Phân loại |
| --- | --- |
| Late claim-room response, dòng 146 | Mock response trả `clientMessageId` cố định khác request; optimistic + persisted message không khử trùng được. Chưa kết luận server thật trả sai ID |
| Finder custody from chat, dòng 262 | Assert chuỗi giờ làm việc cũ; sau đó fixture cũng chưa nhập thời gian tiếp nhận mới |
| Pending sends in two rooms, dòng 498 | Assert draft còn nguyên trong khi UI mới xóa draft ngay và render optimistic message. Assertion nút gửi vẫn disabled trước đó đã đạt; chưa kết luận bị mở khóa sai phòng |
| Matching toast, `notification-navigation.spec.ts:100` | Liên quan D4; không có refresh feed/event cho notification mới |

**Hướng sửa:** Cập nhật fixture đúng contract/idempotency thực tế và giữ các assertion bảo vệ race, lỗi, retry và pending send. Bổ sung test socket/push thật ở ranh giới transport với dữ liệu giả. Không chỉ xóa assertion, skip test hoặc đổi UI để khớp fixture lỗi thời. Không sửa SQL migration/ledger lịch sử để làm test đếm file xanh.

## Kết quả kiểm tra

Môi trường local: Node.js `22.15.0`; cài dependency bằng `npm ci`. Không chạy `npm audit fix` hoặc sửa lockfile.

| Lệnh / kiểm tra | Kết quả đợt này |
| --- | --- |
| `npm test` | FAIL ở architecture gate: 8 violations; 2 test của chính checker pass |
| `npm --workspace @lnfs/api-node run test` | 458 tests: 422 pass, 4 fail, 32 skip |
| `npm --workspace @lnfs/web run lint` | PASS |
| `npm run build` | FAIL: 3 diagnostic TypeScript ở API; root script chưa chạy Web build |
| `npm --workspace @lnfs/web run build` | PASS khi chạy riêng; có cảnh báo chunk lớn |
| `npm --workspace @lnfs/web run e2e:home -- --workers=2 --reporter=line` | 150 ca: 146 pass, 4 fail; Chrome, khoảng 2,1 phút |
| Runtime probes bổ sung | 4 pass: 3 ca xác nhận gap/defect D3/D6/D7 và 1 ca ghi nhận dependency baseline |
| Browser probe bổ sung | 1 pass xác nhận D5; API/socket giả lập có điều khiển, không phải production UAT |
| `npm audit --omit=dev --json` | 0 vulnerability production theo kết quả npm audit |
| `npm audit --json` | 2 mục critical trong dev dependency: `concurrently` và `shell-quote` |
| `node scripts/check-uc-catalogue.mjs` | PASS: 168 UC = 129 Implemented + 21 Partial + 18 Planned |
| `git diff --check main...HEAD` | PASS |
| `npm run migrate:preflight` | PASS, read-only; 61 source files, 64 ledger entries, 31 APPLIED attempts, pending rỗng |
| SQL integration MySQL 8.0/8.4 | Chưa chạy: chưa có target MySQL local cô lập được cấu hình. Không chạy destructive suite vào Aiven |

Hai mục dependency dev không phải hồi quy mới của nhánh: kiểm tra lockfile cho `main`, commit chung `28067d3` và candidate đều có `concurrently@9.2.4`, `shell-quote@1.9.0`. Cần xử lý riêng theo dependency advisory; không nhầm với kết quả production audit 0.

32 test skip phải được giữ rõ trong báo cáo; không coi 422 pass là đã chạy SQL integration. Audit này không thêm skip hoặc mock để làm suite có sẵn xanh. Probe bổ sung dùng mock để tái hiện biên logic, không thay thế các ca integration chưa chạy.

## Migration, CI và tích hợp

Preflight chỉ đọc, không áp dụng lại `064/065`. Ledger hiện được preflight nhận diện là không còn migration chờ; điều đó không chứng minh toàn bộ hành vi mới đã được nghiệm thu trên DB/provider.

Cảnh báo lịch sử vẫn còn:

- Scope ledger custody `053` khác schema đã recovery; không dùng cảnh báo này để chứng nhận các bảng disposition/legal-hold cũ.
- SQL gốc custody-time `055` chưa có; chỉ kiểm tra schema quan sát được, không replay hay tự dựng lại lịch sử.

`git merge-tree --write-tree main dev-new` báo xung đột ở 4 file:

- `apps/api-node/src/main/services.ts`
- `apps/api-node/src/modules/appointments/application/appointment.use-cases.ts`
- `apps/web/src/pages/item-journey-page.tsx`
- `apps/web/src/pages/workflow-pages.css`

Đây là mô phỏng, không thực hiện merge vào worktree. Main có những sửa riêng về popup lịch hẹn/địa điểm tùy chọn, chuyển meetup sang custody và ảnh hành trình có kiểm tra quyền. Khi giải quyết conflict phải giữ các mục đó; không chọn nguyên một phía rồi coi như đã hợp nhất đúng. Toàn bộ kết quả local trong tài liệu này thuộc candidate dev-new, **không phải cây code sau khi giải quyết conflict**.

Tại lúc kiểm tra, GitHub API không trả combined status hoặc PR-triggered workflow run cho đúng candidate SHA. `.github/workflows/ci.yml:6` không chạy khi push trực tiếp `dev-new`; PR chỉ trigger khi base là main/dev, ngoài ra có `workflow_dispatch`. Chưa có bằng chứng CI MySQL 8.0/8.4/browser xanh trên candidate này.

## Giới hạn cần nghiệm thu tiếp

- Push provider thật, permission, service worker, đăng xuất/đổi tài khoản trên cùng trình duyệt và subscription cũ; hiện không gửi push/email thật.
- `web-push.delivery.ts:8` chưa truyền timeout; worker chờ delivery tuần tự. Cần kiểm tra provider treo, drain, lease expiry và trạng thái ACK không xác định, không nhầm TTL của notification với timeout request.
- Chat hub lưu subscription bằng Map trong RAM. Khi có hai API instance, cần kiểm tra message giữa hai instance; hiện chưa có shared pub/sub và room không còn polling dự phòng. Không chứng nhận scale-out chỉ từ test một process.
- WebSocket bị proxy chặn, reconnect sau mất mạng, chống kết nối unauthenticated quá nhiều và xử lý backpressure/peer không pong.
- Permission/consent thay đổi giữa phiên, nhiều tab/thiết bị, mark-read và preference tắt in-app nhưng trạng thái nghiệp vụ vẫn cần resync.
- SQL concurrency cho legal hold, active claim, reservation, approval/disposition và cleanup chứng từ; role Staff, Admin đề nghị và Admin phê duyệt phải là tài khoản tách biệt.
- Giờ mở cửa, ngày nghỉ, timezone và custody không cần bài FOUND vẫn cần test end-to-end với thời gian hợp lệ. Không yêu cầu Finder đăng FOUND thay cho nguồn ảnh đã được duyệt trong chat.
- Deep accessibility, tải/failover và bàn giao ngoài đời chưa được kiểm chứng trong đợt này.

## Thứ tự xử lý đề nghị

1. Sửa D1/D2 và cập nhật regression D8; không sửa lịch sử migration hay bỏ gate.
2. Chặn D3 trước khi bật browser push trên môi trường có egress thật.
3. Sửa D4/D5/D6, hoàn thiện vòng đời phân quyền socket D7; thêm test âm tính và race tương ứng.
4. Giải quyết 4 conflict với main, chạy lại toàn bộ tests/build trên cây code kết hợp.
5. Chạy isolated SQL MySQL 8.0/8.4, CI browser trên đúng SHA mới và nghiệm thu provider/manual UAT trước khi chốt release.

## Bằng chứng local

- `api-dev-new-audit.log`
- `build-dev-new-audit.log`
- `playwright-dev-new-audit.log`
- `migration-preflight-dev-new-audit.log`
- `test-results/home/`: screenshot và error context của suite browser.
- `test-results/dev-new-audit-2026-10-19/runtime-probes.ts`
- `test-results/dev-new-audit-2026-10-19/browser-probes.spec.ts`
- `test-results/dev-new-audit-2026-10-19/playwright.config.ts`

Log và probe nằm trong các đường dẫn đã ignore, không được tự stage để publish. Nội dung báo cáo không chứa credentials, signed URL, endpoint DB thật hay thông tin người nhận.

## Follow-Up: Resolve Conflict Với Main

Theo yêu cầu tiếp theo, đã bắt đầu merge `origin/main@aa75e0d` vào `dev-new@959e3ca` bằng `--no-commit --no-ff`. Các kết quả audit phía trên giữ nguyên làm snapshot trước tích hợp.

Đã giải quyết và stage cả 4 file conflict:

- `main/services.ts`: giữ push/WebSocket/SSE và wiring notification của dev-new; giữ media storage cho hành trình của main, không khởi tạo trùng service.
- `appointments/application/appointment.use-cases.ts`: giữ địa điểm tùy chọn, validation và hash replay tương thích của main; giữ notification/outbox và publish realtime sau commit của dev-new.
- `pages/item-journey-page.tsx`: giữ giao diện timeline mới; kết hợp ảnh có kiểm tra quyền và reset component theo post ID để không dùng lại state của bài khác.
- `pages/workflow-pages.css`: giữ cả style timeline mới, ảnh hành trình và popup lịch hẹn.

Cũng xử lý tương thích ở phần auto-merge: fingerprint retry của custody bao gồm thời gian tiếp nhận mới. Gửi lại cùng nội dung giữ key; thay thời gian tạo key khác. Test fixture custody có ngày làm việc hợp lệ; response chat giả lập trả lại client message ID từ header idempotency thực tế. Assertion đổi phòng/pending-send và snapshot ảnh vẫn được giữ.

Liên kết lịch sử claim vẫn được giữ, nhưng dùng style link gọn thay vì nút lớn để không làm phần xác minh mobile vượt giới hạn chiều cao đã kiểm thử. Không tăng ngưỡng kiểm tra layout để bỏ qua regression.

Đã thêm 3 regression API cho địa điểm riêng/điểm bàn giao cùng realtime sau commit, replay không phát trùng và transaction lỗi không publish; thêm regression browser cho key custody khi đổi giờ tiếp nhận.

Kết quả đã xác nhận:

| Kiểm tra sau tích hợp | Kết quả |
| --- | --- |
| Index unresolved / conflict marker trong source | Không còn |
| `git diff --cached --check` | PASS |
| API tập trung: appointment, claim verification, activity và main/app | 61 pass, 0 fail, 0 skip |
| Toàn bộ API | 477 tests: 438 pass, 2 fail, 37 skip |
| Web lint và Web build riêng | PASS |
| Root build | Vẫn có 3 diagnostic TypeScript D1 đã biết trước merge |
| Root `npm test` | Vẫn dừng bởi 8 vi phạm kiến trúc D2 đã biết trước merge |
| UC catalogue sau ghép với main | PASS: 168 UC = 126 Implemented + 24 Partial + 18 Planned; giữ trạng thái hiện tại của main, không tự nâng UC |
| Full browser trước chỉnh link lịch sử và fixture mới | 168 ca: 165 pass, 3 fail; xem phân loại bên dưới |
| Browser regression trên bản ghép cuối | 45 pass, 0 fail, 2 workers: `claims-resilience.spec.ts`, `item-journey-media.spec.ts`, `appointment-journey.spec.ts` |

Hai test API còn fail là count migration cứng `59` so với `61` và payload validator custody cũ thiếu `requestedIntakeAt`; đã có trong D8. Các mục bảo mật/realtime khác trong audit chưa được sửa trong phạm vi resolve conflict. SQL integration vẫn cần DB cô lập; đợt resolve không thực hiện thao tác DB hoặc gửi email/push thật.

Ba lỗi của lượt full browser gồm chiều cao review mobile, fixture test mới thiếu `isActive` của điểm tiếp nhận và matching toast D4. Hai mục đầu đã sửa và chạy lại trong 45 ca regression đều pass. D4 chưa sửa; không coi lượt kiểm tra này là toàn bộ browser đã xanh. Các log sau tích hợp dùng prefix `merge-main-`, vẫn được ignore. Lượt full chạy trực tiếp Playwright xác nhận 2 workers; không dựa vào các lượt trung gian mà npm/PowerShell không truyền đúng cờ CLI.

Merge đang ở trạng thái **đã resolve, chờ commit**. Chưa tạo merge commit, push hoặc thay đổi main. Các file tự động stage từ main là thay đổi của merge, không phải phát sinh lại toàn bộ công việc đó.

## Follow-Up: Kiểm Thử Và Chuẩn Bị Nhánh Dev Ngày 20/10/2026

Trạng thái chờ commit phía trên là snapshot của lượt resolve. Merge đã được hoàn tất bằng commit `b39c2ea5d0e6e14ab4037483c8d4fd3e6c63033d`; tạo nhánh `dev` mới từ bản ghép và giữ nhánh dev local cũ dưới tên backup, không sửa lịch sử hoặc thay đổi main.

Đã chạy lại toàn bộ API và browser suite: API 438 pass, 2 fail, 37 skip; browser 167 pass, 1 fail. Build API và architecture gate vẫn fail. Xem kết quả, giới hạn SQL/provider, rà file nhạy cảm và yêu cầu CI đúng candidate trong [báo cáo ngày 20/10/2026](dev-verification-2026-10-20.md). Đây không phải xác nhận đã sửa toàn bộ finding hoặc cho phép release.
