# Kiểm duyệt đầu vào phân tích mô tả ảnh — local

## Phạm vi đã thu hẹp theo yêu cầu

Chỉ kiểm tra ảnh tại endpoint phân tích tạo bản nháp mô tả, áp dụng cho Gemini, Qwen và DeepSeek. Chỉ inject moderator vào dịch vụ tạo bản nháp bài đăng trong `main/services.ts`.

Không thay đổi upload/lưu ảnh, tạo/sửa bài, quyền riêng tư, matching, ảnh liên hệ claim, chat hoặc luồng Staff. Những chỉnh sửa trước đây của tác vụ này trong các phần đó đã được gỡ, giữ hành vi có sẵn của dev. Bỏ qua nút phân tích thì bộ lọc này không chạy; đây không phải cơ chế kiểm duyệt mọi ảnh đăng trên hệ thống.

## Cấu hình

Trong `apps/api-node/.env`:

```dotenv
IMAGE_MODERATION_ENABLED=true
IMAGE_MODERATION_TIMEOUT_MS=60000
```

Dùng cấu hình DeepSeek/Vilao hiện có. Khi bật, mỗi ảnh được gửi riêng tới dịch vụ này để phân loại trước khi gọi AI mô tả được chọn, kể cả chọn Qwen. Nếu lỗi mạng, timeout, phản hồi sai hoặc không xác định rõ thì không trả bản nháp. Khởi động lại API để áp dụng cấu hình.

## Quy tắc phân tích

- Chặn bạo lực, máu me, nội dung tình dục rõ ràng, tuyên truyền thù ghét và nội dung cổ súy tự hại.
- Chặn ảnh hoạt hình/anime/meme/minh họa độc lập không phải ảnh vật phẩm thực tế. Đồ vật thật có in hoạt hình lành tính vẫn được phép; không bắt buộc nền chụp phải ở trường.
- Theo yêu cầu chủ dự án, chặn sản phẩm tình dục như bao cao su, gel bôi trơn tình dục và đồ chơi tình dục, kể cả bao bì kín. Đây là giới hạn của ứng dụng, không khẳng định sản phẩm bất hợp pháp.
- Chặn ảnh giấy tờ chưa che kín thông tin cá nhân, ảnh chân dung, chữ ký, ngày tháng và QR/barcode.
- Thẻ ngân hàng được phép khi tên chủ thẻ, toàn bộ số thẻ/tài khoản, hạn dùng, CVV/CVC, chữ ký và QR/barcode trên mặt được chụp đã che kín bằng vùng che đặc. Logo ngân hàng và màu thẻ có thể còn hiển thị. Không yêu cầu chụp mặt còn lại. Vẫn chặn PIN/OTP/mật khẩu.
- Giấy tờ/thẻ được phân loại đã che chỉ trả tên và mô tả chung, không OCR/mô tả chi tiết tiếp; chọn danh mục thủ công. Không sửa quyền lưu trữ của bài hoặc ảnh.
- Một ảnh bị chặn trong bộ ảnh thì cả lượt không trả bản nháp.

## Giới hạn và kiểm thử

Bước phân loại vẫn gửi ảnh gốc tới DeepSeek/Vilao; chưa đáp ứng yêu cầu không gửi dữ liệu nhạy cảm ra dịch vụ ngoài trong đề xuất nghiệp vụ S1/S2. Người dùng phải che thông tin trước khi gửi. Tài liệu nghiệp vụ và các luồng khác của nhóm không được sửa bởi tác vụ này.

Test dùng verdict mô phỏng để kiểm tra chặn, bộ ảnh hỗn hợp, bản nháp chung và ngăn gọi provider mô tả khi bị chặn. Chưa đo độ chính xác trên tập ảnh nhạy cảm thực tế; model có thể bỏ sót hoặc chặn nhầm. Thử local bằng ảnh đồ vật và giấy tờ mẫu có dữ liệu giả, không cần ảnh gây sốc hay thông tin thật.