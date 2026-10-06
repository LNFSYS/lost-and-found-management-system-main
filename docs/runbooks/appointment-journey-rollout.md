# Lịch hẹn, bàn giao và hành trình vật phẩm - 06/10/2026

Receipt hiện tại: [release 06/10](../audits/dev-main-release-2026-10-06.md). Code đã push `dev`; CI MySQL 8.0/8.4 và browser đạt trên `d7dd7fa`, 063 đã áp dụng Aiven và shared smoke đã chạy. [Sửa UAT](../audits/uat-repair-verification-2026-10-06.md) và bảng local bên dưới là snapshot trước rollout; không dùng số test cũ làm receipt cuối. PR vẫn cần CI đúng HEAD sau cập nhật tài liệu, nghiệm thu inbox và bàn giao vật lý riêng.

## Phạm vi hiện tại

Runtime tại `<workspace>`, nhánh `dev`; không sử dụng project cũ. Đợt release đã commit/push code/tests/tài liệu, được phép áp dụng riêng 063 sau backup/restore/CI; chưa merge `main` hoặc chứng nhận deployment production. Giữ receipt và điểm audit lịch sử.

- Lịch hẹn riêng: `/appointments` và `/appointments/:id`; điểm vào từ navigation **Lịch hẹn** và **Tạo / xem lịch hẹn** trong chat.
- Đề xuất thời gian tương lai (ít nhất 1 phút, tối đa 90 ngày), điểm bàn giao active; chỉ bên nhận đề xuất được accept/reject. Một active attempt cho mỗi claim. Hủy có lý do 3-500 ký tự, giữ lịch sử và thông báo.
- Sau giờ hẹn accepted, Finder kiểm tra vật lý và xác nhận giao; người mất kiểm tra vật lý và xác nhận nhận. Một phía không hoàn tất. Hai xác nhận hợp lệ mới atomically hoàn tất appointment, resolve post liên quan và mở feedback hiện có.
- Mâu thuẫn giữ trạng thái chờ, không tự coi là đã trả. Có thể sửa phản hồi sau đối soát và kiểm tra vật lý mới; pending report vẫn chặn hoàn tất. Hai phản hồi âm có thể hủy với lý do, giữ history và không giả xác nhận nhận đồ. Một xác nhận dương/mâu thuẫn một phía không được âm thầm hủy/no-show.
- Sau 15 phút, nếu chưa bên nào phản hồi bàn giao, có thể báo bên còn lại không đến. Đây là ghi nhận một phía, đóng attempt chứ không hoàn tất item/claim, không tự xử phạt. Đề xuất mới giữ lịch sử attempt trước.
- Nhắc lịch qua transactional notification/email outbox sẵn có; không gửi SMTP bên trong transaction nghiệp vụ.
- Admin `/admin/audit`: search/filter nguồn, actor/target, từ khóa, thời gian; CSV/JSON cùng filter, tối đa 5000 dòng (vượt giới hạn báo lỗi, không cắt âm thầm), CSV formula protection và ghi audit export cùng transaction snapshot.
- **Xem hành trình vật phẩm** trong **Bài của tôi** mở `/posts/:id/journey`: sự kiện theo thời gian từ publication/matching availability/claim/chat/verification/appointment đến custody/kho/return/feedback, cùng summary custodian/location class, receipt/return time, custody duration và feedback eligibility.

## Quyền, tính đúng và privacy

Finder/owner được suy ra từ post ownership và participant thật bằng identity resolver hiện có, kể cả legacy reversed roles hoặc Finder nhắn LOST không đăng FOUND. Không đổi Finder thành Staff và không tự accept ownership. Photo-backed communication-only decision có thể đủ điều kiện trao đổi/đề xuất meetup nhưng không phải ownership proof hoặc warehouse release permission.

Mutation dùng claim/related-post/appointment locks, expected version, request UUID và payload hash. Lần đọc context ban đầu nằm trước transaction; sau khi giữ connection mọi đọc/ghi dùng transaction đó, không xin connection thứ hai và làm kẹt pool nhỏ. Retry cùng thao tác sau mất COMMIT acknowledgement đọc lại kết quả persisted, không tạo appointment/notification trùng; đổi payload cùng key là conflict. Không tự retry COMMIT mù hoặc trả thành công giả. Consent/account/current post, room blocks, competing cases, pending dispute/custody và retained warehouse source được kiểm tra lại trước accept/physical completion. Sau peer completion, Finder decision không được viết lại outcome.

Journey chỉ cho post owner hoặc participant thật của related claim, không có generic Staff/Admin bypass. Warehouse source history cần accepted FOUND linkage hợp lệ hoặc exact custody chain; rejected candidate không mở quyền xem kho. Không chọn/trả raw chat, verification answers, recipient name/phone/identity, private audit JSON/notes, proof/media references hoặc signed URLs. Admin audit chỉ trả metadata allowlist; reason hiện có được tìm server-side nhưng không render/export. Không mở quyền vào hội thoại từ audit metadata.

