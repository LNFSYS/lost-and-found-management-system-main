# Luật nghiệp vụ LNFS

Cập nhật mapping: **06/10/2026**. [Đối chiếu trạng thái 71 UC](../audits/uc-status-review-2026-10-06.md) giữ nguyên snapshot trước đợt xây lịch hẹn/hành trình. Catalogue local hiện **129 Implemented, 20 Partial, 19 Planned**; xem [rollout lịch hẹn và hành trình](../runbooks/appointment-journey-rollout.md). Không thêm UC ID chỉ để sửa nhãn. Baseline custody/matching đã merge trên `dev`; thay đổi mới chưa commit/deploy, migration 063 chưa áp dụng Aiven. UC hiện tại xem [uc.md](uc.md); provider/manual/deployment acceptance tách riêng. Snapshot lịch sử không chứng nhận mọi UC đã hoàn thành.

## 1. Quy ước

- **Enforced:** đang được backend/UI hoặc migration hiện tại cưỡng chế.
- **Partial:** một phần được cưỡng chế, phần còn lại chưa có runtime.
- **Planned:** luật thuộc product scope nhưng chưa có runtime evidence.
- **TBD:** cần FPT University, mentor hoặc team xác nhận.
- AI/OCR và matching chỉ là decision support. Human verification là bắt buộc trước khi trả đồ.

## 2. Authentication, role và post

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-01 | Đăng ký phải qua OTP email còn hạn; email FPT/edu không bắt buộc. | UC-001, UC-002 | Enforced |
| BR-02 | Tài khoản mới nhận role nền USER và audience STUDENT hoặc LECTURER; client không tự cấp STAFF/ADMIN. | UC-002, UC-066 | Enforced |
| BR-03 | Password dùng bcrypt; OTP, refresh token và reset token không lưu plaintext; token có expiry/use-once phù hợp. | UC-001–UC-007 | Enforced |
| BR-04 | Login chỉ thành công với account ACTIVE và session version hợp lệ. | UC-003, UC-004 | Enforced |
| BR-05 | Refresh token được rotate trong transaction; logout revoke session hiện tại. | UC-004, UC-005 | Enforced |
| BR-06 | Protected endpoint phải xác thực JWT; Admin API chỉ chấp nhận ADMIN, Staff API chỉ chấp nhận STAFF/ADMIN theo route. SSE gắn với validated subject/session version và token expiry; đóng khi token hết hạn, kiểm tra session trước delivery/heartbeat, fail closed khi DB revalidation lỗi hoặc quá 5 giây. Kết nối cũ không được tiếp tục nhận thông báo khi phiên đã thu hồi/account bị disable. | UC-003, UC-008, UC-050–UC-057, UC-062–UC-068, UC-119, UC-123 | Enforced current REST/SSE scope; full realtime UC acceptance remains Partial |
| BR-07 | Post chỉ có LOST hoặc FOUND; chỉ owner được update/delete/upload/delete media của bài. | UC-018–UC-025 | Enforced |
| BR-08 | Post cần title, description, category cụ thể, contact, incident time không ở tương lai và location hợp lệ. | UC-018, UC-019 | Enforced |
| BR-09 | Building phải thuộc area đã chọn; LOST không dùng handover point; FOUND phải có nơi lưu/area/custom location/handover hợp lệ. | UC-016, UC-018, UC-019, UC-049 | Enforced |
| BR-10 | PRIVATE_DETAILS chỉ dành cho FOUND; public response phải che contact, location chi tiết và tín hiệu nhận dạng nhạy cảm. | UC-015, UC-019, UC-024, UC-028 | Enforced current post/search/match/private-media scope; guided answer giữ trong participant-protected chat, expected hash không trả ra |
| BR-11 | Public board không trả post soft-deleted/hidden và chỉ trả status hợp lệ. | UC-013–UC-015, UC-022 | Enforced |
| BR-12 | Category có hai cấp; post phải chọn danh mục cụ thể, không chọn nhóm chính. | UC-016, UC-018, UC-019, UC-069–UC-071 | Enforced |
| BR-13 | Không hard-delete category/area/building còn reference; nếu còn dữ liệu phải chuyển inactive. | UC-071, UC-074, UC-077, UC-081 | Enforced |
| BR-14 | Upload chỉ nhận JPEG/PNG/WEBP hợp lệ, theo giới hạn size/count; MIME phải khớp file signature. | UC-023–UC-025, UC-044, UC-045 | Enforced |
| BR-15 | Media không trả storage URI nội bộ; client truy cập qua protected endpoint/proxy sau authorization. | UC-024, UC-045, UC-055 | Enforced cho post media |
| BR-16 | Gemini chỉ chạy khi user chủ động gửi ảnh; tối đa 5 ảnh và tổng dung lượng theo validator hiện tại. | UC-017 | Enforced |
| BR-17 | Gemini chỉ tạo draft; user phải review/chỉnh sửa và tự xác nhận trước khi lưu post. | UC-017 | Enforced ở Web flow |
| BR-18 | OCR/visible text không được dùng để công khai serial đầy đủ, IMEI, QR/barcode, email, phone hoặc giấy tờ. | UC-017, UC-028, UC-030 | Partial; cần provider regression test sâu hơn |

