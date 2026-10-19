# Quy trình đồ thất lạc nhạy cảm và bảo vệ dữ liệu

**Cập nhật:** 16/10/2026

**Trạng thái:** Đề xuất nghiệp vụ để FPTU và nhóm dự án phê duyệt; chưa phải chính sách chính thức của trường và không khẳng định toàn bộ đã được triển khai.

## 1. Mục tiêu và phạm vi

Tài liệu này làm rõ trách nhiệm bảo quản và trả đồ, cách xử lý tài sản có dữ liệu cá nhân hoặc có thể gây thiệt hại nếu bị lộ, cùng các điểm cần quyết định trước khi hoàn thiện business rules. Áp dụng cho bài LOST/FOUND, chat và evidence, điểm tiếp nhận, kho, xác minh, bàn giao, thông báo, nhật ký và export.

Các trạng thái hiện có không thay thế quy trình vật lý: bài FOUND là thông tin đăng tìm chủ; claim là yêu cầu nhận lại; custody request là đề nghị chuyển đồ; warehouse item chỉ hình thành sau khi Staff thực sự nhận đồ. Xem [quy tắc kho hiện tại](warehouse-retention-and-status-rules.md) và [quy trình intake/evidence](warehouse-intake-evidence.md).

### Phân biệt trạng thái

| Nhãn | Ý nghĩa |
| --- | --- |
| **Hiện đã có trong tài liệu/codebase** | Hành vi hoặc guard đã được ghi nhận; vẫn cần kiểm tra đúng candidate/deployment trước khi coi là đã nghiệm thu. |
| **Đề xuất** | Business rule được đề xuất dưới đây; cần chủ nghiệp vụ phê duyệt và triển khai/test nếu chưa được hệ thống cưỡng chế. |
| **Cần FPTU quyết định** | Chính sách vận hành/pháp lý không nên do nhóm phát triển tự đặt. |

## 2. Ai đang giữ đồ và ai trả đồ?

**Quy tắc cốt lõi đề xuất:** trách nhiệm bảo quản đi theo lần bàn giao vật lý, không theo trạng thái nút bấm, bài đăng hay lời hứa trên chat.

| Chặng | Người chịu trách nhiệm vật lý | Điều kiện chuyển trách nhiệm |
| --- | --- | --- |
| Vừa nhặt được, chưa giao cho ai | Finder/người đang cầm giữ đồ | Finder giữ an toàn, không tự ý sử dụng, mở khóa, xem dữ liệu hay đăng ảnh nhạy cảm. |
| Đã tạo FOUND hoặc gửi yêu cầu custody nhưng Staff chưa nhận | Finder | Bài đăng, chấp thuận request, lịch hẹn hoặc thao tác “chuyển sang custody” tự nó **không** chuyển trách nhiệm bảo quản. |
| Đang ở kho | Staff/kho được FPTU chỉ định | Staff xác nhận nhận vật lý; ghi người giao/nhận, thời điểm, tình trạng, mã niêm phong nếu dùng và vị trí lưu. Chỉ lúc này trách nhiệm mới chuyển sang đơn vị tiếp nhận. |
| Trả trực tiếp ngoài kho | Finder giao; người nhận xác nhận đã nhận | Chỉ kết thúc khi hai bên xác nhận việc bàn giao thực tế hợp lệ; lịch hẹn hoặc ảnh tương đồng không đủ. |
| Trả từ kho | Staff giao cho người nhận đã được xác minh | Staff đối chiếu đúng hồ sơ, kiểm tra hold/tranh chấp, ghi bằng chứng tối thiểu và xác nhận nhận đồ. Người đăng LOST không tự lấy đồ khi chưa qua kiểm tra. |
| Đồ walk-in do người không dùng tài khoản đem đến | Staff tiếp nhận từ người giao walk-in | Ghi nhận người giao là nguồn bàn giao, không tự tạo user, claim hay tuyên bố người đó là chủ sở hữu. |

### Trả lời ngắn cho câu hỏi “ai trả đồ?”

- **Luồng trực tiếp:** Finder đang giữ đồ là người giao trả cho Claimant đã xác minh; hệ thống hỗ trợ liên lạc và ghi nhận hai bên xác nhận.
- **Luồng custody:** Finder giao vật lý cho Staff. Sau đó **Staff là người trả đồ từ kho**, không phải Finder. Claimant nhận tại điểm được chỉ định sau xác minh.
- **Không rõ ai đang giữ, nguồn gốc mâu thuẫn hoặc có tranh chấp:** chưa trả cho bất kỳ bên nào; giữ trạng thái chờ xử lý an toàn, mở review có audit và chuyển cấp có thẩm quyền.
- Staff nhận đồ không làm Staff thành Finder, không tự chấp nhận claim và không chứng minh người giao là chủ sở hữu.

