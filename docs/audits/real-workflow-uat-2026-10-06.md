# Kiểm thử thực tế luồng đăng bài, trao đổi và trả đồ - 06/10/2026

## Kết luận

**Chưa thể xác nhận cả hai luồng trả đồ đều hoàn tất.** Các biến thể trả qua kho đã hoàn tất trên API/DB đang chạy. Luồng trả trực tiếp đi được đến xác minh claim, nhưng tạo lịch hẹn trả `503` vì DB chưa áp dụng migration `063_appointment_workflow.sql`.

Phát hiện 3 vấn đề cần theo dõi:

| Mã | Mức độ | Vấn đề | Phân loại |
| --- | --- | --- | --- |
| UAT-01 | P1 | Chưa triển khai schema lịch hẹn, chặn hoàn tất trả trực tiếp | Thiếu rollout; không phải kết luận migration bị lỗi |
| UAT-02 | P2 | Refresh bị giới hạn theo IP, tải lại trang đưa phiên hợp lệ về login | Đã tái hiện trên môi trường đang chạy |
| UAT-03 | P3 | Popup trả đồ giữ thông báo đợi kiểm tra claim sau khi claim đã tải xong | Lỗi hiển thị trạng thái; không chặn submit hợp lệ |

## Phạm vi và phương pháp

- Workspace: `F:/ky9/fptu-lost-found-system-main`; nhánh `dev`.
- HEAD: `195b134c34c3cee559187bfee13d05e78abf3bfe`, **kèm thay đổi chưa commit hiện có**, không phải kiểm thử riêng bản HEAD sạch.
- Web: `http://localhost:5173`; API: `http://localhost:3001/api`; dùng DB/provider cấu hình thực của API đang chạy.
- Thời gian ghi nhận chính: khoảng 12:59-13:12 ngày 06/10/2026, UTC+7.
- Người mất: `vochieuquan@gmail.com`; Finder: `vochieuquan26@gmail.com`; Admin thực hiện vai trò tiếp nhận/trả kho: `adminlnf@gmail.com`.
- Đăng nhập bằng giao diện thật, ba browser context tách biệt. Tạo LOST/FOUND đầu tiên, Walk-in và thao tác trả cặp matching bằng UI; những bước còn lại kết hợp HTTP thật có xác thực và UI. **Không mock API, Gemini, storage hoặc trạng thái DB.**
- Ảnh là bitmap tổng hợp có ghi rõ UAT, không phải ảnh vật phẩm thật. Thông tin người nhận/đối chiếu tại quầy là giả lập có nhãn UAT. Đây là kiểm chứng phần mềm/provider, không chứng nhận bàn giao vật phẩm hoặc danh tính ngoài đời.
- Không sửa code nghiệp vụ, không chạy migration/recovery write, không xóa dữ liệu cũ, không commit/push. Chỉ tạo và thao tác hồ sơ kiểm thử mới.
- Bằng chứng, screenshots và harness nằm trong `test-results/real-uat/`, được Git ignore. Không lưu mật khẩu, token hoặc cookie trong báo cáo/harness/receipt.

## Các vấn đề đã tái hiện

### UAT-01 [P1]: Thiếu schema lịch hẹn chặn luồng trả trực tiếp

**Bước tái hiện:**

1. Người mất và Finder tạo LOST/FOUND mới, cùng danh mục Bình nước/khu vực; matching thực tìm thấy cặp kiểm thử với điểm khoảng 71,2%.
2. Người mất tạo claim từ cặp matching; Finder mở cuộc trao đổi. Chat chữ, ảnh và private evidence đều hoạt động.
3. Finder gửi câu hỏi xác minh; người mất trả lời; Finder chọn xác minh để gặp mặt. Claim chuyển `ACCEPTED`, không đổi vai trò hai bên.
4. Gọi `POST /api/appointments` với `claimId`, `handoverPointId`, `proposedAt` hợp lệ và `requestKey` mới.

**Thực tế:** `503`, nội dung:

```text
Lịch hẹn cần migration 063_appointment_workflow.sql. Vui lòng liên hệ quản trị.
```

