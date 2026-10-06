# Đối chiếu trạng thái UC - 6 October 2026

**Snapshot lịch sử trước khi xây lịch hẹn/hành trình:** bảng 71 UC, số 113/20/35 và phân công 55 mục dưới đây được giữ nguyên theo baseline `195b134`. Follow-up local mới trong [appointment-journey-rollout.md](../runbooks/appointment-journey-rollout.md) bổ sung runtime; status hiện tại lấy từ [uc.md](../requirements/uc.md): 129 Implemented, 20 Partial, 19 Planned, còn 39 mục. Không dùng CI baseline để chứng nhận thay đổi mới.

## Phạm vi và kết quả

Rà **toàn bộ 71 dòng trước đó là Partial/Planned** trong [uc.md](../requirements/uc.md), trên `dev@195b134c34c3cee559187bfee13d05e78abf3bfe`, tại `F:/ky9/fptu-lost-found-system-main`. Đối chiếu route đang đăng ký, use case/repository, điểm vào giao diện thực tế và tests; không coi schema, component chưa được dùng, event writer hay tên nút là luồng đã hoàn chỉnh. 97 dòng Implemented cũ được giữ nguyên, không phải một đợt nghiệm thu lại 97 mục đó.

| Trạng thái | Trước đối chiếu | Sau đối chiếu |
| --- | ---: | ---: |
| Implemented | 97 | 113 |
| Partial | 18 | 20 |
| Planned | 53 | 35 |
| Tổng | 168 | 168 |

**16 UC được ghi nhận Implemented:** UC-098/099/100, UC-106/107/108/109, UC-120/121/122/124, UC-141/143/144/145/146. Đây là sửa nhãn của chức năng đã có, không phải vừa xây thêm 16 chức năng.

**14 UC Planned chuyển Partial:** UC-111/113/115/116/140/148/149/150/151/152/153/155/158/164. Có phần code hoạt động, nhưng còn thiếu scope cụ thể ở bảng bên dưới. Tổng còn 55 UC Partial/Planned; người phụ trách không đổi.

Implemented là **đủ mục tiêu triển khai trong repository**, có quyền truy cập và bằng chứng regression tương ứng, không đồng nghĩa đã nghiệm thu provider, deployment, an toàn tải lớn, screen reader hoặc chính sách nhà trường. Partial dành cho thiếu actor/behavior/UI thật sự; không giữ một mục Partial chỉ vì chưa nghiệm thu production. Không thêm ID UC/FR/BR hay tự nâng điểm project.

## Bằng chứng dùng để đối chiếu

Các mã E1-E8 trong bảng trỏ đến nhóm bằng chứng sau. Với mục còn Planned, kiểm tra các route/composition và điểm vào Web trong nhóm tương ứng: bảng SQL hoặc một helper dùng để chặn thao tác không thay thế actor workflow.

