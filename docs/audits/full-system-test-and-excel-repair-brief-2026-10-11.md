# Báo cáo kiểm thử toàn hệ thống và brief sửa Excel

- Ngày kiểm thử: 2026-10-11
- Workspace: repository root (local workspace path omitted).
- Branch: deploy
- HEAD: 7ff7569 (feat(workflows): refine chat appointments and protected journey photos)
- Môi trường DB: Aiven dev; người dùng đã xác nhận rõ, không phải production.

## Kết luận

DOCX có **189 test case chi tiết duy nhất trên 65 UC**: Round 1 có 63, Round 2 có 65, Round 3 có 61. Bảng 15 dòng lịch sử trong DOCX là phần tổng hợp kết quả, không phải 15 testcase bổ sung.

Trong lần kiểm thử bổ sung, cả **189/189 test ID đã được phân loại**: **88 Passed, 58 Failed, 23 Partial, 20 Blocked, 0 Not Run**. Có **169 case đã được chạy/đánh giá trực tiếp**; 20 case vẫn Blocked do thiếu fixture an toàn, quyền test phù hợp hoặc phụ thuộc worker/provider chưa thể cô lập. “Đã phân loại đủ” không có nghĩa là toàn bộ 189 case đã thực thi end-to-end hoặc hệ thống đạt nghiệm thu.

Trong DOCX lịch sử có 174 case chưa ghi (Round 1: 48, Round 2: 65, Round 3: 61) và 2 case N/A. Kết quả mới cho đủ 189 case được lưu riêng, không ghi đè snapshot lịch sử. Có 13 case được chạy lại dù DOCX đã có lịch sử: 11 case lịch sử Passed (10 vẫn Pass, TC-UC-165-03 thành Partial) và 2 case lịch sử N/A (TC-UC-069-01, TC-UC-070-01 nay Pass). TC-UC-101-01 và TC-UC-104-01 vẫn giữ lịch sử Passed trong DOCX nhưng lần kiểm tra hiện tại phát hiện workflow chưa được triển khai; xem riêng cả hai kết quả theo ngày.

## Nguồn và cách đọc kết quả

- DOCX nguồn: bản Test Report Summary do người dùng cung cấp; đường dẫn và tên file cá nhân đã được ẩn.
- Workbook ứng viên, chưa được mở/chỉnh trong lượt này: LNFS_Report5_Test_Report_MAIN_CODE_AUDIT.xlsx; đường dẫn máy cá nhân đã được ẩn.
- DOCX lịch sử ghi Round 1: 13 Passed, 0 Failed, 2 N/A, 48 chưa ghi; Round 2: 65 chưa ghi; Round 3: 61 chưa ghi. Tổng lịch sử là 13 Passed, 0 Failed, 2 N/A và 174 chưa ghi.
- Ô trống trong nguồn vẫn là chưa ghi, không phải Failed. “Blocked” trong báo cáo này nghĩa là chưa có fixture/điều kiện an toàn để kết luận, không phải N/A.
- Các API live gọi createApp() một lần, không chạy tiến trình server/worker cục bộ. Đã tạo dữ liệu UAT có kiểm soát trên Aiven dev và dọn theo trạng thái bên dưới. Một ảnh synthetic đã được upload authenticated lên Cloudinary và xác minh lại qua protected proxy trong UC-146; chưa xác minh SMTP thật hoặc Gemini. Không áp dụng migration và không chạm production.

## Kết quả live theo testcase

### Passed — 88

- TC-UC-009-01..03, TC-UC-012-01..03, TC-UC-112-02.
- TC-UC-098-02, TC-UC-099-02, TC-UC-106-01, TC-UC-106-03, TC-UC-109-01..03, TC-UC-115-03.
- TC-UC-114-02, TC-UC-117-02, TC-UC-118-02, TC-UC-125-02..03, TC-UC-129-02, TC-UC-132-02, TC-UC-144-02, TC-UC-145-02, TC-UC-146-02, TC-UC-149-02, TC-UC-151-02, TC-UC-152-02, TC-UC-153-02, TC-UC-155-02, TC-UC-158-02, TC-UC-159-02, TC-UC-160-02, TC-UC-161-02, TC-UC-162-02.
- TC-UC-069-01..03, TC-UC-070-01..03, TC-UC-071-01..02.
- TC-UC-072-01..02, TC-UC-073-01..02, TC-UC-074-01..02.
- TC-UC-075-01..03, TC-UC-076-01..03, TC-UC-077-01..02.
- TC-UC-093-01..03, TC-UC-094-01..03, TC-UC-095-01..03, TC-UC-096-01..03.
- TC-UC-143-02..03, TC-UC-148-02, TC-UC-165-01..02, TC-UC-168-02.
- Newly exercised: TC-UC-107-01, TC-UC-107-03, TC-UC-141-01..03, TC-UC-144-01, TC-UC-144-03, TC-UC-145-01, TC-UC-146-01, TC-UC-146-03, TC-UC-152-01, TC-UC-152-03, TC-UC-154-02.

Evidence highlights:

