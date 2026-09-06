# Luật nghiệp vụ LNFS

Cập nhật: **06/09/2026**

## 1. Quy ước

- **Enforced:** đang được backend/UI hoặc migration hiện tại cưỡng chế.
- **Partial:** một phần được cưỡng chế, phần còn lại chưa có runtime.
- **Planned:** luật thuộc product scope nhưng chưa có runtime evidence.
- **TBD:** cần FPT University, mentor hoặc team xác nhận.
- AI/OCR và matching chỉ là decision support. Human verification là bắt buộc trước khi trả đồ.

## 2. Authentication, role và post

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-01 | Đăng ký phải qua OTP email còn hạn; email FPT/edu không bắt buộc. | UC-031, UC-032 | Enforced |
| BR-02 | Tài khoản mới nhận role nền USER và audience STUDENT hoặc LECTURER; client không tự cấp STAFF/ADMIN. | UC-002, UC-032 | Enforced |
| BR-03 | Password dùng bcrypt; OTP, refresh token và reset token không lưu plaintext; token có expiry/use-once phù hợp. | UC-031–UC-036 | Enforced |
| BR-04 | Login chỉ thành công với account ACTIVE và session version hợp lệ. | UC-001, UC-033, UC-034 | Enforced |
| BR-05 | Refresh token được rotate trong transaction; logout revoke session hiện tại. | UC-034, UC-035 | Enforced |
| BR-06 | Protected endpoint phải xác thực JWT; Admin API chỉ chấp nhận ADMIN, Staff API chỉ chấp nhận STAFF/ADMIN theo route. | UC-001, UC-002, UC-062 | Enforced |
| BR-07 | Post chỉ có LOST hoặc FOUND; chỉ owner được update/delete/upload/delete media của bài. | UC-040–UC-043, UC-048, UC-050 | Enforced |
| BR-08 | Post cần title, description, category cụ thể, contact, incident time không ở tương lai và location hợp lệ. | UC-040, UC-041 | Enforced |
| BR-09 | Building phải thuộc area đã chọn; LOST không dùng handover point; FOUND phải có nơi lưu/area/custom location/handover hợp lệ. | UC-040, UC-041, UC-055 | Enforced |
| BR-10 | PRIVATE_DETAILS chỉ dành cho FOUND; public response phải che contact, location chi tiết và tín hiệu nhận dạng nhạy cảm. | UC-041, UC-044, UC-054 | Enforced current post/search/match/private-media scope; guided private answers chưa có |
| BR-11 | Public board không trả post soft-deleted/hidden và chỉ trả status hợp lệ. | UC-043, UC-046, UC-047 | Enforced |
| BR-12 | Category có hai cấp; post phải chọn danh mục cụ thể, không chọn nhóm chính. | UC-040, UC-041, UC-064 | Enforced |
| BR-13 | Không hard-delete category/area/building còn reference; nếu còn dữ liệu phải chuyển inactive. | UC-064, UC-065 | Enforced |
| BR-14 | Upload chỉ nhận JPEG/PNG/WEBP hợp lệ, theo giới hạn size/count; MIME phải khớp file signature. | UC-048, UC-050 | Enforced |
| BR-15 | Media không trả storage URI nội bộ; client truy cập qua protected endpoint/proxy sau authorization. | UC-048, UC-050, UC-054 | Enforced cho post media |
| BR-16 | Gemini chỉ chạy khi user chủ động gửi ảnh; tối đa 5 ảnh và tổng dung lượng theo validator hiện tại. | UC-086, UC-088 | Enforced |
| BR-17 | Gemini chỉ tạo draft; user phải review/chỉnh sửa và tự xác nhận trước khi lưu post. | UC-086, UC-088 | Enforced ở Web flow |
| BR-18 | OCR/visible text không được dùng để công khai serial đầy đủ, IMEI, QR/barcode, email, phone hoặc giấy tờ. | UC-086, UC-091 | Partial; cần provider regression test sâu hơn |