## 3. Phân loại tài sản và mức xử lý

Phân loại theo **mức rủi ro cao nhất** trong đồ vật hoặc dữ liệu nhìn thấy bên trong. Một vật có thể thuộc nhiều nhóm.

| Mức | Ví dụ | Đăng công khai / ảnh / AI | Tiếp nhận và bàn giao đề xuất |
| --- | --- | --- | --- |
| **S0 - thông thường** | Áo khoác, bình nước, ô, đồ dùng không có dữ liệu riêng tư | Có thể đăng ảnh đã rà soát, không kèm dữ liệu cá nhân ngoài ý muốn. AI chỉ phân tích khi người dùng chủ động và ảnh phù hợp. | Quy trình FOUND, chat xác minh, trả trực tiếp hoặc custody như hiện hành. |
| **S1 - có dữ liệu cá nhân hoặc quyền truy cập** | CCCD/hộ chiếu/thẻ sinh viên có thông tin, giấy tờ xe, chìa khóa, thẻ ra vào, điện thoại/laptop/USB | Không đăng mặt có dữ liệu, số giấy tờ, QR/barcode, serial/IMEI, nội dung màn hình hoặc vị trí chính xác. Không gửi cho Gemini/OCR. Có thể đăng ảnh minh họa đã che hoàn toàn dấu hiệu nhận dạng nếu cần. | Bảo quản kín, giới hạn người xem; thiết bị không mở khóa/khám phá nội dung. Ưu tiên chuyển cho đầu mối FPTU được chỉ định nếu không có cách bảo quản an toàn. |
| **S2 - tài chính/xác thực** | Thẻ ngân hàng, ví có thẻ, token/thiết bị xác thực, giấy ghi PIN/mật khẩu/OTP | **Không chụp, upload, OCR, phân tích AI hoặc đăng công khai.** Không ghi số thẻ, CVV, PIN, OTP, mật khẩu hay dữ liệu giao dịch vào chat, log hoặc DB. | Không quẹt/thử giao dịch/đăng nhập. Báo ngay đầu mối an ninh/campus được FPTU chỉ định và hướng người có thể là chủ thẻ liên hệ ngân hàng phát hành để khóa thẻ khi cần. Nếu được phép giữ tạm: niêm phong kín, mã hóa nơi lưu, bàn giao có biên nhận và thời hạn ngắn do FPTU duyệt. |
| **S3 - nguy hiểm, bị cấm hoặc cần chuyên môn** | Vũ khí, vật sắc nhọn nguy hiểm, hóa chất, vật nghi chất cấm, pin hỏng/nóng, thuốc cần bảo quản y tế, vật phẩm có nguy cơ sinh học | Không đăng chi tiết/ảnh, không di chuyển hoặc kiểm tra thêm nếu có thể gây nguy hiểm. | Không tự xử lý như đồ thất lạc thường. Cô lập khu vực nếu an toàn và báo ngay Campus Security/cơ quan hoặc đơn vị chuyên trách. Thuốc được chuyển cho đơn vị y tế có thẩm quyền, không tự phát lại cho người nhận. |

**Không được công khai** số thẻ đầy đủ, CVV, PIN/OTP, mật khẩu, số giấy tờ định danh, địa chỉ/điện thoại cá nhân, IMEI/serial đầy đủ, QR/barcode, nội dung màn hình, dữ liệu sinh viên hoặc chi tiết giúp người khác giả nhận đồ.

## 4. Quy trình nghiệp vụ từ phát hiện đến đóng hồ sơ

### Bước 1 - Người nhặt được bảo đảm an toàn

1. Không sử dụng, chiếm giữ để đổi lợi ích, tự truy cập dữ liệu hoặc đăng thông tin nhận dạng nhạy cảm.
2. Với nguy hiểm hoặc thẻ ngân hàng/giấy tờ quan trọng, liên hệ đầu mối FPTU được công bố; không trì hoãn chỉ để tạo bài đăng.
3. Nếu có nguy cơ tức thời, không tự cầm nắm hoặc vận chuyển; báo Campus Security/cơ quan chuyên trách.

### Bước 2 - Ghi nhận FOUND tối thiểu

