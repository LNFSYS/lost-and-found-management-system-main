# LNFS Business Process A–Z

Cập nhật: **06/09/2026**

Đây là nguồn mô tả nghiệp vụ đầy đủ của FPTU Lost & Found System. Các phần có chữ **Current** là những gì repository đã có runtime evidence; **Target/Planned** là phạm vi sản phẩm cần hoàn thiện và không được trình bày như đã triển khai.

## A. Mục tiêu và phạm vi

LNFS giúp cộng đồng FPT University Đà Nẵng báo mất, báo nhặt, tìm kiếm, so sánh và phối hợp trả lại đồ. Sản phẩm mục tiêu có Web Application, PWA support và Native Mobile Application dùng chung Node.js API.

Current baseline: authentication, LOST/FOUND posts, catalog, handover point management, local media, Gemini-assisted draft, hybrid matching, claim/private text verification ở mức partial và Staff warehouse operations.

Target workflow:

LOST/FOUND → matching suggestion → private verification chat → Finder decision → meetup → dual-confirmed direct handover

Staff custody/warehouse là nhánh hỗ trợ hoặc escalation, không phải default flow.

## B. Actor

- Guest: xem thông tin public và bắt đầu đăng ký.
- Student/Lecturer: tạo và theo dõi LOST/FOUND.
- Owner: người báo mất và gửi yêu cầu xác minh cho FOUND phù hợp.
- Finder: người nhặt và đang giữ FOUND item.
- Staff: tiếp nhận/custody và vận hành kho khi có escalation.
- Admin: quản lý catalog, điểm bàn giao và chức năng quản trị.
- System: validation, matching, draft AI, status, notification và audit.
- SMTP/Gemini: dịch vụ bên ngoài tùy cấu hình, chỉ hỗ trợ kỹ thuật.

## C. Quy trình hiện tại: account

1. Guest nhập họ tên, email, audience role và password.
2. API giới hạn request và gửi OTP qua SMTP.
3. Guest nhập OTP còn hạn; API tạo tài khoản với role được phép.
4. User login bằng email/password và nhận session.
5. Refresh token được rotate; logout revoke token.
6. Forgot/reset password dùng mã email có hạn dùng và một lần.
7. Web route guard bảo vệ các trang yêu cầu đăng nhập/role.

Business result: account ACTIVE có role hợp lệ. Email FPT/edu không bắt buộc.

## D. Quy trình hiện tại: tạo LOST/FOUND

1. User chọn Tôi làm mất đồ hoặc Tôi nhặt được đồ.
2. User nhập title, description, category cụ thể, thời gian, area/building, location và contact.
3. FOUND phải có nơi lưu/địa điểm hợp lệ; LOST không gắn handover point như nơi đang giữ.
4. User có thể gửi tối đa 5 ảnh để Gemini tạo draft.
5. User review/chỉnh sửa draft trước khi submit.
6. API validate payload, category hierarchy, area/building relation, time, location, media và privacy.
7. Post được lưu; owner có thể update, close hoặc soft-delete theo quyền.

Public description không được chứa private verification answer, serial đầy đủ, IMEI, QR/barcode, giấy tờ hoặc thông tin cá nhân không cần thiết.

## E. Quy trình hiện tại: catalog và handover point

1. Admin tạo area, building, category group và category cụ thể.
2. Admin tạo handover point với tên, địa chỉ, area/building, giờ mở cửa và trạng thái.
3. Admin upload map image và đặt marker X/Y theo phần trăm khung ảnh.
4. Public form chỉ nhận điểm đang active.
5. Admin có thể tạm đóng/mở point.
6. Không hard-delete point đang được appointment active hoặc có operational reference; khi đó chuyển inactive.
7. Staff dashboard có thể thống kê item theo handover point.

## F. Quy trình hiện tại: media và Gemini