- UC-009 chạy trên tài khoản UAT tạm: cập nhật hồ sơ thành công, unauthenticated PATCH trả 401, tài khoản khác không bị thay đổi; giá trị hồ sơ đã được khôi phục.
- UC-012: hai tài khoản nhận ownerId khớp tài khoản đang đăng nhập; không có token trả 401.
- UC-069..077: CRUD hợp lệ, từ chối role không đủ, hierarchy không hợp lệ và building trỏ tới area không tồn tại được kiểm tra. Case xóa khi có quan hệ được ghi riêng ở phần Failed.
- UC-093..096: 12 case báo cáo đã chạy; submit/list/detail/withdraw đúng scope, unauth bị từ chối, người khác không đọc được report, report đã review không withdraw được. Hai report UAT được giữ trong audit history.
- UC-143: filter đã trả đúng trạng thái cho các hàng có dữ liệu hiện có (REJECTED, CANCELLED, INTAKED); chi tiết giới hạn fixture ở dưới.
- UC-165: Admin đọc report detail có reporter/entity/status/resolution và 2 dòng audit; unauth trả 401, user thường trả 403.
- UC-168: unauthenticated GET/PUT preference trả 401; PUT cùng cấu hình hiện tại lưu/đọc lại không đổi. Case scope đầy đủ không Passed, xem Failed.
- UC-106/109/115: Finder lấy được template câu hỏi không kèm đáp án riêng; claimant thấy prompt nhưng payload không có expected/private answer. Finder đọc evidence từng claim; hai claim cùng FOUND có 0 và 2 evidence, ID không giao nhau. UC-115-03 vì vậy Passed cho fixture hiện có, không chứng minh mọi claim/evidence trong hệ thống.
- UC-098/099: tài khoản khác bị từ chối `403` khi thử thao tác trên matching; không thay đổi trạng thái. Đây là bằng chứng quyền truy cập cho TC-02, không làm cho thao tác chính chủ vốn đang lỗi thành công.
- Các case role-gate UC-114/117/118/144/145/146/149/151/152/153/155/158: user thường đã đăng nhập bị `403` ở route Staff trước khi controller xử lý; request body rỗng không làm thay đổi dữ liệu.
- UC-112: Admin đăng nhập gọi queue nhận `404` vì endpoint chưa tồn tại; user thường đăng nhập nhận `403` từ role gate nên TC-UC-112-02 Pass, không có dữ liệu queue bị lộ. Filter theo state/age/handler cũng chưa có endpoint.
- UC-150: truy vấn read-only hiện có 5 item `RECEIVED`, 16 `RETURNED`; fixture synthetic mới đang `RECEIVED`, chưa quá hạn. Không item active nào quá hạn hay đến hạn trong 30 ngày; 1 item quá hạn là `RETURNED`, và chưa có notification `CUSTODY_OVERDUE`. Source maintenance chỉ tạo thông báo cho custody request đã quá hạn, không có nhắc trước hạn; chi tiết từng case ở Failed/Blocked.
- UC-101..105: catalogue ghi Planned; tìm trong API/Web không có endpoint, giao diện hay pipeline training để thu thập ví dụ, gán nhãn, ẩn danh, huấn luyện hoặc version model. Các testcase tương ứng được phân loại Failed/Blocked theo bằng chứng và điều kiện thực thi trong các bảng bên dưới.
- UC-107: Finder lấy câu hỏi xác minh và gửi câu hỏi mẫu thành công; claimant nhìn thấy prompt liên quan, không nhận expected/private answer.
- UC-141/144/145: trên ba post tổng hợp, kiểm tra request custody của chủ bài, từ chối request của người không sở hữu, hàng đợi Staff/Admin, trạng thái trước intake, hủy trước intake và Staff từ chối có lý do. Accept custody không tự tạo warehouse item; không thực hiện intake vật lý.
- UC-146: tạo một post FOUND riêng tư có tiêu đề `UAT-SYNTHETIC-CUSTODY-20261011-0a462894 blue backpack fixture`, request và accept custody, upload một ảnh PNG synthetic 519 byte lên Cloudinary, rồi intake. Kết quả: custody `INTAKED`, warehouse item `RECEIVED`, đúng một item và một intake image, ảnh tải lại qua protected proxy; source/delivery SHA-256 đều `dd1185d66bf193a554b15a58703a17362bb114fe7e4f9fc4fa3aa4f26f22c108`. User thường đọc ảnh bị 403, xóa ảnh đã gắn bị 409, replay cùng payload trả lại cùng item. Bài nguồn được đóng để không hiện trên bảng tin.
- UC-152: Admin bật rồi gỡ legal hold trên item synthetic; giá trị DB lần lượt được xác nhận true/false, có hai storage-log entries, item cuối vẫn `RECEIVED` và không bị hold.
- UC-154-02: request tới warehouse-approval detail với USER bị chặn 403 ở role gate. Đây chỉ xác nhận phân quyền endpoint, không xác nhận detail flow của Admin.
- TC-UC-129-02 và 132-02: request không có token tới appointment action bị `401`.
- TC-UC-125-02: Admin ngoài participant POST action `CANCEL` với version cố ý sai nhận `403` trước khi mutation; version sai là lớp bảo vệ phụ nếu authorization sai.
- TC-UC-125-03: ba notification appointment mỗi tài khoản liên kết tới lịch của participant; DTO không có trường message/evidence/private answer.
- UC-159..162 role test: user thường bị `403` trên Admin route group. Admin probe các campaign create/update/items/close endpoint nhận `404`; do route chưa đăng ký nên các chức năng chính bên dưới Failed.

### Failed — 58

