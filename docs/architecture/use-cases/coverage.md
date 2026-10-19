# Đối chiếu 168 UC theo từng sơ đồ vai trò

Nguồn: [uc.md](../../requirements/uc.md). File này được tạo từ catalogue và cấu hình trong [generate.mjs](generate.mjs); không thay đổi trạng thái triển khai.

- **X:** actor tham gia trực tiếp, hoặc thông qua một UC include/extend. Các guard về ownership, participant, consent, escalation và dữ liệu tối thiểu vẫn áp dụng.
- **Auto:** hành vi bên trong hệ thống được trình bày để giải thích luồng của vai trò; không phải nút bấm hoặc quyền kích hoạt thủ công của actor.
- **-:** không đưa vào sơ đồ vai trò này. Không suy ra quyền của một account có thể mang thêm role khác.
- Hai sơ đồ Lost/Finder đều sử dụng nhãn actor **User**. Hai vai trò nghiệp vụ này không tạo thêm role DB.
- Các sơ đồ Staff/Admin tập trung quyền vận hành và tài khoản/public/notification chung. Khi đăng bài hoặc tham gia một case với tư cách người dùng, xem thêm sơ đồ User tương ứng.
- UC dùng chung được tính trong nhiều sơ đồ; hợp của năm sơ đồ là **168/168 UC**, không cộng các cột để suy ra tổng UC độc lập.

| Vai trò | Số UC duy nhất trong sơ đồ | Ảnh |
| --- | ---: | --- |
| Guest | 11 | [PNG](images/01-guest.png) / [SVG](images/01-guest.svg) |
| Lost | 80 | [PNG](images/02-user-lost.png) / [SVG](images/02-user-lost.svg) |
| Finder | 91 | [PNG](images/03-user-finder.png) / [SVG](images/03-user-finder.svg) |
| Staff | 49 | [PNG](images/04-staff.png) / [SVG](images/04-staff.svg) |
| Admin | 95 | [PNG](images/05-admin.png) / [SVG](images/05-admin.svg) |

