# Báo cáo kiểm thử FE-13 đến FE-17 — 2026-10-11

- Workspace: repository root (local workspace path omitted).
- Branch: sequence-diagram
- HEAD: f49cd0a (docs: add member-grouped use case sequence diagrams)
- Phạm vi: file đính kèm ghi tiêu đề FE-13 (15 case), nhưng nội dung còn có FE-14 đến FE-17; tổng cộng 83 test case.
- DB: Aiven dev đã được xác nhận là môi trường dev. Chỉ chạy migration preflight read-only; không tạo/sửa/xóa dữ liệu nghiệp vụ, không chạy migration và không gửi email thật.
- File mẫu full-system-test-and-excel-repair-brief-2026-10-11.md được dùng tham khảo cấu trúc. File đó ghi branch/HEAD khác, không dùng kết quả cũ làm bằng chứng cho lần này.

## Kết luận

Đã phân loại đủ 83/83 ID: **37 Đạt, 23 Một phần, 19 Không đạt, 4 Bị chặn**. Có 79 case được đánh giá từ test tự động và đối chiếu implementation; 4 case cần fixture DB cô lập hoặc thao tác disposition có thể đổi trạng thái vật phẩm không thể hoàn tác an toàn nên chưa nghiệm thu runtime.

“Đạt” ở bảng dưới nghĩa là contract tương ứng có test tự động và/hoặc kiểm tra route/logic trong working tree hiện tại. Đây không phải nghiệm thu thủ công trên production. Các test Playwright phần lớn mock API; không thay thế SQL integration hoặc UAT trên deployment.

## Kết quả kiểm thử

| Phạm vi | Kết quả |
|---|---|
| npm test | Pass: 413, fail: 0, skip: 32 (445 test); các SQL integration cần MySQL cô lập được skip theo cấu hình hiện tại. |
| npm run build | Pass: API TypeScript build và Web TypeScript/Vite production build. |
| Playwright toàn bộ apps/web | Pass: 146, fail: 0, skip: 0. Có Admin audit UI, journey responsive, notification navigation và Staff/kho; chưa có browser test riêng cho system-config UI hay notification-preferences UI. |
| Bộ test API/domain liên quan | Pass: 96, fail: 0, skip: 0; gồm admin reporting, activity ACL/export, system config, claims/privacy, warehouse return/verification và notification email worker. |
| Aiven dev migration preflight | Read-only pass: 59 migration nguồn, 62 đã áp dụng, 29 attempts, 0 pending, 0 superseded. Còn cảnh báo lịch sử 040/045/047/048/053/055; chi tiết bên dưới. |
| UC catalogue | 168 UC: 129 Implemented, 21 Partial, 18 Planned. Đây là kiểm tra catalogue, không phải bằng chứng UAT. |

## FE-13 — Dashboard, Statistics & Audit (15 case)

| Test Case ID | Kết quả | Bằng chứng / nhận xét |
|---|---|---|
| TC-UC-084-01 | Đạt | Dashboard KPI, tổng trạng thái và trend được kiểm tra trong admin-reporting.use-cases.test.ts; endpoint được bảo vệ Admin. |
| TC-UC-084-02 | Đạt | Admin route group yêu cầu xác thực và role ADMIN; app test kiểm tra role boundary. |
| TC-UC-084-03 | Đạt | Test dashboard kiểm tra khoảng ngày, bucket theo ngày và snapshot/tổng hiện tại riêng biệt. |
| TC-UC-085-01 | Đạt | Thống kê hỗ trợ CSV/JSON; test kiểm tra cấu trúc export và audit thành công. |
| TC-UC-085-02 | Đạt | Export thống kê nằm sau Admin role gate; app test xác nhận API role boundary. |
| TC-UC-085-03 | Đạt | Export lấy các aggregate/section allowlist; format không hợp lệ bị validator từ chối và ghi nhận export failure. |
| TC-UC-163-01 | Đạt | Admin audit API/UI hỗ trợ actor, target, source, thời gian và text query trên action/reason; test Playwright lọc audit. |
| TC-UC-163-02 | Đạt | Activity use-case từ chối Staff/User; HTTP route chỉ cho ADMIN. |
| TC-UC-163-03 | Đạt | Filter schema giới hạn source, actorId, targetId, from/to và query; repository áp dụng các filter tương ứng. |
| TC-UC-164-01 | Một phần | Người tham gia xem claim/verification history hiện có; catalogue xác nhận chưa có full history UI và quyền xem case tổng quát cho Staff/Admin. |
| TC-UC-164-02 | Đạt | Claim read use-case từ chối outsider trước khi đọc/đụng legacy state; test xác nhận. |
| TC-UC-164-03 | Đạt | Test xác minh không trả raw verification answer; API chỉ đưa lịch sử trong phạm vi claim được phép. |
| TC-UC-166-01 | Đạt | Admin export audit/moderation CSV/JSON theo filter, giới hạn 5.000 dòng và ghi audit export. |
| TC-UC-166-02 | Đạt | Activity export chỉ cho ADMIN; test xác nhận Staff/User bị từ chối. |
| TC-UC-166-03 | Đạt | Export projection chỉ gồm metadata allowlist; CSV formula được neutralize, không xuất private note/evidence. |

