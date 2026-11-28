# Phân tích ảnh bằng DeepSeek qua Vilao

Form đăng bài có ba lựa chọn độc lập: Gemini, Qwen và DeepSeek. DeepSeek gửi các góc chụp trong cùng một yêu cầu và dùng danh mục hiện có để tự điền tên, mô tả, nhóm chính và danh mục cụ thể. Không tự chuyển sang provider khác khi gặp lỗi.

## Cấu hình backend

Đặt trong `apps/api-node/.env` (không commit):

```dotenv
DEEPSEEK_API_KEY=<khóa Vilao của bạn>
DEEPSEEK_BASE_URL=https://api.vilao.ai/v1
DEEPSEEK_MODEL=spd/deepseek-v4-flash-vision-exp
DEEPSEEK_TIMEOUT_MS=120000
```

Model được chọn theo [trang model Vilao](https://vilao.ai/vi/model/spd/deepseek-v4-flash-vision-exp). Adapter dùng `POST /chat/completions`, Bearer authentication và ảnh dưới dạng `image_url` data URI. Không đưa key vào biến `VITE_*`, frontend hoặc log.

Khởi động lại backend sau khi sửa `.env`; chạy `npm run dev` ở thư mục gốc để dùng local. Chọn ảnh rồi bấm **Phân tích bằng DeepSeek**. Dịch vụ này không cần Qwen local hay SSH tunnel. Các lựa chọn Gemini và Qwen vẫn dùng cấu hình riêng.

Khi triển khai VPS, cần đưa bản build mới và cấu hình các biến trên tại VPS rồi restart API. `.env` local không được Git chuyển lên VPS. Reverse proxy cần thời gian chờ lớn hơn 120 giây (cấu hình 300 giây hiện có đáp ứng).

Kết quả là bản nháp cần người dùng kiểm tra, đặc biệt chữ nhỏ, model và tình trạng vật phẩm. Điểm confidence do model trả về, không phải độ chính xác đã được đo lường. API key được gửi trong hội thoại nên nên thay bằng key mới trước khi dùng lâu dài.
