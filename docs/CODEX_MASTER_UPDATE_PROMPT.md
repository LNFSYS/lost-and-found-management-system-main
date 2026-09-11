# MASTER PROMPT — Đồng bộ toàn bộ LNFS theo phạm vi Web + PWA + Native Mobile và nghiệp vụ mới

Bạn đang làm việc trực tiếp trong repository của dự án **FPTU Lost & Found System (LNFS)**.

Đây là nhiệm vụ **audit, chỉnh sửa và đồng bộ tài liệu thực tế**, không chỉ review hoặc đưa ra đề xuất. Hãy đọc repository, kiểm tra implementation, test và Jira nếu connector đã được cung cấp; sau đó chỉnh trực tiếp các file hiện có, chạy verification và báo cáo kết quả.

Không dừng lại sau bước audit. Phải hoàn thành việc sửa trong phạm vi file thực sự tồn tại.

---

# 1. Nguồn sự thật và thứ tự ưu tiên

Sử dụng thứ tự ưu tiên sau:

1. Code, test, configuration và deployment evidence thực tế trong repository.
2. Jira hiện tại, bao gồm sprint, dates, status, assignee và ticket description.
3. Các quyết định nghiệp vụ và phạm vi mới trong prompt này.
4. Nội dung tài liệu cũ.

Nếu code, Jira và tài liệu mâu thuẫn:

- dùng code/test để xác định trạng thái implementation;
- dùng Jira để xác định kế hoạch, sprint, assignee và tiến độ;
- dùng prompt này để xác định nghiệp vụ và phạm vi mục tiêu mới;
- ghi rõ mâu thuẫn và cách xử lý trong changelog.

Không đánh dấu `Done`, `Implemented` hoặc `Verified` chỉ vì:

- database có table/column;
- migration đã tồn tại;
- Jira có ticket;
- chức năng có trong roadmap;
- tài liệu cũ nói đã hoàn thành;
- có UI mockup nhưng chưa kết nối;
- có service/controller skeleton;
- có test file nhưng chưa chạy hoặc test không bao phủ chức năng.

Phân biệt rõ:

- **Implemented:** có code runtime hoạt động.
- **Verified:** có test/build/evidence vừa được kiểm tra.
- **Partial:** có một phần luồng nhưng chưa đủ acceptance criteria.
- **Planned:** có kế hoạch/ticket nhưng chưa có implementation.
- **TBD:** cần team, mentor hoặc đơn vị vận hành xác nhận.

---

# 2. Quyết định phạm vi sản phẩm mới

Sử dụng thống nhất:

> **Software type: Web Application with Progressive Web App (PWA) support and a Native Mobile Application**

LNFS có ba delivery channels:

1. **Web Application**
   - sử dụng chính trên desktop/laptop;
   - cung cấp đầy đủ chức năng người dùng;
   - cung cấp Staff/Admin operational screens.

2. **Progressive Web App (PWA)**
   - là khả năng mở rộng của Web Application, không phải native app;
   - responsive trên desktop, tablet và mobile browser;
   - có manifest, installability, service worker, basic offline application shell;
   - có safe offline/error fallback và safe retry;
   - hỗ trợ camera/gallery upload trên mobile browser;
   - không được tuyên bố toàn bộ dữ liệu và business workflow hoạt động offline nếu code không hỗ trợ.

3. **Native Mobile Application**
   - là ứng dụng mobile riêng và là phạm vi bắt buộc theo yêu cầu của giảng viên;
   - sử dụng chung backend API, authentication, authorization, validation, privacy rules và business state transitions với Web/PWA;
   - tập trung vào user-facing flows: authentication, LOST/FOUND, matching, realtime chat, image upload, meetup, direct handover confirmation và notifications;
   - Staff/Admin operations có thể ưu tiên Web nếu phạm vi mobile chưa yêu cầu;
   - repository hiện chưa có project mobile thì phải ghi `Planned — project not created yet`, tuyệt đối không ghi implemented;
   - chỉ ghi Expo, React Native, Android Java/Kotlin, Flutter hoặc công nghệ cụ thể sau khi kiểm tra repository hoặc quyết định kỹ thuật chính thức;
   - không gọi PWA là native mobile app.

