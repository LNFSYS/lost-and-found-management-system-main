# Phân công Report 3 / UC — LNFS Sprint 4

> Nội dung dưới đây tập trung từ mục 3.2 trở đi. Các phần trước 3.2 đã được lược bỏ theo yêu cầu. Phạm vi phân công chỉ tính LNFS Sprint 4.

## 3.2 Authentication & Profile

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC001–008 | Register/login/logout/session/password/account access | Theo source RP3; chỉ đánh dấu S4 evidence khi có | Khoa | Actor, credential validation, session/token, error cases, authorization |
| UC009–012 | View/update profile, activity/history và profile-related actions | Partial/Implemented chỉ khi có evidence | Khoa | Profile fields, ownership, privacy, protected route, postcondition |

S4 evidence liên quan: LNFS-60 (PWA foundation, Jira Done, Khoa), LNFS-177 (security hardening, Jira In Progress, Git Quân). Không gộp PWA vào tên UC; PWA chỉ là kênh thực thi.

## 3.3 Public Board & Post Management

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC013–025 | Public board, LOST/FOUND post create/view/search/filter/update/manage media | Theo source RP3 | Đạt | Actor Finder/Poster, post lifecycle, validation, media, public/private data, responsive behavior |

S4 evidence liên quan: LNFS-61, Jira Done, Git commit f3d283a của Đạt. PWA install/offline là NFR/channel evidence, không phải UC mới.

## 3.4 Matching & Recommendations

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC026–031 | Matching suggestion, candidate list, explanation và match actions | Implemented/Partial theo evidence | Quân | Input attributes, matching result, explanation, confidence, dismiss/accept behavior |
| UC097–100 | Matching notifications, dismiss/feedback và periodic refresh | Planned nếu chưa có S4 evidence | Quân | Trigger, refresh policy, duplicate suppression, notification rule, failure fallback |

S4 evidence: LNFS-56 Jira Done, Git commits 9127723/dac7c20/489cdc9 của Quân. LNFS-56 có yêu cầu re-check supplied audit; không tự suy diễn mọi UC matching là Done.

## 3.5 Matching Model & AI Operations

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC101–105 | Training/data feedback, model lifecycle, AI/OCR operation và monitoring | Planned nếu chưa có evidence | Lượng | Data source, human review, model version, rollback, audit, privacy, failure mode |

S4 evidence: LNFS-57 In Progress, Jira giao Lượng. Rule bắt buộc: Gemini/OCR chỉ hỗ trợ quyết định; hệ thống không tự chuyển ownership.

## 3.6 Claims & Ownership Verification

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC032–038 | Create/view/withdraw claim, claim status, basic ownership flow | Done baseline theo LNFS-52 | Khoa | Claimant, item, authorization, state transition, validation, withdrawal |
| UC106–110 | Guided verification questions, answer/review evidence, confidence | Planned/Partial theo source | Lượng | Question flow, evidence privacy, confidence meaning, human decision boundary |
| UC111–118 | Escalation, multiple claimants, comparison, reserve/release item | Planned nếu chưa có S4 evidence | Quân | Conflict handling, escalation, reservation timeout, staff/admin decision |

S4 evidence: LNFS-52 Done, Jira/Git Khoa; LNFS-53 To Do, Jira Lượng; LNFS-177/182 có security/media/claim fixes của Quân. Không ghi guided verification đã triển khai chỉ vì baseline claim đã Done.

## 3.7 Private Communication, Evidence & Notifications

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC039–045 | Private room, evidence exchange, media/privacy, claim conversation actions | Done baseline theo LNFS-52 | Khoa | Participant authorization, private media access, allowed actions, abuse/error cases |
| UC046–048 | Claim/chat notification baseline | Theo evidence | Khoa | Notification trigger, recipient, read/unread, privacy |
| UC119–125 | Realtime messages, image message, unread/read, claim/appointment/handover notifications | Planned/Partial theo source | Đạt | Delivery, reconnect, duplicate, read state, notification fallback |

S4 evidence: LNFS-52 Done của Khoa; LNFS-58 To Do giao Đạt. HTTP/polling baseline không được mô tả thành full realtime nếu chưa có evidence.

## 3.8 Handover, Appointment & Direct Return

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC049 | Admin handover points/campus map | Done theo LNFS-47 | Quân | Admin CRUD, map point fields, authorization, audit |
| UC126–127 | List/view appointment | Planned | Quân | Participants, appointment state, visibility |
| UC128–131 | Propose/counter-propose/accept/decline meetup | Planned | Quân | State machine, permission, conflict and validation |
| UC132–135 | Reschedule/cancel/reminder/no-show | Planned | Quân | Time rule, reminders, cancellation and no-show evidence |
| UC136–140 | Confirm handover/received, conflicting confirmations, complete return, issue report | Planned | Quân | Dual confirmation, dispute hold, final state, escalation |