## FE-14 — System Configuration (18 case)

| Test Case ID | Kết quả | Bằng chứng / nhận xét |
|---|---|---|
| TC-UC-086-01 | Đạt | Public config trả giá trị đã parse theo kiểu dữ liệu; use-case test xác nhận. |
| TC-UC-086-02 | Đạt | Public response chỉ lấy key allowlist/prefix client được cho phép; test credential-like key không bị lộ. |
| TC-UC-087-01 | Đạt | API list hỗ trợ q, valueType, isPublic, page/pageSize; test use-case/HTTP cover list contract. |
| TC-UC-087-02 | Đạt | Config router yêu cầu authenticated ADMIN. |
| TC-UC-088-01 | Đạt | Create config ghi CREATE history và admin audit trong transaction; service test xác nhận. |
| TC-UC-088-02 | Đạt | Tạo config nằm trong Admin-only route group. |
| TC-UC-088-03 | Đạt | INTEGER/FLOAT/BOOLEAN/JSON được parse và validate; test từ chối giá trị INTEGER sai kiểu. |
| TC-UC-089-01 | Đạt | GET detail đọc theo config ID và trả giá trị hiện tại đã redaction nếu nhạy cảm. |
| TC-UC-089-02 | Đạt | Detail route thuộc Admin-only config router. |
| TC-UC-090-01 | Không đạt | History endpoint chỉ nhận limit và SQL LIMIT; chưa có page/cursor/hasMore nên không thể chuyển trang lịch sử. |
| TC-UC-090-02 | Đạt | History route nằm trong Admin-only config router. |
| TC-UC-090-03 | Một phần | Truy vấn ưu tiên config_id và cô lập key; nhánh legacy config_id IS NULL lọc theo config_key có thể gộp history của config cũ cùng key sau xóa/tạo lại. Chưa có SQL integration để xác minh tình huống này. |
| TC-UC-091-01 | Đạt | Update lưu actor, reason, trạng thái trước/sau vào history và audit trong transaction; service test cover. |
| TC-UC-091-02 | Đạt | Update config chỉ Admin. |
| TC-UC-091-03 | Đạt | Schema/type validation và reason được kiểm tra; update history giữ typed values trước/sau. |
| TC-UC-092-01 | Đạt | Xóa config tồn tại và ghi DELETE history/admin audit; use-case test chạy CRUD. Chưa thử xóa config thật trên Aiven. |
| TC-UC-092-02 | Đạt | Delete route chỉ Admin. |
| TC-UC-092-03 | Đạt | Test CRUD xác nhận history sau xóa; implementation ghi ADMIN_CONFIG_DELETED trong cùng transaction. |

## FE-15 — Warehouse Retention & Disposition (44 case)