Journey là projection dữ liệu hiện có, không tạo event lịch sử giả. Matching availability là sự kiện thô từ current saved results, không chứng nhận immutable matching-job history. Summary độc lập với trang timeline; nguồn vật lý mơ hồ là UNKNOWN. Legacy return thiếu dual/custody evidence được ghi riêng, không mở feedback giả. Audit read/export không bổ sung các catalogue/domain writers còn thiếu của FR-AUDIT-01/UC-164.

## Nhắc lịch và giới hạn email

`APPOINTMENT_REMINDER_MINUTES=30` mặc định, giới hạn 1-1440 phút. Coalesced task kiểm tra mỗi 60 giây; conditional marker trong transaction giúp hai worker chỉ enqueue một reminder cho mỗi attempt/participant. Khi shutdown, task được drain trước khi đóng pool.

Giữ preference nhóm claim hiện có, verified/active email, quiet hours, unread cancellation, digest/disabled mode và lease fencing. In-app là nguồn chính thức. Final worker check chặn reminder của lịch hủy, đã qua giờ hoặc chuyển custody. Không thể thu hồi email đã được SMTP nhận trước một cancellation race. SMTP chậm, quiet hours, disabled/digest, downtime hoặc uncertainty quarantine có thể làm reminder không đến trước cuộc hẹn; đây là delivery best effort, không exactly-once hay guaranteed arrival. Email chỉ có metadata/deep link `/appointments/:id`, không chứa thông tin bàn giao riêng tư. Không thêm category preference mới chưa có UI.

## Schema và rollout

Forward-only [063_appointment_workflow.sql](../../apps/api-node/src/migrations/063_appointment_workflow.sql) thêm `return_appointment_workflows` và `appointment_events`; không sửa migrations đã chạy, enum cũ hoặc checksum lịch sử. **Đã áp dụng 063 trên Aiven** lúc `2026-10-06T11:19:52.254Z`, sau restore/rehearsal và CI xanh. Không chạy lại; môi trường khác còn thiếu schema vẫn phải fail closed 503/paused.

Postflight read-only `npm run migrate:preflight` sau rollout: 59 source migrations, 62 applied ledger entries, 29 APPLIED attempts; `pending: []`. Hai cảnh báo lịch sử vẫn nguyên: scope 053 khác recovered runtime và SQL gốc custody-time 055 chưa xác minh. Không ghi lại ledger/schema hay replay SQL để loại warnings.

Lịch hẹn cũ không có workflow metadata giữ version 0 và chỉ đọc trên cả UI/API. Không backfill/đoán xác nhận, không tự dùng status COMPLETED cũ để chứng nhận physical receipt. Active legacy appointment có thể chặn attempt mới; cần review riêng dựa trên history trước bất kỳ conversion/cancellation write nào.

Với target khác chưa có 063: DB owner xác nhận endpoint/database, read-only preflight, protected backup và restore rehearsal cô lập, review additive SQL/schema plan rồi phê duyệt migration write riêng. Không chạy destructive integration trên Aiven hoặc `npm run migrate` mù với `.env` shared. Không replay migration applied, xóa ledger hoặc sửa checksum. Giới hạn 053/055 và các custody link lịch sử vẫn ở [history review](../audits/migration-history-review-2026-10-05.md)/[recovery](database-warehouse-recovery.md). Không rerun rollout 16 ảnh kho đã hoàn tất.

Backup rehearsal ban đầu là snapshot **64 bảng/4.421 dòng**; backup mới ngay trước rollout là **64 bảng/4.426 dòng**. Cả hai được mã hóa ngoài Git, Windows ACL owner/SYSTEM, restore/rehearsal trên MySQL 9.3 loopback. Native DDL capture xử lý ANSI để không mất engine/collation, khôi phục settings session cả khi lỗi. Clone chỉ thêm 2 bảng và APPLIED 063; bảng/dữ liệu/ledger cũ giữ nguyên, runner lần hai không replay. Backup mới/receipt `063-applied.json` được đối chiếu trước write Aiven. Không dùng backup ANSI thử nghiệm chưa đạt restore check.

Deploy schema trước app/worker cần schema mới. Chỉ rollout app sau verification/CI đúng candidate; dừng/drain worker theo runbook hiện có. Khi rollback app, giữ schema/history mới, không DROP bảng hoặc replay 063. Không coi schema applied là deployment hay nghiệm thu nghiệp vụ.

## Snapshot Local Trước Sửa UAT

Các command bên dưới đã hoàn tất; không dùng receipt baseline để chứng nhận code mới:

