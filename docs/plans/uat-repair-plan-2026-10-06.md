# Kế hoạch xử lý các vấn đề UAT - 06/10/2026

## 1. Mục tiêu và trạng thái

Trạng thái triển khai mới nằm ở [biên bản sửa UAT 06/10](../audits/uat-repair-verification-2026-10-06.md). Các mục bên dưới giữ checklist kế hoạch ban đầu; không dùng chúng thay receipt cuối. UAT-02/03 đã sửa local; UAT-01 đã backup/restore/rehearsal nhưng chưa được phép ghi shared Aiven.

Nguồn: [báo cáo UAT thực tế 06/10](../audits/real-workflow-uat-2026-10-06.md), [rollout lịch hẹn/hành trình](../runbooks/appointment-journey-rollout.md), [re-audit và follow-up 05/10](../audits/full-system-re-audit-2026-10-05.md).

Tài liệu này là kế hoạch giao việc, không phải bằng chứng đã sửa code hoặc đã rollout. Đợt tổ chức tài liệu chỉ chuyển thư mục, cập nhật liên kết và tạo checklist; không ghi Aiven, không đổi UC/status nghiệp vụ, không commit/push/merge.

| Mục | Ưu tiên | Phụ trách đề xuất | Trạng thái cần xử lý |
| --- | --- | --- | --- |
| UAT-01: schema lịch hẹn còn thiếu | P1 | DB owner + Backend + QA | Chờ phê duyệt rollout 063 và chạy lại nhánh trả trực tiếp |
| UAT-02: refresh 429 đưa về login | P2 | Backend + Frontend + QA | Cần sửa limiter và phân loại lỗi refresh |
| UAT-03: cảnh báo loading claim bị cũ | P3 | Frontend + QA | Cần sửa vòng đời trạng thái trong popup trả đồ |
| Nghiệm thu bổ sung | Release gate | QA + vận hành + release owner | Chưa đủ bằng chứng email inbox, cạnh tranh claim, legal hold, tải/failover và bàn giao ngoài đời |

Các vai trò trên chưa phải assignee đã xác nhận. Nhóm tự giao người thực hiện; không thay attribution Git hoặc lịch sử ticket dựa trên bảng này.

## 2. Phạm vi và nguyên tắc

- Chỉ làm tại `F:/ky9/fptu-lost-found-system-main`, nhánh `dev`; không sử dụng project cũ `F:/ky9/fptu-lost-found-system`.
- Đọc branch/status/diff/history trước mỗi đợt. Worktree đã có implementation lịch hẹn, audit và journey chưa commit; giữ nguyên công việc đó.
- Xác minh lại từng finding với code và môi trường hiện tại trước khi sửa. Trạng thái DB trong báo cáo là snapshot, không mặc định vẫn đúng ở ngày thực hiện.
- Không bỏ xác minh người nhận, proof, consent, tranh chấp hoặc legal hold để làm luồng pass. Staff tiếp nhận không tự trở thành Finder và không tự chấp nhận claim.
- Finder liên hệ bài LOST có thể chuyển custody mà không đăng FOUND; ảnh chỉ hỗ trợ trao đổi, không tự chứng nhận quyền sở hữu. Không tạo bài FOUND giả.
- Không replay migration applied, sửa checksum DB, xóa ledger, DROP schema mới hoặc dựng SQL rồi gọi là bản gốc. Giữ các giới hạn lịch sử 053/055.
- Không chạy lại rollout 16 ảnh kho đã hoàn tất. Không sửa/xóa dữ liệu người dùng cũ hay hồ sơ UAT giữ làm bằng chứng nếu chưa có phê duyệt riêng.
- Aiven mặc định chỉ kiểm tra read-only. Mọi rollout/recovery write cần phê duyệt riêng, backup được bảo vệ và rehearsal cô lập.
- Không lưu mật khẩu, access/refresh token, cookie, signed URL, raw storage reference hoặc dữ liệu giấy tờ người nhận vào log/tài liệu public.

## 3. UAT-01: Triển khai schema lịch hẹn an toàn