`GET /api/appointments` cũng trả cùng lỗi. Preflight read-only chạy trong đợt này xác nhận migration `063` nằm trong `pending`.

**Kỳ vọng:** sau rollout schema được phê duyệt, có thể tạo/xem lịch, hai bên chấp nhận và xác nhận bàn giao theo workflow.

**Ảnh hưởng:** chưa kiểm chứng được trên DB này các bước chấp nhận lịch, Finder xác nhận đã giao, người mất xác nhận đã nhận, hoàn tất khi hai bên xác nhận, nhắc lịch qua email, no-show và xác nhận mâu thuẫn. Không gán các bước đó PASS bằng kết quả unit/mocked tests cũ.

**Hướng xử lý:** backup, rehearsal trên DB cô lập, preflight và xin phê duyệt áp dụng migration mới; sau đó test lại toàn bộ nhánh lịch hẹn/trả trực tiếp. Không replay migration đã áp dụng, sửa checksum hoặc xóa ledger.

**Vị trí:** [schema gate](../../apps/api-node/src/modules/appointments/application/appointment.use-cases.ts:15), [migration 063](../../apps/api-node/src/migrations/063_appointment_workflow.sql), [runbook rollout](../runbooks/appointment-journey-rollout.md).

**Hồ sơ:** LOST `e461c637-e084-47b6-9718-29930fd1b361`; FOUND `02ec2da2-9aa3-4741-9760-1a3f390e3383`; claim `0259d21c-c9cc-42fa-80cd-2174a01f9c7c`. Claim đang `ACCEPTED`, hai bài chưa được đánh dấu đã trả.

### UAT-02 [P2]: Refresh 429 làm mất giao diện phiên đang hợp lệ

**Bước tái hiện:**

1. Đăng nhập ba tài khoản trên các browser context cùng máy/IP.
2. Tải lại/mở trực tiếp nhiều trang có bảo vệ trong cửa sổ 15 phút; mỗi lần bootstrap gọi `/auth/refresh`.
3. Khi bucket refresh đạt giới hạn, đăng nhập mới vẫn thành công; `GET /api/auth/me` với access token vừa cấp trả `200`.
4. `POST /api/auth/refresh` với refresh cookie hợp lệ trả `429`; reload trang đang đăng nhập đưa về `/login`.

**Bằng chứng độc lập lúc 13:07:48 UTC+7:** login `200`, `/auth/me` `200`, refresh `429`, `Retry-After: 278`. Lần kiểm tra trong harness lúc 13:09:56 cũng có `/auth/me: 200`, refresh `429`, `Retry-After: 151`; reload chuyển sang `/login`.

**Thực tế:** refresh báo `Quá nhiều yêu cầu. Vui lòng thử lại sau.`; phía Web chuyển mọi lỗi refresh thành session null, nên người dùng nhìn thấy màn hình login thay vì trạng thái tạm thời/thử lại.

**Nguyên nhân đối chiếu code:** `sensitiveLimit` có `limit: 10` / 15 phút, mặc định khóa theo IP và dùng chung cho register, refresh, reset-password. `refreshSession()` bắt mọi lỗi và xóa access token; AuthProvider nhận null.

**Kỳ vọng:** bảo vệ rate limit vẫn có, nhưng thao tác refresh hợp lệ của nhiều người/phiên cùng mạng không dễ làm mất phiên của nhau; Web phân biệt phiên thực sự hết hiệu lực với `429`/lỗi mạng tạm thời.

**Hướng xử lý:** tách ngân sách refresh khỏi password/reset/register, xem xét khóa theo phiên an toàn cộng giới hạn chống lạm dụng theo IP; hỗ trợ Retry-After/backoff và thông báo thử lại cho lỗi tạm thời. Không bỏ auth, không dùng access token hết hạn để vượt quyền.

**Vị trí:** [limiter](../../apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts:21), [refresh route](../../apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts:34), [refreshSession](../../apps/web/src/services/api.ts:783), [AuthProvider](../../apps/web/src/context/auth-context.tsx:19).

**Ảnh chụp:** `test-results/real-uat/20261006060605-refresh-login-redirect.png`.