| Test ID | Kết quả quan sát | Expected trong DOCX / vấn đề |
|---|---|---|
| TC-UC-071-03 | DELETE category có child trả 409; category cha vẫn active. | DOCX yêu cầu không hard-delete và chuyển inactive. Runtime từ chối nhưng không deactivate. |
| TC-UC-074-03 | DELETE area đang có building trả 409; area vẫn active. | DOCX yêu cầu giữ bản ghi và chuyển inactive. |
| TC-UC-077-03 | DELETE building được handover point tham chiếu trả 409; building vẫn active. | DOCX yêu cầu giữ bản ghi và chuyển inactive. |
| TC-UC-098-01 | Chủ bài POST dismiss với `matchId` đang hiển thị trong danh sách matching nhận 404; gợi ý vẫn còn sau khi đọc lại. | Thao tác chính chủ không tìm thấy matching tương ứng dù API đang trả suggestion; không hoàn tất dismiss. |
| TC-UC-099-01 | Chủ bài POST feedback `USEFUL` cho `matchId` đang hiển thị nhận 404; feedback vẫn rỗng khi đọc lại. | Không thể gửi feedback cho gợi ý hiện tại; lỗi tái hiện trên UAT post. |
| TC-UC-106-02 | Tài khoản ngoài participant gọi template endpoint nhận 404, không có protected payload. | DOCX yêu cầu 401/403. Quyền vẫn bị chặn nhưng status không đúng expected chính xác. |
| TC-UC-107-02 | Claimant đã đăng nhập gọi Finder-only verification template nhận 404, không có protected payload. | DOCX yêu cầu 401/403; quyền bị chặn nhưng HTTP status khác expected. |
| TC-UC-110-01 | Có 4 claim Finder với câu trả lời; cả 19 verification responses đều không có score/confidence. | Không tính support score như UC-110. |
| TC-UC-110-02 | Verification response không có score để trả về; status claim được đọc riêng, không có bằng chứng score quyết định trạng thái. | UC-110 không cung cấp score hỗ trợ; không suy luận việc ACCEPTED trong dữ liệu cũ là do score. |
| TC-UC-111-01 | Finder gửi action `ESCALATE_TO_STAFF` hợp lệ về mặt ý định nhưng API validator trả 422; enum chỉ có quyết định meetup, more-info, decline và custody. | Không có workflow general Staff support escalation. Request bị từ chối trước DB. |
| TC-UC-119-02 | Admin đã đăng nhập, không phải participant, GET messages của claim nhận 404 và không có nội dung. | DOCX yêu cầu 401/403; quyền được chặn nhưng status khác expected. |
| TC-UC-113-01 | Với claim đã escalated, Admin gọi detail/verification/messages/evidence đều nhận 404. | Expected cho phép xem context, evidence summary, messages và audit của case escalated. UC-113 hiện Partial và luồng xem tổng quát chưa có. |
| TC-UC-113-02 | User UAT ngoài participant bị từ chối với 404, không có protected payload. | DOCX yêu cầu 401/403. Quyền truy cập bị chặn an toàn nhưng HTTP status không khớp expected. |
| TC-UC-115-01 | Finder có 40 claim riêng; gửi `foundPostId` của một FOUND có đúng 2 claim vẫn trả đủ 40. | `listClaimsQuerySchema` chỉ nhận page/pageSize; filter theo bài FOUND bị bỏ qua, chưa có danh sách claimant theo vật phẩm. |
| TC-UC-116-01 | Không tìm thấy route/API hay giao diện so sánh tiến độ verification giữa nhiều claimant. | Cross-claim comparison được catalogue xác nhận còn thiếu; chỉ có trang/room riêng từng claim. |
| TC-UC-129-01 | Appointment action `COUNTER_PROPOSE` bị validator trả 422. | Không thể tạo đề xuất giờ/địa điểm mới theo UC-129. |
| TC-UC-129-03 | `COUNTER_PROPOSE` bị từ chối 422 trước DB; không có counter-proposal để xác minh trạng thái chưa xác nhận. | Expected transition chưa được hỗ trợ. |
| TC-UC-132-01 | Appointment action `RESCHEDULE` bị validator trả 422. | Không thể đề xuất lịch thay thế theo UC-132. |
| TC-UC-132-03 | `RESCHEDULE` bị từ chối 422 trước DB; không có lịch mới hoặc history event. | Expected replacement chưa được hỗ trợ. |
| TC-UC-154-01 | Admin GET disposition approval detail nhận 404; API không có route detail và Web không có màn order review. | Không xem được order detail như expected. |
| TC-UC-154-03 | Không có order-detail response/UI để kiểm tra item, reason, approval, evidence và history. | Các trường expected không thể xem. |
| TC-UC-156-01 | Admin POST reject disposition order nhận 404. | UC-156 chưa có thao tác từ chối order. |
| TC-UC-156-03 | Không có reject flow để ghi reason hay xác minh custody giữ nguyên. | Expected workflow chưa tồn tại. |
| TC-UC-157-01 | Admin POST cancel disposition order nhận 404. | UC-157 chưa có thao tác hủy order. |
| TC-UC-157-03 | Không có cancel flow để phân biệt order đã xử lý/chưa xử lý hoặc ghi audit. | Expected workflow chưa tồn tại. |
| TC-UC-159-01 | Admin POST tạo donation campaign nhận 404. | Không có campaign creation route/UI. |
| TC-UC-159-03 | Request campaign thiếu trường bắt buộc nhận 404 thay vì validation response; không có create flow. | Incomplete-input behavior chưa được triển khai. |
| TC-UC-160-01 | Admin PATCH campaign nhận 404. | Không có campaign update route/UI. |
| TC-UC-160-03 | Không có update/history response để kiểm tra giá trị mới và lịch sử cũ. | Expected workflow chưa tồn tại. |
| TC-UC-161-01 | Admin POST campaign item assignment nhận 404. | Không có route thêm/bỏ item campaign. |
| TC-UC-161-03 | Không có item-assignment flow để kiểm tra item chưa/đã xử lý. | Expected workflow chưa tồn tại. |
| TC-UC-162-01 | Admin POST close campaign nhận 404. | Không có campaign completion route/UI. |
| TC-UC-162-03 | Không có close flow để kiểm tra approvals/evidence trước khi hoàn tất. | Expected workflow chưa tồn tại. |
| TC-UC-168-01 | API lưu chatMode/claimMode (các mode email IMMEDIATE, DELAYED_UNREAD, DIGEST, DISABLED), quiet-hours và timezone. | Expected còn yêu cầu preference riêng cho in-app/PWA push và bảo đảm mandatory security delivery; các control đó chưa có trong model/API. Scope runtime chưa đáp ứng đầy đủ. |
| TC-UC-112-01 | Admin đăng nhập gọi `GET /api/staff/escalated-claims?status=OPEN` nhận 404. | Không có queue/list escalated claims cho Staff/Admin. |
| TC-UC-112-03 | Không có endpoint để gửi filter state/age/assigned handler; request của Admin tới path queue nhận 404. | Chưa thể lọc hoặc loại claim ngoài filter vì tính năng UC-112 chưa được triển khai. |
| TC-UC-150-01 | Code maintenance chỉ chọn custody request đã quá `retention_deadline`; không có stage nhắc trước deadline và không bao phủ walk-in item độc lập. | Expected yêu cầu nhắc cả trước và sau deadline; chưa đáp ứng nhắc trước hạn. |
| TC-UC-101-03 | Không có API, UI hay job thu thập training example; không tồn tại luồng lọc reviewed/unreviewed để kiểm tra. | UC-101 đang Planned; không thể loại outcome chưa review khỏi tập training vì tập/pipeline chưa có. |
| TC-UC-102-01 | Không có route hoặc UI gán nhãn candidate pair positive/negative/uncertain. | UC-102 đang Planned; thao tác chính không được triển khai. |
| TC-UC-102-03 | Không có thao tác lưu label cho candidate pair hay schema label để gửi giá trị ngoài tập hỗ trợ. | UC-102 đang Planned; validation của label chưa tồn tại. |
| TC-UC-103-01 | Không có job/event hay pipeline anonymization cho training examples. | UC-103 đang Planned; không thể chạy quy trình ẩn danh trước training. |
| TC-UC-103-02 | Không có endpoint/service tạo training example hoặc loại bỏ/mask trường nhạy cảm trong bộ dữ liệu training. | UC-103 đang Planned; không thể xác minh dữ liệu được ẩn danh. |
| TC-UC-104-03 | Không có dataset/version/training-job API để gửi dataset thiếu approval hoặc version. | UC-104 đang Planned; guard không cho chạy training từ dataset chưa duyệt chưa được triển khai. |
| TC-UC-105-01 | Không có màn/API đánh giá metrics hoặc lưu version model. | UC-105 đang Planned; không thể đánh giá, ghi kết quả hay kích hoạt model đã duyệt. |
| TC-UC-105-03 | Không có candidate model/version và activation workflow để kiểm tra trạng thái unapproved. | UC-105 đang Planned; chưa có guard cấm activate model chưa duyệt. |
| TC-UC-101-01 | Không có luồng UI/API thu thập training example để chạy lại case tạo example. | DOCX có historical Pass ngày 2026-09-25; trạng thái hiện tại được đánh giá riêng, không ghi đè lịch sử. |
| TC-UC-101-02 | Không có thao tác quản lý/đọc training examples được triển khai. | UC-101 hiện Planned; chức năng chính không tồn tại. |
| TC-UC-102-02 | Không có endpoint/UI gán nhãn candidate pair. | UC-102 hiện Planned; không thể thực thi case phân quyền trên hành động này. |
| TC-UC-104-01 | Không có dataset approval/training-job workflow để tạo job theo case. | DOCX có historical Pass ngày 2026-09-25; lần đánh giá hiện tại thấy feature chưa được triển khai. |
| TC-UC-104-02 | Không có training job để thực thi case quyền truy cập/role. | Historical snapshot vẫn giữ nguyên; kết quả hiện tại phản ánh source/runtime hiện thời. |
| TC-UC-105-02 | Không có model evaluation/version workflow để kiểm tra role/action. | UC-105 hiện Planned. |
| TC-UC-114-01 | Admin GET `/api/staff/escalated-claims?status=OPEN` nhận 404. | Chưa có queue/list escalated claims. |
| TC-UC-114-03 | Admin POST quyết định trên escalated claim giả lập nhận 404. | Route/workflow quyết định escalated case chưa tồn tại. |
| TC-UC-117-01, TC-UC-117-03 | Không có Finder reservation/release-after-no-show workflow; chỉ có thao tác giữ chỗ kho của Staff/Admin. | UC-117 chưa hỗ trợ các hành động và history theo testcase. |
| TC-UC-118-01, TC-UC-118-03 | Không có thao tác reservation timeout/no-show/release dành cho Finder. | UC-118 workflow trong catalogue không khả dụng ở runtime. |
| TC-UC-151-01 | Không có preview/eligibility view hoặc API cho yêu cầu disposition. | Hành động xem xét trước khi tạo order chưa được triển khai. |