### Bằng chứng và điểm sửa

UAT ghi nhận `GET/POST /api/appointments` trả `503`; preflight có pending `063_appointment_workflow.sql`. Đây là thiếu rollout, chưa phải finding migration SQL bị lỗi.

Đối chiếu [schema gate](../../apps/api-node/src/modules/appointments/application/appointment.use-cases.ts), [migration 063](../../apps/api-node/src/migrations/063_appointment_workflow.sql) và [runbook hiện có](../runbooks/appointment-journey-rollout.md).

### Checklist thực hiện

1. Chốt candidate code và cấu hình DB/API/worker cần triển khai; đối chiếu schema/ledger với preflight read-only mới, lưu receipt đã loại thông tin nhạy cảm.
2. Review additive SQL 063, runner và prerequisites. Nếu phát hiện blocker mới, dừng rollout và báo rõ; không sửa ledger để vượt qua.
3. DB owner backup metadata, dữ liệu và ledger vào nơi được bảo vệ. Restore thử trên DB cô lập; xác nhận đọc được và có thể phục hồi trước khi ghi shared DB.
4. Áp dụng qua runner trên bản restore cô lập. Kiểm tra bảng `return_appointment_workflows`, `appointment_events`, dữ liệu/ledger cũ không đổi ngoài tác động additive dự kiến; thử runner lần nữa không replay migration đã applied.
5. Ghi receipt rehearsal và kế hoạch rollback app; xin phê duyệt riêng cho migration write đúng DB. Không chạy `npm run migrate` mù bằng `.env` đang trỏ shared DB hoặc có pending ngoài scope.
6. Sau phê duyệt, dùng runner hiện có với danh sách pending đã review. Nếu mất acknowledgement, đối soát schema/ledger/attempt authoritative trước bất kỳ retry nào; không chạy lại SQL trực tiếp.
7. Preflight read-only lại; xác nhận 063 applied, schema gate sẵn sàng và warnings lịch sử được giải thích riêng. Triển khai/restart app và worker theo candidate, drain các tác vụ đang chạy trước khi đóng pool.
8. Chạy lại UAT trả trực tiếp ở môi trường thực. Khi rollback app, giữ schema/history mới; không xóa bảng hoặc đoán/backfill xác nhận bàn giao legacy.

### Điều kiện đóng UAT-01

- [ ] Có backup/restore receipt, rehearsal cô lập, phê duyệt write và migration receipt đúng DB.
- [ ] API tạo/xem lịch hợp lệ không còn 503 vì thiếu schema; validation/authorization vẫn chặn yêu cầu sai.
- [ ] Đề xuất, accept/reject/cancel và xem lịch hoạt động cho đúng participant; không tự chuyển claim sang accepted.
- [ ] Finder xác nhận giao và người mất xác nhận nhận: một phía không hoàn tất, hai xác nhận hợp lệ mới hoàn tất nguyên tử và resolve đúng bài liên quan.
- [ ] Mâu thuẫn giữ pending; correction có kiểm tra vật lý/lịch sử, report đang mở vẫn chặn hoàn tất. Không mở feedback từ outcome chưa hợp lệ.
- [ ] No-show sau thời gian cho phép được ghi là khai báo một phía, không tự xác nhận trả đồ hoặc xử phạt; attempt mới giữ lịch sử cũ.
- [ ] Reminder enqueue không trùng giữa worker; preference/quiet hours và lịch hủy/custody được tôn trọng. Có kiểm tra inbox thực được phép nhận, không suy ra exactly-once hoặc đảm bảo email đến đúng giờ.
- [ ] Lịch legacy giữ read-only theo policy; không dùng `COMPLETED` cũ để giả chứng nhận dual confirmation.

## 4. UAT-02: Tách rate limit và xử lý refresh tạm thời

### Bằng chứng và điểm sửa

UAT đã có login 200, `/auth/me` 200 nhưng refresh cookie hợp lệ trả 429; reload đưa về `/login`. `sensitiveLimit` dùng chung register/refresh/reset-password, giới hạn 10 lần/15 phút theo IP. Web bắt mọi lỗi refresh thành null.