Đây là lỗi được tái hiện khi dùng nhiều phiên/tải lại trong cùng cửa sổ rate limit, không có nghĩa mọi lần login/reload đều lỗi. Những ca UI tiếp theo dùng điều hướng SPA giữ phiên hiện có; không coi việc tránh reload là đã sửa UAT-02.

### UAT-03 [P3]: Cảnh báo đợi kiểm tra claim không tự hết

**Bước tái hiện:**

1. Mở popup trả một vật phẩm có claim đã được Staff xác minh.
2. Bấm xác nhận khi form còn trống và request tải claim đang chạy.
3. Chờ danh sách trả xong, chọn claim hiển thị `Đã xác minh`, điền đúng người nhận, tải proof và đánh dấu đối chiếu.

**Thực tế:** dưới select vẫn có dòng đỏ `Vui lòng đợi hoàn tất kiểm tra claim.` mặc dù claim đã hiển thị đầy đủ và không còn tải. Submit lần nữa vẫn trả thành công `200`, cho thấy cảnh báo cũ không phản ánh trạng thái hiện tại.

**Kỳ vọng:** cảnh báo loading được cập nhật/xóa khi request tương ứng hoàn tất; lỗi xác minh thật vẫn được giữ cho đến khi giải quyết.

**Hướng xử lý:** disable submit khi đang tải review hoặc quản lý lại riêng lỗi loading; cập nhật lỗi claim khi load/chọn/xác minh thành công, không xóa toàn bộ lỗi nghiệp vụ một cách mù quáng.

**Vị trí:** [load claim reviews](../../apps/web/src/pages/staff-page.tsx:523), [ghi lỗi loading khi submit](../../apps/web/src/pages/staff-page.tsx:721), [select claim](../../apps/web/src/pages/staff-page.tsx:1077).

**Ảnh chụp:** `test-results/real-uat/20261006061051-return-ready.png`. Screenshot được chụp ngay sau upload proof; không dùng trạng thái thumbnail đang tải trong ảnh này để kết luận provider lỗi.

## Các luồng đã đi được

| Luồng / nhóm kiểm tra | Kết quả thực tế |
| --- | --- |
| Đăng nhập hai user và Admin; đăng LOST/FOUND bằng UI, upload ảnh | PASS |
| Matching LOST-FOUND, claim từ matching, Finder mở conversation | PASS |
| Chat hai chiều, gửi ảnh trong chat, upload/read private evidence | PASS |
| Xác minh: chặn khi thiếu câu trả lời, hỏi thêm thông tin, Owner trả lời, Finder chấp thuận | PASS |
| Trả trực tiếp: tạo lịch sau xác minh và các bước xác nhận vật lý | BLOCKED bởi UAT-01 |
| FOUND -> chat chưa xác minh -> custody -> intake ngay từ PENDING -> Staff xác minh -> trả kho | PASS, vật phẩm RETURNED, FOUND RESOLVED |
| LOST + Finder không đăng FOUND -> kiểm tra ảnh thật -> chat -> custody -> trả kho | PASS; điểm ảnh 74,55%, AI confidence 95%, có 3 câu hỏi trong response; LOST RESOLVED, không tạo FOUND giả |
| Cặp LOST-FOUND matching -> custody -> trả bằng popup -> cả hai bài RESOLVED | PASS |
| Walk-in bằng UI, ảnh tiếp nhận, người nhận offline không account/claim | PASS, RETURNED |
| Vật phẩm EXPIRED chưa xử lý -> upload proof -> trả hợp lệ | PASS, RETURNED; dùng hồ sơ UAT mới có ngày nhận giả lập cũ, không sửa hồ sơ cũ của người dùng |
| Thiếu ảnh intake, thiếu proof, điện thoại 4 ký tự, sai người nhận | PASS: chặn đúng bằng 422/409; UI hiện lỗi đỏ dưới điện thoại, màu đo được `rgb(180, 35, 24)` |
| Trả trước khi Staff xác minh; bỏ claim để trả offline khi còn claim online | PASS: chặn 409, không tự xác minh khi intake |
| Gửi lại claim/chat/intake/return cùng nội dung | PASS: cùng record ID, không thêm item hoặc RETURNED log trùng |
| Cùng key nhưng đổi quantity/reason; đổi hồ sơ người nhận sau trả | PASS: chặn 409 |
| User gọi API kho/xác minh/trả; tự claim; sửa bài người khác | PASS: chặn 403/404/409 |
| Admin không tham gia xem chat/evidence/journey; anonymous đọc evidence | PASS: không có quyền, 404/401; không có Admin bypass |
| Nguồn bài đăng, ảnh intake, ảnh return được giữ riêng | PASS, đủ SOURCE_POST / INTAKE / RETURN |
| Journey của Owner/Finder gồm giai đoạn kho và trả, không lộ identity/phone/storage reference | PASS |
| Modal Walk-in: focus trong modal, Tab/Shift+Tab, preview lồng và Escape | PASS trên phiên kiểm tra desktop |
| Journey và trang Staff tại 390px; ảnh thật qua proxy | PASS trong viewport đã chụp, không tràn ngang toàn trang |
| Admin đọc audit/export CSV; user không được đọc/export | PASS |
| Rút claim đang hoạt động -> CANCELLED; gửi lại/direct message không tự mở lại | PASS: 404/409 |
| Upload byte giả PNG; kiểm tra API còn sống | PASS: 415 đúng lỗi chữ ký ảnh, API tiếp tục trả 200 |