## 3. Matching và điểm bàn giao

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-19 | Create/update post gọi matching best-effort; matching failure không rollback một post hợp lệ. | UC-029 | Enforced |
| BR-20 | Matching chỉ so sánh bài đối nghịch LOST/FOUND đang hoạt động, có candidate limit và time window. | UC-029–UC-031 | Enforced |
| BR-21 | Score dùng text, category, location, time, image và safe OCR; weight/threshold đọc từ config/default. | UC-030 | Enforced |
| BR-22 | Candidate dưới ngưỡng yếu bị bỏ; tier cao hơn chỉ là gợi ý, không auto-verify ownership, claim hoặc return. | UC-026, UC-028, UC-030, UC-110 | Enforced |
| BR-23 | Khác category mạnh hoặc lệch thời gian lớn phải có penalty/cap, trừ khi tín hiệu mạnh phù hợp. | UC-028, UC-030 | Enforced |
| BR-24 | Match lưu score thành phần, tier, matcher version và explanation; xem/re-run phải qua authorization/rate limit. | UC-026–UC-028, UC-031 | Enforced |
| BR-25 | Match của PRIVATE_DETAILS không lộ raw tokens/OCR/location cho actor không có quyền. | UC-028 | Enforced trong serializer |
| BR-26 | Public API chỉ trả handover point active. Admin không hard-delete point có appointment PENDING/ACCEPTED/RESCHEDULED hoặc reference vận hành; phải inactive. | UC-049, UC-078–UC-081 | Enforced |
| BR-27 | Migration đã chạy không được sửa; toàn bộ lịch sử phải qua preflight trước DDL; runner và reconciliation dùng chung database lock. Alias chỉ được đối soát khi checksum/schema/backfill khớp và có phê duyệt. | N/A | Enforced in runner/isolated SQL; reviewed forward recovery and 059/060 are applied on Aiven, with original ledger preserved and explicit historical-scope warnings |
| BR-28 | Node.js + TypeScript là backend, business-write và migration owner duy nhất; module phụ thuộc core qua public application contract. Java đã ngừng sử dụng. | N/A | Enforced: composition root, injected ports và architecture check |
| BR-44 | Moderation phải suy ra target từ report hoặc quan hệ backend hợp lệ; không nhận target ID tùy ý từ client. BAN_USER không được tự khóa admin hoặc khóa Admin active cuối cùng. | UC-083, UC-093–UC-096, UC-165, UC-067 | Enforced |
| BR-45 | Avatar được lưu bằng Cloudinary authenticated storage; database chỉ lưu metadata ổn định, không dùng local absolute path làm nguồn chính. | UC-010, UC-011 | Enforced |
| BR-46 | Dashboard tách metrics theo khoảng thời gian khỏi current snapshot; UI và export phải giữ nhãn scope tương ứng. | UC-084, UC-085 | Enforced |