Không loại Native Mobile khỏi overview, scope, requirements, architecture, WBS, roadmap, reports hoặc traceability.

---

# 3. Nghiệp vụ chính thức: peer-to-peer first

Luồng mặc định không phải Finder giao vật phẩm cho Staff để Staff duyệt evidence.

Luồng chính phải được mô tả thống nhất như sau:

1. Owner tạo LOST report.
2. Finder tạo FOUND report và tiếp tục giữ vật phẩm.
3. Hệ thống tìm/gợi ý LOST–FOUND match và giải thích lý do phù hợp.
4. Owner gửi verification request cho FOUND item phù hợp.
5. Hệ thống mở conversation riêng tư giữa Owner và Finder.
6. Hai bên trao đổi qua real-time chat; có thể gửi ảnh.
7. Giao diện chat của Finder hiển thị các câu hỏi xác minh có sẵn theo category.
8. Owner trả lời mà không được xem trước private attributes/đáp án do Finder giữ.
9. Finder đánh giá câu trả lời và chọn:
   - `REQUEST_MORE_INFO`;
   - `VERIFY_FOR_MEETUP` (claim chuyển `ACCEPTED` và đủ điều kiện appointment);
   - `DECLINE`;
   - `ESCALATE_TO_CUSTODY`.
10. `OPEN_CONVERSATION` chỉ mở private room; khi Finder chọn `VERIFY_FOR_MEETUP`, hai bên mới được đề xuất và cùng xác nhận điểm gặp/thời gian ngay trong chat.
11. Finder và Owner gặp trực tiếp.
12. Finder xác nhận `HANDED_OVER`; Owner xác nhận `RECEIVED`.
13. Chỉ khi xác nhận hai chiều hợp lệ, hệ thống chuyển item thành `RETURNED` và đóng hồ sơ.
14. Nếu xác nhận thiếu hoặc mâu thuẫn, giữ `HANDOVER_PENDING_CONFIRMATION` và cho phép report/escalation.

Security/Staff chỉ tham gia khi:

- Finder chủ động không muốn tiếp tục giữ vật phẩm;
- vật phẩm chưa tìm được Owner sau thời hạn cấu hình;
- vật phẩm nhạy cảm/nguy hiểm hoặc policy bắt buộc;
- có nhiều Owner cạnh tranh nhưng không thể phân giải;
- có dispute, harassment, fraud concern hoặc incident;
- direct meetup không khả thi;
- Finder yêu cầu chuyển vào kho.

Khi chuyển Staff:

1. Finder tạo `TRANSFER_REQUESTED`.
2. Hai bên chọn điểm/thời gian giao cho Staff.
3. Chỉ khi Staff xác nhận intake, item mới chuyển `IN_CUSTODY`.
4. Hệ thống tạo storage/warehouse record.
5. Từ thời điểm đó Staff quản lý custody, appointment và handover từ kho.
6. Overdue, retention và disposition chỉ áp dụng cho item thực sự `IN_CUSTODY`.

Staff không phải người duyệt evidence trong luồng thường và không được xem routine chat mặc định. Staff chỉ xem case bị report/escalate khi có:

- quyền phù hợp;
- lý do truy cập;
- audit trail;
- phạm vi dữ liệu tối thiểu cần thiết.

---

# 4. Quy tắc nghiệp vụ bắt buộc

## 4.1 LOST/FOUND và privacy

- Public description và private verification attributes phải tách riêng.
- FOUND item mặc định là `HELD_BY_FINDER`, không mặc định `IN_CUSTODY`.
- Finder không được công khai đặc điểm bí mật dùng để xác minh.
- Owner không được xem private attributes trước khi trả lời.
- Ảnh công khai phải tránh làm lộ số thẻ, giấy tờ, serial đầy đủ hoặc dữ liệu cá nhân.

## 4.2 Matching và AI/OCR

- Matching chỉ là decision support.
- Match phải có explanation: category, thời gian, vị trí, text/image similarity hoặc yếu tố phù hợp khác.
- AI/OCR không được tự:
  - xác nhận Owner;
  - accept/reject verification request;
  - chọn người thắng khi có nhiều claimant;
  - tạo meetup được xác nhận;
  - hoàn tất handover;
  - đánh dấu `RETURNED`;
  - công khai private evidence.
