# Ranh giới Node.js và Java

Cập nhật: 26/08/2026

## Quyết định hiện tại

Node.js là backend runtime, API owner và write owner duy nhất của codebase mới. Java/Spring Boot hiện là skeleton để giữ chỗ cho thành viên chuyên Java và chỉ cung cấp Spring Boot Actuator health endpoint.

Không trình bày kiến trúc hiện tại là production microservices. Java chưa có controller nghiệp vụ, chưa xác thực JWT, chưa kết nối schema nghiệp vụ và chưa được frontend/Node.js gọi.

## Bằng chứng trong code

| Thành phần | Trạng thái thực tế |
| --- | --- |
| Node app | Mount `/api/auth`, `/api/posts`, `/api/staff`, `/api/admin` trong `apps/api-node/src/app.ts` |
| Node migrations | Là nguồn thay đổi schema duy nhất trong `apps/api-node/src/migrations` |
| Java app | Chỉ có `JavaAdminServiceApplication` và Actuator health |
| Java business API | Chưa có |
| Node-to-Java integration | Chưa có |
| Shared JWT contract | Chưa được triển khai/kiểm thử ở Java |

## Ownership matrix

| Domain | Owner hiện tại | Java hiện tại | Hướng tương lai |
| --- | --- | --- | --- |
| Auth, OTP, session, profile | Node.js | Không tham gia | Java chỉ verify JWT nếu có endpoint riêng |
| LOST/FOUND posts và media | Node.js | Không tham gia | Giữ Node làm owner |
| Gemini draft và matching | Node.js | Không tham gia | Java có thể đọc kết quả, không ghi cạnh tranh |
| Category/area/building admin | Node.js | Không tham gia | Có thể chuyển trọn flow sang Java sau khi có contract |
| Claim/evidence | Chưa có runtime | Không có | Chọn đúng một owner trước khi triển khai |
| Appointment/handover | Chưa có runtime | Không có | Chọn đúng một owner trước khi triển khai |
| Warehouse receive/store/return, retention và storage log | Node.js | Không tham gia | Giữ Node làm owner cho current release; chỉ chuyển trọn domain sau contract/integration tests |
| Warehouse overdue disposition, donation/transfer policy | Chưa hoàn chỉnh runtime | Không có | Hoàn thiện dưới một write owner duy nhất |
| Realtime/notification | Chưa có runtime | Không có | Dự kiến Node.js/Socket.IO |

## Điều kiện để Java nhận một flow

Một domain chỉ được chuyển sang Java khi có đủ:

1. API contract/OpenAPI cho domain đó.
2. JWT/role compatibility test với token do Node phát hành.
3. Một writer duy nhất trong mỗi deployment.
4. Transaction/state-machine tests cho business invariant.
5. Node adapter hoặc frontend routing rõ ràng.
6. Health/readiness và cấu hình môi trường.
7. Rollback plan về Node hoặc tắt route Java.

Java không được ghi trực tiếp cùng bảng/trạng thái với Node cho cùng một flow nếu chưa có cơ chế ownership và integration test.

## Cách trình bày an toàn

> Node.js là core API của current system và là write owner cho các flow đang chạy, gồm warehouse operations hiện tại. Nhóm giữ một Spring Boot skeleton cho khả năng mở rộng sau này; Java chưa sở hữu flow nghiệp vụ và kiến trúc hiện tại không được trình bày là production microservices.

## Không nên tuyên bố

- Java đã xử lý claim/warehouse/appointment.
- Node và Java đã chia tải production.
- Hai service có thể cùng ghi shared MySQL an toàn.
- Java đã tương thích JWT nếu chưa có test.
- Hệ thống đã deploy theo microservice architecture.