## 4. Staff, custody và warehouse

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-29 | Shared DB không được tham chiếu file chỉ tồn tại trên một máy; shared object storage là yêu cầu trước multi-instance staging. Post/claim và warehouse intake/return có Cloudinary authenticated adapter; production warehouse không ghi fallback local. Ảnh local cũ phải backup/đối soát và copy có xác minh trước khi bỏ instance nguồn. | UC-023–UC-025, UC-044, UC-045, UC-051, UC-052, UC-055, UC-056, UC-146 | Partial overall: warehouse 16-reference transfer, protected backup/UTC restore, independent-process/provider/restart/role checks pass; production topology and non-warehouse legacy acceptance remain separate |
| BR-30 | Metadata media còn nhưng file mất phải trả 404 có kiểm soát, không để unhandled 500. | UC-024, UC-045 | Enforced cho local post media |
| BR-31 | Admin catalog write cần audit actor, action, before/after và timestamp. | UC-069–UC-081, UC-163 | Planned |
| BR-32 | Staff page chỉ công bố hoàn thành khi có operational flow và backend role evidence. | UC-050–UC-057, UC-143–UC-146 | Enforced cho warehouse operations hiện tại |
| BR-33 | Ownership claim đối chiếu FOUND; direct contact tới LOST phải qua BR-69. Không tự claim/contact bài của mình hoặc tạo trùng. Với direct LOST, chủ LOST là Claimant và người đang giữ FOUND là Finder; khóa requester không phải chứng cứ về vai trò sở hữu. | UC-034, UC-042 | Enforced current claim API; full multi-claimant policy còn cần xác nhận |
| BR-34 | Claim state transition phải transaction/lock; một FOUND không có hai accepted claims. | UC-034–UC-038, UC-107–UC-118 | Guided verification uses row locks/current-state/idempotency and unique accepted claim. New appointments lock claim and related posts, fence stale versions and replay exact operation keys |
| BR-35 | Evidence chỉ hiển thị cho participant/reviewer có quyền; cả Finder và Claimant đã đồng ý trong phòng đang mở có thể tải PHOTO riêng tư hoặc gửi IMAGE trong chat qua authenticated endpoint và protected proxy. IMAGE và PHOTO evidence liên quan được ghi atomically, retry cùng key không tạo trùng. Ảnh không xác nhận ownership; private answer không trả trước cho claimant. | UC-041, UC-043–UC-045, UC-107–UC-109, UC-120 | Enforced current participant/API scope: protected evidence/image, atomic replay và hidden expected hash có regression. Raw answer có thể lưu trong private chat, human review không dùng automatic hash comparison; provider/deployment/manual acceptance riêng |
| BR-36 | Evidence confidence chỉ hỗ trợ review; không phải xác minh 100% và không thay thế human verification. | UC-109, UC-110, UC-114 | Enforced for explicit Finder review and post-intake Staff review under BR-65; confidence/match/intake never automatically accepts ownership |
| BR-37 | Accepted eligible conversation, accepted consents and active real participants are required to propose a future time/active point; counterpart must accept. One active appointment per claim. A communication-only LOST proposal is not ownership verification or warehouse permission. | UC-126–UC-133 | Local proposal/accept/reject/cancel API/Web enforced; counter-proposal and mutual rescheduling still Planned. Isolated migration 063 only |
| BR-37A | Feedback sau trả đồ chỉ mở khi return COMPLETED có dual confirmation hoặc custody outcome được ủy quyền; mỗi participant gửi một lần và không tự cộng reputation cho chính mình. | UC-055, UC-058–UC-060, UC-139 | Canonical custody and local peer dual-confirmation completion feed existing feedback; offline return invents no participants. Deployment/provider/manual acceptance separate |
| BR-38 | Disposition kho bị chặn nếu còn claim, appointment, dispute hoặc legal hold pending; overdue không tự động thanh lý. | UC-148–UC-158 | Canonical API gates enforced in dev; full disposition/evidence UI and operational acceptance remain incomplete |
| BR-39 | Warehouse receive/store/return chỉ Staff/Admin; mỗi transition phải ghi actor, action, from/to, note và timestamp. | UC-050–UC-057 | Enforced |
| BR-40 | FOUND mặc định do Finder giữ; Staff custody là escalation/optional branch và chỉ bắt đầu sau intake confirmation. | UC-141–UC-147 | Enforced current API/UI custody scope; UC-141/143–146 Implemented, UC-142/147 Partial vì thiếu scheduling/full producers. Physical/manual acceptance riêng |
| BR-41 | Native Mobile và PWA phải dùng chung authorization, privacy, validation và state rule với Web; offline không được báo transaction thành công trước server. | N/A (channels) | Partial/Planned |
| BR-42 | Retention/disposition policy theo loại vật phẩm cần đơn vị vận hành xác nhận; không tự coi thời hạn kỹ thuật là policy chính thức. | UC-057, UC-148, UC-151 | TBD |
| BR-43 | Staff chỉ xem routine conversation khi có escalation, lý do truy cập, quyền phù hợp, dữ liệu tối thiểu và audit. | UC-112–UC-114, UC-164 | Planned |