1. Chọn nhóm rủi ro trước khi thêm ảnh. Với S1/S2/S3, UI phải cảnh báo rõ và mặc định không cho upload ảnh gốc nhạy cảm.
2. Chỉ lưu mô tả tổng quát, khoảng thời gian/khu vực đủ rộng và tình trạng bên ngoài; không đưa dữ liệu bí mật vào title, description, contact, file name hoặc metadata.
3. Giữ một số đặc điểm riêng làm câu hỏi xác minh; không công khai tất cả dấu hiệu để kẻ mạo nhận có thể trả lời.
4. Gemini/OCR/matching là xử lý dữ liệu bên ngoài hoặc tự động: mặc định loại ảnh S1/S2/S3 khỏi phân tích. Chỉ mở ngoại lệ sau phê duyệt privacy/security và đánh giá nhà cung cấp, mục đích, thời hạn, quyền truy cập và việc lưu dữ liệu.

### Bước 3 - Chọn nhánh bàn giao

**Nhánh A: Finder giữ để trả trực tiếp**

- Finder tiếp tục chịu trách nhiệm vật lý đến lúc bàn giao.
- Chat chỉ hiển thị câu hỏi an toàn và không yêu cầu người nhận gửi PIN, OTP, mật khẩu, toàn bộ số thẻ hoặc ảnh giấy tờ qua chat.
- Ảnh matching chỉ hỗ trợ trao đổi, không chứng minh người nhắn đang cầm đồ hoặc có quyền sở hữu.
- Nếu hai bên không thể gặp, Finder chọn custody; không ép gặp riêng, nhận tiền, chuộc đồ hoặc chia sẻ địa chỉ nhà.

**Nhánh B: Finder chuyển vào custody**

- Finder tạo yêu cầu nhưng vẫn giữ đồ tới khi Staff nhận tận tay.
- Staff kiểm tra vật lý, phân loại rủi ro, tình trạng và gói/niêm phong nếu policy yêu cầu.
- Staff và Finder xác nhận mã hồ sơ, thời điểm, tình trạng, mã seal (nếu có); Staff không nhập thông tin thẻ/giấy tờ đầy đủ.
- Hệ thống chuyển sang IN CUSTODY/RECEIVED chỉ sau xác nhận intake vật lý. Staff/kho chịu trách nhiệm tiếp từ thời điểm này.
- Staff không tự quyết quyền sở hữu chỉ dựa trên intake, ảnh, độ tương đồng hoặc lời kể của Finder.

### Bước 4 - Xác minh người nhận

1. Claimant chứng minh bằng các đặc điểm riêng không công khai và quy trình xác minh danh tính được FPTU phê duyệt.
2. Người kiểm tra không yêu cầu bí mật xác thực ngân hàng. Với thẻ, không yêu cầu PIN/CVV/OTP; không yêu cầu claimant gửi ảnh hai mặt thẻ.
3. Chỉ kiểm tra giấy tờ trực tiếp khi quy trình được FPTU phê duyệt; không chụp/lưu bản sao giấy tờ mặc định. Hệ thống chỉ lưu kết quả “đã kiểm tra/không đạt”, loại chứng từ ở mức tổng quát nếu thật sự cần, actor, thời điểm và lý do.
4. Với S2, ưu tiên bàn giao theo hướng dẫn của ngân hàng phát hành hoặc đầu mối an ninh FPTU. Người nhận có thể được hướng dẫn khóa thẻ qua kênh chính thức; LNFS không thay ngân hàng xác nhận tình trạng tài khoản.
5. Nếu có nhiều claimant, thông tin không khớp, nghi giả mạo hoặc một bên báo bị ép buộc/đòi tiền, tạm dừng bàn giao và chuyển review. Không chọn người đến trước.

### Bước 5 - Bàn giao và đóng hồ sơ

- **Trực tiếp:** hai bên xác nhận đã giao/đã nhận sau khi sự kiện thực tế xảy ra. “Đã hẹn”, “đã đến” hoặc ảnh tương tự không được tính là hoàn tất.
- **Kho:** Staff đối chiếu claimant đã được xác minh, mã item, trạng thái, active claim/appointment, dispute và legal hold; sau đó Staff thực hiện bàn giao và ghi audit.
- Bằng chứng phải tối thiểu. Với S1/S2 không chụp nội dung giấy tờ/thẻ; ưu tiên ghi nhận người giao/nhận, thời gian, mã seal và xác nhận. Nếu cần ảnh, chỉ ảnh vật/bao niêm phong đã che dữ liệu, không mặc định chụp mặt người.
- Nếu xác nhận mâu thuẫn, item giữ nguyên trạng thái chưa hoàn tất; yêu cầu review của Staff/Admin. Không tự động RETURNED, xóa bài hoặc cấp feedback.