| Kiểm tra | Kết quả / phạm vi |
| --- | --- |
| `npm test` bình thường | Lượt cuối: 399 pass, 0 fail, 30 opt-in SQL skips; architecture tests và Web typecheck pass, process tự kết thúc không force-exit. SQL skips được chạy riêng trên helper cô lập |
| Architecture | 204 production files, 0 violations, gồm type cycles |
| `npm run build` | Lượt cuối API/Web pass; workflow page lazy-load, main Web chunk 491.04 kB |
| Full opt-in API/SQL | 466 pass, 0 fail, 0 skip trên toàn bộ API suite trước sửa vị trí pool read cuối; không gọi receipt này là full suite của bản sau thay đổi đó |
| Final focused SQL/unit follow-up | 28/28 pass, 0 skip trên code cuối, gồm legacy read-only, one-connection pool proposal/accept/reminder, paired/no-FOUND journey ACL, lost COMMIT acknowledgement, dual completion/feedback, no-show/reminder suppression, pending dispute/custody/accounts. Unit fixture cũng kiểm tra không đọc qua pool khi đã giữ transaction |
| Playwright | 94/94 pass trên đầy đủ suite, hai worker: `node ../../node_modules/@playwright/test/cli.js test --workers=2` tại apps/web; không skip lỗi hoặc đổi expectations cũ |
| `npm audit --omit=dev` | 0 vulnerabilities trong lượt kiểm tra local |
| UC catalogue | `node scripts/check-uc-catalogue.mjs`: 168 IDs, 129 Implemented, 20 Partial, 19 Planned |

Browser reruns trước receipt xanh đã phát hiện matcher query thiếu và selector trùng nhãn summary/timeline trong fixture mới; đã sửa matcher/giới hạn selector, không bỏ test. Một lượt preview bị nhiễu bởi build ghi lại dist trong lúc browser chạy; chạy lại toàn bộ sau build, với hai worker và không đổi code/expectations của auth/home/Admin cũ. Receipt xanh chỉ lấy từ lượt đầy đủ đã hoàn tất.

SQL dùng server MySQL **9.3** độc lập, `127.0.0.1:33308`, fixture database `_test` tạo/drop riêng, UTC. Không dùng Aiven. Đây chưa phải exact new candidate CI MySQL 8.0/8.4; các job đó và browser CI phải chạy sau commit/push được yêu cầu. Browser route fixtures kiểm tra UI/interaction/late responses, không chứng nhận real SMTP hoặc shared runtime. Screenshot desktop/mobile và kiểm tra document overflow được lưu trong ignored `test-results`.

Full SQL dùng `npm --workspace @lnfs/api-node run test` với `LNFS_DB_INTEGRATION=1` và `LNFS_TEST_DB_*` chỉ vào helper loopback `_test`; final focused dùng Node với `--import tsx --import ./src/test/setup-env.ts --test` cho appointment integration/use-case tests và activity use-case tests. Không dùng `--test-force-exit`, destructive shared tests hoặc SMTP production để lấy receipt. `git diff --check` pass; UC catalogue/architecture/typecheck/build pass. SQL helper đã được dừng sau kiểm tra; không dừng API/Vite đang phục vụ người dùng.

Web dev đang chạy sẵn tại `http://localhost:5173/`; giữ nguyên server đó. Calendar trên shared Aiven đã qua schema gate sau rollout 063; đây là local API/Web dùng shared DB, không phải cloud deployment.

## UC và nghiệm thu còn lại

Implementation: UC-126/127/128/130/131/133, UC-134-140, UC-163/166/167. UC-125 chuyển Partial cho appointment producers đã có nhưng counter/reschedule/full channels còn thiếu. UC-129/132 vẫn Planned; UC-164, general Staff escalation, full disposition và delivery categories không tự nâng. Catalogue **168 = 129 Implemented + 20 Partial + 19 Planned**, còn 39 mục với assignee cũ; không thêm UC ID hay thay điểm lịch sử. Mapping FR-APPT-02/FR-AUDIT-02/FR-JOURNEY-01 và BR-72-74 dành cho yêu cầu/quy tắc nghiệp vụ thật, không tạo ID cho bug fix.

Manual UAT cần hai tài khoản thật cho FOUND thông thường và photo-backed LOST không FOUND: eligibility, accept/reject/cancel, hai xác nhận, mismatch/correction, no-show, pending report, chuyển custody, private journey và lịch legacy. Staff intake/verification/return tiếp tục là nhánh riêng với proof/identity/hold gates. Dùng provider-controlled recipients để kiểm tra nhắc email, preference/quiet hours, link auth, cancellation và shutdown, không gửi tới người dùng thật ngoài phạm vi chấp thuận.

Cần nghiệm thu thêm authorization/privacy/security sâu, keyboard/screen-reader/device accessibility, load/failover nhiều instance và vận hành reminder khi downtime. Không tuyên bố production/main sẵn sàng từ local mocks/tests. CI và shared smoke hiện tại nằm trong release receipt; inbox/physical acceptance và production deployment chưa được chứng nhận. Không tự merge `main`.