## 5. Notification delivery

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-47 | Chỉ event nghiệp vụ đã commit mới được tạo notification; in-app là bản ghi chính thức, email/PWA là delivery channel và không được tự đổi business state. | UC-097, UC-123–UC-125, UC-147, UC-150 | Partial: claim/chat notification và enqueue email cùng transaction; các producer khác chưa hoàn tất |
| BR-48 | User được cấu hình kênh và tần suất cho notification optional; email bảo mật bắt buộc cho account flow không được tắt bằng preference chung. | UC-168 | Partial: preference được scope theo authenticated subject cho claim/chat; OTP/reset password vẫn độc lập và bắt buộc |
| BR-49 | Email tin nhắn mới phải chờ 5–10 phút, kiểm tra unread ngay trước khi gửi và coalesce nhiều message cùng room. | UC-124, UC-168 | Worker/unit and isolated SQL evidence exists; real-provider/full producer acceptance remains open |
| BR-50 | Email không chứa message body, private evidence, verification answer, OCR/raw AI output, contact riêng, vị trí chính xác, storage URL hoặc secret. | UC-097, UC-123–UC-125, UC-147, UC-150, UC-168 | Enforced cho template hiện tại: HTML/text chỉ metadata và deep link, không render nội dung riêng tư |
| BR-51 | Delivery phải có transactional outbox, idempotency key, bounded retry/backoff và observability; provider failure không rollback nghiệp vụ đã commit. | UC-097, UC-123–UC-125, UC-147, UC-150 | Partial: known failures retry; SMTP timeout ở trạng thái UNKNOWN bị quarantine/cancel để tránh gửi trùng, vì provider hiện chưa có exactly-once |
| BR-52 | Chỉ gửi tới email đã xác minh; deep link luôn yêu cầu authorization và unsubscribe chỉ được tắt nhóm email optional tương ứng. | UC-168 | Enforced cho worker scope: verified/active/access checks và authenticated deep link; full category/provider evidence còn mở |

Chi tiết event, priority, privacy, retry và negative test nằm trong [notification-email-rules.md](../workflows/notification-email-rules.md).

## 6. Luồng peer-to-peer mục tiêu

FOUND item đi theo luồng:

~~~text
REPORTED → HELD_BY_FINDER → CHATTING → RESERVED → MEETUP_SCHEDULED
→ HANDOVER_PENDING_CONFIRMATION → RETURNED → CLOSED
~~~

Verification conversation:

~~~text
PENDING → CONVERSATION_OPEN ↔ NEED_MORE_INFO
→ ACCEPTED / REJECTED
~~~

Custody escalation đã tích hợp trong `dev`: giữ nguyên claim status, thêm `chat_rooms.escalated_at/by/reason` và audit `CUSTODY_ESCALATED`; reject/cancel custody xóa projection escalation, không xóa history. Intake không tự xác minh. Sau intake, Staff/Admin có thể ghi quyết định xác minh riêng theo BR-65 mà không giả danh hoặc thay thế Finder.
Chỉ `ACCEPTED` là appointment-eligible; `CONVERSATION_OPEN` không phải ownership verification.

Quy tắc bắt buộc:

1. Finder giữ vật phẩm trong luồng thường.
2. Finder hỏi và đánh giá từng Owner; không dùng first-claim-wins.
3. Appointment chỉ confirmed khi hai bên cùng đồng ý.
4. Direct handover cần Finder xác nhận đã giao và Owner xác nhận đã nhận.
5. Direct return cần dual confirmation; custody return cần Staff authorization, verified recipient và private proof. Chỉ status string không mở feedback.
6. Dispute/no-show không tự kết luận gian lận; có thể escalate.
7. Nếu chuyển Staff, phải có TRANSFER_REQUESTED và intake confirmation trước IN_CUSTODY.

## 7. Sensitive item và privacy

Thẻ sinh viên, giấy tờ, thẻ ngân hàng, CCCD/hộ chiếu, điện thoại/laptop, chìa khóa, tiền, thuốc và vật nguy hiểm cần policy riêng. Chỗ chưa được trường xác nhận phải ghi TBD. Không công khai bí mật dùng để xác minh, không yêu cầu password/OTP, và không đưa raw private storage URL cho actor không có quyền.

## 8. Nguyên tắc status

Một rule chỉ được chuyển từ Planned/Partial sang Enforced khi có runtime implementation, validation/authorization, test hoặc evidence tái lập được và traceability đã cập nhật.
## Notification email enforcement

Optional claim/chat email is never the source of truth: the committed in-app notification remains canonical. Only verified, active users with current entity access can receive a generic authenticated-link email. A read notification or opened room cancels pending optional delivery. Security OTP and password-reset email are mandatory and bypass optional preference settings. SMTP failure is isolated to outbox state and cannot roll back a committed claim, message, or notification. Known delivery failures use bounded retry; an uncertain provider timeout is quarantined/cancelled rather than retried because the current SMTP provider cannot guarantee exactly-once delivery.

## 9. Custody Safety Rules (Integrated in dev)