## 5. Business rules đề xuất

Các mã dưới đây là **PBR (Proposed Business Rule)** để thảo luận, không phải BR chính thức và chưa được thêm vào catalogue.

| Mã đề xuất | Quy tắc |
| --- | --- |
| PBR-01 | Custody vật lý thuộc người đang cầm giữ; chỉ chuyển khi bên nhận xác nhận đã tiếp nhận vật lý. Tạo post/request/appointment không chuyển custody. |
| PBR-02 | Finder là người giao trong nhánh trả trực tiếp hoặc giao cho Staff; khi Staff nhận vật lý, Staff/kho là người giao trong nhánh trả kho. Không gán trách nhiệm “trả đồ” cho actor chỉ vì họ tạo bài. |
| PBR-03 | Mỗi item có một nguồn custody và lịch sử handoff bất biến: actor giao/nhận, thời điểm, trạng thái, tình trạng, location tối thiểu và seal/reference nếu áp dụng. Không sửa lịch sử cũ để che một quyết định sai; correction phải append event. |
| PBR-04 | Mọi item được phân loại rủi ro trước khi public, upload ảnh, gọi OCR/AI, tiếp nhận kho hoặc trả đồ. Không xác định được thì áp dụng mức cao hơn cho tới khi Staff review. |
| PBR-05 | Dữ liệu công khai phải được giảm thiểu và che các dấu hiệu nhận dạng, thông tin liên hệ, số tài khoản/thẻ, giấy tờ, serial/IMEI, QR/barcode và vị trí quá chính xác. |
| PBR-06 | S2/S3 không được upload ảnh gốc, gửi Gemini/OCR, nhúng trong notification/email, hoặc xuất report. Chỉ ngoại lệ có phê duyệt cụ thể của privacy/security owner và được ghi audit. |
| PBR-07 | Cấm thu thập/lưu PIN, CVV, OTP, password, access token, toàn bộ số thẻ, bí mật đăng nhập hoặc nội dung giao dịch để nhận dạng/trao trả đồ. |
| PBR-08 | Ảnh, AI score, matching, post ownership, account/email và việc intake riêng lẻ không tự chứng minh live possession hoặc quyền sở hữu. Phải có human review theo nhánh trả tương ứng. |
| PBR-09 | Staff chỉ xem dữ liệu nhạy cảm khi cần xử lý item được giao; least privilege, lý do truy cập, audit và giới hạn export. Routine chat/evidence không được mở mặc định. |
| PBR-10 | Handoff S1/S2 cần xác minh người nhận theo quy trình được FPTU phê duyệt, kiểm tra dispute/hold và ghi outcome tối thiểu; không lưu bản sao giấy tờ tùy thân theo mặc định. |
| PBR-11 | Với thẻ ngân hàng, không thử giao dịch, không sử dụng chip/từ tính/contactless, không giữ PIN/CVV/OTP; ưu tiên chuyển ngân hàng/đầu mối FPTU theo SLA đã phê duyệt. |
| PBR-12 | Với điện thoại/laptop/USB, không mở khóa, đọc file, xem notification, đăng nhập hoặc reset; giữ tình trạng nguồn/niêm phong theo SOP do FPTU phê duyệt. |
| PBR-13 | Đồ nguy hiểm, nghi phạm pháp, thuốc hoặc vật cần chuyên môn đi theo quy trình chuyên trách, không đi qua hàng đợi kho thông thường. |
| PBR-14 | Tranh chấp, nhận dạng không đủ, hai xác nhận mâu thuẫn, nghi lừa đảo hoặc chain-of-custody thiếu thì chặn return/disposition; giữ an toàn và chuyển authorized reviewer. |
| PBR-15 | Thời hạn giữ, tiêu hủy, chuyển ngân hàng/cơ quan, thông báo sự cố và quyền truy cập phải theo policy được FPTU duyệt; cấu hình kỹ thuật không được tự coi là căn cứ pháp lý. |
| PBR-16 | Khi lộ dữ liệu hoặc thất lạc vật trong custody, cô lập quyền truy cập, giữ audit/evidence, báo đầu mối incident/privacy/security và xử lý thông báo theo quy định hiện hành. Không ghi bí mật lộ lọt vào incident log. |
| PBR-17 | Khi kết thúc mục đích, xóa/ẩn danh dữ liệu số và hủy/hoàn chuyển vật lý theo retention/disposition policy; ngoại lệ legal hold phải có chủ thể, lý do, ngày rà soát và audit. |