- **E1 - Matching:** [API](../../apps/api-node/src/modules/posts/interfaces/http/post.routes.ts), [feedback/pagination](../../apps/api-node/src/modules/matching/application/matching.use-cases.ts), [repository](../../apps/api-node/src/modules/matching/infrastructure/matching.repository.ts), [Web đánh giá/ẩn](../../apps/web/src/pages/post-matches-page.tsx), [worker](../../apps/api-node/src/modules/matching/application/matching-refresh.worker.ts), [composition](../../apps/api-node/src/main/server.ts). Tests: [feedback/owner scope](../../apps/api-node/src/modules/matching/application/matching.use-cases.test.ts), [isolated refresh/lease SQL](../../apps/api-node/src/integration/matching-refresh.integration.test.ts), [HTTP runtime](../../apps/api-node/src/test/http-runtime-scenario.ts), [browser](../../apps/web/tests/story-post-form.spec.ts). Feedback không phải pipeline huấn luyện; refresh không tạo thông báo match mới.
- **E2 - Claim/question/history:** [route](../../apps/api-node/src/modules/claims/interfaces/http/claim.routes.ts), [use cases](../../apps/api-node/src/modules/claims/application/claim.use-cases.ts), [repository](../../apps/api-node/src/modules/claims/infrastructure/claim.repository.ts), [chat/reply composer](../../apps/web/src/pages/claims-page.tsx), [modal hỏi đang được dùng](../../apps/web/src/components/claim-verification-question-modal.tsx), [quyết định human](../../apps/web/src/components/claim-verification-panel.tsx). Tests: [verification/private answers](../../apps/api-node/src/modules/claims/application/claim-verification.use-cases.test.ts), [claim list/notifications](../../apps/api-node/src/modules/claims/application/claim.use-cases.test.ts), [HTTP question/answer](../../apps/api-node/src/test/http-runtime-scenario.ts), [room resilience](../../apps/web/tests/claims-resilience.spec.ts), [Finder photo questions](../../apps/web/tests/lost-contact-photo.spec.ts). `claim-question-panel.tsx` không được trang chat dùng: không lấy component đó làm bằng chứng Web.
- **E3 - Private chat/notifications:** E2, [protected image](../../apps/web/src/components/claim-chat-image.tsx), [notification feed](../../apps/web/src/pages/notifications-page.tsx), [notification API](../../apps/api-node/src/modules/notifications/interfaces/http/notification.routes.ts), [SSE server](../../apps/api-node/src/modules/realtime/application/realtime.use-cases.ts), [preferences Web](../../apps/web/src/pages/notification-preferences-page.tsx). Tests: [SSE session/privacy](../../apps/api-node/src/modules/realtime/application/realtime.use-cases.test.ts), [private IMAGE/proof SQL](../../apps/api-node/src/integration/lost-custody-return.integration.test.ts), [email queue/worker](../../apps/api-node/src/modules/notifications/application/notification-email.test.ts). Server SSE chưa được chat Web subscribe; Web tải phòng bằng polling 10 giây. COUNT unread và UPDATE READ là SQL thật, không chỉ badge/state local.
- **E4 - Custody:** [Staff routes](../../apps/api-node/src/modules/warehouse/interfaces/http/staff.routes.ts), [request workflow](../../apps/api-node/src/modules/warehouse/application/custody-request.use-cases.ts), [repository](../../apps/api-node/src/modules/warehouse/infrastructure/custody-request.repository.ts), [Staff Web](../../apps/web/src/pages/staff-page.tsx), [physical intake](../../apps/web/src/components/warehouse-intake-dialog.tsx), [Finder chat action](../../apps/web/src/components/claim-verification-panel.tsx), [Finder cancellation](../../apps/web/src/pages/notifications-page.tsx). Tests: [policy/legacy gates](../../apps/api-node/src/modules/warehouse/application/custody-request.use-cases.test.ts), [real custody SQL/HTTP](../../apps/api-node/src/integration/custody-safety.integration.test.ts), [no-FOUND custody SQL](../../apps/api-node/src/integration/lost-custody-return.integration.test.ts), [desktop/mobile](../../apps/web/tests/staff-page.spec.ts). Finder không cần đăng FOUND nếu thỏa điều kiện photo-backed LOST; intake không xác minh ownership.
- **E5 - Retention/disposition/Staff review:** E4, [canonical operations](../../apps/api-node/src/modules/warehouse/application/warehouse.use-cases.ts), [repository/gates](../../apps/api-node/src/modules/warehouse/infrastructure/warehouse.repository.ts), [validator](../../apps/api-node/src/modules/warehouse/interfaces/http/warehouse.validator.ts), [custody notification producer](../../apps/api-node/src/modules/warehouse/application/custody-notifications.ts), [maintenance](../../apps/api-node/src/main/warehouse-maintenance.ts). Tests: [custody verification](../../apps/api-node/src/modules/warehouse/application/custody-verification.test.ts), [independent approval/hold/proof/overdue SQL](../../apps/api-node/src/integration/custody-safety.integration.test.ts). Staff UI không gọi API legal hold/disposition/reservation; guard khi execute không phải màn hình xem eligibility.
- **E6 - Appointment/direct return:** [claim routes](../../apps/api-node/src/modules/claims/interfaces/http/claim.routes.ts), [return routes](../../apps/api-node/src/modules/returns/interfaces/http/return.routes.ts), [main composition](../../apps/api-node/src/main/services.ts), [chat decision panel](../../apps/web/src/components/claim-verification-panel.tsx), [custody completed return](../../apps/api-node/src/modules/warehouse/infrastructure/warehouse.repository.ts). Chưa có appointment API/Web lifecycle. Nút đề xuất gặp mặt ghi decision; nút tạo lịch còn disabled. Canonical custody return có thể tạo completed appointment phục vụ feedback, nhưng không triển khai đề xuất/đổi lịch hay dual confirmation giữa Finder và Claimant.
- **E7 - Reports/audit:** [report target authorization](../../apps/api-node/src/modules/reports/infrastructure/report.repository.ts), [report use case](../../apps/api-node/src/modules/reports/application/report.use-cases.ts), [reports form](../../apps/web/src/pages/reports-page.tsx), [Admin routes](../../apps/api-node/src/modules/admin/interfaces/http/admin.routes.ts), [Admin reporting](../../apps/api-node/src/modules/admin/application/admin-reporting.use-cases.ts). Tests: [report lifecycle](../../apps/api-node/src/modules/reports/application/report.use-cases.test.ts), [report browser](../../apps/web/tests/reports-page.spec.ts), [Admin reporting](../../apps/api-node/src/modules/admin/application/admin-reporting.use-cases.test.ts). Có target HANDOVER theo participant; chưa có màn hình tìm kiếm audit toàn cục hoặc export raw moderation/audit. Export aggregate thống kê UC-085 không phải UC-166.
- **E8 - Scope chưa có runtime:** [API modules](../../apps/api-node/src/modules), [main services](../../apps/api-node/src/main/services.ts), [Web routes](../../apps/web/src/main.tsx), [warehouse routes](../../apps/api-node/src/modules/warehouse/interfaces/http/staff.routes.ts). Không có training/anonymization/model-version workflow, donation-campaign workflow hay projection journey xuyên module. Các bảng/migration và lịch sử sự kiện rời rạc không hoàn thành các mục đó.