| ID | Rule | UC | Evidence scope |
| --- | --- | --- | --- |
| BR-53 | Custody uses an owned active undeleted FOUND plus valid claim/room, or an unlinked direct LOST room with accepted participants and the actual Finder's consumed private contact photo scoring at least 50%. The latter needs no FOUND post: keep physical post_id NULL and bind the request/item to claim, room and Finder; never treat the LOST owner as Finder. Keys scope to actor/operation and immutable original payload. One active request/intake per physical post or photo-backed conversation; retries cannot expose another user's record. | UC-042, UC-141–UC-146 | Local 6 October threshold follow-up; existing row locks/schema, isolated SQL/HTTP and desktop/mobile regressions; deployment/manual acceptance separate |
| BR-54 | Request creation queues physical intake immediately; no Staff pre-approval is needed. PENDING and legacy ACCEPTED may transition once to INTAKED with one RECEIVED item, not STORED. Opening the form is read-only. Intake never resolves a post or accepts/rejects ownership. Finder cancellation and Staff refusal before intake require a reason, restore room decisions and preserve audit history. | UC-141–UC-147 | Dev state/notification and SQL tests; acceptance remains distinct from automated evidence |
| BR-55 | CLAIMED/RETURNED/DISPOSED/DONATED/TRANSFERRED require canonical workflow, not PATCH. Staff reserve needs verified participant; release needs reason/no blocker/storage location. Legal hold and approval require Admin; requester cannot approve own order. Execution rechecks deadline, claim/appointment/dispute/hold in transaction; denied attempts are logged. | UC-053–UC-055, UC-151–UC-158 | Canonical safety endpoints in dev; full order/evidence UI remains Planned |
| BR-56 | Project defaults are documents/cards/keys/vehicle papers 120, electronics 90, perishables 3, others 60 days. Use UTC physical receivedAt, reject future time and invalid override; not an approved university policy. | UC-052, UC-057, UC-146, UC-148 | Common policy + isolated SQL |
| BR-57 | Canonical return records verified recipient identity/contact and Staff-private proof IDs. A linked online claim needs actual verified claimant and existing participant relationships; explicit post-intake Staff verification is allowed under BR-65. Offline return needs no account/claim but cannot bypass active online cases. Only real participants gain feedback; no synthetic participant is created. Unattached proofs expire after 72 hours; raw public/base64 identity images are not rendered from legacy notes. | UC-055, UC-058–UC-060 | Private storage/proxy, direct-recipient migration 059 and canonical completion tests |
| BR-58 | Create/accept/reject/cancel/intake/return notification and optional outbox commit atomically; generic privacy-safe text, event/recipient dedupe and post-commit realtime. Recipient follows only an authorized custody/claim/post link. | UC-147, UC-168 | Dev transaction/notification tests; SMTP provider unverified |
| BR-59 | Overdue maintenance sends a deduplicated reminder, never disposes/deletes/transitions item. Legal hold does not suppress operational reminders. | UC-150 | Custody-item reminder in dev; stale claims/meetups and walk-in reminders remain gaps |
| BR-60 | Saved permitted inactive matches survive refresh; deleted/hidden/private data remain guarded. Own LOST is hidden. LOST chat retains any authorized physical FOUND linkage. Without it, BR-53 permits photo-backed custody transfer, never automatic ownership approval. | UC-026–UC-031, UC-040, UC-042 | Real repository/HTTP regression; photo-custody is a local follow-up |

See [warehouse rules](../workflows/warehouse-retention-and-status-rules.md) for state semantics, rollout prerequisites and remaining gaps. Enforced guards do not complete every Planned/Partial actor goal. Current catalogue and evidence are in [uc.md](uc.md) and [dev audit fixes](../audits/dev-main-audit-fixes.md).

## Matching Feedback and Refresh Contract (3 October 2026)

| ID | Rule | UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-61 | Owner/Staff/Admin reads use the same total/page/pageSize/hasMore contract. Exclude LOST candidates owned by the source owner before totals/slicing, independently of the viewer's feedback/dismissal scope; serialization must not filter a sliced page again. Recalculate retains requesting actor and pagination; authorization and private-signal redaction still apply. | UC-026, UC-027, UC-028 | Application and real HTTP pageSize=1 owner/Staff/Admin regressions |
| BR-62 | A source owner rates a match once (USEFUL/IRRELEVANT/INCORRECT). Exact correlation-key replay returns the same record; conflicting reuse is 409. Dismissal is actor/source/match scoped and survives refresh. Neither action is proof of ownership. | UC-098, UC-099 | Application, repository, HTTP and browser regressions; manual/privacy release QA remains separate |
| BR-63 | Refresh jobs require active non-deleted posts. Each just-in-time claim receives a unique, expiring lease; heartbeat and result/complete/fail writes require the current unexpired token. Ineligible jobs become FAILED; transient failures back off 15 minutes and stop after 5 attempts. A later legitimate schedule starts a new attempt budget only after successful completion, not for exhausted jobs. | UC-100 | Real concurrent SQL tests, application worker and graceful shutdown tests |
| BR-64 | Historical matching 054 SQL/checksum stays unchanged. When 057 has actually run with the reviewed checksum and its entire feedback/dismissal/job schema verifies, the read-only plan reports 054 as superseded, never APPLIED. Missing/drifted schema, unknown checksums or incomplete attempts block DDL. Lease changes use new additive 060. | UC-098–UC-100 | Isolated upgrade/repeat-run tests; 060 applied on Aiven on 3 October, read-only preflight on 4 October has no pending migrations |