## 6. Dữ liệu được phép ghi nhận

### Tối thiểu nên giữ cho một custody event

- ID hồ sơ/item và loại rủi ro; không dùng bí mật của chính vật làm mã hồ sơ.
- Actor giao/nhận, role, thời gian UTC, địa điểm ở mức cần thiết.
- Tình trạng bên ngoài và số lượng/phụ kiện quan sát được; không khám phá dữ liệu bên trong.
- Trạng thái niêm phong/mã seal nếu policy yêu cầu; các event seal phải có history.
- Kết quả xác minh (đạt/không đạt/chờ), actor, thời gian và lý do ngắn; không lưu ảnh ID/giá trị bí mật nếu không có căn cứ được duyệt.
- Lý do truy cập đặc biệt, incident reference, legal hold reference và các lần chuyển cho đơn vị khác.

### Không đưa vào log, email, analytics hoặc export

CVV, PIN, OTP, mật khẩu, full PAN, nội dung tin nhắn riêng, ảnh giấy tờ chưa che, raw OCR/Gemini output, URL ký truy cập, token, khóa niêm phong có thể mở đồ, hoặc chi tiết cho phép mạo danh claimant. Log chỉ lưu ID/reference đã kiểm soát, mã lỗi an toàn và metadata tối thiểu.

## 7. Bảo vệ dữ liệu trong ứng dụng

1. **Thu thập tối thiểu:** chỉ lấy dữ liệu cần cho liên hệ, xác minh, custody và audit; nêu mục đích/thời hạn trước khi thu thập.
2. **Phân quyền:** tách USER, Staff, Admin và privacy/security reviewer; Staff chỉ được mở item được giao; truy cập break-glass cần lý do, giới hạn thời gian và audit.
3. **Media:** private storage/proxy có authorization, `no-store`, quyền truy cập theo record; không lưu raw public URLs hoặc base64 trong ghi chú. Thumbnail/public serializer phải dùng allowlist và redaction.
4. **AI/OCR:** mặc định không gửi ảnh nhạy cảm; thông báo rõ provider, mục đích, dữ liệu được gửi và điều kiện xử lý. Human review bắt buộc; không dùng AI để xác quyết quyền sở hữu.
5. **Email/in-app:** chỉ thông báo có sự kiện và deep link an toàn; không chèn ảnh, evidence, đáp án, thông tin định danh, vị trí chính xác hoặc thông tin thẻ.
6. **Audit/export:** ghi ai xem/tải/sửa/niêm phong/bàn giao và lý do; export mặc định loại secret và phải có quyền, scope, redaction, expiry và audit.
7. **Retention:** tách thời hạn media, hồ sơ claim, audit và dữ liệu account; job cleanup không được xóa evidence còn tranh chấp/hold hoặc đang đối soát.
8. **Incident:** có đầu mối nhận báo cáo, phân loại mức độ, giữ bằng chứng an toàn, thu hồi quyền/token, xác định phạm vi và thực hiện thông báo theo quy định/đơn vị chịu trách nhiệm.

## 8. Hiện trạng LNFS và khoảng trống

| Chủ đề | Baseline đã ghi nhận trong repository | Phần chưa thể coi là hoàn tất |
| --- | --- | --- |
| Public/private data | BR-10 che contact/location/private details; BR-18 hạn chế OCR lộ serial, IMEI, QR/barcode, email/phone/giấy tờ. | BR-18 vẫn ghi Partial; chưa chứng minh redaction đầy đủ cho mọi ảnh/provider/export. |
| Evidence và AI | BR-35/36: evidence theo quyền, ảnh/score không xác minh sở hữu; Gemini chỉ chạy khi user chủ động theo BR-16/17. | Phân loại sensitive item chưa thành gate xuyên suốt; cần cấm/kiểm soát S1/S2/S3 trước upload và trước provider. |
| Ai giữ/ai trả | BR-40: FOUND mặc định do Finder giữ; Staff custody là nhánh escalation. Warehouse policy: request/acceptance không chuyển custody; Staff physical intake mới chuyển. | Cần đưa trách nhiệm handoff, UI wording, biên nhận/niêm phong và offline/walk-in vào SOP được FPTU phê duyệt. |
| Staff review | BR-43 giới hạn xem chat; BR-65 tách physical intake khỏi ownership verification. | BR-43 còn Planned trong catalogue; cần xác nhận permission, audit và vận hành trên môi trường đích. |
| Return/dispute | BR-38/39/55/57 giữ gate return, actor log, private proof, active claim/dispute/legal hold. | Chưa có chính sách chính thức theo mức nhạy cảm, ngân hàng/campus transfer SLA, hay quyết định ai được nhận ngoại lệ. |
| Retention/disposition | BR-42 TBD; BR-56 ghi thời lượng hiện tại chỉ là project defaults, chưa được trường phê duyệt. | Không dùng 120/90/60/3 ngày làm quy định chính thức. Cần phê duyệt schedule theo loại item và legal hold. |