1. User chọn ảnh đúng loại và giới hạn.
2. API kiểm MIME, file signature, size và count.
3. Media post hiện lưu trên local UPLOAD_DIR và được đọc qua protected proxy.
4. Gemini-assisted image analysis nhận ảnh và trả về draft title, description, category suggestion, attributes và safe visible text.
5. User quyết định dữ liệu cuối cùng; provider không tự đăng bài và không tự xác minh ownership.
6. Khi file local mất, API phải trả lỗi có kiểm soát thay vì unhandled server error.

Shared object storage là yêu cầu trước khi triển khai nhiều API instance. Local media không đồng bộ chỉ vì metadata nằm trong MySQL.

## G. Quy trình hiện tại: matching

1. Sau create/update, Node chạy bounded best-effort matching.
2. Chỉ candidate đối nghịch LOST/FOUND đang hoạt động được đưa vào so sánh.
3. Engine normalize tiếng Việt và dùng text, category, location, time, image tags và safe OCR tags.
4. Candidate bị giới hạn theo số lượng và time window.
5. Category/time mismatch có penalty hoặc score cap.
6. Kết quả lưu score thành phần, tier, matcher version và explanation.
7. Owner xem danh sách và có thể recalculate theo quyền/rate limit.

Matching là gợi ý. Không có auto ownership verification, auto claim acceptance hoặc auto return.

## H. Luồng mục tiêu peer-to-peer

### H1. Tạo cặp cần xác minh

1. Owner tạo LOST report.
2. Finder tạo FOUND report và mặc định tiếp tục giữ item.
3. System gợi ý cặp tương tự.
4. Owner chọn FOUND candidate và gửi verification request.
5. Mỗi cặp Owner/Finder/LOST/FOUND có conversation riêng.

### H2. Xác minh qua chat

1. Finder mở conversation.
2. Finder chọn guided question theo category hoặc viết câu hỏi an toàn.
3. Câu hỏi tập trung vào phụ kiện, dấu xước, nội dung màn hình, bốn số cuối serial hoặc chi tiết chỉ chủ sở hữu biết.
4. Owner trả lời nhưng không xem trước private answer của Finder.
5. Finder chọn MORE_INFO_REQUIRED, MEETUP_ACCEPTED, DECLINED hoặc ESCALATED.
6. Claim/evidence chỉ hiển thị cho claimant, post owner và reviewer có quyền.

Staff không xem routine conversation mặc định; chỉ truy cập case đã escalate, có reason, permission, minimum data và audit.

### H3. Multiple claimant

1. Mỗi claimant có request/conversation riêng.
2. Không dùng first-claim-wins.
3. Finder đánh giá từng claimant bằng câu trả lời/evidence.
4. Một item chỉ có tối đa một active reservation/meetup.
5. Nếu meetup hủy hoặc no-show, Finder có thể mở lại request khác.
6. Case không giải quyết được có thể escalate.

### H4. Meetup

1. Chỉ request đã được Finder chấp nhận mới được đề xuất appointment.
2. Một bên đề xuất thời gian và điểm gặp an toàn.
3. Bên còn lại accept, counter-propose hoặc cancel.
4. Appointment chỉ CONFIRMED khi hai bên cùng đồng ý.
5. Hỗ trợ reminder, reschedule, cancel và NO_SHOW.
6. No-show không tự kết luận gian lận.

### H5. Direct handover

1. Hai bên gặp trực tiếp tại appointment đã confirmed.
2. Finder xác nhận HANDED_OVER.
3. Owner kiểm tra và xác nhận RECEIVED.
4. Chỉ dual confirmation hợp lệ mới chuyển item RETURNED và đóng hồ sơ.
5. Nếu thiếu hoặc mâu thuẫn xác nhận, giữ HANDOVER_PENDING_CONFIRMATION và cho phép report/escalation.

## I. Nhánh Staff custody và warehouse

Nhánh này bắt đầu khi Finder không thể tiếp tục giữ item, item nhạy cảm/nguy hiểm, có dispute, direct meetup không khả thi hoặc policy yêu cầu.