## Staff Verification After Intake

| ID | Rule | UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-65 | Physical intake is not ownership verification. Staff/Admin may explicitly verify a consented claimant only for the received custody item, linked through an eligible FOUND or the exact photo-backed LOST conversation under BR-53, after checking private identifying details in person and recording a 10-1000 character rationale. Legal hold, another reservation, competing active claims/appointments and unresolved disputes block verification. Append STAFF_CUSTODY_VERIFIED; preserve Finder identity, decisions and earlier audit. Finder cannot rewrite this Staff decision. Return still requires the linked verified recipient, identity/contact record and private proof. | UC-114, UC-055, UC-146 | Custody verification API/UI and regressions; full escalation reject/more-info workflow remains outside this scope |
| BR-66 | EXPIRED means retention elapsed, not physical disposition. An undisposed EXPIRED item can still be returned through the canonical Staff return workflow with unchanged recipient, competing-case, reservation, legal-hold and private-proof checks. Generic PATCH cannot return it; DISPOSED, DONATED and TRANSFERRED remain terminal. | UC-055, UC-148, UC-151 | Domain/API/UI agreement; negative gates and isolated SQL return regression |
| BR-67 | Optional SMTP delivery renews a live lease during processing. Only explicit NOT_SENT failures may retry within the attempt budget. Expired PROCESSING leases, unknown SMTP outcomes and failed post-send acknowledgements are CANCELLED with a redacted uncertainty code, never automatically reclaimed/retried. Stable Message-ID is correlation only; in-app remains canonical and conservative quarantine may lose an optional email. | UC-168, UC-147 | Heartbeat, slow two-worker SQL regression, timeout classification and stale-lease fences; no exactly-once/provider-dedup claim |
| BR-68 | Physical receipt requires 1-5 new Staff-uploaded private condition photos, received quantity and accessory observations. Source-post and Finder contact photos cannot satisfy receipt evidence. A draft is actor/request-scoped, expires after 72 hours and creates no item; identical confirmation replays one RECEIVED item. Source information is retained separately from warehouse observations. AI suggestions require explicit review and never decide custody/ownership. SOURCE_POST, CONTACT_PHOTO, INTAKE and RETURN metadata retain uploader and timestamps; only Staff/Admin may use the warehouse media gateway, and contact photos require a valid pending/received custody linkage. Photos document condition, not immunity from responsibility. | UC-051, UC-052, UC-056, UC-146 | API/UI/test scope; shared additive 061 applied 4 October 2026; CONTACT_PHOTO reuse is a local follow-up without new DDL. Durable media/application deployment and manual acceptance remain open |
| BR-69 | A non-owner contacting an active LOST post must first submit a private photo. Server similarity must be at least 50% with analysis confidence at least 60%; a 30-minute check is bound to actor, post revision and one conversation. Approval opens the room and posts the checked image, without sending the typed draft. Only the Finder sees three safe suggestions from the uploaded photo analysis, with no generic fallback on room reads. A click sends ordinary text and collapses the suggestions to a reopenable row; failed sends expand for retry. They do not count as answered ownership questions. The receiving LOST owner retains the safety reminder. The Finder may explicitly propose a communication-only meetup without minimum answers, or request custody under BR-53; a meetup audit with communicationOnly=true cannot authorize warehouse release. Ordinary FOUND verification still needs its required answers. No photo proves live possession/ownership; physical intake, human custody verification, dispute/hold/proof safeguards remain separate. | UC-034, UC-040, UC-042, UC-044, UC-106, UC-107, UC-120 | Shared additive 062 applied 4 October 2026; 6 October local follow-up needs no DDL. Real-photo/provider and application/manual acceptance remain open. See lost-contact-photo-rules.md |