Đối chiếu [auth routes](../../apps/api-node/src/modules/auth/interfaces/http/auth.routes.ts), [API client](../../apps/web/src/services/api.ts) và [AuthProvider](../../apps/web/src/context/auth-context.tsx).

### Checklist thực hiện

1. Tách ngân sách refresh khỏi đăng ký/reset/password. Chọn ngưỡng dựa trên tải dự kiến; không chỉ tăng một con số tùy ý hoặc bỏ rate limit.
2. Nếu dùng khóa theo phiên, xác minh cookie/session phía server, không tin user ID/header client tự khai và không log token. Kết hợp giới hạn IP chống lạm dụng; xử lý thiếu/invalid cookie và IPv4/IPv6/proxy bằng pattern của thư viện đang dùng.
3. Kiểm tra store của limiter trong cấu hình multi-instance; nếu chưa có shared store, ghi giới hạn rõ, không gọi limiter local là bảo đảm phân tán.
4. Web phân biệt invalid/revoked session với `429`, `5xx` và lỗi mạng. Phiên bị từ chối thật phải logout/fail closed; lỗi tạm thời có trạng thái báo thử lại, không tự coi là đã hết phiên.
5. Tôn trọng `Retry-After`, coalesce refresh đang chạy và giới hạn backoff; không tạo retry loop hoặc dùng access token hết hạn để gọi API có quyền.
6. Khi bootstrap chưa khôi phục được session, hiển thị trạng thái tạm thời/thử lại thay vì render nội dung có bảo vệ hoặc redirect login giả. Logout/đổi account/unmount phải vô hiệu hóa phản hồi refresh cũ.

### Regression và điều kiện đóng UAT-02

- [ ] Nhiều session hợp lệ cùng IP, nhiều hard reload và gọi register/reset không làm cạn chung bucket refresh như trước.
- [ ] Thực sự vượt ngân sách refresh vẫn nhận 429 với retry semantics rõ; spoofed key, thiếu cookie và token invalid không vượt auth/limiter.
- [ ] Web gặp 429/network/503 giữ trạng thái tạm thời và phục hồi sau retry; không mất draft vì redirect login giả.
- [ ] 401 do refresh hết hạn/thu hồi vẫn kết thúc phiên đúng; không giữ quyền bằng token đã hết hạn.
- [ ] Nhiều request đồng thời chỉ dùng refresh coalesced; logout/đổi account trong khi chờ không bị phản hồi cũ đăng nhập lại.
- [ ] Playwright có ca 429 với delayed response và hard reload; UAT ba browser context cùng mạng được chạy lại, ghi request/status/Retry-After không có token/cookie.

## 5. UAT-03: Cảnh báo kiểm tra claim phải theo request hiện tại

### Bằng chứng và điểm sửa

Popup trả đồ giữ `Vui lòng đợi hoàn tất kiểm tra claim.` sau khi claim đã tải và được chọn `Đã xác minh`; submit tiếp theo vẫn thành công. Đây là lỗi trạng thái hiển thị, không phải lý do bỏ gate claim/proof.

Đối chiếu [load reviews, validation và chọn người nhận](../../apps/web/src/pages/staff-page.tsx).

### Checklist thực hiện

1. Tách trạng thái đang tải review khỏi lỗi claim nghiệp vụ và lỗi field khác; disable submit khi kiểm tra đang chạy nhưng giữ draft/ảnh đã upload.
2. Khi đúng request của vật phẩm đang mở tải/xác minh xong, bỏ riêng cảnh báo loading đã hết hiệu lực. Chọn claim cập nhật validation tương ứng, không xóa toàn bộ lỗi một cách mù quáng.
3. Kiểm tra target item/operation generation trước khi sửa state; phản hồi trễ sau đổi A -> B -> A hoặc đóng popup không được ghi vào form mới.
4. Nếu load/xác minh thất bại, hiển thị lỗi và khả năng thử lại phù hợp; không bật trả đồ như đã xác minh thành công.