## Kết quả từng UC

| UC | Trước | Sau | Bằng chứng và giới hạn thực tế |
| --- | --- | --- | --- |
| UC-097 | Planned | Planned | E1: chưa có producer thông báo match mới; không tính worker refresh là notification. |
| UC-098 | Partial | Implemented | E1: owner ẩn gợi ý bằng Web/API, persisted dismissal và replay; refresh không xóa quyết định. |
| UC-099 | Partial | Implemented | E1: owner đánh giá bằng Web/API, correlation-key replay và scope riêng. |
| UC-100 | Partial | Implemented | E1: worker đăng ký thật, lease/heartbeat/retry/shutdown và SQL fencing; nghiệm thu vận hành riêng. |
| UC-101 | Planned | Planned | E8: dữ liệu feedback chưa thành pipeline thu thập training đã phê duyệt. |
| UC-102 | Planned | Planned | E8: chưa có actor workflow gán nhãn training; rating gợi ý không tương đương. |
| UC-103 | Planned | Planned | E8: chưa có training anonymization pipeline. |
| UC-104 | Planned | Planned | E8: chưa có training job/model artifact. |
| UC-105 | Planned | Planned | E8: chưa có evaluation/version/activation workflow. |
| UC-106 | Partial | Implemented | E2: template/custom modal đang dùng và Finder-only suggestions từ photo analysis. |
| UC-107 | Partial | Implemented | E2: gửi structured question hoặc suggestion text; quyền Finder, state/retry và private room. |
| UC-108 | Planned | Implemented | E2: API answer và nút trả lời trong message composer; progress lưu lại, expected hash không trả ra. |
| UC-109 | Partial | Implemented | E2/E3: Finder xem answer private và evidence qua protected preview trước human decision. |
| UC-110 | Planned | Planned | E2: answered/minimum counters và photo score không phải confidence tính từ tổng câu trả lời/evidence. |
| UC-111 | Planned | Partial | E2/E4/E7: Finder custody escalation và participant report có; thiếu general Staff support-case cho cả hai bên. |
| UC-112 | Planned | Planned | E2/E4: queue custody không phải danh sách general escalated claims theo tuổi/handler. |
| UC-113 | Planned | Partial | E4/E5: custody source context và return-claim summaries có; thiếu general case messages/audit/detail. |
| UC-114 | Partial | Partial | E5: Staff xác minh sau intake có; chưa có general escalation reject/more-info decisions. |
| UC-115 | Planned | Partial | E2: list claim riêng biệt theo participant có; thiếu list/filter claimants theo FOUND nguồn. |
| UC-116 | Planned | Partial | E2: từng phòng có status/answer progress; chưa có cross-claim comparison. |
| UC-117 | Planned | Planned | E5: Staff warehouse reserve có, nhưng không phải Finder reserve trước meetup. |
| UC-118 | Planned | Planned | E5: Staff release có, nhưng không phải Finder release/no-show/reopen peer claim. |
| UC-119 | Partial | Partial | E3: SSE backend và Web polling có; thiếu subscribe new-message tức thì trong chat Web. |
| UC-120 | Partial | Implemented | E3: multipart IMAGE/PHOTO atomic, composer/preview/proxy và retry/room-fence; provider/manual QA riêng. |
| UC-121 | Planned | Implemented | E2/E3: repository COUNT unread theo counterpart, API summary, Web badge/filter. |
| UC-122 | Planned | Implemented | E2/E3: authorized listMessages gọi SQL markMessagesRead/read_at và hủy email unread. |
| UC-123 | Partial | Partial | E2/E3: claim status producers có; chưa đầy đủ mọi update/escalation category trong goal. |
| UC-124 | Planned | Implemented | E2/E3: chat notification cùng transaction, dedupe, optional email, post-commit publish và feed. |
| UC-125 | Planned | Planned | E6: chưa có appointment proposal/change/reminder/handover producer lifecycle. |
| UC-126 | Planned | Planned | E6: chưa có list appointments API/Web. |
| UC-127 | Planned | Planned | E6: chưa có detail appointments API/Web. |
| UC-128 | Planned | Planned | E6: decision đề xuất gặp không đặt time/place và không tạo lịch. |
| UC-129 | Planned | Planned | E6: chưa có counter-proposal. |
| UC-130 | Planned | Planned | E6: chưa có mutual appointment acceptance. |
| UC-131 | Planned | Planned | E6: chưa có appointment decline workflow. |
| UC-132 | Planned | Planned | E6: chưa có mutually confirmed reschedule. |
| UC-133 | Planned | Planned | E6: chưa có appointment cancellation lifecycle. |
| UC-134 | Planned | Planned | E6: chưa có confirmed-appointment reminder scheduler. |
| UC-135 | Planned | Planned | E6: chưa có no-show actor workflow. |
| UC-136 | Planned | Planned | E6: chưa có Finder peer handed-over confirmation. |
| UC-137 | Planned | Planned | E6: chưa có Claimant peer received confirmation. |
| UC-138 | Planned | Planned | E6: chưa có dual-confirmation conflict workflow. |
| UC-139 | Planned | Planned | E6: custody return không thay thế peer dual-confirmation completion. |
| UC-140 | Planned | Partial | E7: report HANDOVER được authorize theo participant và form hỗ trợ nhập ID; thiếu discovery/entry ngay trong handover. |
| UC-141 | Partial | Implemented | E4: request từ FOUND hoặc đúng photo-backed LOST room, Web/API/idempotency/roles. |
| UC-142 | Partial | Partial | E4: chọn điểm và xem giờ làm có; chưa chọn/đàm phán slot, kiểm tra ngày nghỉ. |
| UC-143 | Partial | Implemented | E4: list/filter/pagination queue Staff/Admin đã có API/Web. |
| UC-144 | Partial | Implemented | E4: context nguyên bản và ảnh nguồn/contact được authorize, phân biệt với Staff observations. |
| UC-145 | Partial | Implemented | E4: Staff từ chối với lý do; Finder hủy trước receipt, lưu standard reason/audit và phục hồi projection. |
| UC-146 | Partial | Implemented | E4: intake thật, ảnh Staff bắt buộc, quantity/accessories, one-item replay, FOUND hoặc no-FOUND. |
| UC-147 | Partial | Partial | E4/E5: request/reject/cancel/intake/return notification có; movement/release producer chưa đủ. |
| UC-148 | Planned | Partial | E5: count, deadline indicator và EXPIRED filter có; thiếu overdue filter theo deadline/hold thật. |
| UC-149 | Planned | Partial | E5: popup detail/photos/logs có; thiếu full conflict/appointment/hold/eligibility context. |
| UC-150 | Planned | Partial | E5: custody post-deadline reminders có dedupe; thiếu before-deadline và general walk-in coverage. |
| UC-151 | Planned | Partial | E5: execute recheck deadline/cases/hold có; chưa có eligibility preview/API/UI riêng. |
| UC-152 | Planned | Partial | E5: Admin-only hold/unhold API có reason/log; chưa có Admin Web control. |
| UC-153 | Planned | Partial | E5: per-item request donation/dispose/transfer có; thiếu full eligible-item order workflow/UI. |
| UC-154 | Planned | Planned | E5: internal approval lock phục vụ mutation không phải actor GET detail/history/list. |
| UC-155 | Planned | Partial | E5: separate Admin approve API có; thiếu order-review/approval Web screen. |
| UC-156 | Planned | Planned | E5: chưa có reject-order route/use case/UI. |
| UC-157 | Planned | Planned | E5: chưa có cancel-approved-order route/use case/UI. |
| UC-158 | Planned | Partial | E5: private proof upload/attach, execution/log có; thiếu disposition completion/evidence screen. |
| UC-159 | Planned | Planned | E8: chưa có create donation campaign runtime. |
| UC-160 | Planned | Planned | E8: chưa có update donation campaign runtime. |
| UC-161 | Planned | Planned | E8: chưa có assign/remove campaign items runtime. |
| UC-162 | Planned | Planned | E8: chưa có complete donation campaign runtime. |
| UC-163 | Planned | Planned | E7: audit writers không phải searchable Admin audit API/Web. |
| UC-164 | Planned | Partial | E2/E5: participant history API/latest decision và custody logs có; thiếu full history UI/general Staff access. |
| UC-166 | Planned | Planned | E7: aggregate statistics export không phải filtered raw audit/moderation export. |
| UC-167 | Planned | Planned | E8: chưa có integrated privacy-safe journey projection API/Web. |
| UC-168 | Partial | Partial | E3: preference/email queue/worker có; PWA push, full category/producer matrix chưa đủ. |