Ba finding xóa category/area/building là chênh lệch giữa expected của workbook và policy hiện tại “xóa hoặc từ chối khi có reference”; cần chủ dự án xác nhận policy trước khi sửa code hoặc Excel. Không tự coi đó là quyết định nghiệp vụ đã được phê duyệt.

### Partial — 23

| Test ID | Bằng chứng và phần chưa đủ |
|---|---|
| TC-UC-115-02 | API không có thao tác claimant-list theo FOUND để gửi request ngoài scope; `foundPostId` bị bỏ qua và `/api/claims` trả danh sách riêng của actor. Không thấy dữ liệu của bài đích, nhưng chưa kiểm tra đúng authorization contract 401/403 của resource chưa tồn tại. |
| TC-UC-119-01 | UI tải room lại theo chu kỳ 10 giây; không chạy hai browser session để chứng minh độ trễ, nhưng code không phải event-driven immediate delivery. |
| TC-UC-119-03 | Notification `CHAT_MESSAGE_RECEIVED` chỉ có metadata, không có field nội dung riêng tư; không đọc message room của participant vì GET sẽ đánh dấu đã đọc/hủy email chờ, nên chưa kiểm tra đầy đủ delivery và redaction hai chiều. |
| TC-UC-108-01 | Claimant GET verification cho claim có câu trả lời nhận payload chỉ gồm prompt/answer/status, không có expected answer. Chưa gửi câu trả lời mới trong test này. |
| TC-UC-108-03 | Câu trả lời đã tồn tại mà không lộ expected answer; chưa thực thi thao tác submit để xác minh toàn bộ luồng. |
| TC-UC-123-01 | Đã thấy notification CLAIM cho một phần claim fixture, nhưng không tạo chuỗi create/update/accept/decline/withdraw/escalate có kiểm soát. |
| TC-UC-123-02 | Không token trả 401; notification list có scope theo actor qua đối chiếu `entityId` với claim của từng user. Chưa thử target-specific resource bằng authenticated outsider vì collection chỉ trả inbox của actor. |
| TC-UC-123-03 | Các notification hiện có liên kết claim của user; không mô phỏng transaction rollback/commit để chứng minh chỉ committed event mới tạo notification. |
| TC-UC-143-01 | Queue có 1 REJECTED, 1 CANCELLED, 17 INTAKED; không có PENDING/ACCEPTED. Chưa chứng minh đủ toàn bộ vòng đời như expected. |
| TC-UC-165-03 | Role gate Admin/non-Admin và response shape được kiểm tra; report fixture không có evidence nên không xác nhận nội dung evidence được phép/không được phép. |
| TC-UC-111-03 | Request reason rỗng bị validator trả 422; action custody-only có lý do hợp lệ cũng không chứng minh general support escalation vì enum không có action đó. |
| TC-UC-125-01 | Có notification APPOINTMENT_UPDATED trỏ tới lịch của participant; không kiểm tra có kiểm soát proposals, confirmations, changes, reminders, handover results hoặc email delivery. |
| TC-UC-147-01 | Inbox có CUSTODY_REQUEST_CREATED/CUSTODY_UPDATED nhưng chưa kiểm tra chuỗi accept/intake/move/release trong cùng request. |
| TC-UC-147-02 | Endpoint inbox không token trả 401; chưa có request-specific custody notification resource để thử authenticated outsider theo đúng kịch bản. |
| TC-UC-147-03 | Notification DTO hiện không có field evidence/message riêng tư; chưa chạy controlled custody transitions để kiểm chứng event-only delivery và toàn bộ payload. |
| TC-UC-149-01 | Đã đọc danh sách 21 warehouse items (5 RECEIVED, 16 RETURNED); detail fields có deadline/received time và lịch sử log của các item active. Không có item active quá hạn để xác minh một overdue detail hoàn chỉnh theo expected. |
| TC-UC-149-03 | Không có item active quá hạn và legal-hold/conflict fixture tương ứng; đã xác nhận UI/API kho có metadata deadline/log nhưng chưa kiểm chứng tổ hợp conflict, appointment, hold và eligibility trên một item quá hạn. |
| TC-UC-108-02 | Admin ngoài participant thử trả lời verification nhận 404 (không lộ dữ liệu); claimant thực sự gửi câu trả lời hợp lệ nhận 200. | Quyền bị chặn, nhưng expected yêu cầu 401/403; status khác contract trong workbook. |
| TC-UC-111-02 | USER gửi `ESCALATE_TO_STAFF` nhận 422 do action không nằm trong validator enum. | Request bị chặn trước mutation; chưa có endpoint/action hỗ trợ escalation để xác minh authorization như mô tả. |
| TC-UC-142-01 | Finder tạo custody request chọn được điểm bàn giao đang active và Staff/Admin xem/accept request. | Không chọn/thực thi được thời điểm intake trong workflow này; chỉ xác nhận một phần lựa chọn/tiếp nhận. |
| TC-UC-142-02 | USER không có quyền Staff gọi endpoint accept và nhận 403; Finder thường vẫn được phép tạo custody request. | Đây không tương đương việc từ chối một request custody hợp lệ của Finder; testcase/expected cần làm rõ actor và hành động. |
| TC-UC-145-03 | Staff từ chối với reason rỗng nhận 422 và request vẫn PENDING; từ chối có reason thành công. | Chưa kiểm tra quy tắc sau khi đã intake vì không tạo warehouse item. |
| TC-UC-158-03 | Admin execute approval với approval/proof ID không tồn tại nhận 409 và không tạo order. | Xác nhận nhánh không tạo order; chưa xác nhận positive path có proof hợp lệ. |