**Lưu ý về từ chối:** `REJECTED` do quyết định quyền sở hữu vẫn cho chat nếu consent còn ACCEPTED theo `claim-policy.ts`; hai request chat 201 ban đầu không đổi claim về ACCEPTED/CONVERSATION_OPEN. Không báo chúng là lỗi “mở lại quyền sở hữu”. `CANCELLED` sau rút claim mới bị khóa chat trong ca đã kiểm tra.

## Hồ sơ UAT đã tạo và giữ lại

Có **9 bài đăng, 6 claim, 4 yêu cầu custody và 5 vật phẩm kho** mới. Không tự xóa để giữ lịch sử/bằng chứng. Hai tiền tố bài đăng: `[UAT-20261006055914]`, `[UAT-20261006060605]`; ghi chú trả ở lần tiếp tục còn dùng `[UAT-20261006061051]`.

| Hồ sơ | Định danh chính | Trạng thái cuối kiểm tra |
| --- | --- | --- |
| FOUND -> kho | FOUND `cf415dab-8907-4f52-973a-c7c1e4eb9615`; kho `6023c764-d837-41f1-a0d7-c7d449876857` | RESOLVED / RETURNED |
| LOST chỉ có ảnh -> kho | LOST `c6e539e6-7e15-4a97-a15d-6baf00200202`; kho `f173b8d4-96bf-4ca3-b788-f703d72d9b23` | RESOLVED / RETURNED |
| Cặp matching -> kho | LOST `955c6222-60a5-4d1b-baf3-44acc16e3b90`; FOUND `074b8307-5e22-4d3d-a9b8-3636a9d54e8c`; kho `69effbf4-1f17-4be6-9bf0-7d2ad4eb56d5` | Cả hai RESOLVED / RETURNED |
| Walk-in offline | kho `032b5082-e8e1-4f16-979c-897aed64f76f` | RETURNED |
| EXPIRED | kho `8c913851-24f6-4006-9e23-cb0ad9b596c1` | RETURNED |
| Trả trực tiếp đang chờ rollout | claim `0259d21c-c9cc-42fa-80cd-2174a01f9c7c` | ACCEPTED; chưa tạo lịch |
| Claim bị từ chối | claim `b3ee3945-ffc3-4082-9d8a-e082d29da4ba` | REJECTED |
| Hủy custody/rút claim | custody `078f8e46-5618-4711-92b0-503de466d614`; claim `233e98e5-3e19-456f-97b8-f3a06a56b5a8` | CANCELLED |

Bài LOST `ad24486c-d147-4540-bdf5-454e5886740e` trong ca direct claim FOUND không được liên kết vào claim, nên không kỳ vọng tự đóng bài này; không dùng kết quả đó để chứng minh đóng cặp LOST-FOUND. Ca matching liên kết phía trên đã kiểm tra cả hai bài.

## Bằng chứng và giới hạn