1. Finder tạo TRANSFER_REQUESTED.
2. Hai bên chọn điểm/thời gian giao cho Staff.
3. Staff kiểm tra và xác nhận intake.
4. Sau intake, item chuyển IN_CUSTODY và tạo warehouse record.
5. Staff cập nhật location, condition, storage code và status.
6. Mỗi transition ghi actor, action, from/to, note và timestamp.
7. User nhận thông tin appointment/handover phù hợp.
8. Overdue chỉ là trạng thái cần xử lý, không tự động dispose/donate.
9. Item có claim, appointment, dispute hoặc legal hold pending không được disposition.
10. Donation/disposal/transfer cần order, reason, approval và evidence theo policy.

Current runtime chỉ chứng minh receive/store/return, retention deadline và storage log. Overdue/disposition documents là Planned/TBD.

## J. State model

### J1. FOUND item target

~~~text
REPORTED → HELD_BY_FINDER → CHATTING → RESERVED → MEETUP_SCHEDULED
→ HANDOVER_PENDING_CONFIRMATION → RETURNED → CLOSED
~~~

### J2. Custody target

~~~text
HELD_BY_FINDER/CHATTING → TRANSFER_REQUESTED → IN_CUSTODY
→ STAFF_HANDOVER_SCHEDULED → STAFF_RETURNED → CLOSED
~~~

### J3. Warehouse exception

~~~text
IN_CUSTODY → OVERDUE → TRANSFERRED/DISPOSED → CLOSED
~~~

### J4. Verification conversation target

~~~text
REQUESTED → CONVERSATION_OPEN → MORE_INFO_REQUIRED
→ MEETUP_ACCEPTED / DECLINED / ESCALATED
→ SCHEDULED → COMPLETED / NO_SHOW / CANCELLED
~~~

Schema hiện tại có enum/table tương ứng ở migration nhưng nhiều state target chưa có API/runtime. Không sửa migration đã chạy chỉ để làm tài liệu khớp.

## K. Privacy và evidence

- Tách public description khỏi private verification attributes.
- Không công khai đáp án Finder trước khi Owner trả lời.
- Không hiển thị raw private storage URL.
- Media/evidence phải kiểm tra authorization, type, size và safe storage.
- Không yêu cầu password, OTP hoặc dữ liệu vượt mục đích xác minh.
- AI/OCR không tự kết luận người sở hữu.
- Evidence confidence chỉ là mức hỗ trợ review, không phải xác minh 100%.
- Staff access escalation phải có reason và audit.

## L. AI/OCR và matching wording

Wording được phép:

- Gemini-assisted image/OCR analysis.
- Google Vision assisted recognition nếu repository thật sự dùng provider đó.
- Hybrid/rule-based matching.
- Evidence review support.
- Human verification required.

Không dùng:

- custom-trained AI model khi chưa có dataset, artifact và evaluation;
- AI tự xác minh ownership;
- production AI/MLOps;
- score matching là kết luận pháp lý.

## M. Notification, audit và KPI mục tiêu

Notification target gồm OTP, match suggestion, verification request, new message, appointment change, handover confirmation và warehouse alert. Claim notification hiện có REST/in-app feed với unread total; match notification, realtime/socket và warehouse alert scheduler chưa có runtime evidence.

Audit target ghi actor, action, entity, before/after, reason và timestamp cho admin action, claim decision, appointment, handover, custody và disposition.

KPI đề xuất:

- số LOST/FOUND report theo thời gian/khu vực;
- tỷ lệ matching được người dùng mở;
- tỷ lệ verification accepted/declined/escalated;
- thời gian từ report đến meetup/return;
- số item đang giữ tại Finder và IN_CUSTODY;
- số overdue item và disposition;
- tỷ lệ no-show/report/abuse;
- tỷ lệ phản hồi thành công sau pilot.