### Blocked — 20

| Test ID | Lý do chưa kết luận |
|---|---|
| TC-UC-098-03 | Thao tác dismiss chính chủ hiện trả 404; chưa thể xác minh gợi ý đã dismiss không xuất hiện lại sau refresh. |
| TC-UC-099-03 | Feedback chính chủ hiện trả 404; chưa thể xác minh tác động của feedback lên gợi ý/ownership behavior. |
| TC-UC-113-03 | Không có luồng Staff/Admin xem escalated-case detail để kiểm tra redaction trong context được phép. Admin detail hiện trả 404. |
| TC-UC-116-02 | Không có endpoint/view comparison để gửi request từ actor ngoài scope; Admin ngoài participant đọc detail/evidence của hai claim đều nhận 404 và không có dữ liệu, nhưng đó không phải authorization của comparison resource. |
| TC-UC-116-03 | Không có màn so sánh để quan sát tiến độ song song và redaction giữa hai claimant; không suy luận kết quả từ việc evidence từng claim được tách riêng. |
| TC-UC-148-01 | Có 21 warehouse items: 5 RECEIVED, 16 RETURNED; không item active nào đã quá deadline, bộ lọc EXPIRED trả 0. Fixture synthetic mới còn hạn; deadline cũ duy nhất thuộc item RETURNED, nên không tạo item overdue để kiểm tra mà không thay đổi lifecycle không thể hoàn tác qua API. |
| TC-UC-148-03 | Snapshot hiện không có item legalHold. Fixture synthetic đã được bật/gỡ hold để xác minh UC-152, nhưng vẫn là RECEIVED và chưa quá hạn; không thể dùng nó để kiểm tra loại trừ khỏi danh sách overdue/eligible. |
| TC-UC-168-03 | Cần xác minh delayed-email/read-before-send và security delivery qua outbox/worker. Không khởi động worker hoặc gửi SMTP trong lượt này. |
| TC-UC-150-02 | Không có custody item active quá hạn và chưa có thông báo `CUSTODY_OVERDUE`; chạy maintenance trên DB dùng chung còn có thể dọn proof/session hết hạn hoặc publish notification nên không kích hoạt chỉ để tạo trigger. Chưa xác minh được alert sau hạn và việc không đổi custody/disposition bằng runtime. |
| TC-UC-100-01, TC-UC-100-02 | Matching refresh là sweep toàn cục trên DB dùng chung; không chạy vì có thể tính lại/notify cho người dùng ngoài fixture. Chưa có worker scope theo post để cô lập. |
| TC-UC-142-03 | Không có handover point inactive trong Aiven dev; không chỉnh catalog production-like chỉ để dựng fixture. |
| TC-UC-151-03 | Fixture synthetic hiện có nhưng không đủ điều kiện retention và không có eligibility preview API (UC-151-01 đã Failed). Không tạo order chỉ để thử hold/conflict vì endpoint ghi order pending và hiện không có luồng hủy an toàn. |
| TC-UC-153-01, TC-UC-153-03 | Có fixture intake synthetic, nhưng deadline còn hạn. Request disposition vẫn tạo order pending; không tạo order vì thiếu luồng hủy và không muốn để lại yêu cầu xử lý giả trong hàng đợi. |
| TC-UC-155-01, TC-UC-155-03 | Fixture synthetic chưa đủ điều kiện disposition; chỉ có một tài khoản Admin nên không thể kiểm tra phê duyệt hai người. Không tạo order pending không thể hủy để dựng fixture. |
| TC-UC-156-02, TC-UC-157-02 | Không có tài khoản Staff không phải Admin để kiểm tra role boundary theo case. |
| TC-UC-158-01 | Positive execute cần retention đã hết hạn, order, phê duyệt bởi Admin khác và proof hợp lệ. Fixture synthetic còn hạn, chỉ có một Admin; không sửa deadline/lifecycle hoặc để lại order pending. Cloudinary upload đã được kiểm tra riêng trong UC-146, không thay thế positive disposition proof flow. |