### Regression và điều kiện đóng UAT-03

- [ ] Delayed load: không submit khi chưa biết review; khi tải xong cảnh báo loading cũ biến mất.
- [ ] Claim chưa xác minh, sai người nhận, claim cạnh tranh/dispute và legal hold vẫn bị chặn.
- [ ] Lỗi điện thoại, giấy tờ, checkbox và proof vẫn có thông báo đỏ đúng field; sửa loading không xóa lỗi chưa giải quyết.
- [ ] Đổi item, đóng/mở popup và A -> B -> A trong khi request đang chờ không làm lẫn claim/recipient/error/draft.
- [ ] Upload proof đang chạy, load failed/retry và hai submit liên tiếp có trạng thái busy/idempotency đúng.
- [ ] Kiểm tra bàn phím/mobile của popup và preview lồng; UAT lại trường hợp đã tái hiện, lưu ảnh khi trạng thái đã ổn định.

## 6. Ma trận kiểm thử lại và nghiệm thu bổ sung

Các mục dưới đây là khoảng trống bằng chứng hoặc regression cần giữ, không mặc định là bug mới. Các luồng kho đã PASS trong UAT vẫn cần smoke sau sửa auth/UI hoặc rollout.

| Nhóm | Trường hợp bắt buộc | Bằng chứng cần ghi |
| --- | --- | --- |
| Trả trực tiếp | FOUND-LOST matching; photo-backed LOST không FOUND; accept/reject/cancel; một/hai xác nhận; mismatch/correction; no-show; legacy | Status API/DB, timeline và trạng thái cả hai bài; không giả bàn giao vật lý |
| Kho | FOUND chưa xác minh -> custody -> intake -> Staff xác minh -> trả; LOST không FOUND; cặp matching; Walk-in offline; EXPIRED chưa disposition | Giữ identity/proof/claim/hold gates, ảnh SOURCE_POST/INTAKE/RETURN và RETURNED log không trùng |
| Quyền và tranh chấp | Người ngoài đọc chat/evidence/journey; Admin không tham gia; hai người nhận cạnh tranh; pending report/legal hold; account bị khóa | Denial đúng, không lộ private data, không có hai completed return; SQL race trên DB cô lập trước |
| Email | Inbox được phép nhận, deep link có auth, quiet hours/disabled/digest, hủy/custody, SMTP chậm, shutdown và kết quả gửi chưa rõ | Receipt enqueue/worker/inbox riêng; không gửi người ngoài scope, không công bố nội dung riêng tư |
| Media | Proxy authenticated, restart/multi-instance, thiếu cấu hình/lỗi provider, acknowledgement loss, retry và cleanup | Không xóa asset còn có thể đã được DB tham chiếu, không local-write fallback kho production, không tạo success giả |
| Accessibility | Modal/focus restoration, Tab/Shift+Tab, Escape/busy/nested preview, mobile và screen reader | Playwright + kiểm tra thủ công thiết bị; không suy ra conformance từ một screenshot |
| Vận hành | Mất kết nối/DNS/timeout, failover, nhiều instance, tải đồng thời và worker drain | SLO/ngưỡng nghiệm thu được owner duyệt, error/recovery receipts; không stress/destructive test Aiven chưa được phép |
| Nghiệm thu ngoài đời | Vật phẩm, ảnh và người nhận thật; đối chiếu giấy tờ và tình trạng tại quầy | Biên bản riêng tư được phép lưu; ảnh UAT tổng hợp không thay chứng nhận vật lý |

Tham khảo [đối soát media](../runbooks/media-upload-reconciliation.md), [rollout ảnh kho](../runbooks/warehouse-media-rollout.md), [quy tắc kho](../workflows/warehouse-retention-and-status-rules.md), [quy tắc email](../workflows/notification-email-rules.md) và [history review 053/055](../audits/migration-history-review-2026-10-05.md). Historical custody links cần review bằng dữ liệu thực; nếu thiếu bằng chứng, giữ trạng thái chưa xác minh, không tự sửa quan hệ.