S4 evidence: UC049 từ LNFS-47 Done; LNFS-54 To Do. LNFS-51 feedback/reputation phụ thuộc handover nhưng không có nghĩa appointment đã hoàn thành.

## 3.9 Warehouse Intake, Custody & Transfer

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC050–057 | Warehouse intake, custody, overdue alert/disposition guard và staff operations | Planned nếu chưa có evidence | Lượng | Custodian role, chain of custody, timestamps, acceptance/rejection, notification |
| UC141–147 | Transfer request, intake point/time, accept/reject, staff intake and status notification | Planned | Lượng | Request state, handoff evidence, dual acknowledgement, audit |

S4 evidence: LNFS-55 To Do, Jira giao Lượng. Không lấy task sprint khác làm bằng chứng hoàn thành.

## 3.10 Feedback & Reputation

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC058–060 | Return feedback, reputation and activity flow | Done theo LNFS-51 | Đạt | Who can rate, timing, one-rating rule, edit/abuse rule, reputation calculation |

S4 evidence: LNFS-51 Done, Git commit c0be32f của Đạt. Description của LNFS-51 ghi dependency với handover; nếu handover chưa Done thì phải nêu dependency.

## 3.11 User & Role Administration

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC062–068 | User administration, role/permission and access management | Theo source RP3; S4 evidence chỉ khi có | Khoa | Admin actor, permission matrix, protected action, account state, audit |

Đối chiếu thêm LNFS-177 để viết security/authorization, nhưng không gán toàn bộ implementation security cho UC admin.

## 3.12 Master Data & Location Administration

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC061 | Master-data/catalog administration | Theo source RP3 | Đạt | Entity fields, CRUD, validation, dependency |
| UC069–077 | Categories, areas, buildings and location master data | Theo source RP3 | Đạt | Hierarchy, uniqueness, active/inactive and references |
| UC078–081 | Handover point/campus map administration | Done theo LNFS-47 | Quân | CRUD, map coordinate/address, public/private exposure, authorization |

S4 evidence rõ nhất cho UC078–081: LNFS-47 Done, Git commit d91ac91 của Quân. Các UC catalog khác không tự nhận là Sprint 4 completed nếu không có S4 evidence trực tiếp.

## 3.13 Moderation & User Reports

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC082–083 | Admin moderation/report handling baseline | Done theo LNFS-59 | Khoa | Report target, moderator actions, evidence, resolution |
| UC093–096 | User report create/list/view/resolve flow | Planned nếu chưa có evidence | Khoa | Reporter, target, reason, status, privacy, anti-abuse |
| UC165 | View moderation report detail | Planned/Partial theo source | Khoa | Detail fields, access control, moderation history |

S4 evidence: LNFS-59 Done, Jira Khoa; Git direct feature commit 51dfb3a của Khoa. PR/merge có thể do Quân nhưng không thay đổi implementation owner.

## 3.14 Dashboard, Statistics & Audit

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC084–085 | Admin dashboard and statistics | Done theo LNFS-59 | Khoa | KPI definitions, filters, time range, aggregation, export boundary |
| UC163–164 | Audit logs and claim/verification history | Planned nếu chưa có S4 evidence | Đạt | Event, actor, timestamp, immutable/auditable fields, access |
| UC166 | Export audit and moderation data | Planned nếu chưa có S4 evidence | Đạt | Filter, format, authorization, masking, export audit |

Quân là reviewer cuối cho evidence/integration vì LNFS-63 và các QA/security tasks; không đồng nghĩa Quân là người viết tất cả UC audit.

## 3.15 System Configuration

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC086 | Safe public configuration endpoint | Done theo LNFS-94 | Quân | Public-safe fields, no secret leakage, cache/fallback, authorization |
| UC087–092 | Admin system configuration CRUD | Done theo LNFS-93 | Đạt | Admin CRUD, validation, effective time, audit, public projection |

LNFS-50 là parent historical Done. Runtime evidence dùng LNFS-93 của Đạt và LNFS-94 của Quân.

## 3.16 Warehouse Retention & Disposition

| UC | Phạm vi | Status cần giữ | Người viết | Nội dung bắt buộc |
|---|---|---|---|---|
| UC148–150 | List overdue items, detail and retention deadline alerts | Planned | Lượng | Deadline calculation, alert recipient, repeat suppression |
| UC151–155 | Disposition eligibility, legal hold, create/view/approve disposition | Planned | Lượng | Legal hold precedence, approval role, state transition, audit |
| UC156–158 | Reject/cancel disposition and record evidence | Planned | Lượng | Reason, evidence, immutable history, rollback boundary |
| UC159–162 | Donation campaign create/update/assign/complete | Planned | Lượng | Campaign state, item assignment, eligibility, completion evidence |

