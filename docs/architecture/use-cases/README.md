# Sơ đồ use case LNFS theo vai trò

Nguồn phạm vi và trạng thái: [catalogue 168 UC](../../requirements/uc.md). Gồm một sơ đồ tổng quát và năm sơ đồ chi tiết. Tên UC dùng tiếng Anh như catalogue và ảnh bố cục tham chiếu.

## Mở sơ đồ

**File chỉnh sửa:** [LNFS_USE_CASE_DIAGRAMS.drawio](LNFS_USE_CASE_DIAGRAMS.drawio). Mở bằng draw.io/diagrams.net; sáu tab tương ứng sáu sơ đồ. SVG là ảnh vector để phóng to hoặc đưa vào báo cáo; PNG có độ phân giải đầy đủ. Các bản nhiều UC có chiều cao lớn để giữ được từng mã và tên UC.

| Sơ đồ | Ảnh PNG | Vector SVG | Phạm vi |
| --- | --- | --- | --- |
| Tổng quát | [00-overview.png](images/00-overview.png) | [00-overview.svg](images/00-overview.svg) | Guest, User, Staff, Admin; nhóm các mục tiêu chính |
| Guest | [01-guest.png](images/01-guest.png) | [01-guest.svg](images/01-guest.svg) | 11 UC: tài khoản và thông tin công khai |
| Người mất / Claimant | [02-user-lost.png](images/02-user-lost.png) | [02-user-lost.svg](images/02-user-lost.svg) | 80 UC, gồm hành vi dùng chung và xử lý tự động liên quan |
| Người nhặt / Finder | [03-user-finder.png](images/03-user-finder.png) | [03-user-finder.svg](images/03-user-finder.svg) | 91 UC, gồm xét claim, câu hỏi xác minh và chuyển custody |
| Staff | [04-staff.png](images/04-staff.png) | [04-staff.svg](images/04-staff.svg) | 49 UC: tài khoản dùng chung, intake, kho và review được phép |
| Admin | [05-admin.png](images/05-admin.png) | [05-admin.svg](images/05-admin.svg) | 95 UC: quản trị và quyền vận hành Staff/Admin trong catalogue |

[coverage.md](coverage.md) liệt kê **từng UC trong 168 UC**, trạng thái gốc và sơ đồ nào có UC đó. UC dùng chung được tính ở nhiều vai trò; hợp của năm sơ đồ chi tiết là 168, không phải tổng cộng các cột.

## Quy ước thể hiện

- Giữ phong cách ảnh mẫu: đen/trắng, nền lưới mờ, khung hệ thống chữ nhật, actor người que bên ngoài, use case hình elip và đường nối thẳng.
- Sơ đồ tổng quát chỉ có bốn actor **Guest, User, Staff, Admin**. Hai sơ đồ chi tiết người mất/người nhặt cũng ghi nhãn actor **User**; tiêu đề trang phân biệt Lost/Claimant và Finder. Đây là vai trò nghiệp vụ trong case, không phải hai role tài khoản mới.
- Association actor–UC dùng nét liền, không mũi tên. `<<include>>` dùng nét đứt và mũi tên từ UC chính tới hành vi bắt buộc được dùng lại. `<<extend>>` đi từ hành vi bổ sung tới UC gốc; điều kiện nằm trong dấu `[]`.
- Include/extend mô tả quan hệ hành vi; không dùng chúng thay mũi tên trình tự. Các bước trước/sau độc lập như hủy lịch rồi yêu cầu custody được vẽ thành UC độc lập.
- `I` = Implemented, `P` = Partial, `PL` = Planned, lấy trực tiếp từ catalogue. Một UC xuất hiện trên hình thể hiện phạm vi, không chứng nhận đã deploy hoặc nghiệm thu.
- `[auto]` là tác vụ bên trong hệ thống, không nối actor với quyền kích hoạt thủ công. Không thêm “System” như một role người dùng ngoài khung hệ thống.
- Elip không có UC ID là hành vi hỗ trợ được tách ra để thể hiện include; dòng cuối ghi BR liên quan. Chúng không tạo UC mới trong catalogue. Các đề xuất PBR về đồ nhạy cảm chưa được phê duyệt không được tự đưa thành quyền hiện hành.

## Phạm vi và quyền

- Người mất có UC-137 xác nhận nhận đồ; Finder có UC-136 xác nhận giao đồ, UC-106/107 hỏi xác minh và UC-141 yêu cầu custody. Hai xác nhận và gate hợp lệ mới dẫn tới UC-139 hoàn tất trả trực tiếp.
- Finder được chuyển custody từ hội thoại LOST có ảnh đã được kiểm tra theo BR-53/69; không bắt buộc tạo FOUND. Yêu cầu custody không thay thế intake vật lý hoặc xác minh ownership của Staff.
- Staff/Admin có quyền vận hành kho theo catalogue. Các UC Partial/Planned như general escalation, duyệt disposition đầy đủ hoặc nhãn dữ liệu huấn luyện vẫn giữ đúng trạng thái.
- Staff/Admin có các UC tài khoản, bảng tin công khai, notification và report dùng chung. Nếu cùng account tham gia một case như người mất/người nhặt, xem thêm sơ đồ User tương ứng; không suy ra Staff/Admin được đọc tùy ý chat/evidence riêng tư.
- Sơ đồ tổng quát gộp các UC cùng nhóm; phạm vi cụ thể và guard phải đọc ở các bản chi tiết/catalogue. Ví dụ Admin quản lý model; Staff chỉ có UC-102 gán nhãn, không được suy ra quyền train/activate model.

## Tái tạo và kiểm tra

Chạy từ root repository:

```powershell
node docs/architecture/use-cases/generate.mjs --render
node docs/architecture/use-cases/verify.mjs
node scripts/check-uc-catalogue.mjs
```

`generate.mjs` đọc tên/trạng thái từ `uc.md`, kiểm tra UC không trùng trong từng sơ đồ và hợp các UC đủ 168/168; xuất draw.io, SVG, PNG, bảng coverage và kích thước trong `layout.json`. Cờ `--render` dùng Chromium/Playwright đã cài trong workspace để tạo PNG, không gọi dịch vụ vẽ bên ngoài.

`verify.mjs` kiểm tra XML, sáu trang, actor, hướng include/extend, nét thẳng, độ vừa chữ, vị trí ellipse và PNG có nội dung. Không cần khởi động API, kết nối database hoặc chạy migration để tạo/kiểm tra bộ hình.