Các BR hiện hữu được tham chiếu để tránh mâu thuẫn: [business-rules.md](../requirements/business-rules.md), đặc biệt BR-10, BR-16–18, BR-35–43, BR-53, BR-55–57, BR-65, BR-70–74. Tài liệu này **không tự nâng trạng thái UC/BR**, không tạo migration và không chứng minh rollout.

## 9. Các quyết định cần FPTU phê duyệt

1. Đơn vị/địa điểm chính thức nhận thẻ ngân hàng, giấy tờ định danh, thẻ sinh viên, thiết bị và vật nguy hiểm; người phụ trách chính và dự phòng.
2. Danh sách category S1/S2/S3 cụ thể, trường hợp từ chối tiếp nhận và cách xử lý walk-in.
3. SLA chuyển thẻ ngân hàng cho ngân hàng phát hành/đầu mối campus; có được lưu giữ tạm tại LNFS hay phải chuyển ngay.
4. Quy trình đóng gói/niêm phong, khu lưu trữ, phân quyền chìa khóa, 2-person control và biên nhận custody.
5. Phương thức xác minh người nhận được chấp thuận; có được kiểm tra ID tại chỗ không, dữ liệu nào được ghi lại và cách xử lý người không có giấy tờ.
6. Thời hạn giữ theo loại đồ, nhắc quá hạn, chuyển đơn vị bên ngoài, tiêu hủy/hoàn trả, legal hold và bằng chứng cần giữ.
7. Ảnh nào được đăng, dùng Gemini/OCR hay không, provider nào được phép xử lý, vùng lưu trữ, retention và quy trình consent/notice.
8. Privacy/security incident owner, kênh báo cáo, escalation, thời hạn xử lý và người có thẩm quyền thông báo sự cố.
9. Staff/Admin nào được xem private evidence, audit và export; yêu cầu dual control/approval cho S2/S3.
10. Nghiệp vụ legal review áp dụng cho tiền mặt, giấy tờ của người ngoài trường, đồ nghi phạm pháp và tài sản chưa có người nhận.

Cho tới khi các mục trên được quyết định, xử lý theo phương án an toàn hơn: không đăng ảnh/dữ liệu nhạy cảm; không gửi provider; không tự xác minh hoặc tự tiêu hủy; chuyển Campus Security/đơn vị có thẩm quyền và ghi rõ phần còn chờ.

## 10. Căn cứ và giới hạn

Đây là định hướng nghiệp vụ/bảo mật, không phải ý kiến pháp lý. Trước rollout, FPTU cần nhờ bộ phận pháp chế/privacy/security đối chiếu văn bản hiện hành, quy chế nội bộ, vai trò kiểm soát dữ liệu và hợp đồng nhà cung cấp. Tại thời điểm cập nhật, [Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15](https://vanban.chinhphu.vn/?docid=214590&pageid=27160) và [Nghị định 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?docid=216387&pageid=27160&typegroupid=4) có hiệu lực từ 01/01/2026. [Thông tư 45/2025/TT-NHNN](https://vanban.chinhphu.vn/?docid=216016&pageid=27160&typegroupid=6) sửa đổi quy định về hoạt động thẻ ngân hàng, có hiệu lực 05/01/2026. Những văn bản này cần được chuyên viên xác định phạm vi áp dụng cụ thể với LNFS/FPTU; tài liệu này không tự diễn giải nghĩa vụ pháp lý chi tiết.

## 11. Tài liệu liên quan

- [Business rules](../requirements/business-rules.md)
- [Warehouse retention/status](warehouse-retention-and-status-rules.md)
- [Warehouse intake/evidence](warehouse-intake-evidence.md)
- [Lost-contact photo rules](lost-contact-photo-rules.md)
- [LNFS business process A–Z](../overview/LNFS_BUSINESS_PROCESS_A_TO_Z.md)
