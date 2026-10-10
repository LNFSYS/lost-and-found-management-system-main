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

Journey chỉ cho post owner hoặc participant thật của related claim, không có generic Staff/Admin bypass. Warehouse source history cần accepted FOUND linkage hợp lệ hoặc exact custody chain; rejected candidate không mở quyền xem kho. Không chọn/trả raw chat text, verification answers, recipient name/phone/identity, private audit JSON/notes, storage/provider references hoặc signed URLs. Ảnh hợp lệ có thể hiển thị qua proxy journey riêng, theo phạm vi bổ sung bên dưới; gateway kho Staff/Admin giữ nguyên. Admin audit chỉ trả metadata allowlist; reason hiện có được tìm server-side nhưng không render/export. Không mở quyền vào hội thoại từ audit metadata.

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

## Giao diện lịch hẹn - 07/10/2026

Phần dưới là snapshot kiểm chứng local trên `dev-clean` trước publish. Receipt publish và lượt kiểm tra rộng hơn xem [publish review 07/10](../audits/publish-review-2026-10-07.md). Giữ nguyên receipt và snapshot 06/10 ở trên; CI cũ không chứng nhận candidate mới.

- `/appointments` hiển thị thẻ có ảnh vật phẩm, tiêu đề, trạng thái, ngày giờ, điểm hẹn, vai trò của người xem và liên kết chi tiết. Bố cục 3 cột desktop, 2 cột tablet, 1 cột mobile.
- `/appointments/:id` hiển thị ảnh lớn, lịch hẹn và phản hồi hai bên; ảnh có thể phóng to bằng dialog có Escape/focus restoration. Không thay đổi kiểm tra vật lý, dual confirmation, dispute/custody/legacy gates, version hay idempotency.
- API chỉ chiếu ID của ảnh `ITEM` đầu tiên thuộc bài identity của claim, visibility `PUBLIC`, không hidden/deleted. Không lấy ảnh `EVIDENCE`, ảnh liên hệ LOST riêng tư hoặc raw provider/storage references. Danh sách vẫn dùng count và một truy vấn projection; không đọc từng bài đăng riêng để lấy ảnh.
- Client tải qua endpoint media hiện có, kèm authentication; ảnh thiếu/private dùng placeholder rõ ràng, lỗi tải có nút thử lại. Không dùng ảnh mẫu làm fallback production. Ảnh synthetic trong screenshots chỉ là browser fixture, không phải bằng chứng provider/UAT thật.
- Không thêm migration, không ghi Aiven và không chạy lại 063. Chỉ cập nhật mô tả UC-126/127 và mapping hiện có; không thêm ID hoặc nâng trạng thái UC.

| Kiểm tra local của đợt giao diện | Kết quả / giới hạn |
| --- | --- |
| `npm test` bình thường | 413 pass, 0 fail, 32 opt-in SQL skips; architecture và Web typecheck pass, process tự kết thúc |
| `npm run build` sau sửa CSS cuối | API/Web pass |
| Playwright focused | 33/33 pass: toàn bộ `appointment-journey.spec.ts` (15) và `notification-navigation.spec.ts` (18); không gọi đây là full browser suite |
| Native SQL focused | 11/11 pass, 0 skip: `appointment.integration.test.ts` trên MySQL 9.3 loopback UTC; gồm ITEM/private/hidden/deleted media, participant ACL, dual handover, reminder, mismatch, no-show, custody gates, journey và lost COMMIT acknowledgement |
| UC catalogue | 168 IDs: 129 Implemented, 21 Partial, 18 Planned; đợt UI không thay đổi số lượng/trạng thái |
| Visual QA | Screenshots và ảnh decode thực tế tại 1440/768/390/320px; không tràn ngang. Retry/zoom/Escape/focus restoration được kiểm thử |

Lượt native SQL đầu phát hiện helper cô lập dùng timezone hệ điều hành trong khi fixture/client đọc UTC, khiến timeline snapshot không thấy các event DB có giờ lệch. Lượt cuối khởi động server với timezone `+00:00`, kiểm tra UTC offset bằng 0 và chạy lại đủ 11 ca, không sửa hoặc bỏ assertions. Helper/server cô lập đã dừng; API/Vite của người dùng giữ nguyên. Đây không phải kiểm tra CI MySQL 8.0/8.4, SMTP inbox, production deployment hay nghiệm thu bàn giao vật lý mới. Chưa chạy lại full browser suite trong đợt giao diện này.