- Nếu code sử dụng Gemini, gọi đúng là **Gemini-assisted image/OCR analysis**.
- Không ghi Google Vision hoặc custom-trained AI nếu không có evidence.

## 4.3 Realtime chat

- Mỗi conversation gắn với đúng một cặp LOST–FOUND–Finder–Owner.
- Các claimant cạnh tranh có conversation tách biệt và không thấy nhau.
- Chat hỗ trợ text và image attachment.
- Attachment phải có authorization, type/size validation và safe storage.
- Finder có question templates theo category.
- Finder có thể chọn câu hỏi mẫu hoặc nhập câu hỏi an toàn.
- Không được yêu cầu password, OTP hoặc dữ liệu vượt quá mục đích xác minh.
- Không công khai contact information mặc định.
- Có delivery/read state, retry/idempotency, reconnect, notification, report/block và rate limiting.
- Staff không xem routine conversation mặc định.

## 4.4 Multiple claimant

- Không dùng nguyên tắc “first claim wins”.
- Finder hỏi và đánh giá riêng từng claimant.
- Một item chỉ có tối đa một active reservation/meetup.
- Khi chọn một Owner để meetup, các request khác tạm dừng.
- Nếu meetup bị hủy/no-show, Finder có thể mở lại request khác.
- Case không phân giải được có thể chuyển `ESCALATE_TO_CUSTODY` và optional Staff custody.

## 4.5 Meetup và direct handover

- Chỉ claim `ACCEPTED` có audit outcome `FINDER_VERIFIED_FOR_MEETUP` mới tạo appointment; `CONVERSATION_OPEN` không đủ điều kiện.
- Một bên đề xuất, bên còn lại accept hoặc counter-propose.
- Appointment chỉ `CONFIRMED` khi cả hai đồng ý.
- Ưu tiên campus meeting points an toàn.
- Hỗ trợ reminder, reschedule, cancel và `NO_SHOW`.
- No-show không tự động kết luận gian lận.
- Direct return cần dual confirmation.
- Không đánh dấu `RETURNED` chỉ từ một phía.

## 4.6 Staff custody và warehouse

- Đây là optional/escalation flow, không phải default flow.
- `IN_CUSTODY` chỉ sau Staff intake confirmation.
- Mọi thay đổi custody/storage/location/status cần audit.
- Staff không được mở khóa hoặc truy cập dữ liệu trong điện thoại/laptop.
- Overdue không tự động dẫn tới donation/disposal.
- Item có active dispute hoặc legal hold không được disposition.
- Retention/disposition policy chưa được FPT University xác nhận phải ghi `TBD`.

## 4.7 Sensitive items

Phải có xử lý riêng cho:

- thẻ sinh viên và giấy tờ do trường cấp;
- thẻ ngân hàng;
- CCCD/hộ chiếu;
- điện thoại/laptop;
- chìa khóa/thẻ ra vào;
- tiền mặt/tài sản giá trị cao;
- thuốc/vật dễ hỏng;
- vật khả nghi hoặc nguy hiểm.

Không tự tạo policy của trường thành sự thật. Ghi rõ proposed rule và phần cần mentor/đơn vị vận hành xác nhận.

---

# 5. State model mục tiêu

Kiểm tra database/code trước khi đổi enum hoặc migration. Trong tài liệu, mô tả state mục tiêu và đánh dấu planned nếu runtime chưa hỗ trợ.

## 5.1 FOUND item

```text
REPORTED
→ HELD_BY_FINDER
→ CHATTING
→ RESERVED
→ MEETUP_SCHEDULED
→ HANDOVER_PENDING_CONFIRMATION
→ RETURNED
→ CLOSED
```

Optional custody branch:

```text
HELD_BY_FINDER / CHATTING
→ TRANSFER_REQUESTED
→ IN_CUSTODY
→ STAFF_HANDOVER_SCHEDULED
→ STAFF_RETURNED
→ CLOSED
```

Warehouse exception:

```text
IN_CUSTODY
→ OVERDUE
→ TRANSFERRED / DISPOSED
→ CLOSED
```

