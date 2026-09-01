# Ranh giới Node.js và Java

Cập nhật: **01/09/2026**

## 1. Quyết định hiện tại

Node.js là core API, runtime owner, migration owner và write owner duy nhất của các flow đang có. Java/Spring Boot hiện là health-check skeleton cho khả năng mở rộng, không phải business microservice đã tích hợp.

Không trình bày hệ thống hiện tại là production microservices. Không để Node và Java cùng ghi một flow hoặc cùng điều khiển một trạng thái trên shared MySQL.

## 2. Bằng chứng repository

| Thành phần | Evidence | Status |
| --- | --- | --- |
| Node application | apps/api-node/src/app.ts mount auth, posts, staff, handover-points và admin routes | Runtime/API owner |
| Node migrations | apps/api-node/src/migrations/001_auth.sql đến 038_seed_default_handover_point.sql | Schema owner |
| Node business modules | controllers, services, repositories, validators và tests | Current implementation |
| Java application | apps/java-admin-service/src/main/java/.../JavaAdminServiceApplication.java | Health skeleton |
| Java business API | Không tìm thấy controller/service/repository nghiệp vụ | Not implemented |
| Node-to-Java integration | Không tìm thấy adapter/call/contract test | Not implemented |
| Native mobile | Không tìm thấy Android/iOS/Expo/React Native/Flutter project | Planned |

## 3. Ownership matrix

| Domain | Current owner | Current status | Rule |
| --- | --- | --- | --- |
| Auth, OTP, session, profile | Node.js | Implemented | Java không tạo login flow riêng |
| LOST/FOUND posts và media | Node.js | Implemented; local media limitation | Java không ghi post/media state |
| Category, area, building, handover point | Node.js | Implemented theo module | Java không ghi catalog nếu chưa có contract |
| Gemini draft và hybrid matching | Node.js | Implemented theo decision-support scope | Không gọi custom-trained AI |
| Claim/evidence/chat/appointment | Chưa có owner runtime | Planned | Chọn một owner trước khi triển khai |
| Warehouse receive/store/return | Node.js | Partial/implemented operational scope | Giữ Node owner trong current release |
| Warehouse disposition | Chưa có runtime đầy đủ | Planned/TBD | Policy và owner cần chốt |
| Notification/realtime | Chưa có runtime | Planned | Dự kiến Node nếu được triển khai |
| PWA | Cùng Web client | Partial/planned | Dùng shared API và rule |
| Native Mobile | Client planned | Planned | Chỉ là client gọi shared Node API |

## 4. One-writer rule

Một business flow chỉ có một write owner trong mỗi deployment:

1. Owner sở hữu route, validation, state transition và transaction.
2. Service khác chỉ đọc qua API hoặc event contract được version hóa.
3. Không dùng việc cùng truy cập MySQL để coi là integration.
4. Mọi thay đổi ownership cần API contract, JWT compatibility test, transaction/concurrency test, integration test, health/readiness và rollback plan.
5. Nếu chưa đủ evidence, ghi Planned hoặc TBD.

## 5. Điều kiện để Java nhận một domain

Java chỉ được nhận trọn một domain khi có:

- API contract/OpenAPI được duyệt;
- JWT/role compatibility với token Node;
- một writer duy nhất và migration ownership rõ;
- state machine, transaction và race-condition tests;
- Node adapter hoặc frontend routing rõ;
- readiness, metrics/logging, cấu hình secret;
- rollout và rollback plan;
- tài liệu traceability cập nhật.

Không chuyển một nửa claim, appointment hoặc warehouse sang Java. Tránh để hai service cùng sửa claims, return_appointments, warehouse_items hoặc posts.

## 6. Cách trình bày với mentor/judge

> Node.js là core API và write owner của current Web/PWA baseline. Java hiện là Spring Boot health skeleton để mở rộng, chưa có business endpoint hoặc integration. Native Mobile là client mục tiêu dùng chung backend nhưng chưa có project trong repository. Kiến trúc hiện tại chưa được gọi là production microservices.

## 7. Việc cần quyết định sau

- Java có nhận domain nào không, hay chỉ giữ vai trò extension.
- Contract và owner cho claim/evidence/appointment/realtime.
- Event/queue nếu matching/notification cần scale.
- Shared object storage và deployment platform.
- Jira sprint/assignee chính thức; workspace hiện không có Jira connector.
