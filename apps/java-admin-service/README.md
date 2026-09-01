# Java Admin Service

## Trạng thái hiện tại

Đây là Spring Boot health-check skeleton, không phải business service đã tích hợp. Module hiện chỉ khởi động Actuator health endpoint.

- Không có login flow riêng.
- Không ghi vào shared MySQL schema.
- Không sở hữu authentication, posts, matching, claim, appointment, warehouse hoặc handover point.
- Chưa có Node-to-Java integration, JWT compatibility test hoặc frontend route.
- Native Mobile không thuộc module này; mobile target sẽ dùng shared Node API.

## Chạy kiểm tra

Yêu cầu Java 21 và Maven:

~~~bash
mvn -f apps/java-admin-service/pom.xml package -DskipTests
mvn -f apps/java-admin-service/pom.xml spring-boot:run
~~~

Health endpoint mặc định của Spring Boot là /actuator/health trên port cấu hình trong application.yml.

## Điều kiện mở rộng

Chỉ nhận một business domain khi có API contract, một write owner, JWT/role compatibility test, transaction/state-machine tests, integration test và rollback plan. Xem [Node.js và Java boundary](../../docs/node-java-service-boundary.md).