S4 evidence: LNFS-55 To Do. Không dùng issue ở sprint khác để đánh dấu những UC này đã làm.

## 4. Non-functional Requirements

| Nhóm NFR | Nội dung cần ghi | Người phụ trách | Evidence Sprint 4 |
|---|---|---|---|
| Security & privacy | Auth, role/permission, private claim room, private media, notification authorization, no secret leakage | Võ Chiêu Quân | LNFS-177, LNFS-182 |
| Performance & availability | API response, retry, resilience, migration lock, fallback, CI/release gate | Võ Chiêu Quân | LNFS-177–183 |
| Accessibility & responsive | Responsive UI, browser/device behavior, PWA installability and offline boundary | Phạm Nguyễn Anh Khoa + Trương Quang Đạt | LNFS-60–62 |
| PWA Support | Web installability, responsive authentication/board, offline behavior and browser evidence | Trương Quang Đạt | LNFS-60–62 |
| Native Mobile Support | Ghi là channel/future boundary nếu chưa có implementation trong Sprint 4; không tạo UC nghiệp vụ riêng | Trần Thế Lượng | Không có acceptance riêng trong Sprint 4 |
| AI/OCR boundary | AI/OCR chỉ hỗ trợ decision; human/business workflow mới quyết định ownership | Trần Thế Lượng | LNFS-57 |

## 5. Jira Sprint 4 ledger dùng để kiểm tra phân công

| Issue | Trạng thái Jira | Assignee | Ảnh hưởng tới RP3 |
|---|---|---|---|
| LNFS-47 | Done | Quân | UC049, UC078–081 |
| LNFS-50 | Done lịch sử | Đạt | Không dùng trực tiếp; runtime lấy LNFS-93/94 |
| LNFS-51 | Done | Đạt | UC058–060 |
| LNFS-52 | Done | Khoa | UC032–048 baseline |
| LNFS-53 | To Do | Lượng | UC106–110; verification chưa làm |
| LNFS-54 | To Do | Quân | UC126–140; appointment/direct handover chưa làm |
| LNFS-55 | To Do | Lượng | UC050–057, UC141–162 chưa làm |
| LNFS-56 | Done | Quân | UC026–031; cần re-check evidence |
| LNFS-57 | In Progress | Lượng | UC101–105; AI/OCR đang làm |
| LNFS-58 | To Do | Đạt | UC119–125 realtime còn lại |
| LNFS-59 | Done | Khoa | UC082–085, moderation/dashboard baseline |
| LNFS-60 | Done | Khoa | PWA auth/profile/channel evidence; không phải UC mới |
| LNFS-61 | Done | Đạt | PWA board/post/channel evidence |
| LNFS-62 | To Do | Quân | NFR/integration evidence cho PWA/browser/device |
| LNFS-63 | To Do | Quân | Final integration, audit evidence, release validation |
| LNFS-80 | To Do | Lượng | RP3 functional overview và traceability |
| LNFS-81 | To Do | Quân | RP3 NFR, business rules và evidence sync |
| LNFS-93 | Done | Đạt | UC087–092 admin configuration runtime |
| LNFS-94 | Done | Quân | UC086 safe public configuration |
| LNFS-120 | To Do | Quân | Merge/verify schema-reconciliation; chỉ là evidence kỹ thuật |
| LNFS-169 | In Progress | Lượng | ERD/entity reference; không phải toàn bộ RP3 |
| LNFS-170 | Done | Quân | Template/format kinh nghiệm cho report |
| LNFS-171 | Done | Khoa | Kinh nghiệm rewrite theo format 3.1 |
| LNFS-172 | Done | Đạt | Kinh nghiệm institutional adoption |
| LNFS-173 | Done | Quân | Kinh nghiệm report workflow |
| LNFS-174 | Done | Đạt | Roadmap/deliverables |
| LNFS-175 | Done | Lượng | Communication table |
| LNFS-176 | Done | Khoa | Naming/GitHub workflow |
| LNFS-177 | In Progress | Quân | Cross-cutting security/auth/claim evidence |
| LNFS-178 | In Progress | Quân | Node modular architecture boundary |
| LNFS-179 | In Progress | Jira Lượng; Git Quân | DB/migration/feedback retry; tách owner và author |
| LNFS-180 | In Progress | Quân | Playwright/home evidence |
| LNFS-181 | In Progress | Quân | Migration integration test evidence |
| LNFS-182 | In Progress | Jira Lượng; Git Quân | Aiven/media/claim evidence; tách owner và author |
| LNFS-183 | In Progress | Quân | CI on dev branch |

## 6. Git evidence chính trong Sprint 4

Chỉ dùng commit trực tiếp để nhận diện người implement; không dùng PR opener/merger làm bằng chứng duy nhất.