## Actor Journey Audit Safeguards

| ID | Rule | UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-70 | Owned post deletion locks the source and checks custody requests, retained physical items, active claims/appointments, unresolved disputes and legal hold in the same transaction. Conflicting intake/deletion cannot both succeed. Eligible completed publication may be removed without erasing operational history. Previously deleted sources require authorized review, not automatic restoration. | UC-022, UC-051, UC-055, UC-146 | post-custody-deletion.integration.test.ts; real SQL and deterministic concurrent intake |
| BR-71 | Claim/verification/template GETs authorize before returning data and never change status, consent, rooms or audit. Pending legacy claims require an explicit authorized Finder decision; requester retries cannot accept consent. New direct LOST participants use ownership roles; legacy roles are normalized consistently across chat, custody review, verified return and feedback without rewriting consent/history. Schema checks accept only complete canonical or recognized legacy participant pairs. | UC-034, UC-035, UC-040, UC-042, UC-055, UC-114 | claim-readonly.test.ts, legacy-claim-read.integration.test.ts, lost-custody-return.integration.test.ts; no ownership decision inferred from reads/intake/photo |

These safeguards extend existing actor goals, not new UC IDs. Local verification and deployment limits: [full-system audit](../audits/full-system-audit-2026-10-04.md).

## Appointment, Handover and Journey Follow-Up - 6 October 2026

| ID | Rule | UC | Evidence / Limit |
| --- | --- | --- | --- |
| BR-72 | Only the actual Finder and owner can acknowledge physical checking after accepted meeting time. Both positive responses, with current consent/account/post and no competing claim/dispute/custody blocker, atomically complete the appointment and related posts. A mismatch stays pending; correcting a response requires a fresh explicit physical check. Both negative responses may cancel with a reason while preserving history, never fabricating receipt. A single positive/mismatched response cannot be silently cancelled or marked no-show. Completed outcomes cannot be rewritten through Finder decisions. | UC-133, UC-136–UC-139 | appointment.use-cases.ts/repository.ts, appointment integration/unit tests and claim correction guard; no substitution of Staff or photo score for physical review |
| BR-73 | Queue one reminder per accepted attempt/participant at configured lead time (default 30 minutes); transactional outbox/preferences and final access/status/time checks apply. After 15-minute grace, a participant may report the counterpart absent only before any handover response. This ends the attempt, not the item/claim, and is a one-sided observation without automatic penalty. | UC-125, UC-134, UC-135 | Main coalesced scheduler and existing email worker; slow/provider-unknown delivery remains conservative best effort, not guaranteed timely SMTP |
| BR-74 | Journey is read-only and scoped to owned posts or actual related participants; warehouse source history requires a valid accepted FOUND linkage or exact custody chain. Rejected candidates do not grant warehouse access. Return/feedback summaries use authorized outcomes, not page contents; missing/ambiguous legacy evidence stays unknown. Private messages, answers, recipient details, proof/media references and unrelated cases are excluded. ADMIN-only global audit/export exposes allowlisted metadata and records export; it does not invent absent audit writers. | UC-163, UC-166, UC-167 | activity.use-cases.ts/repository.ts, activity tests, paired/no-FOUND SQL ACL regressions and browser views; historical-source/security/manual review remains separate |

New rules describe requested appointment/journey goals, not a blanket upgrade of general escalation, realtime, notification channels or disposition. Rollout gates: [appointment-journey-rollout.md](../runbooks/appointment-journey-rollout.md).