KPI là target; không điền số liệu giả khi chưa có data/analytics runtime.

## N. Channel mapping

| Capability | Web | PWA | Native Mobile |
| --- | --- | --- | --- |
| Auth/session | Current | Partial target | Planned |
| LOST/FOUND | Current | Responsive partial | Planned |
| Matching/explanation | Current | Planned parity | Planned |
| Claim/evidence/chat | Partial current REST | Partial PWA current | Planned native client |
| Meetup/dual handover | Planned | Planned | Planned |
| Staff/Admin operations | Current một phần | Có thể ưu tiên Web | Có thể không bắt buộc |
| Camera/gallery | File input current | Planned device verification | Planned |
| Offline shell | Chưa có | Current shell; installability QA pending | Phụ thuộc app |
| Notification/realtime | Claim notification current REST; realtime planned | Claim notification current UI; realtime planned | Planned |

PWA không phải native app. Mobile browser responsive không phải bằng chứng Native Mobile.

## O. Exception và safety rules

- Invalid hoặc expired OTP: từ chối và không tạo session.
- Unauthorized/forbidden: trả 401/403, không dựa chỉ vào ẩn menu.
- Post hidden/deleted: không xuất hiện public.
- Category/area/building đang được tham chiếu: chuyển inactive thay vì hard-delete.
- Handover point có active appointment/reference: không hard-delete.
- Matching failure: không rollback post hợp lệ.
- Claim conflict: dùng transaction/lock và một accepted claim tối đa.
- Appointment conflict: một active appointment cho claim.
- No-show/dispute: giữ case và escalate, không tự kết luận.
- Warehouse disposition: chặn khi claim/appointment/dispute/legal hold còn pending.
- Offline: không báo thành công trước server confirmation.
- Migration checksum mismatch: dừng và reconcile thủ công; không bypass.

## P. Architecture và service ownership

Node.js + TypeScript là backend, migration owner và write owner duy nhất. Backend là Clean Architecture modular monolith; Java đã được gỡ ngày 09/09/2026. Web/PWA/native mobile dùng chung API và rules. Mọi domain mới tuân theo dependency rules trong `CLEAN_ARCHITECTURE.md`.

## Q. TBD cần quyết định

- FPT University duyệt retention/disposition policy nào.
- Staff được xem escalation data đến mức nào.
- Native Mobile dùng Expo, React Native, Flutter hay công nghệ khác.
- Sprint dates, assignee và Jira status chính thức.
- Shared object storage và deployment platform.
- Notification provider và realtime transport.
- Quy trình xử lý sensitive item và legal hold.
- Bộ dữ liệu hợp pháp cho future AI training.

## R. Evidence repository ngày 06/09/2026

- Node routes: auth, posts, claims/private room/evidence, notifications, staff, handover-points và admin.
- Web routes: home, profile, posts, my-posts, post detail, matches, claims, staff và admin.
- Tests: Node unit/service/repository/validator; guarded DB integration; Web Playwright tests và typecheck. Latest local evidence: API 137 pass/1 skip, Playwright 23/23 pass.
- Migrations: 001 đến 046, checksum runner; 046 là corrective migration chưa áp dụng lên Aiven/shared DB.
- Backend: Node.js-only, composition root inject adapter vào application port; không có Java runtime.
- Không có native mobile project.
- Có PWA manifest/service worker; installability/device evidence còn pending.
- Không có Jira connector trong workspace.

## S. Definition of Done cho nghiệp vụ mới

Một flow chỉ được đánh dấu Done khi có:

1. Runtime implementation đúng actor và state.
2. Backend validation, authorization và privacy.
3. Transaction/idempotency/concurrency control nếu cần.
4. Test thật chạy pass.
5. UI/channel tương ứng được kiểm tra.
6. Traceability BR–FR–UC cập nhật.
7. PR được review và Jira được cập nhật nếu quy trình nhóm yêu cầu.
8. Evidence path tồn tại.