| Commit | Git author | Nội dung | Jira/UC liên quan |
|---|---|---|---|
| d91ac91 | vochieuquan | Admin handover point management | LNFS-47; UC049, UC078–081 |
| c0be32f | ugnttad | Return feedback reputation flow | LNFS-51; UC058–060 |
| fb0d877, 6e3491b | anhkhoapro123 | Match-to-chat verification PWA/API | LNFS-52; UC032–048 |
| 9127723, dac7c20, 489cdc9 | vochieuquan | Matching hardening | LNFS-56; UC026–031 |
| 51dfb3a | anhkhoapro123 | Admin moderation reporting and PWA profile activity | LNFS-59/60; UC082–085 và PWA channel evidence |
| f3d283a | ugnttad | PWA board offline support | LNFS-61; UC013–025/channel evidence |
| 696afef | ugnttad | System configuration management | LNFS-93; UC087–092 |
| d5d50ea | vochieuquan | Reliability/security remediation | LNFS-177; cross-cutting evidence |
| 1f18578 | vochieuquan | Modular clean architecture | LNFS-178 |
| fd8e25c | vochieuquan | Legacy claim migration/feedback retry | LNFS-179; Jira assignee Lượng, Git author Quân |
| 949cdc1 | vochieuquan | Aiven migrations/media/claim flow | LNFS-182; Jira assignee Lượng, Git author Quân |
| 43f70be, bfcdf99, aa69fa0 | vochieuquan | QA home test, migration test, CI dev | LNFS-180/181/183 |

## 7. Cách viết một UC trong RP3

Dùng cùng một template cho tất cả UC:

1. UC ID và tên.
2. Goal: actor muốn đạt kết quả nghiệp vụ gì.
3. Primary actor và secondary actor/system.
4. Trigger: hành động hoặc sự kiện bắt đầu.
5. Preconditions.
6. Main flow: đánh số từng bước, viết theo góc nhìn actor/system.
7. Alternative/exception flows: validation, unauthorized, timeout, duplicate, conflict.
8. Business rules: state transition, role, deadline, privacy, AI boundary.
9. Data/API boundary: input/output, entity liên quan, endpoint/service nếu đã xác nhận.
10. Authorization/privacy: ai được xem, ai được sửa, private media/message xử lý ra sao.
11. Postconditions: trạng thái và notification sau khi thành công/thất bại.
12. UI/screen reference: tên màn hình hoặc link prototype nếu có.
13. Status: Implemented, Partial, Planned hoặc TBD.
14. Evidence: Jira key/commit đặt trong traceability table hoặc appendix; không nhồi commit hash vào phần mô tả nghiệp vụ.

Mẫu ngắn:

- Actor: Finder
- Goal: Xem danh sách match có khả năng liên quan
- Preconditions: Đã đăng nhập và có post hợp lệ
- Main flow: mở match list → hệ thống tính/lấy candidate → hiển thị score/explanation → actor chọn action
- Alternative: không có candidate, dữ liệu thiếu, service timeout
- Rule: score không đồng nghĩa ownership; ownership chỉ hoàn tất qua claim/verification/handover
- Postcondition: action được lưu và notification được gửi nếu rule yêu cầu

## 8. Cách hoàn thiện tài liệu theo thứ tự

1. Lượng hoàn thiện 3.1, actor/module map, traceability và entity reference từ LNFS-80/LNFS-169.
2. Khoa và Đạt hoàn thiện các module đã có evidence: auth/profile, board/post, claim/private room, feedback, moderation, dashboard, configuration.
3. Quân hoàn thiện matching, public config, handover-point và phần NFR/security/architecture boundary.
4. Lượng viết các nhóm Planned: AI, guided verification, warehouse/custody/disposition.
5. Đạt viết realtime/notification và audit/statistics/export phần được giao.
6. Mỗi người cập nhật status/evidence table; không tự đổi To Do/In Progress thành Implemented.
7. Quân kiểm tra cuối theo LNFS-63/LNFS-81: numbering, actor consistency, state transition, API/entity references, PWA/Native Mobile boundary và TBD list.

## 9. Các lỗi cần tránh

- Không coi Native Mobile Support hoặc PWA Support là một UC độc lập.
- Không coi 3.1 là “chức năng”; 3.1 là phần overview/traceability.
- Không gom appointment, guided verification và direct handover vào LNFS-52; đó là các workflow sau, thuộc LNFS-53/LNFS-54.
- Không mô tả HTTP/polling baseline thành full realtime khi LNFS-58 còn To Do.
- Không ghi AI/OCR tự quyết định chủ sở hữu.
- Không lấy parent LNFS-50 làm runtime evidence.
- Không lấy Jira assignee làm Git author khi Git evidence cho thấy người khác viết commit.
- Không dùng task của Sprint khác để đánh dấu Sprint 4 đã hoàn thành.