### Bổ sung lần chạy UAT — 43 ID được phân loại

Các testcase sau đã được chạy/đánh giá sau vòng đầu. Các mục Blocked vẫn cần điều kiện/fixture an toàn nêu trên; không đổi chúng thành N/A hoặc coi như đã thực thi end-to-end.

- Passed (13): `TC-UC-107-01`, `TC-UC-107-03`, `TC-UC-141-01..03`, `TC-UC-144-01`, `TC-UC-144-03`, `TC-UC-145-01`, `TC-UC-146-01`, `TC-UC-146-03`, `TC-UC-152-01`, `TC-UC-152-03`, `TC-UC-154-02`.
- Failed (13): `TC-UC-101-01`, `TC-UC-101-02`, `TC-UC-102-02`, `TC-UC-104-01`, `TC-UC-104-02`, `TC-UC-105-02`, `TC-UC-114-01`, `TC-UC-114-03`, `TC-UC-117-01`, `TC-UC-117-03`, `TC-UC-118-01`, `TC-UC-118-03`, `TC-UC-151-01`.
- Partial (6): `TC-UC-108-02`, `TC-UC-111-02`, `TC-UC-142-01`, `TC-UC-142-02`, `TC-UC-145-03`, `TC-UC-158-03`.
- Blocked (11): `TC-UC-100-01`, `TC-UC-100-02`, `TC-UC-142-03`, `TC-UC-151-03`, `TC-UC-153-01`, `TC-UC-153-03`, `TC-UC-155-01`, `TC-UC-155-03`, `TC-UC-156-02`, `TC-UC-157-02`, `TC-UC-158-01`.

Không còn Test ID ở trạng thái Not Run trong ledger báo cáo. Tuy nhiên 20 case tổng cộng vẫn Blocked; SMTP thật, một số role/fixture chuyên biệt và các luồng đòi hỏi worker cô lập chưa được nghiệm thu. UC-146 intake/evidence và UC-152 legal hold được kiểm tra với dữ liệu synthetic đã được giữ ở Aiven dev; đây không phải bàn giao hay vật phẩm có thật. Nhóm training (UC-101..105), confidence (UC-110) và donation campaigns (UC-159..162) theo trạng thái catalogue hiện tại; không suy luận từ unit tests.

## Automated và deployment evidence

Các kết quả dưới đây đã chạy trên working tree tại HEAD nêu trên, có thay đổi local chưa commit; chúng không phải 189 testcase Excel và không phải CI của SHA đã push.

| Phạm vi | Kết quả gần nhất |
|---|---|
| npm test | Architecture: 205 production files, 0 violations; API: 424 passed, 0 failed, 37 skipped; Web lint/typecheck pass. |
| npm run build | API/Web production build pass. |
| npm run mobile:typecheck | Pass. |
| Playwright tại apps/web | 163 passed, 0 failed, 0 skipped. |
| npm audit --omit=dev root/API/Web | 0 vulnerabilities. |
| npm --prefix apps/mobile audit --omit=dev | 22 advisories: 15 High, 7 Moderate; chưa dùng --force. |
| Migration preflight | Read-only: 59 source migrations, 62 applied, 29 attempts, 0 pending; cảnh báo lịch sử 040/045/047/048/053/055. Không chạy migration. |
| UC catalogue | `node scripts/check-uc-catalogue.mjs`: 168 UC: 129 Implemented, 21 Partial, 18 Planned. `uc.md` còn các câu tổng kết cũ 97/17/54 và 129/20/19; cần đối soát tài liệu, không dùng các số prose đó làm kết quả checker. |
| SQL destructive integration | Không chạy trên Aiven; suite có guard yêu cầu LNFS_TEST_DB_* cho MySQL cô lập. Không bypass guard. |