- Receipts gốc: `receipt-20261006055914.json`, `receipt-20261006060605.json`, `receipt-20261006061051.json`, `cancellation-receipt.json` trong `test-results/real-uat/`.
- Giữ nguyên receipts thô. Không cộng số request/assertion thành số “luồng nghiệp vụ” hoặc tuyên bố 100% coverage.
- Harness ban đầu có locator exact không đúng label select, chưa đóng popup thành công Walk-in trước chuyển tab; đã điều chỉnh harness và tiếp tục các ca đó, không sửa code ứng dụng. Các timeout do harness không được liệt kê là bug sản phẩm.
- Hai FAIL thô về REJECTED chat là kỳ vọng harness sai sau đối chiếu policy; đã đọc lại claim xác nhận vẫn REJECTED. FAIL thô yêu cầu PNG giả trả 400 thực tế là 415, cũng là hành vi chặn hợp lệ. Hai FAIL refresh 429 là lỗi thực UAT-02.
- Screenshots desktop/mobile của hành trình ở lượt đầu bị redirect login không dùng làm bằng chứng layout PASS; lượt tiếp tục đã xác nhận đúng page trước khi chụp lại.
- Ảnh đối chiếu/provider đã hoạt động thật trong ca UAT này; không suy ra AI luôn đúng, có khả năng chứng minh người đang giữ đồ, hoặc provider/DB sẽ luôn ổn định.
- Chưa kiểm chứng email đến inbox thật, nhắc lịch theo giờ, no-show, xác nhận mâu thuẫn hoặc dual confirmation trong môi trường này vì UAT-01. Không tăng reputation bằng feedback giả.
- Chưa thực hiện ca hai người nhận cạnh tranh đồng thời, legal hold/disposition, failover/load, đa instance, hoặc destructive SQL integration trên Aiven. Ba tài khoản không tạo thêm actor/tài khoản khác trong đợt này.
- Không dùng đợt này thay thế unit/SQL/Playwright suite toàn repo hoặc nghiệm thu ngoài đời. Không đổi UC/điểm audit chỉ vì các ca trên pass.

Preflight read-only trong đợt kiểm tra:

```text
sourceMigrations: 59
appliedMigrations: 61
appliedAttempts: 28
pending: 063_appointment_workflow.sql
warnings: lịch sử 053 khác scope runtime phục hồi;
          chưa có SQL gốc custody-time 055 để chứng nhận/replay.
```

Hai cảnh báo lịch sử được giữ nguyên. Đợt UAT này không sửa ledger/checksum và không chạy lại rollout ảnh cũ.

## Việc tiếp theo

Kế hoạch giao việc và tiêu chí đóng từng vấn đề nằm trong [kế hoạch sửa UAT 06/10](../plans/uat-repair-plan-2026-10-06.md). Việc tạo kế hoạch/chuyển thư mục không có nghĩa các lỗi dưới đây đã được sửa hoặc migration đã được áp dụng.

1. Xin phê duyệt rollout 063 theo runbook, rồi chạy lại nhánh lịch hẹn/trả trực tiếp, reminder email, no-show và xác nhận mâu thuẫn.
2. Sửa refresh limiter và cách Web xử lý lỗi tạm thời; thêm regression cho nhiều session chung IP và hard reload.
3. Sửa cảnh báo loading cũ trong popup trả đồ, giữ nguyên gate quyền sở hữu/proof.
4. Nghiệm thu với ảnh/vật phẩm và người nhận thật; bổ sung cạnh tranh claim/legal hold và thử tải/failover riêng trước khi tuyên bố production-ready.

## Repair follow-up 06/10

Snapshot UAT phía trên giữ nguyên. [Biên bản sửa UAT](uat-repair-verification-2026-10-06.md) ghi kết quả của dirty worktree mới: UAT-02/03 đã sửa local và có regression; backup/restore/rehearsal 063 đã PASS. Shared Aiven vẫn pending 063 vì chưa có phê duyệt write. Không sử dụng kết quả test local để đổi những ca chưa đi được trên Aiven thành PASS; hồ sơ UAT cũ, migration warnings và giới hạn inbox/ngoài đời vẫn giữ nguyên.