## 3. Matching và điểm bàn giao

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-19 | Create/update post gọi matching best-effort; matching failure không rollback một post hợp lệ. | UC-068 | Enforced |
| BR-20 | Matching chỉ so sánh bài đối nghịch LOST/FOUND đang hoạt động, có candidate limit và time window. | UC-068, UC-070 | Enforced |
| BR-21 | Score dùng text, category, location, time, image và safe OCR; weight/threshold đọc từ config/default. | UC-069, UC-070, UC-091 | Enforced |
| BR-22 | Candidate dưới ngưỡng yếu bị bỏ; tier cao hơn chỉ là gợi ý, không auto-verify ownership, claim hoặc return. | UC-070–UC-072 | Enforced |
| BR-23 | Khác category mạnh hoặc lệch thời gian lớn phải có penalty/cap, trừ khi tín hiệu mạnh phù hợp. | UC-070, UC-076 | Enforced |
| BR-24 | Match lưu score thành phần, tier, matcher version và explanation; xem/re-run phải qua authorization/rate limit. | UC-071, UC-072, UC-075, UC-076 | Enforced |
| BR-25 | Match của PRIVATE_DETAILS không lộ raw tokens/OCR/location cho actor không có quyền. | UC-054, UC-076 | Enforced trong serializer |
| BR-26 | Public API chỉ trả handover point active. Admin không hard-delete point có appointment PENDING/ACCEPTED/RESCHEDULED hoặc reference vận hành; phải inactive. | UC-008–UC-010, UC-055–UC-057 | Enforced |
| BR-27 | Migration đã chạy không được sửa; checksum mismatch phải dừng migration. | N/A | Enforced |
| BR-28 | Node.js là write owner duy nhất; Java không ghi business state khi chưa có ownership và integration evidence. | N/A | Enforced theo kiến trúc |
| BR-44 | Moderation phải suy ra target từ report hoặc quan hệ backend hợp lệ; không nhận target ID tùy ý từ client. BAN_USER không được tự khóa admin hoặc khóa Admin active cuối cùng. | UC-066 | Enforced |
| BR-45 | Avatar được lưu bằng Cloudinary authenticated storage; database chỉ lưu metadata ổn định, không dùng local absolute path làm nguồn chính. | UC-038 | Enforced |
| BR-46 | Dashboard tách metrics theo khoảng thời gian khỏi current snapshot; UI và export phải giữ nhãn scope tương ứng. | UC-067, UC-084 | Enforced |

## 4. Staff, custody và warehouse