## 5.2 Verification conversation

```text
REQUESTED
→ CONVERSATION_OPEN
→ NEED_MORE_INFO
→ ACCEPTED / REJECTED / CUSTODY_ESCALATION_REQUESTED
→ SCHEDULED
→ COMPLETED / NO_SHOW / CANCELLED
```

Nếu code hiện có state khác, không tự sửa migration chỉ để khớp tài liệu. Ghi mapping current → target và tạo danh sách implementation gap.

---

# 6. Phạm vi chức năng đầy đủ

Tài liệu, requirements, use cases, design và traceability phải bao phủ:

1. Authentication and account management.
2. Role and permission management.
3. LOST/FOUND post management.
4. Media and private attributes.
5. Category, area, building and campus meeting points.
6. Search, filter, sort and pagination.
7. Matching suggestion and match explanation.
8. Gemini/AI/OCR decision support nếu có evidence.
9. Verification request.
10. Realtime private chat.
11. Image messages/private evidence.
12. Guided verification questions.
13. Finder verification decisions.
14. Multiple claimant isolation and reservation.
15. Meetup proposal, acceptance and rescheduling.
16. Direct handover and dual confirmation.
17. Report, block, abuse and dispute escalation.
18. Optional Staff intake and custody.
19. Warehouse record, location and lifecycle.
20. Sensitive-item routing.
21. Overdue, retention and disposition.
22. Notifications.
23. Feedback and reputation.
24. Moderation and administration.
25. Audit log.
26. Dashboard and statistics.
27. Web Application.
28. PWA.
29. Native Mobile Application.
30. Integration, security testing, system testing and regression.
31. Deployment and release validation.
32. Real-user pilot, feedback and fixes.
33. Documentation and final demonstration.

---

# 7. Sprint và Jira

Không dùng lại lịch sprint cũ trong tài liệu nếu chưa kiểm tra Jira.

Jira là nguồn sự thật cho:

- sprint name;
- start date/end date;
- sprint state;
- ticket assignment;
- status;
- assignee;
- ticket history.

Thông tin đã được xác minh ngày 01/09/2026:

> **LNFS Sprint 4: 01/09/2026–09/09/2026**

Mục tiêu Sprint 4:

> **Hoàn thành toàn bộ Web + PWA, tích hợp core peer-to-peer workflow và chuẩn bị lấy feedback từ real users.**

Các nhóm ticket Sprint 4 cần đối chiếu:

| Nhóm | Jira | Mục tiêu |
|---|---|---|
| Foundation | LNFS-47, LNFS-50 | Campus meeting points, map và configuration |
| Peer verification | LNFS-52–LNFS-53 | Match request, private chat evidence, guided questions và Finder decision |
| Direct return | LNFS-54 | Meetup, direct handover và dual confirmation |
| Optional custody | LNFS-55 | Transfer-to-Staff, warehouse overdue và disposition |
| Matching/AI | LNFS-56–LNFS-57 | Matching explanation và AI/OCR |
| Communication/admin | LNFS-51, LNFS-58–LNFS-59 | Realtime chat/image, notification, feedback, moderation và statistics |
| PWA | LNFS-60–LNFS-62 | Installability, responsive flows và safe fallback |
| Integration | LNFS-63 | E2E peer-return và optional-custody scenarios |
| SRS | LNFS-80–LNFS-81 | Functional overview, NFR và business rules |

Native Mobile Application:

- là phạm vi bắt buộc;
- hiện chưa có project mobile;
- không bắt buộc hoàn thành trước thứ Bảy;
- cần tăng tốc và có thể huy động thành viên khác có khả năng mobile;
- phải kiểm tra Jira để xác định sprint thật;
- nếu chưa có ticket/sprint chính thức, ghi `Planned — sprint and technology TBD`;
- không tự tạo, sửa, di chuyển hoặc assign Jira ticket trừ khi người dùng yêu cầu rõ trong task hiện tại.

Không thay đổi lịch sử ticket Done. Không đổi assignee tùy ý.

---

# 8. Definition of Done thống nhất

Một chức năng chỉ được ghi Done khi:

1. Implementation completed.
2. Relevant tests completed và có kết quả thật.
3. Pull Request created and reviewed.
4. Required fixes resolved.
5. Jira ticket moved to Done.
6. Related SRS Section 3.2 updated.
7. Design/test evidence updated when applicable.
8. Web/PWA/Mobile channel tương ứng đã được kiểm tra.

Nếu thiếu một điều kiện, dùng Partial/Planned và ghi gap.

---

# 9. Kiểm kê bắt buộc trước khi sửa

Dùng `rg --files` để tìm:

- `*.md`;
- `*.docx`;
- `*.xlsx`;
- `*.xls`;
- `*.pdf`;
- source code và test;
- các thư mục `docs`, `reports`, `documents`, `meeting-notes` hoặc tương tự.

Kiểm tra nếu tồn tại:

- `docs/README.md`;
- `docs/project-overview.md`;
- `docs/requirements.md`;
- `docs/use-case-checklist.md`;
- `docs/business-rules.md`;
- `docs/traceability-matrix.md`;
- `docs/node-java-service-boundary.md`;
- `docs/LNFS_BUSINESS_PROCESS_A_TO_Z.md`;
- Report 1 — Project Introduction/Overview;
- Report 2 — Project Management Plan;
- Report 3 — SRS;
- Report 4 — Design;
- Report 5 — Implementation and Testing;
- meeting records, WBS, sprint plan hoặc spreadsheets.

Nếu file không tồn tại, ghi rõ; không giả định và không tạo bản Report thay thế trùng lặp.

---

# 10. Kiểm tra implementation thật

Trước khi cập nhật status, kiểm tra:

## 10.1 Web frontend

- routes/pages/components;
- responsive layout;
- LOST/FOUND forms;
- match/search screens;
- chat UI và image message;
- guided-question UI;
- meetup UI;
- dual-confirmation UI;
- Staff custody/warehouse screens;
- Admin screens.

## 10.2 PWA

- manifest;
- icons;
- service worker;
- installability;
- offline application shell;
- offline/error fallback;
- safe retry;
- caching rules;
- mobile-browser camera/gallery upload;
- responsive tests;
- browser/device verification.

## 10.3 Native Mobile

- kiểm tra có thư mục/project Android/iOS/React Native/Expo/Flutter hay không;
- build configuration;
- navigation/screens;
- API client/auth/session;
- notification;
- image capture/upload;
- chat;
- meetup;
- handover confirmation;
- tests.

Nếu không có project mobile, ghi chính xác:

> Native Mobile Application is required in the planned product scope, but no mobile project or implementation evidence exists in the current repository.

## 10.4 Backend

- Node routes/controllers/services/repositories/validators;
- realtime transport implementation;
- attachment storage;
- authorization;
- idempotency;
- state transitions;
- Java controllers/services và integration;
- database migrations;
- audit/notification jobs;
- deployment configuration và CI/CD.

Không gọi Java skeleton là integrated business service.
Không gọi local filesystem là deploy-safe shared media storage.
Không ghi Socket.IO/Cloudinary/Docker/staging nếu không có evidence.

## 10.5 Tests

- unit;
- API/integration;
- realtime/chat;
- authorization/privacy;
- attachment security;
- E2E/Playwright;
- PWA/browser;
- mobile;
- system/regression;
- deployment smoke;
- UAT/real-user feedback.

Không giữ số test/coverage cũ nếu chưa chạy lại.

---

# 11. Thay đổi bắt buộc theo tài liệu

## 11.1 README và Project Overview

- Định vị sản phẩm là Web + PWA + Native Mobile.
- Không xóa native mobile khỏi planned product scope.
- Ghi rõ mobile chưa có implementation nếu repository chưa có project.
- Tách:
  - Current implementation baseline;
  - Planned complete product scope;
  - Current implementation status;
  - Architecture/channel strategy;
  - Deployment and real-user feedback strategy.
- Thay luồng Staff-first bằng peer-to-peer first.
- Cập nhật overview diagram:
  - Web/PWA client;
  - Native Mobile client;
  - shared API/auth/business rules;
  - realtime communication;
  - storage/database;
  - optional Staff operations.