| UC | Tên trong catalogue | Trạng thái | Guest | Lost | Finder | Staff | Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UC-001 | Request registration OTP | Implemented | X | - | - | - | - |
| UC-002 | Register an account | Implemented | X | - | - | - | - |
| UC-003 | Log in with email and password | Implemented | X | - | - | - | - |
| UC-004 | Refresh the login session | Implemented | - | X | X | X | X |
| UC-005 | Log out | Implemented | - | X | X | X | X |
| UC-006 | Request password reset | Implemented | X | - | - | - | - |
| UC-007 | Reset password | Implemented | X | - | - | - | - |
| UC-008 | View current account | Implemented | - | X | X | X | X |
| UC-009 | Update personal profile | Implemented | - | X | X | X | X |
| UC-010 | Update profile avatar | Implemented | - | X | X | X | X |
| UC-011 | View protected profile avatar | Implemented | - | X | X | X | X |
| UC-012 | View personal activity and reputation | Implemented | - | X | X | X | X |
| UC-013 | Browse the LOST/FOUND board | Implemented | X | X | X | X | X |
| UC-014 | Search and filter posts | Implemented | X | X | X | X | X |
| UC-015 | View post details | Implemented | X | X | X | X | X |
| UC-016 | View post form reference data | Implemented | - | X | X | - | - |
| UC-017 | Analyze item images with Gemini | Implemented | - | X | X | - | - |
| UC-018 | Create a LOST post | Implemented | - | X | - | - | - |
| UC-019 | Create a FOUND post | Implemented | - | - | X | - | - |
| UC-020 | View my posts | Implemented | - | X | X | - | - |
| UC-021 | Update my post | Implemented | - | X | X | - | - |
| UC-022 | Close or remove my post | Implemented | - | X | X | - | - |
| UC-023 | Upload post image | Implemented | - | X | X | - | - |
| UC-024 | View protected post media | Implemented | X | X | X | X | X |
| UC-025 | Delete post image | Implemented | - | X | X | - | - |
| UC-026 | View matching suggestions | Implemented | - | X | X | X | X |
| UC-027 | Recalculate matching suggestions | Implemented | - | X | X | X | X |
| UC-028 | View matching explanation | Implemented | - | X | X | X | X |
| UC-029 | Generate matches after post changes | Implemented | - | Auto | Auto | - | - |
| UC-030 | Calculate matching score | Implemented | - | Auto | Auto | - | - |
| UC-031 | Store active match results | Implemented | - | Auto | Auto | - | - |
| UC-032 | View my claim requests | Implemented | - | X | X | - | - |
| UC-033 | View claim request details | Implemented | - | X | X | - | - |
| UC-034 | Create a claim request | Implemented | - | X | X | - | - |
| UC-035 | Accept a claim request | Implemented | - | - | X | - | - |
| UC-036 | Request more claim information | Implemented | - | - | X | - | - |
| UC-037 | Decline a claim request | Implemented | - | - | X | - | - |
| UC-038 | Withdraw a claim request | Implemented | - | X | - | - | - |
| UC-039 | View private claim rooms | Implemented | - | X | X | - | - |
| UC-040 | Open a private claim room | Implemented | - | X | X | - | - |
| UC-041 | View direct messages | Implemented | - | X | X | - | - |
| UC-042 | Send a direct message | Implemented | - | X | X | - | - |
| UC-043 | View claim evidence | Implemented | - | X | X | - | - |
| UC-044 | Upload claim evidence | Implemented | - | X | X | - | - |
| UC-045 | View protected claim evidence | Implemented | - | X | X | - | - |
| UC-046 | View notifications | Implemented | - | X | X | X | X |
| UC-047 | Mark a notification as read | Implemented | - | X | X | X | X |
| UC-048 | Mark all notifications as read | Implemented | - | X | X | X | X |
| UC-049 | View active handover points | Implemented | X | X | X | X | X |
| UC-050 | View warehouse reference data | Implemented | - | - | - | X | X |
| UC-051 | Browse warehouse items | Implemented | - | - | - | X | X |
| UC-052 | Receive a warehouse item | Implemented | - | - | - | X | X |
| UC-053 | Update warehouse item details | Implemented | - | - | - | X | X |
| UC-054 | Move an item to stored state | Implemented | - | - | - | X | X |
| UC-055 | Confirm a warehouse return | Implemented | - | - | - | X | X |
| UC-056 | View warehouse storage logs | Implemented | - | - | - | X | X |
| UC-057 | Calculate item retention deadline | Implemented | - | - | - | Auto | Auto |
| UC-058 | Check return-feedback eligibility | Implemented | - | X | X | - | - |
| UC-059 | Submit return feedback | Implemented | - | X | X | - | - |
| UC-060 | Update reputation after feedback | Implemented | - | Auto | Auto | - | - |
| UC-061 | View administrative catalog | Implemented | - | - | - | - | X |
| UC-062 | List and search user accounts | Implemented | - | - | - | - | X |
| UC-063 | Create a user account | Implemented | - | - | - | - | X |
| UC-064 | View user account details | Implemented | - | - | - | - | X |
| UC-065 | Update user information | Implemented | - | - | - | - | X |
| UC-066 | Change user role | Implemented | - | - | - | - | X |
| UC-067 | Enable or disable user account | Implemented | - | - | - | - | X |
| UC-068 | Delete user account | Implemented | - | - | - | - | X |
| UC-069 | Create item category | Implemented | - | - | - | - | X |
| UC-070 | Update item category | Implemented | - | - | - | - | X |
| UC-071 | Delete item category | Implemented | - | - | - | - | X |
| UC-072 | Create campus area | Implemented | - | - | - | - | X |
| UC-073 | Update campus area | Implemented | - | - | - | - | X |
| UC-074 | Delete campus area | Implemented | - | - | - | - | X |
| UC-075 | Create campus building | Implemented | - | - | - | - | X |
| UC-076 | Update campus building | Implemented | - | - | - | - | X |
| UC-077 | Delete campus building | Implemented | - | - | - | - | X |
| UC-078 | Create handover point | Implemented | - | - | - | - | X |
| UC-079 | Update handover point | Implemented | - | - | - | - | X |
| UC-080 | Upload handover map image | Implemented | - | - | - | - | X |
| UC-081 | Delete handover point | Implemented | - | - | - | - | X |
| UC-082 | View user reports | Implemented | - | - | - | - | X |
| UC-083 | Review report and apply moderation | Implemented | - | - | - | - | X |
| UC-084 | View administration dashboard | Implemented | - | - | - | - | X |
| UC-085 | Export system statistics | Implemented | - | - | - | - | X |
| UC-086 | View public system configuration | Implemented | Auto | Auto | Auto | Auto | Auto |
| UC-087 | List system configurations | Implemented | - | - | - | - | X |
| UC-088 | Create system configuration | Implemented | - | - | - | - | X |
| UC-089 | View system configuration details | Implemented | - | - | - | - | X |
| UC-090 | View configuration history | Partial | - | - | - | - | X |
| UC-091 | Update system configuration | Implemented | - | - | - | - | X |
| UC-092 | Delete system configuration | Implemented | - | - | - | - | X |
| UC-093 | Submit a user report | Implemented | - | X | X | X | X |
| UC-094 | View my submitted reports | Implemented | - | X | X | X | X |
| UC-095 | View my report detail | Implemented | - | X | X | X | X |
| UC-096 | Withdraw a pending report | Implemented | - | X | X | X | X |
| UC-097 | Notify owner about a new match | Partial | - | X | X | - | - |
| UC-098 | Dismiss a match suggestion | Partial | - | X | X | - | - |
| UC-099 | Submit match feedback | Partial | - | X | X | - | - |
| UC-100 | Refresh matches periodically | Implemented | - | Auto | Auto | - | - |
| UC-101 | Collect eligible matching examples | Planned | - | - | - | - | X |
| UC-102 | Label matching outcomes | Planned | - | - | - | X | X |
| UC-103 | Anonymize matching training data | Planned | - | - | - | - | Auto |
| UC-104 | Train a custom matching model | Planned | - | - | - | - | X |
| UC-105 | Evaluate and version a matching model | Planned | - | - | - | - | X |
| UC-106 | View guided verification questions | Implemented | - | - | X | - | - |
| UC-107 | Ask a guided verification question | Implemented | - | - | X | - | - |
| UC-108 | Answer a guided verification question | Implemented | - | X | - | - | - |
| UC-109 | Review private claim evidence | Implemented | - | - | X | - | - |
| UC-110 | Calculate verification confidence | Planned | - | Auto | Auto | - | - |
| UC-111 | Escalate a claim for staff support | Partial | - | X | X | - | - |
| UC-112 | List escalated claims | Planned | - | - | - | X | X |
| UC-113 | View an escalated claim | Partial | - | - | - | X | X |
| UC-114 | Record an escalation decision | Partial | - | - | - | X | X |
| UC-115 | View claimants for a found item | Partial | - | - | X | - | - |
| UC-116 | Compare claimant verification results | Partial | - | - | X | - | - |
| UC-117 | Reserve an item for one claimant | Planned | - | - | X | - | - |
| UC-118 | Release reservation and reopen another claim | Planned | - | - | X | - | - |
| UC-119 | Receive new private messages immediately | Partial | - | X | X | - | - |
| UC-120 | Send an image in a private conversation | Implemented | - | X | X | - | - |
| UC-121 | View unread conversation count | Implemented | - | X | X | - | - |
| UC-122 | Mark a conversation as read | Implemented | - | X | X | - | - |
| UC-123 | Receive claim status notifications | Partial | - | X | X | - | - |
| UC-124 | Receive new-message notifications | Implemented | - | X | X | - | - |
| UC-125 | Receive appointment and handover notifications | Partial | - | X | X | - | - |
| UC-126 | List my appointments | Implemented | - | X | X | - | - |
| UC-127 | View appointment detail | Implemented | - | X | X | - | - |
| UC-128 | Propose a meetup appointment | Implemented | - | X | X | - | - |
| UC-129 | Counter-propose an appointment | Planned | - | X | X | - | - |
| UC-130 | Accept an appointment proposal | Implemented | - | X | X | - | - |
| UC-131 | Decline an appointment proposal | Implemented | - | X | X | - | - |
| UC-132 | Reschedule a confirmed appointment | Planned | - | X | X | - | - |
| UC-133 | Cancel an appointment | Implemented | - | X | X | - | - |
| UC-134 | Send appointment reminders | Implemented | - | Auto | Auto | - | - |
| UC-135 | Record an appointment no-show | Implemented | - | X | X | - | - |
| UC-136 | Confirm item handed over | Implemented | - | - | X | - | - |
| UC-137 | Confirm item received | Implemented | - | X | - | - | - |
| UC-138 | Hold conflicting handover confirmations | Implemented | - | Auto | Auto | - | - |
| UC-139 | Complete a direct return | Implemented | - | Auto | Auto | - | - |
| UC-140 | Report a handover issue | Implemented | - | X | X | - | - |
| UC-141 | Request transfer to staff custody | Implemented | - | - | X | - | - |
| UC-142 | Select staff intake point and time | Partial | - | - | X | X | X |
| UC-143 | List custody transfer requests | Implemented | - | - | - | X | X |
| UC-144 | Review a custody transfer request | Implemented | - | - | - | X | X |
| UC-145 | Reject or cancel a custody transfer request | Implemented | - | - | X | X | X |
| UC-146 | Confirm staff intake | Implemented | - | - | - | X | X |
| UC-147 | Receive custody status notifications | Partial | - | X | X | - | - |
| UC-148 | List overdue warehouse items | Partial | - | - | - | X | X |
| UC-149 | View overdue item detail | Partial | - | - | - | X | X |
| UC-150 | Send retention deadline alerts | Partial | - | - | - | Auto | Auto |
| UC-151 | Check disposition eligibility | Partial | - | - | - | X | X |
| UC-152 | Apply or remove a legal hold | Partial | - | - | - | - | X |
| UC-153 | Create a disposition order | Partial | - | - | - | - | X |
| UC-154 | View disposition order detail | Planned | - | - | - | X | X |
| UC-155 | Approve a disposition order | Partial | - | - | - | - | X |
| UC-156 | Reject a disposition order | Planned | - | - | - | - | X |
| UC-157 | Cancel a disposition order | Planned | - | - | - | - | X |
| UC-158 | Record disposition evidence | Partial | - | - | - | X | X |
| UC-159 | Create a donation campaign | Planned | - | - | - | - | X |
| UC-160 | Update a donation campaign | Planned | - | - | - | - | X |
| UC-161 | Assign or remove campaign items | Planned | - | - | - | X | X |
| UC-162 | Complete a donation campaign | Planned | - | - | - | - | X |
| UC-163 | View administrative audit logs | Implemented | - | - | - | - | X |
| UC-164 | View claim and verification history | Partial | - | X | X | X | X |
| UC-165 | View moderation report detail | Implemented | - | - | - | - | X |
| UC-166 | Export audit and moderation data | Implemented | - | - | - | - | X |
| UC-167 | View end-to-end item journey | Implemented | - | X | X | - | - |
| UC-168 | Manage notification delivery preferences | Partial | - | X | X | X | X |