## Kiểm chứng và giới hạn

- Trong lần đối chiếu này, `npm test` chạy bình thường: **379 pass, 0 fail, 20 SQL opt-in entries skip**, process tự thoát. Architecture: **196 production files, 0 violations**; Web typecheck pass. Các skip được công khai, không dùng force-exit và không chạy destructive tests trên Aiven.
- `node scripts/check-uc-catalogue.mjs` xác nhận **168 = 113 + 20 + 35**. Kiểm tra thêm: giữ nguyên đủ ID UC-001–UC-168, bảng review có đúng 71 ID không trùng và trạng thái trước/sau khớp Git HEAD/catalogue; 30 dòng đổi nhãn; 55 dòng còn lại được phân công đúng một lần; 149 relative links trong các file sửa đều tồn tại. `git diff --check` pass.
- Kiểm tra lại GitHub run [37408974894](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37408974894): đúng SHA `195b134c34c3cee559187bfee13d05e78abf3bfe`, completed/success, ba job đều success. Receipt của baseline: MySQL 8.0/8.4 mỗi job **437 pass, 0 skip**; browser **85 pass**. Đây là CI của code baseline không đổi, không phải CI của một commit tài liệu chưa tạo.
- Regression có cả mocks, HTTP và isolated SQL với scope riêng; không coi một UI mock test hoặc CI xanh là chứng minh mọi actor goal. UC-122 có runtime SQL/read path nhưng chưa có browser test chuyên biệt round-trip read/unread; cần bổ sung vào manual/targeted acceptance. UC-108 có API/HTTP answer coverage; cần manual UAT chuỗi Finder hỏi → Claimant reply qua composer → Finder đọc và quyết định.
- Không rerun toàn bộ browser/build/isolated SQL trong lần **chỉ sửa tài liệu** này. Không gọi provider, không kiểm chứng deployment mới, không sửa Aiven/ledger hay replay rollout 16 ảnh. Giới hạn migration 053/055 và liên kết custody lịch sử vẫn giữ theo [recovery](../runbooks/database-warehouse-recovery.md) và [media rollout](../runbooks/warehouse-media-rollout.md).
- Cần manual UAT role/privacy, ảnh thật/provider, intake/return tại quầy, accessibility sâu hơn; load/failover/network chaos là nghiệm thu riêng. Không kết luận production/main đã sẵn sàng chỉ từ cập nhật trạng thái.

## Việc còn lại ưu tiên

1. Nối Web với SSE để UC-119 thực sự nhận tin tức thì; bổ sung round-trip unread/read tests và đo reconnect/session revoke.
2. Hoàn thiện general Staff support cases, list/filter/compare claimants theo vật phẩm; không mở routine conversation trái quyền.
3. Xây appointment có thời gian/địa điểm, mutual confirmation và peer handover; không dùng communication-only decision làm ownership proof.
4. Bổ sung overdue/hold/eligibility và disposition-order screens, reject/cancel/evidence workflow; giữ independent Admin approval và legal/case gates.
5. Hoàn thiện còn lại theo bảng phân công trong [catalogue](../requirements/uc.md); match notifications, campaigns, training và journey là scope mới thật sự, không phải đổi nhãn cho đủ số.
