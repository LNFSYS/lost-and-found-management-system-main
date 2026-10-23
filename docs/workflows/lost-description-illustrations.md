# Ảnh minh họa LOST từ mô tả

Phạm vi: mở rộng luồng tạo bài LOST (UC-018). Không thay thế phân tích ảnh thật của UC-017, không tạo FOUND hoặc tự quyết định quyền sở hữu.

## Luồng

1. Người dùng đăng nhập, chọn LOST, nhập tên, danh mục cụ thể và mô tả 20–2.000 ký tự.
2. Nhấn **Tạo ảnh minh họa**. Backend lấy danh mục đang hoạt động và truy xuất tài liệu tham chiếu tương ứng trong corpus vật phẩm.
3. Gemini kiểm tra mô tả có đúng vật phẩm/danh mục và đủ đặc điểm hay không. Mô tả không liên quan hoặc không rõ bị từ chối trước khi cấp lượt tạo ảnh.
4. Server cấp lượt trong transaction, tạo ảnh, rồi kiểm tra lại ảnh bằng mô hình thị giác. Ảnh không phù hợp không được lưu/chọn.
5. User xem các phiên bản và chọn **Dùng ảnh này cho bài đăng**. Thay đổi tên/mô tả/danh mục làm lựa chọn cũ mất hiệu lực.
6. Khi đăng, server kiểm tra owner, trạng thái và fingerprint mô tả, rồi gắn ảnh và đóng bản nháp trong cùng transaction với post.
7. Nếu bỏ chọn ảnh AI và đăng bài bằng ảnh thật, bản nháp ảnh cũng được đóng. Bài LOST tiếp theo có lượt riêng.

Ảnh mang nhãn **Ảnh minh họa do AI tạo**, không phải ảnh thật hoặc bằng chứng sở hữu. Bài có cả ảnh thật và ảnh minh họa ưu tiên ảnh thật trên board.

## Constraint và RAG

- Retrieval dùng danh mục đang hoạt động và corpus tham chiếu được kiểm soát tại `illustration-context.ts`; không lấy post của người khác, chat, evidence hoặc dữ liệu riêng tư làm context.
- Corpus gồm ví/túi, điện thoại, máy tính/phụ kiện, chìa khóa, tai nghe, giấy tờ, trang sức, quần áo, bình nước, văn phòng phẩm và ô/dù. Danh mục chưa có tài liệu phù hợp bị từ chối thay vì cho phép prompt tùy ý.
- Có ba bước: kiểm tra retrieval khớp danh mục → kiểm tra ngữ nghĩa/structured spec → kiểm tra ảnh sau sinh. Prompt người dùng được truyền như dữ liệu; không cho gửi system prompt hoặc model từ client.
- Kiểm tra AI có thể sai; không tuyên bố RAG bảo đảm tuyệt đối mọi ảnh chính xác. Nếu provider không trả kết quả hợp lệ, luồng từ chối ảnh.
- Ảnh được kiểm tra MIME/chữ ký/kích thước trước khi lưu. Không chép contact, serial, mã giấy tờ, QR hoặc khuôn mặt vào prompt ảnh; giấy tờ chỉ được minh họa dạng trống.
- `isAiGenerated` được lưu tại `post_media`, không nhận từ upload client. Post dùng ảnh sinh không ghi `analysisSignals` vào image/OCR matching tags. Không dùng ảnh này làm thumbnail evidence trong claim, lịch bàn giao hoặc hành trình ảnh thật.

## Giới hạn và retry