## Ảnh trong hành trình - 10/10/2026

Phạm vi local chưa commit/push trên `main`; mở rộng UC-167, FR-JOURNEY-01 và BR-74, không thêm UC hoặc migration. Các receipt trước vẫn là snapshot lịch sử.

- Mốc đăng bài có ảnh ITEM của bài đó; ảnh PHOTO đã chia sẻ trong cuộc trao đổi có mốc riêng theo thời gian lưu ảnh. Ảnh kiểm tra trước liên hệ LOST được lấy từ evidence đã gắn vào cuộc trao đổi, không từ bản nháp AI.
- Mốc tiếp nhận có ảnh condition của phiên intake đã xác nhận, gắn đúng vật phẩm. Mốc hoàn tất trả từ kho có proof đã attach trong `warehouse_completed_returns.proof_ids`, không lấy từ note/log hoặc proof chưa sử dụng.
- Proxy `/api/posts/:postId/journey/images/:kind/:imageId` kiểm tra lại current post/participant/consent, item chưa xóa và snapshot. Không có quyền xem thay nhờ role Staff/Admin. Ảnh trả đồ chỉ cho người nhận thực tế hoặc Finder của claim trong chính completed return đó; claimant khác không được xem receipt.
- Không tự công khai giấy tờ, ảnh post EVIDENCE, chứng từ người nhận offline, private messages/answers/contact details, storage refs hoặc signed URLs. Gateway kho Staff/Admin giữ nguyên. Trả trực tiếp không có ảnh đã lưu thì không tạo ảnh giả; ảnh không chứng minh đang cầm đồ hay quyền sở hữu.
- Thumbnail có nhãn và thời gian, mở dialog ảnh lớn bằng bàn phím, Tab/Shift+Tab, Escape và trả focus; lỗi ảnh có retry, không làm mất timeline. Gallery theo snapshot/paging và được tháo khi chuyển vật phẩm.

| Kiểm tra local của đợt ảnh hành trình | Kết quả / giới hạn |
| --- | --- |
| `npm test` bình thường | 418 pass, 0 fail, 34 opt-in SQL skips; architecture 205 production files/0 violations, Web typecheck pass; process tự kết thúc |
| `npm run build` | API/Web pass; API build chạy lại sau cập nhật test cuối cũng pass |
| Playwright focused | 73/73 pass: item-journey-media, appointment-journey, claims-resilience, posts-page, story-post-form; không gọi đây là full browser suite |
| Native SQL media | 2/2 pass, 0 skip: journey-media.integration.test.ts trên MySQL 9.3 loopback UTC cô lập; FOUND/LOST-photo-only, intake/verified return, byte delivery, consent/outsider/Admin/Staff/cross-post/type/snapshot/deleted-item gates, draft/document/unattached proof exclusions |
| UC catalogue | 168 IDs: 129 Implemented, 21 Partial, 18 Planned; không nâng trạng thái hoặc thay số lượng UC |
| Visual QA | Ảnh PNG fixture decode đủ 600px và screenshots ở 1440/768/390/320px; preview/focus và không tràn ngang đã kiểm tra |

MySQL `DATETIME(0)` có thể làm tròn thời gian vừa ghi lên giây kế tiếp; fixture chờ đúng `completed_at` authoritative trước khi tạo snapshot, không sửa clock/assertion để giả outcome. Không sửa Aiven hay chạy lại rollout media/063. Ảnh synthetic chỉ dùng trong tests, không thay evidence production. Chưa có candidate CI MySQL 8.0/8.4, provider acceptance hoặc manual UAT cho scope ảnh mới; không dùng các kết quả local này để chứng nhận deployment/main release.

## Popup Lịch Hẹn Và Chuyển Custody - 10/10/2026

Phạm vi local chưa commit/push trên `main`. Mở rộng các UC/BR/FR hiện có, không thêm ID, đổi trạng thái UC hoặc tạo migration. Các receipt ở trên vẫn giữ nguyên snapshot lịch sử.

