# Tài liệu FPTU Lost & Found System

Cập nhật: 21/08/2026

Thư mục này là bộ tài liệu chính của codebase mới tại `fptu-lost-found-system-main`. Không dùng tài liệu của repository cũ để xác nhận một chức năng đã hoàn thành.

## Nguồn tài liệu chính

| Tài liệu | Mục đích |
| --- | --- |
| [project-overview.md](project-overview.md) | Phạm vi, kiến trúc, module và luồng hiện tại |
| [requirements.md](requirements.md) | Yêu cầu chức năng/phi chức năng và trạng thái |
| [business-rules.md](business-rules.md) | Luật nghiệp vụ đang được cưỡng bức hoặc dự kiến |
| [traceability-matrix.md](traceability-matrix.md) | Liên kết requirement, business rule, use case và code evidence |
| [use-case-checklist.md](use-case-checklist.md) | Checklist 100 UC; chỉ tick khi code hiện tại có bằng chứng |
| [node-java-service-boundary.md](node-java-service-boundary.md) | Ranh giới runtime Node.js và Java hiện tại |

## Trạng thái triển khai

| Trạng thái | Ý nghĩa |
| --- | --- |
| `Done` | Có route/UI hoặc service thực thi, có thể build và có bằng chứng kiểm tra phù hợp |
| `Partial` | Có một phần code/schema/UI nhưng chưa hoàn thành luồng end-to-end |
| `Planned` | Chưa có runtime implementation trong codebase mới |
| `Deferred` | Cố ý để sau phạm vi web/backend hiện tại, ví dụ mobile |

## Snapshot hiện tại

Đã triển khai:

- Authentication bằng email OTP, password, refresh token, logout và reset password.
- JWT/role guard cho `USER`, `STUDENT`, `LECTURER`, `STAFF`, `ADMIN`.
- Board LOST/FOUND, bài của tôi, chi tiết bài, tạo/cập nhật/đóng/xóa mềm bài.
- Upload/xóa ảnh bài đăng qua media proxy; storage hiện tại là filesystem local.
- Gemini-assisted image analysis để tạo bản nháp có thể chỉnh sửa.
- Rule-based/hybrid matching có tier, explanation, lưu `match_results` và trang xem kết quả.
- Admin CRUD cho nhóm danh mục, danh mục con, khu vực và tòa nhà/địa điểm.

Chưa hoàn thành ở runtime:

- Claim/evidence review, appointment, warehouse, realtime chat/notification.
- Admin user management, moderation, report, configuration và dashboard toàn hệ thống.
- Java business endpoints; Java hiện chỉ là health-check skeleton.
- Shared object storage. Dùng chung cloud DB trong khi lưu ảnh local có thể tạo metadata ảnh không tồn tại trên máy khác.
- Mobile và custom-trained AI model.

## Bằng chứng audit 21/08/2026

- `npm test`: pass 23/23 API unit tests và frontend TypeScript check.
- `npm run build`: API và web production build pass.
- `npm --workspace @lnfs/web run e2e:home`: pass 10/10 Playwright tests.
- `npm run build:java`: chưa chạy được trên máy audit vì chưa cài Maven (`mvn` không có trong `PATH`).
- Checklist chứa đúng 100 ID duy nhất từ `UC-001` đến `UC-100`.
- Kiểm tra link Markdown nội bộ: không có link hỏng.

Browser tests hiện chủ yếu kiểm tra UI với API mock; chúng không thay thế MySQL integration tests.

## Quy tắc cập nhật

1. Không tick `Done` chỉ vì migration đã tạo bảng.
2. Mỗi thay đổi trạng thái phải ghi được route/service/UI/test làm bằng chứng.
3. Không mô tả `Cloudinary`, `Socket.IO`, claim hay warehouse là hiện hành nếu dependency/route chưa tồn tại.
4. Node.js là runtime/write owner duy nhất của các flow đang chạy.
5. Không mô tả Java là microservice nghiệp vụ hoàn chỉnh khi mới có health endpoint.
6. Dùng “Gemini-assisted image analysis” và “rule-based/hybrid matching”; không gọi là custom-trained AI.
7. Sau thay đổi lớn, chạy `npm test`, `npm run build` và cập nhật ngày audit.