- Không gọi sản phẩm production-ready nếu chưa có evidence.
- Không dùng “MVP” làm tên/trạng thái chính thức; chỉ giữ khi là historical quote cần thiết.

## 11.2 Requirements

Phải có nhóm requirement riêng:

- `FR-WEB-*`;
- `FR-PWA-*`;
- `FR-MOBILE-*`;
- `FR-CHAT-*`;
- `FR-VERIFY-*`;
- `FR-MEETUP-*`;
- `FR-HANDOVER-*`;
- `FR-CUSTODY-*`;
- `FR-WAREHOUSE-*`;
- `FR-AUDIT-*`.

Không đổi ID tùy tiện nếu đã được trace trong Report 3. Nếu cần đổi, tạo alias/migration mapping rõ ràng.

Requirements phải mô tả:

- Finder giữ item;
- private match conversation;
- guided questions;
- image evidence in chat;
- Finder decision;
- multiple claimant isolation;
- meetup agreement;
- dual confirmation;
- Staff fallback;
- mobile/PWA parity;
- privacy, abuse prevention và audit.

## 11.3 Use cases

Rà lại toàn bộ UC ID để không trùng/mất. Mỗi UC phải có:

- Actor;
- Preconditions;
- Trigger;
- Main flow;
- Alternative flows;
- Exceptions;
- Postconditions;
- Business rules;
- Data/privacy note;
- implementation status;
- evidence path nếu implemented.

Các UC cũ kiểu “Staff reviews every Claim” phải được sửa thành:

- Finder verifies through chat;
- Staff handles escalated/custody cases only.

Phải có UC cho:

- start verification conversation;
- send/receive text and image;
- use guided question;
- request more information;
- accept/decline/escalate;
- schedule/reschedule meetup;
- confirm direct handover;
- report/block;
- transfer item to Staff;
- Staff intake and warehouse handover;
- PWA flows;
- Native Mobile flows.

## 11.4 Business Rules

Đồng bộ với Section 4 của prompt này. Đặc biệt:

- Staff không duyệt evidence mặc định;
- Finder không tiết lộ đáp án trước;
- Staff access escalated chat có audit;
- appointment cần mutual agreement;
- return cần dual confirmation;
- custody là optional branch;
- PWA/mobile dùng chung backend rules.

## 11.5 Traceability Matrix

Mỗi business rule phải map tới FR và UC.
Mỗi FR phải map tới UC hoặc có lý do.
Mỗi UC implemented phải có evidence path tồn tại.
Tách evidence theo channel:

- Web;
- PWA;
- Native Mobile;
- Backend/API;
- Realtime;
- Test.

Không tạo evidence giả.

## 11.6 Architecture và service ownership

- Xác định write owner thật cho từng domain.
- Node/Java ownership phải dựa trên runtime code.
- Nếu Java chỉ là skeleton, ghi đúng là skeleton/planned.
- Web/PWA có thể dùng cùng web codebase.
- Native Mobile là client riêng dùng shared API.
- Realtime service/transport chỉ nêu công nghệ khi có evidence.
- Warehouse ownership phải khớp route/service/test.
- Không gọi kiến trúc là production microservices nếu chưa có integration thật.

## 11.7 Report 1 — Project Introduction/Overview

- Cập nhật software type thành Web + PWA + Native Mobile.
- Cập nhật product background, problem, vision, scope và major features.
- Dùng peer-to-peer direct return làm core business flow.
- Staff custody là supporting/escalation flow.
- Phân biệt PWA và native mobile.
- Native mobile chưa có project phải ghi Planned, không phải exclusion.
- Cập nhật objectives, WBS, estimation, limitations, risks, roadmap, deployment và feedback.
- Existing/Similar Systems phải có nguồn/link/ngày truy cập thật; không tạo nguồn giả.
- AI/OCR chỉ là decision support.

## 11.8 Report 2 — Project Management Plan

- Lấy sprint dates thật từ Jira.
- Weekly Scrum: tối thứ Sáu hằng tuần.
- Đồng bộ backlog, priority, acceptance criteria, estimation, sprint, assignee, status và blocker handling.
- Definition of Done dùng Section 8.
- Deliverables thể hiện Web + PWA + Native Mobile và trạng thái thật.
- Git workflow dựa trên repository thực tế.
- Responsibility:
  - Quân: team leadership, matching and integration;
  - Đạt: Node.js/API;
  - Lượng: Java/backend/mobile theo assignment thực tế;
  - Khoa: UI/PWA/mobile support theo assignment thực tế.