| Test Case ID | Kết quả | Bằng chứng / nhận xét |
|---|---|---|
| TC-UC-148-01 | Một phần | Có deadline indicator, overdue count và status filter; list API chưa có filter overdue theo deadline/legal hold authoritative. EXPIRED không tương đương lọc quá hạn. |
| TC-UC-148-02 | Đạt | Warehouse routes yêu cầu Staff/Admin sau các custody self-service routes. |
| TC-UC-148-03 | Một phần | Execute disposition có chặn legal hold; danh sách overdue/eligible chưa loại trừ hold như một bộ lọc nghiệp vụ đầy đủ. |
| TC-UC-149-01 | Một phần | Màn kho có deadline, ảnh và storage logs; chưa có một detail projection đầy đủ deadline + claim/dispute + appointment + hold + eligibility. |
| TC-UC-149-02 | Đạt | Chi tiết kho nằm trong Staff/Admin route group. |
| TC-UC-149-03 | Bị chặn | Cần một fixture đồng thời overdue + legal hold + conflict/appointment. Không có fixture phù hợp; Aiven preflight còn cảnh báo lịch sử/schema disposition nên không tạo dữ liệu để suy diễn. |
| TC-UC-150-01 | Không đạt | Maintenance hiện chỉ quét custody request đã quá hạn để gửi OVERDUE; chưa có nhắc trước hạn và chưa bao phủ walk-in item tổng quát. |
| TC-UC-150-02 | Một phần | Maintenance gửi notification, không đổi trạng thái/tiêu hủy warehouse item; chưa chạy scheduler với fixture cô lập để xác minh runtime end-to-end. |
| TC-UC-151-01 | Một phần | Execute recheck deadline, claim/appointment/dispute và legal hold trong transaction; chưa có eligibility preview/read endpoint trước khi bắt đầu xử lý. |
| TC-UC-151-02 | Không đạt | Không có API/UI riêng để Staff kiểm tra eligibility và xác minh role denial trên chức năng đó. |
| TC-UC-151-03 | Bị chặn | Source có gate legal hold/case conflict ở execute, nhưng không chạy được transaction test trên fixture MySQL cô lập; không tạo lệnh thật trên DB dùng chung. |
| TC-UC-152-01 | Một phần | API Admin đặt/gỡ hold, yêu cầu reason và ghi storage log; chưa có Admin UI hoặc kiểm thử DB integration cho thao tác này trong lượt chạy. |
| TC-UC-152-02 | Đạt | Use-case kiểm tra Admin trước khi thay đổi legal hold; route kho có Staff/Admin group và service giữ Admin-only gate. |
| TC-UC-152-03 | Một phần | Reason bắt buộc và storage log được ghi trong code; chưa xác nhận insert/update thật trên schema hiện tại do cảnh báo preflight. |
| TC-UC-153-01 | Một phần | Có per-item request tạo approval cho DISPOSED/DONATED/TRANSFERRED; chưa có order list/detail UI hay positive DB workflow. |
| TC-UC-153-02 | Đạt | requestDisposition kiểm tra Admin ở application service. |
| TC-UC-153-03 | Không đạt | Tạo approval hiện chỉ lock item và ghi request; không kiểm tra deadline, legal hold, trạng thái hay blocking case trước khi tạo lệnh. Các gate chỉ chạy khi execute. |
| TC-UC-154-01 | Không đạt | Không có GET list/detail/history cho warehouse approvals; chỉ có approve/execute POST. |
| TC-UC-154-02 | Một phần | Router group chặn actor không phải Staff/Admin, nhưng endpoint xem approval chưa tồn tại nên chưa kiểm chứng được authorization theo đối tượng. |
| TC-UC-154-03 | Không đạt | Staff/Admin không có màn/API xem item, lý do, trạng thái duyệt, proof và lịch sử order. |
| TC-UC-155-01 | Bị chặn | Có endpoint approve yêu cầu Admin khác người tạo; positive approval cần item đủ điều kiện và hai Admin. Không dựng order/fixture trên Aiven hay chạy destructive SQL trên DB dùng chung. |
| TC-UC-155-02 | Đạt | approveDisposition kiểm tra role Admin và không cho requester tự duyệt. |
| TC-UC-155-03 | Không đạt | approveDisposition chỉ kiểm tra trạng thái PENDING và người duyệt khác requester; không kiểm tra retention/claim/appointment/dispute/hold tại bước duyệt. Execute mới recheck. |
| TC-UC-156-01 | Không đạt | Không có route/use-case/UI reject approval order. |
| TC-UC-156-02 | Một phần | Staff route group có role gate, nhưng reject endpoint không tồn tại nên không thể test quyền trên thao tác thật. |
| TC-UC-156-03 | Không đạt | Không có reject reason/history hoặc regression xác nhận custody không đổi sau reject. |
| TC-UC-157-01 | Không đạt | Không có route/use-case hủy approval đã duyệt hoặc audit reason. |
| TC-UC-157-02 | Một phần | Có Staff/Admin route group, nhưng cancel endpoint không tồn tại để xác minh object-level authorization. |
| TC-UC-157-03 | Không đạt | Không có workflow phân biệt lệnh đã bắt đầu xử lý để chặn cancel. |
| TC-UC-158-01 | Bị chặn | Execute có đường attach private proof và chuyển trạng thái item, nhưng positive disposition là terminal business mutation; không thực hiện trên DB dùng chung, cần isolated MySQL + fixture/phê duyệt riêng. |
| TC-UC-158-02 | Một phần | Upload/execute route nằm trong Staff/Admin scope; chưa có integration test xác nhận role/proof ownership qua DB trong lượt này. |
| TC-UC-158-03 | Một phần | Code yêu cầu approval APPROVED, proof đúng item/actor và chưa attach; chưa chạy positive/negative DB workflow với schema đã xác nhận. |
| TC-UC-159-01 | Không đạt | Không có donation campaign model/route/UI để tạo campaign. |
| TC-UC-159-02 | Một phần | Admin router áp role gate, nhưng campaign endpoint không tồn tại; chỉ xác minh được gate nhóm, không xác minh quyền trên thao tác thật. |
| TC-UC-159-03 | Không đạt | Không có create contract để validate trường bắt buộc. |
| TC-UC-160-01 | Không đạt | Không có update campaign route/use-case. |
| TC-UC-160-02 | Một phần | Admin route group có role gate; campaign update endpoint không tồn tại. |
| TC-UC-160-03 | Không đạt | Không có campaign change history. |
| TC-UC-161-01 | Không đạt | Không có route thêm/bỏ warehouse item khỏi campaign. |
| TC-UC-161-02 | Một phần | Admin route group có role gate; assignment endpoint không tồn tại để kiểm tra quyền thực tế. |
| TC-UC-161-03 | Không đạt | Không có campaign-item workflow để chặn bỏ item đã xử lý. |
| TC-UC-162-01 | Không đạt | Không có campaign completion workflow. |
| TC-UC-162-02 | Một phần | Admin route group có role gate; completion endpoint không tồn tại. |
| TC-UC-162-03 | Không đạt | Không có kiểm tra phê duyệt/bằng chứng trước khi đóng campaign. |

