# Tài liệu FPTU Lost & Found System

Cập nhật: 26/08/2026

Thư mục này là bộ tài liệu chính của codebase tại `fptu-lost-found-system-main`. Sản phẩm được định vị là **Web Application with Progressive Web App (PWA) support**. PWA là kênh web responsive và có khả năng cài đặt khi hoàn thiện; không phải native mobile app riêng.

Không dùng tài liệu của repository cũ, roadmap hoặc migration đơn lẻ để xác nhận một chức năng đã hoàn thành. Thứ tự nguồn sự thật là code/test hiện tại, trạng thái Jira nếu có quyền truy cập, quyết định phạm vi đã được nhóm chốt và cuối cùng mới đến tài liệu cũ.

## Nguồn tài liệu chính

| Tài liệu | Mục đích |
| --- | --- |
| [project-overview.md](project-overview.md) | Phạm vi, kiến trúc, module và luồng hiện tại |
| [requirements.md](requirements.md) | Yêu cầu chức năng/phi chức năng và trạng thái |
| [business-rules.md](business-rules.md) | Luật nghiệp vụ đang được cưỡng bức hoặc dự kiến |
| [traceability-matrix.md](traceability-matrix.md) | Liên kết requirement, business rule, use case và code evidence |
| [use-case-checklist.md](use-case-checklist.md) | Checklist 100 UC; chỉ tick khi code hiện tại có bằng chứng |
| [node-java-service-boundary.md](node-java-service-boundary.md) | Ranh giới runtime Node.js và Java hiện tại |
| [DOCUMENTATION_UPDATE_REPORT.md](DOCUMENTATION_UPDATE_REPORT.md) | Biên bản đối chiếu code và cập nhật tài liệu ngày 26/08/2026 |

## Trạng thái triển khai

| Trạng thái | Ý nghĩa |
| --- | --- |
| `Done` | Có route/UI hoặc service thực thi, có thể build và có bằng chứng kiểm tra phù hợp |
| `Partial` | Có một phần code/schema/UI nhưng chưa hoàn thành luồng end-to-end |
| `Planned` | Chưa có runtime implementation trong codebase mới |
| `Deferred` | Future enhancement được nêu rõ và không thuộc current development scope |

## Snapshot hiện tại

Đã triển khai:

- Authentication bằng email OTP, password, refresh token, logout và reset password.
- JWT/role guard cho `USER`, `STUDENT`, `LECTURER`, `STAFF`, `ADMIN`.
- Board LOST/FOUND, bài của tôi, chi tiết bài, tạo/cập nhật/đóng/xóa mềm bài.
- Upload/xóa ảnh bài đăng qua media proxy; storage hiện tại là filesystem local.
- Gemini-assisted image analysis để tạo bản nháp có thể chỉnh sửa.
- Rule-based/hybrid matching có tier, explanation, lưu `match_results` và trang xem kết quả.
- Admin CRUD cho nhóm danh mục, danh mục con, khu vực và tòa nhà/địa điểm.
- Staff warehouse API/UI cho tiếp nhận, lưu kho, trả đồ, retention deadline và storage log.
- Responsive layout cho desktop/mobile browser; Playwright có mobile viewport checks.

Partial hoặc chưa hoàn thành ở runtime:

- Claim/evidence review, appointment, warehouse disposition và realtime chat/notification.
- Admin user management, moderation, report, configuration và dashboard toàn hệ thống.
- Java business endpoints; Java hiện chỉ là health-check skeleton.
- Shared object storage. Dùng chung cloud DB trong khi lưu ảnh local có thể tạo metadata ảnh không tồn tại trên máy khác.
- PWA infrastructure: chưa có web app manifest, service worker, installability hay offline application shell.
- Native mobile app và custom-trained AI model là future enhancements, không phải current delivery channel.

## Bằng chứng kiểm tra 26/08/2026

- API tests: 47 pass; 1 DB integration test được safety-skip vì chưa cấu hình MySQL local `_test`.
- Frontend TypeScript check: pass.
- `npm run build`: API và web production build pass.
- `npm --workspace @lnfs/web run e2e:home`: pass 14/14 Playwright tests, gồm mobile viewport và Staff warehouse UI.
- `npm run build:java`: fail do môi trường chưa cài Maven (`mvn` không có trong `PATH`); chưa kết luận Java code lỗi.
- Checklist chứa đúng 100 ID duy nhất từ `UC-001` đến `UC-100`.
- Kiểm tra link Markdown nội bộ: không có link hỏng.

Browser tests hiện chủ yếu kiểm tra UI với API mock. MySQL integration suite có guard local-only và cần được chạy riêng trên database có tên kết thúc bằng `_test`; tuyệt đối không chạy trên Aiven/shared DB.

## Quy tắc cập nhật

1. Không tick `Done` chỉ vì migration đã tạo bảng.
2. Mỗi thay đổi trạng thái phải ghi được route/service/UI/test làm bằng chứng.
3. Không mô tả `Cloudinary`, `Socket.IO`, claim, appointment hoặc PWA là hiện hành nếu dependency/route/runtime evidence chưa tồn tại.
4. Node.js là runtime/write owner duy nhất của các flow đang chạy.
5. Không mô tả Java là microservice nghiệp vụ hoàn chỉnh khi mới có health endpoint.
6. Dùng “Gemini-assisted image/OCR analysis” và “rule-based/hybrid matching”; không gọi là custom-trained AI.
7. Sau thay đổi lớn, chạy `npm test`, `npm run build` và cập nhật ngày audit.