- Tối đa **1 lần tạo đầu + 3 lần tạo lại = 4 lần gọi tạo ảnh** cho một bản nháp LOST.
- Mỗi user có tối đa một bản nháp ảnh đang mở. Mở nhiều tab, reload hoặc đổi `requestId` không đặt lại lượt.
- Lượt chỉ được mở mới sau khi bài LOST được đăng. Không có endpoint reset quota tùy ý.
- Từ chối đầu vào trước generation không mất lượt. Khi đã cấp lượt và bắt đầu generation, lỗi provider, ảnh bị từ chối hoặc kết nối không chắc chắn vẫn tính lượt để tránh gọi dịch vụ không giới hạn.
- `requestId` UUID + fingerprint mô tả chống replay. Gửi lại cùng request trả lại lượt cũ, không gọi tạo ảnh lần hai; dùng lại key với input khác trả `409`.
- SQL khóa user trước khi tạo/đọc active draft. Một ảnh đang PENDING sẽ chặn generation khác. CHECK/unique constraints giữ quota và thứ tự lượt khi nhiều API instance cùng chạy.
- PENDING quá 5 phút chuyển FAILED; kết quả đến muộn không được hoàn tất lượt đó. API không tự gọi lại provider khi chưa biết request trước có hoàn thành không.
- Khi Gemini trả 429, backend phân loại quota Free Tier của model ảnh, quota theo ngày hoặc giới hạn tần suất; chỉ trả thông báo an toàn và `Retry-After`, không trả raw provider body. API công bố header này qua CORS để web đọc được.
- Thời gian chờ lấy từ RetryInfo/Retry-After, tối thiểu 60 giây và tối đa 24 giờ. Instance API nhớ trạng thái chặn để các yêu cầu mới dừng ở bước kiểm tra mô tả, trước khi cấp lượt; state trả cooldown để UI phục hồi sau F5. Đây là circuit breaker trong bộ nhớ từng instance, không phải quota phân tán bền vững. Quota 4 lượt trong SQL vẫn giữ nguyên và không tự hoàn/reset các lượt FAILED đã ghi.
- UI khóa tạo lại trong thời gian chờ, không tự retry, vẫn cho đăng thủ công hoặc dùng ảnh thật. Khi hết thời gian chờ, user phải chủ động nhấn lại; không bảo đảm hạn mức provider đã được cấp lại.
- Storage/DB acknowledgement không chắc chắn giữ asset để đối soát, không tự xóa ảnh có thể đã commit. Chưa bổ sung job retention/dọn asset riêng trong phạm vi này.

## API

Tất cả route cần JWT/session còn hợp lệ và trả `Cache-Control: private, no-store`.

| Route | Mục đích |
| --- | --- |
| `GET /api/posts/illustrations/draft` | Trạng thái bản nháp, lượt đã dùng/còn lại và các phiên bản của chính user |
| `POST /api/posts/illustrations` | Tạo ảnh; body gồm `type: LOST`, `title`, `description`, `categoryId`, `requestId` |
| `GET /api/posts/illustrations/:id/image` | Stream ảnh qua proxy sau owner check; outsider nhận 404 |
| `POST /api/posts` | Thêm `illustrationId` nếu chọn ảnh, `illustrationDraftId` để đóng bản nháp sau đăng |

POST generation trả `202` nếu request replay còn PENDING; các trạng thái READY/REJECTED/FAILED trả kết quả lượt cũ. Input sai trả `422`, vượt quota/đang chạy trả `409`. Request chưa đăng nhập hoặc account bị khóa trả `401`. Storage URL/public ID không có trong response công khai.

## Cấu hình và chạy

Chạy migration **066** trước khi chạy phiên bản API mới vì metadata media có cột mới. Không sửa migration/ledger đã áp dụng.

```powershell
npm ci
npm run migrate:preflight
npm run migrate
```

Cấu hình `.env` gốc:

```dotenv
GEMINI_API_KEY=<key phía server có quyền dùng mô hình ảnh>
GEMINI_MODEL=<mô hình text/vision đang hoạt động>
LOST_ILLUSTRATION_ENABLED=true
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GEMINI_IMAGE_TIMEOUT_MS=90000
```

Giữ Cloudinary/private storage theo cấu hình dự án. Tính năng mặc định tắt; khi chưa có key, UI thông báo chưa cấu hình và vẫn cho đăng thủ công. Không đưa key vào frontend hoặc commit `.env`.

```powershell
npm run dev
```

Vào `/home` → Báo mất vật phẩm → nhập danh mục/mô tả → tạo/chọn ảnh → đăng. Sau đó mở board/detail để kiểm tra nhãn ảnh AI.