- Nút Lịch hẹn trong chat mở popup danh sách, đề xuất và chi tiết ngay tại phòng hiện tại. Popup dùng chung xử lý với trang lịch hẹn: counterpart accept/reject, hủy có lý do, physical confirmation/dispute/no-show và lịch sử. Giữ nguyên draft chat, focus trap, Escape/focus restoration; không đóng khi mutation còn chạy. Preview ảnh lồng nhau chỉ đóng lớp trên cùng.
- Chọn một điểm bàn giao đang hoạt động hoặc nhập địa điểm riêng (trim, 3-255 ký tự, không control characters). Dùng `return_appointments.custom_location` có từ schema cũ; `handover_point_id` NULL khi địa điểm riêng. Idempotency hash của đề xuất điểm cũ không thay đổi; địa điểm mới thuộc payload replay. Eligibility, consent, account, duplicate-active, dispute và custody gates giữ nguyên. Điểm riêng chỉ dùng hẹn trực tiếp, không thay quầy Staff.
- Finder có Chuyển sang custody trong phần điều chỉnh quyết định gặp mặt. Nếu còn lịch hoạt động, phải mở popup và hủy lịch bằng quy tắc hiện có trước; không tự hủy hoặc ghi đè xác nhận bàn giao/mâu thuẫn. Chỉ sửa quyết định hợp lệ mới nhất của claim ACCEPTED, không thay quyết định từ chối/completed return/Staff verification. Audit thêm CUSTODY_ESCALATED với correctsEventId, giữ original Finder history và trạng thái claim; request không tự tiếp nhận hoặc cấp quyền trả đồ.
- Cả linked FOUND và no-FOUND LOST có ảnh Finder đã đối chiếu tiếp tục đi qua physical intake, explicit Staff verification và private proof/recipient/hold checks. Sau chuyển custody, popup không cho tạo lịch trực tiếp mới. Client retry giữ key khi payload không đổi, cấp key khác nếu sửa lý do/điểm/decision.

| Kiểm tra local của đợt popup/custody | Kết quả / giới hạn |
| --- | --- |
| `npm test` bình thường, lượt cuối | 424 pass, 0 fail, 37 opt-in SQL skips; architecture 205 files/0 violations và Web typecheck pass; process tự kết thúc |
| `npm run build`, lượt cuối | API/Web pass; appointments tiếp tục lazy-load, không thêm dependency |
| Full Playwright, sau build cuối | 163/163 pass, 0 fail/skip, hai workers. Bao gồm custom-location proposal/retry, mutation busy/Escape, owner accept, nested preview, draft/focus restoration, late read khi đóng/mở lại và hủy hẹn rồi chuyển custody |
| Native SQL focused | 22/22 pass, 0 skip: appointment.integration.test.ts và lost-custody-return.integration.test.ts trên MySQL 9.3 loopback UTC cô lập. Bao gồm custom location persist/list/replay, linked/no-FOUND meetup cancellation -> pending custody -> Staff receipt/verification -> return, cùng consent/identity/proof/dispute/reminder/legacy/acknowledgement regressions |
| UC catalogue / diff | 168 IDs: 129 Implemented, 21 Partial, 18 Planned; git diff --check pass |
| Visual QA | Screenshots popup proposal/detail ở 1440/390px, ảnh decode thực tế, keyboard focus và overflow checks pass. Ảnh browser fixture không phải chứng cứ bàn giao thật |

Helper MySQL đã dừng, fixture DB được drop; API/Vite của người dùng tại localhost giữ nguyên. Không đọc/ghi Aiven trong đợt này, không chạy lại 063 hay rollout media. Full browser dùng controlled API fixtures, SQL dùng provider analysis fixture và private local test media; chưa chứng nhận real SMTP, provider hoặc bàn giao vật lý. Manual UAT cần hai participant thật kiểm tra popup/custom location/notification và hủy hẹn trước custody; Staff thực hiện intake/verification/return thực tế. Exact candidate CI MySQL 8.0/8.4 và production acceptance vẫn là gates riêng sau khi commit/push được yêu cầu.