Chưa xác minh SMTP thật, Gemini, PWA push, rollout migration, APK trên thiết bị, tải/failover, production hoặc full manual UAT. Một lượt Cloudinary intake có authenticated upload/protected read được kiểm tra; không đại diện cho toàn bộ media flows. Aiven dev được xác nhận là target test; điều đó không biến nó thành DB disposable và không cho phép chạy suite destructive vốn được thiết kế chỉ cho DB cô lập.

## Test data và working tree

- Category/area/building/handover-point fixtures trong lượt kiểm thử catalog đã được dọn; event/audit history được giữ nguyên.
- Test user UAT tạm được soft-delete. Profile được khôi phục. Truy vấn xác nhận các account có tiền tố uat-profile- và uat-outsider- không còn ACTIVE (3 DISABLED và 1 DISABLED).
- Hai report UAT từ lượt test report trước (WITHDRAWN, DISMISSED) được giữ vì là audit/history; post test đã soft-delete và user tổng hợp đã soft-delete.
- UC-115/116: chỉ đọc 40 claim của Finder, filter thử `foundPostId` không lọc (40 kết quả; hai claim thuộc cùng FOUND); Admin ngoài participant gọi detail/evidence đều 404 và không có payload; evidence giữa hai claim không trùng. Không gửi message hay cập nhật claim.
- UC-129/132: authenticated action `COUNTER_PROPOSE`/`RESCHEDULE` trả 422 do action enum không hỗ trợ; unauthenticated action trả 401. Validator chặn trước service/DB.
- UC-110: đọc verification summary cho 19 claim Finder; 4 có câu trả lời, không response nào có score/confidence field. Không ghi hay đổi claim.
- UC-108/111: claimant đọc verification của claim có answer mà không thấy expected answer; action general `ESCALATE_TO_STAFF` trả 422, action reason rỗng cũng trả 422 trước DB.
- UC-107/108: dùng post/claim synthetic; Finder template và gửi câu hỏi mẫu thành công, claimant đọc prompt và gửi answer, outsider Admin không đọc được payload; claim/post test đã withdraw/soft-delete qua service ứng dụng.
- UC-141/142/144/145: tạo ba FOUND post test, chạy owner/non-owner custody request, queue/context access, Staff role gate, accept không tạo kho, hủy trước intake và reject có/không reason. Trong nhóm lifecycle này, sáu post test đã hidden; ba claim CANCELLED, hai custody request CANCELLED, một REJECTED; không có warehouse item nào được tạo. Lịch sử audit giữ nguyên.
- UC-146/152: giữ lại fixture tổng hợp `UAT-SYNTHETIC-CUSTODY-20261011-0a462894 blue backpack fixture` (warehouse item `d81ad154-6d06-44b1-b849-f6f466533b22`), status `RECEIVED`, custody `INTAKED`, source post `CLOSED`, một ảnh intake Cloudinary 519 byte. Đây là test record, không phải vật phẩm hay bàn giao có thật; `physicalReviewConfirmed` chỉ được gửi để thực thi validator trong môi trường dev. Ảnh qua proxy trả PNG 519 byte với SHA-256 khớp nguồn; user thường bị 403, xóa ảnh đã attach bị 409, replay không tạo item trùng. Legal hold được bật/gỡ, có 2 log entries và hiện đã gỡ.
- UC-101..105/112/114/117/118/151/154/156/157/159..162: source/UI inventory xác nhận một số workflow chưa có; Admin route probes cho escalated-claim queue/decision, approval detail/reject/cancel và campaign create/update/items/close trả 404; các role gate đã kiểm tra trả đúng 403 hoặc được ghi Partial nếu status không khớp contract. Không có business mutation ngoài các fixture custody nêu trên.
- UC-149/150: chỉ đọc inventory, deadline và notification counts trên Aiven dev. Không có active overdue fixture; không chạy warehouse maintenance hay gửi email.
- UC-119/123/125/147: API inbox chỉ đọc metadata; so khớp notification với claim/appointment của user, không có field chứa message/evidence/private answer. Appointment detail/action và claim message authorization đã kiểm tra riêng; GET message participant không chạy vì có side effect mark-read.
- Không xác minh SMTP thật; user đã cho phép notification/email test nhưng không bật worker vì worker claim/reclaim trên outbox dùng chung, nên không thể cô lập một message mà không ảnh hưởng notification khác. Đã upload một ảnh synthetic qua Cloudinary authenticated trong UC-146 và giữ nguyên ảnh vì đang gắn vào item/history. Preference PUT lặp đúng giá trị hiện có nên không đổi cấu hình hiệu lực. Các request dùng createApp(), không bật worker cục bộ; không khẳng định worker dev độc lập bên ngoài đang chạy hay không.
- Không sửa workbook, không chạy migration, không commit/push/merge.
- Worktree vẫn có thay đổi có trước: apps/api-node/src/modules/auth/interfaces/http/auth.controller.ts, auth.routes.ts, auth.validator.ts, package.json, package-lock.json, apps/mobile/. Không chỉnh các mục đó.