| ID | Luật | UC | Status |
| --- | --- | --- | --- |
| BR-29 | Shared DB không được tham chiếu file chỉ tồn tại trên một máy; shared object storage là yêu cầu trước multi-instance staging. | UC-048, UC-050 | Planned |
| BR-30 | Metadata media còn nhưng file mất phải trả 404 có kiểm soát, không để unhandled 500. | UC-048 | Enforced cho local post media |
| BR-31 | Admin catalog write cần audit actor, action, before/after và timestamp. | UC-064, UC-065 | Planned |
| BR-32 | Staff page chỉ công bố hoàn thành khi có operational flow và backend role evidence. | UC-062 | Enforced cho warehouse operations hiện tại |
| BR-33 | Claim chỉ áp dụng FOUND; Owner không claim bài của mình và một user không tạo duplicate claim. | UC-052, UC-053 | Enforced current claim API; full multi-claimant policy còn cần xác nhận |
| BR-34 | Claim state transition phải transaction/lock; một FOUND không có hai accepted claims. | UC-003–UC-007 | Partial: claim row/active-pair lock có; constraint một FOUND duy nhất và appointment chưa có |
| BR-35 | Evidence chỉ hiển thị cho claimant, post owner và reviewer có quyền; private answer không trả trước cho claimant. | UC-049, UC-054, UC-087–UC-092 | Partial: participant-scoped private evidence/proxy có; guided private answer/reviewer flow chưa có |
| BR-36 | Evidence confidence chỉ hỗ trợ review; không phải xác minh 100% và không thay thế human verification. | UC-089, UC-090, UC-092 | Planned |
| BR-37 | Appointment chỉ tạo sau accepted verification; một claim chỉ có một active appointment. | UC-021–UC-024 | Planned |
| BR-37A | Feedback sau trả đồ chỉ mở khi return COMPLETED có dual confirmation hoặc custody outcome được ủy quyền; mỗi participant gửi một lần và không tự cộng reputation cho chính mình. | UC-025, UC-039 | Enforced cho feedback runtime; phụ thuộc LNFS-54 để tạo completed return thật |
| BR-38 | Disposition kho bị chặn nếu còn claim, appointment, dispute hoặc legal hold pending; overdue không tự động thanh lý. | UC-016–UC-020 | Planned |
| BR-39 | Warehouse receive/store/return chỉ Staff/Admin; mỗi transition phải ghi actor, action, from/to, note và timestamp. | UC-011–UC-015, UC-059–UC-061 | Enforced |
| BR-40 | FOUND mặc định do Finder giữ; Staff custody là escalation/optional branch và chỉ bắt đầu sau intake confirmation. | UC-016–UC-020 | Planned |
| BR-41 | Native Mobile và PWA phải dùng chung authorization, privacy, validation và state rule với Web; offline không được báo transaction thành công trước server. | UC-093–UC-100 | Partial/Planned |
| BR-42 | Retention/disposition policy theo loại vật phẩm cần đơn vị vận hành xác nhận; không tự coi thời hạn kỹ thuật là policy chính thức. | UC-016–UC-020 | TBD |
| BR-43 | Staff chỉ xem routine conversation khi có escalation, lý do truy cập, quyền phù hợp, dữ liệu tối thiểu và audit. | UC-077–UC-083 | Planned |

## 5. Luồng peer-to-peer mục tiêu

FOUND item đi theo luồng:

~~~text
REPORTED → HELD_BY_FINDER → CHATTING → RESERVED → MEETUP_SCHEDULED
→ HANDOVER_PENDING_CONFIRMATION → RETURNED → CLOSED
~~~

Verification conversation:

~~~text
REQUESTED → CONVERSATION_OPEN → MORE_INFO_REQUIRED
→ MEETUP_ACCEPTED / DECLINED / ESCALATED
→ SCHEDULED → COMPLETED / NO_SHOW / CANCELLED
~~~

Quy tắc bắt buộc:

1. Finder giữ vật phẩm trong luồng thường.
2. Finder hỏi và đánh giá từng Owner; không dùng first-claim-wins.
3. Appointment chỉ confirmed khi hai bên cùng đồng ý.
4. Direct handover cần Finder xác nhận đã giao và Owner xác nhận đã nhận.
5. Chỉ dual confirmation hợp lệ mới chuyển RETURNED.
6. Dispute/no-show không tự kết luận gian lận; có thể escalate.
7. Nếu chuyển Staff, phải có TRANSFER_REQUESTED và intake confirmation trước IN_CUSTODY.

## 6. Sensitive item và privacy

Thẻ sinh viên, giấy tờ, thẻ ngân hàng, CCCD/hộ chiếu, điện thoại/laptop, chìa khóa, tiền, thuốc và vật nguy hiểm cần policy riêng. Chỗ chưa được trường xác nhận phải ghi TBD. Không công khai bí mật dùng để xác minh, không yêu cầu password/OTP, và không đưa raw private storage URL cho actor không có quyền.

## 7. Nguyên tắc status

Một rule chỉ được chuyển từ Planned/Partial sang Enforced khi có runtime implementation, validation/authorization, test hoặc evidence tái lập được và traceability đã cập nhật.