- Không tự thay assignee nếu Jira khác.
- Không ghi Google Vision, Docker/Staging hoặc coverage cụ thể nếu chưa có evidence/commitment.

## 11.9 Report 3 — SRS

- Cập nhật System Functional Overview.
- Actor list phải thể hiện Finder, Owner, Security/Staff, Admin, System và external services.
- Đồng bộ FR/UC/BR cho peer-to-peer chat.
- Thêm Native Mobile requirements/use cases riêng.
- PWA requirements riêng, không gộp thành native app.
- Mỗi UC có cấu trúc đầy đủ.
- Section 3.2 phản ánh chức năng thực tế theo sprint.
- Bổ sung ERD/entity relationships nếu thiếu.
- Liệt kê third-party API đúng evidence.

## 11.10 Report 4 — Design

- Web/PWA/native mobile architecture.
- Realtime conversation design.
- Chat message/attachment authorization.
- Guided-question design.
- State diagrams cho verification, meetup, direct handover và custody.
- Sequence diagrams cho:
  - peer-to-peer return;
  - competing claimant;
  - optional Staff transfer;
  - escalated dispute.
- Deployment/component view.
- PWA manifest/service worker/cache design.
- Mobile navigation/API/session/notification design.

## 11.11 Report 5 — Implementation and Testing

- Evidence theo sprint và channel.
- Unit/API/integration/realtime/E2E/PWA/mobile/system/UAT.
- Privacy/authorization tests cho chat và ảnh.
- Dual-confirmation và idempotency tests.
- Optional custody tests.
- Deployment, feedback, defect và regression evidence.
- Không ghi pass/coverage nếu chưa chạy.

---

# 12. Estimation và WBS

Không tiếp tục giữ bảng effort cũ nếu việc thêm Native Mobile làm tổng effort không còn hợp lý.

Thực hiện:

1. Tìm tất cả WBS/effort/capacity trong Markdown, DOCX và XLSX.
2. Kiểm tra tổng effort hiện tại.
3. Thêm Native Mobile thành workstream riêng, gồm:
   - project setup;
   - architecture/navigation;
   - shared API/auth;
   - LOST/FOUND;
   - matching;
   - realtime chat/image;
   - guided verification;
   - meetup/handover;
   - notifications;
   - testing/build/release.
4. Không tự bịa tổng man-days mới nếu team chưa chốt.
5. Nếu prompt/repository không có con số mới được duyệt:
   - giữ bảng cũ dưới nhãn historical/current approved baseline nếu cần;
   - tạo bảng `Re-estimation required`;
   - ghi rõ tổng planned effort mới là `TBD pending mobile estimation`;
   - liệt kê delta do Native Mobile.
6. Không ép tổng 416 man-days nếu phạm vi đã thay đổi nhưng chưa re-estimate.

---

# 13. Verification bắt buộc sau khi sửa

Tìm toàn repository:

- `PWA-only`;
- `Web Application with PWA support`;
- `native mobile excluded`;
- `future enhancement`;
- `Mobile App`;
- `mobile client`;
- `Expo`;
- `React Native`;
- `Flutter`;
- `Android`;
- `FR-MOBILE`;
- `FR-PWA`;
- `Staff review`;
- `Staff approve`;
- `Finder giao.*Staff`;
- `AWAITING_HANDOVER`;
- `MVP`;
- mọi sprint date cũ;
- mọi effort total cũ.

Phân loại từng kết quả còn lại:

- current truth;
- planned scope;
- historical note;
- future enhancement;
- hoặc lỗi chưa sửa.

Kiểm tra:

- mọi file dùng cùng software type;
- Web/PWA/Native Mobile được phân biệt rõ;
- mobile chưa có project không bị ghi implemented;
- Sprint 4 đúng 01/09/2026–09/09/2026 nếu Jira vẫn như vậy;
- các sprint khác đúng Jira hiện tại;
- peer-to-peer là main flow;
- Staff custody là optional/escalation flow;
- chat/image/guided questions/meetup/dual confirmation xuất hiện xuyên suốt;
- UC ID không trùng hoặc bị mất;
- BR–FR–UC mapping đầy đủ;
- status totals đúng;
- relative Markdown links hoạt động;
- evidence paths tồn tại;
- headings/tables không lỗi hoặc trùng;
- WBS arithmetic đúng với số đã được phê duyệt;
- Mermaid/rendered diagrams hợp lệ.

Chạy test/build/lint phù hợp nếu môi trường cho phép.

Không:

- chạy migration trên shared Aiven database;
- chạy destructive test;
- reset/overwrite user changes;
- sửa Jira khi nhiệm vụ không yêu cầu;
- tạo nguồn hoặc evidence giả.

Nếu sửa DOCX:

- giữ style, heading, table và TOC;
- render PDF/PNG để kiểm tra page break, table width và orphan heading;
- không phá layout.

Nếu sửa XLSX:

- giữ formula, formatting, merged cells, width, wrap và printable layout;
- kiểm tra tổng/công thức sau sửa.

---

# 14. File kết quả bắt buộc

Chỉnh trực tiếp file hiện có; không tạo bản sao trùng tên không cần thiết.

Cập nhật hoặc tạo:

`docs/LNFS_BUSINESS_PROCESS_A_TO_Z.md`

File này phải là nguồn nghiệp vụ đầy đủ, gồm:

- scope;
- actors;
- peer-to-peer main flow;
- chat/guided questions;
- multiple claimant;
- meetup;
- dual-confirmation handover;
- optional Staff custody;
- warehouse;
- sensitive items;
- state models;
- privacy;
- business rules;
- exceptions;
- notifications;
- audit;
- KPI;
- Web/PWA/native mobile channel mapping;
- TBD decisions.

Tạo:

`docs/DOCUMENTATION_UPDATE_REPORT.md`

Nội dung:

- files inspected;
- files modified;
- missing Reports;
- code/Jira evidence checked;
- resolved conflicts;
- status changes;
- current PWA status;
- current Native Mobile status;
- peer-to-peer flow changes;
- Staff/custody conclusion;
- test/build commands and results;
- remaining implementation gaps;
- remaining TBD/team decisions.

---

# 15. Báo cáo cuối

Trong câu trả lời cuối, cung cấp:

1. Tóm tắt thay đổi theo từng file.
2. Current implementation status theo Web, PWA, Native Mobile và Backend.
3. Những status đã thay đổi sau code/test verification.
4. Mâu thuẫn đã giải quyết.
5. Jira/sprint đã đối chiếu.
6. Test/build/lint đã chạy và kết quả thật.
7. Nội dung chưa xác minh hoặc còn TBD.
8. Link đến tất cả file đã sửa.

Không nói “đã hoàn thành toàn bộ” nếu vẫn còn test fail, file chưa xử lý hoặc evidence chưa xác minh.

---

# 16. Các quyết định không được tự thay đổi

- Sản phẩm gồm Web + PWA + Native Mobile.
- Native Mobile là bắt buộc nhưng hiện chưa có project.
- Web + PWA được đặt mục tiêu hoàn thành trong Sprint 4.
- Sprint 4 bắt đầu 01/09/2026 và kết thúc 09/09/2026 theo Jira đã kiểm tra; phải kiểm tra lại Jira tại thời điểm chạy.
- Finder giữ vật phẩm trong luồng thường.
- Finder và Owner xác minh qua real-time chat.
- Chat hỗ trợ ảnh.
- Finder có câu hỏi gợi ý theo category.
- Hai bên tự hẹn điểm/thời gian gặp.
- Direct handover dùng dual confirmation.
- Staff không duyệt routine evidence.
- Staff/custody/warehouse là optional hoặc escalation flow.
- AI/OCR chỉ hỗ trợ quyết định.
- Không thay đổi Jira hoặc assignee nếu người dùng không yêu cầu rõ.
- Không đánh dấu planned feature là implemented.

Hãy bắt đầu bằng inventory và implementation audit, lập plan ngắn, sau đó thực hiện chỉnh sửa và verification đầy đủ.