Tài liệu provider: [Image generation](https://ai.google.dev/gemini-api/docs/image-generation), [model Gemini 3.1 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image).

## Khi gặp lỗi 429

- Model list trả 200 chỉ xác minh key và khả năng đọc metadata; không chứng minh quota tạo ảnh.
- `gemini-3.1-flash-image` không có Free Tier theo [pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-image). Nếu lỗi chỉ ra quota Free Tier, chủ dự án cần kiểm tra [Billing](https://ai.google.dev/gemini-api/docs/billing) và hạn mức của đúng project chứa key. Không tự bật gói trả phí từ ứng dụng.
- Quota áp dụng theo project, không phải riêng từng key; tạo key khác trong cùng project không khắc phục hết hạn mức. Xem [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
- Sau khi xử lý Billing/quota hoặc đổi sang key của project đã có quota, khởi động lại API để nạp cấu hình và xóa cooldown cũ, rồi F5. Không bấm tạo lại liên tục khi chưa xử lý provider.

## Kiểm thử

- Unit/domain: đúng/sai danh mục, request replay, concurrent reservation, 4 lượt/fifth rejection, provider failure, output bị từ chối, IDOR, input thay đổi, AI provenance và matching isolation.
- HTTP: JWT/disabled session, LOST-only/schema validation, owner-only binary delivery và no-store.
- Playwright: desktop/mobile, chọn ảnh + đăng, quota/reload, thay mô tả, ảnh bị từ chối, khôi phục PENDING, API trả trạng thái hỏng và retry preview không tiêu lượt.
- `lost-illustration.integration.test.ts`: opt-in isolated MySQL, migration, hai service instance, real row locking/quota, publication rollback/replay và không ghi AI tags. Fixture từ chối shared DB.

```powershell
npm test
npm run build
npm --workspace @lnfs/web exec -- playwright test tests/lost-illustration.spec.ts
```

MySQL integration cần `LNFS_DB_INTEGRATION=1`, `LNFS_TEST_DB_HOST=127.0.0.1`, tên DB kết thúc `_test` và credential test. Provider/unit/browser mocks không thay cho xác minh Gemini/Cloudinary thật hoặc isolated SQL. Không đánh dấu kiểm tra provider/DB đã đạt khi môi trường chưa được cấu hình.

## Kết quả xác minh 22/10/2026

- Sau bản sửa 429, `npm test`: 487 pass, 39 skip, 0 fail; architecture 0 violations; web lint/type-check đạt.
- `npm run build`: API/Web đạt; còn cảnh báo bundle Vite lớn có sẵn.
- Playwright tập trung sau bản sửa 429: 28/28 đạt, gồm 10 ca ảnh minh họa, 5 ca điều hướng/phân quyền Admin, 8 ca auth và 5 ca PWA/board. Đã kiểm tra screenshot 390px/440px/1440px; bitmap fixture chỉ là dữ liệu tổng hợp, không phải bằng chứng provider thật.
- Hai ca auth thất bại khi request nền không mock chạm API local thật; tái hiện cùng lỗi trên worktree `175f44d`. Đã bổ sung chặn request không cấu hình trong fixture, giữ nguyên toàn bộ assertion session/token/Retry-After.
- Playwright toàn bộ trước bản sửa 429 (`--workers=2`): 192 pass, 2 fail. Hai lỗi ở `lost-contact-photo.spec.ts:99` (nút đề xuất gặp mặt tại 390px) và `notification-navigation.spec.ts:114` (matching toast) cũng tái hiện trên worktree nguyên bản `175f44d`; chưa sửa trong phạm vi tạo ảnh LOST. Chưa chạy lại toàn bộ sau sửa 429; không tuyên bố toàn bộ E2E đã xanh.
- Sau khi được xác nhận, đã áp dụng migration 066 trên Aiven ngày 22/10/2026. Kiểm tra chỉ đọc xác nhận checksum khớp, ledger/attempt `APPLIED`, 2 bảng InnoDB, cột `post_media.is_ai_generated` mặc định false và NOT NULL, 3 unique indexes, 2 CHECK constraints và 4 foreign keys. Ngay sau migration hai bảng mới có 0 bản ghi; smoke không ghi dữ liệu trên DB chung.
- Preflight sau migration không còn pending. Có cảnh báo lịch sử migration custody 053/055 từ baseline, không tự sửa ledger.
- Đọc board qua PostRepository thật sau migration thành công (5 bài); metadata media trả cờ AI dạng boolean. Không ghi/thay đổi post để smoke test.
- Sau khi user cấu hình key, probe tạo ảnh thật bằng mô tả giả lập nhận `429 RESOURCE_EXHAUSTED`, các quota Free Tier của `gemini-3.1-flash-image` và RetryInfo `76775s`; không có ảnh đầu ra. Không gửi contact/chat/evidence, không ghi thêm lượt hoặc thay dữ liệu bản nháp khi probe. Key/model-list 200 trước đó không thay cho generation acceptance. Cloudinary thật và isolated MySQL runtime vẫn chưa được xác minh; chưa thể coi là Done.