## FE-16 — End-to-End Item Journey (3 case)

| Test Case ID | Kết quả | Bằng chứng / nhận xét |
|---|---|---|
| TC-UC-167-01 | Một phần | API projection và trang journey có post, matching, claim/chat, custody, warehouse, return/feedback summary; Playwright responsive pass. SQL integration suite bị skip nên chưa xác minh full timeline trên DB cô lập. |
| TC-UC-167-02 | Đạt | Journey use-case trả not-found cho post ngoài phạm vi viewer; unit test ACL xác nhận không lộ title/item. |
| TC-UC-167-03 | Một phần | Repository chỉ project metadata allowlist, bỏ message/answer/contact/proof và sắp theo created_at/id; browser fixture pass nhưng chưa có DB integration test cho nhiều event/claim thực. |

## FE-17 — Notification Delivery Preferences (3 case)

| Test Case ID | Kết quả | Bằng chứng / nhận xét |
|---|---|---|
| TC-UC-168-01 | Một phần | Preference API hiện có chatMode/claimMode: IMMEDIATE, DELAYED_UNREAD, DIGEST, DISABLED và quiet hours/timezone. Chưa có preference in-app hoặc PWA push; category matrix chưa đầy đủ. |
| TC-UC-168-02 | Đạt | Preference endpoints yêu cầu auth và lấy userId từ authenticated subject; API test xác nhận unauth bị từ chối và service scope theo user. |
| TC-UC-168-03 | Một phần | Worker/unit test cover cancel optional delivery khi notification đã đọc; OTP/reset flows tách khỏi preference. Chưa gửi SMTP thật hoặc xác minh provider delivery trên môi trường cô lập. |