## Prompt cho ChatGPT Work sửa workbook

    Hãy kiểm tra và sửa một BẢN SAO của workbook kiểm thử LNFS theo bằng chứng trong:
    docs/audits/full-system-test-and-excel-repair-brief-2026-10-11.md

    Nguồn lịch sử: bản Test Report Summary do người dùng cung cấp (đã ẩn đường dẫn/tên file cá nhân)
    Workbook ứng viên: LNFS_Report5_Test_Report_MAIN_CODE_AUDIT.xlsx (đã ẩn đường dẫn máy cá nhân)

    Đây là công việc kiểm tra/sửa workbook, không phải chỉ thị sửa source code. Mở workbook ứng viên ở chế độ không ghi trước; đối chiếu sheet, Test ID, UC, round, tester và công thức. Nếu workbook không khớp DOCX thì dừng và hỏi, không đoán. Không sửa file gốc; lưu bản mới với tên rõ ràng.

    Đếm đúng 189 testcase chi tiết trên 65 UC: Round 1=63, Round 2=65, Round 3=61. Bảng lịch sử 15 dòng trong DOCX là bản tóm tắt, không cộng thành testcase. DOCX snapshot ghi 13 Passed, 2 N/A, 174 chưa ghi; giữ nguyên snapshot lịch sử đó.

    Tạo một sheet execution log mới cho lần chạy Aiven dev ngày 2026-10-11, hoặc dùng cơ chế lịch sử tương đương mà không ghi đè kết quả cũ. Ghi trạng thái cho đủ 189 test ID theo danh sách và giải thích đúng như báo cáo. Tổng: 88 Passed, 58 Failed, 23 Partial, 20 Blocked, 0 Not Run; 169 đã kiểm tra/đánh giá, 20 Blocked.
    - Passed (88): TC-UC-009-01..03, 012-01..03, 069-01..03, 070-01..03, 071-01..02, 072-01..02, 073-01..02, 074-01..02, 075-01..03, 076-01..03, 077-01..02, 093-01..03, 094-01..03, 095-01..03, 096-01..03, 098-02, 099-02, 106-01, 106-03, 109-01..03, 112-02, 114-02, 115-03, 117-02, 118-02, 125-02..03, 129-02, 132-02, 143-02..03, 144-02, 145-02, 146-02, 148-02, 149-02, 151-02, 152-02, 153-02, 155-02, 158-02, 159-02, 160-02, 161-02, 162-02, 165-01..02, 168-02, 107-01, 107-03, 141-01..03, 144-01, 144-03, 145-01, 146-01, 146-03, 152-01, 152-03, 154-02.
    - Failed (58): TC-UC-071-03, 074-03, 077-03, 098-01, 099-01, 101-03, 102-01, 102-03, 103-01, 103-02, 104-03, 105-01, 105-03, 106-02, 107-02, 110-01, 110-02, 111-01, 112-01, 112-03, 113-01, 113-02, 115-01, 116-01, 119-02, 129-01, 129-03, 132-01, 132-03, 150-01, 154-01, 154-03, 156-01, 156-03, 157-01, 157-03, 159-01, 159-03, 160-01, 160-03, 161-01, 161-03, 162-01, 162-03, 168-01, 101-01, 101-02, 102-02, 104-01, 104-02, 105-02, 114-01, 114-03, 117-01, 117-03, 118-01, 118-03, 151-01. Chép expected/observed và caveat từ báo cáo, không rút gọn thành lời khẳng định chung.
    - Partial (23): TC-UC-108-01, 108-02, 108-03, 111-02..03, 115-02, 119-01, 119-03, 123-01..03, 125-01, 142-01..02, 143-01, 145-03, 147-01..03, 149-01, 149-03, 158-03, 165-03.
    - Blocked (20): TC-UC-098-03, 099-03, 100-01..02, 113-03, 116-02, 116-03, 142-03, 148-01, 148-03, 150-02, 151-03, 153-01, 153-03, 155-01, 155-03, 156-02, 157-02, 158-01, 168-03.

    Không chuyển Partial/Blocked thành N/A, Failed hoặc Not Run. Nếu workbook không hỗ trợ hai trạng thái này, không ghi đè status lịch sử; tạo execution log riêng có thể biểu diễn Partial/Blocked và ghi lý do. Ledger lần chạy mới không có Test ID Not Run; giữ riêng 23 Partial và 20 Blocked cùng lý do. Không suy luận Pass từ Implemented, automated tests, UC status, hoặc test setup không có fixture.

    Đối chiếu 13 ID lịch sử đã re-run: kết quả hiện tại không thay thế snapshot cũ. Cụ thể, TC-UC-069-01 và TC-UC-070-01 lịch sử là N/A nhưng lần chạy mới pass; TC-UC-165-03 lịch sử pass nhưng lần này chỉ Partial. Ghi hai kết quả vào log theo ngày và báo chênh lệch, không xóa ngày/kết quả cũ.

    Sửa công thức/tổng hợp chỉ khi xác minh được lỗi; tổng current execution log phải đếm 88 Passed, 58 Failed, 23 Partial, 20 Blocked và 0 Not Run. Giữ nguyên sheet, dữ liệu tester khác, formulas có chủ đích, validation, hidden sheets, named ranges, filters, freeze panes, formatting và lịch sử. Không tự đổi expected của ba case delete referenced category/area/building: policy cần chủ dự án xác nhận.

    Quét workbook và hidden sheets tìm secret/credential, dữ liệu cá nhân hoặc link ngoài; không in secret vào báo cáo. Không xóa fixture hợp lệ nếu chưa chứng minh là dữ liệu nhạy cảm/không cần thiết. Không commit, push, email, xóa file nguồn, sửa DB hoặc source code.

    Sau sửa, mở lại bản sao, kiểm tra công thức và tổng Round/tổng chung, test ID trùng/mất, #REF!/#VALUE!, layout Summary/Test Statistics/một sheet FE. Trả bản sao mới và báo vùng/cell sửa, số liệu trước/sau, các chênh lệch cần người dùng quyết định. Báo đúng rằng 189/189 đã được phân loại, trong đó 20 Blocked; không tuyên bố cả 189 đều đã thực thi end-to-end.