## 7. Verification và bàn giao

Chạy từ workspace chính sau khi sửa code. Bảng này là lệnh cần chạy trong đợt sửa, chưa phải kết quả của đợt tạo kế hoạch.

| Kiểm tra | Lệnh / điều kiện |
| --- | --- |
| Unit, architecture và Web typecheck | `npm test` bình thường, không `--test-force-exit` |
| Build | `npm run build` |
| Toàn bộ browser suite | `npm --workspace @lnfs/web run e2e:home` |
| Production dependencies | `npm audit --omit=dev` |
| UC catalogue | `node scripts/check-uc-catalogue.mjs` dùng `docs/requirements/uc.md` |
| SQL integration | `LNFS_DB_INTEGRATION=1` cùng `LNFS_TEST_DB_*` được xác nhận trỏ DB cô lập `_test`; tuyệt đối không dùng shared Aiven |
| Migration preflight | `npm run migrate:preflight` read-only trên đúng target được cho phép; báo pending, warnings và giới hạn lịch sử |
| Diff | `git diff --check`, review cả file mới/untracked và tài liệu đã chuyển đường dẫn |
| Remote CI sau khi được yêu cầu push | MySQL 8.0/8.4 và browser jobs của đúng candidate SHA; CI xanh cũ không chứng nhận code mới |

Ghi số pass/fail/skip, môi trường/provider thật hay mock, commit hoặc dirty worktree, thời gian và đường dẫn evidence được bảo vệ. SQL skips trong suite thường phải được giải thích và chạy riêng trên DB cô lập khi nghiệm thu thay đổi liên quan. Không skip hoặc đổi expectation để che bug.

Không nâng UC thành Implemented/Verified hoặc đổi điểm audit chỉ vì tests pass. Bug fix không tự tạo UC ID mới; chỉ đổi BR/FR/UC/traceability khi thực sự có rule/actor goal mới được nhóm duyệt. Giữ snapshot báo cáo gốc; ghi follow-up riêng cho candidate mới.

### Checklist báo cáo kết quả

- [x] UAT-01/02/03 có disposition riêng: đã sửa, đã kiểm chứng, còn cần nghiệm thu hoặc bị chặn và lý do.
- [ ] Rollout có phê duyệt/backup/restore/preflight receipt; không đánh đồng schema applied với app deployed.
- [x] Có kết quả suites/regression mới; lỗi harness/kỳ vọng sai được phân biệt với bug sản phẩm. Shared UAT vẫn chờ rollout 063, không được coi là đã PASS.
- [x] Các giới hạn lịch sử, email/provider/manual/load/failover còn lại được nêu rõ; không tuyên bố done toàn bộ hoặc main/production sẵn sàng khi chưa đủ bằng chứng.
- [x] Không tự commit/push/merge; nếu được yêu cầu sau này, review file/attribution và CI đúng candidate trước quyết định release.

## 8. Follow-up thực hiện

Xem [receipt chi tiết](../audits/uat-repair-verification-2026-10-06.md). Refresh đã tách quota, phân loại lỗi tạm thời/revoked và chặn phản hồi phiên cũ. Popup đã tách loading khỏi lỗi field, fail closed khi review lỗi và giữ draft/proof khi retry. Backup chụp DDL native thay vì bản ANSI thiếu options; 64 bảng/4.421 dòng đã restore và rehearsal additive 063 thành công trên helper cô lập.

Shared Aiven vẫn pending 063; checklist đóng UAT-01 chưa được đánh dấu. Regression local không thay shared UAT, inbox thật, manual bàn giao, load/failover hay CI đúng candidate. Không sửa UC/điểm audit hoặc các giới hạn lịch sử 053/055.

Receipt cuối: `npm test` 401 PASS/30 opt-in skips (SQL đã chạy riêng), full API/SQL 469/469, Playwright 105/105, build PASS, audit production 0 vulnerabilities; UC/architecture/link/diff checks PASS. Helper đã shutdown; generated datadir còn cần cleanup và không được public artifact. Không commit/push/merge.