## Findings cần ưu tiên

1. **P1 — UC-153 tạo approval trước khi kiểm tra điều kiện.** requestDisposition không chặn item chưa hết hạn, legal hold, claim/dispute hoặc trạng thái không hợp lệ; các check chỉ có ở execute. Xem warehouse.use-cases.ts, hàm requestDisposition và executeDisposition.
2. **P1 — UC-155 duyệt lệnh không kiểm tra eligibility.** approveDisposition chỉ yêu cầu Admin khác requester và trạng thái PENDING; có thể duyệt lệnh không đủ điều kiện rồi mới bị chặn ở execute.
3. **P1 — Lịch sử config thiếu phân trang và có nhánh gộp legacy theo key.** UC-090 endpoint chỉ có limit. Query legacy config_id NULL theo config_key có thể gộp history cũ cùng key khi config bị xóa rồi tạo lại.
4. **P2 — Retention alert thiếu nhắc trước hạn.** Maintenance chỉ chọn custody request quá hạn; không bao phủ walk-in và chưa có nhắc trước deadline.
5. **P2 — Workflow disposition chưa hoàn chỉnh.** Thiếu eligibility preview, approval detail/list, reject/cancel và toàn bộ donation campaign UC-159–162.
6. **P2 — Preferences chưa đủ các kênh yêu cầu.** Chưa có cấu hình in-app/PWA push; chỉ có email mode theo chat/claim.
7. **P2 — UC-164 chỉ một phần.** Participant history hiện có nhưng thiếu full history UI và quyền tra cứu tổng quát hợp lệ cho Staff/Admin.

## Giới hạn DB/deployment

Migration preflight chỉ đọc và báo 0 pending. Các cảnh báo lịch sử còn lại:

- 040/045/047/048 được nhận diện là compatibility records.
- Historical 053 ledger scope khác custody runtime schema đã phục hồi; không alias. Canonical 053 và additive 054 vẫn cần thiết; bảng disposition/legal-hold cũ chưa được chứng nhận bởi recovery.
- SQL gốc historical 055 chưa có; chỉ schema quan sát được kiểm tra, không replay tác động cũ.
- Không chạy migration, không sửa checksum/ledger và không chạy SQL integration/destructive trên Aiven.
- Không bật warehouse maintenance/email worker, không gửi SMTP, không thực hiện disposition terminal hoặc xóa/tạo config trên Aiven.
- 32 test bị skip trong npm test; test suite ghi rõ một số cần MySQL cô lập. Chưa có MySQL 8.0/8.4 isolated run trong lần này.

## Repo và phạm vi thay đổi

- Branch đang là sequence-diagram, HEAD f49cd0a.
- Trước khi làm đã có untracked apps/mobile/ và docs/audits/full-system-test-and-excel-repair-brief-2026-10-11.md; được giữ nguyên.
- Kiểm tra cuối lượt cũng thấy nhiều file .puml/.png trong docs/sequences ở trạng thái modified, docs/sequences/check.mjs modified và docs/sequences/repositories.mjs untracked. Đây là thay đổi ngoài phạm vi audit; được giữ nguyên và không đưa vào kết quả test.
- Tạo duy nhất report mới này. Không sửa source, không commit, push hay merge.

## Bằng chứng tham chiếu

- Admin dashboard/statistics routes: apps/api-node/src/modules/admin/interfaces/http/admin.routes.ts
- Audit/export/journey routes: apps/api-node/src/modules/activity/interfaces/http/activity.routes.ts
- Audit and journey projection: apps/api-node/src/modules/activity/infrastructure/activity.repository.ts
- Config history pagination/filter: apps/api-node/src/modules/system-config/interfaces/http/system-config.validator.ts và apps/api-node/src/modules/system-config/infrastructure/system-config.repository.ts
- Disposition gates and maintenance: apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts
- Warehouse route surface: apps/api-node/src/modules/warehouse/interfaces/http/staff.routes.ts
- Notification preference contract: apps/api-node/src/modules/notifications/interfaces/http/notification.validator.ts
- Current UC scope/status: docs/requirements/uc.md
