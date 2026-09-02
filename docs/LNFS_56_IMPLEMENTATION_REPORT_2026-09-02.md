# LNFS-56 Matching Suggestion and Explanation - Implementation Report

Ngày xác minh: **02/09/2026**  
Nhánh: `feature/lnfs-56-matching-suggestion-explanation`

## 1. Phạm vi ticket

LNFS-56 cung cấp gợi ý matching có thể giải thích giữa bài `LOST` và `FOUND` đang hoạt động:

- Chạy matching best-effort sau khi tạo hoặc cập nhật bài đang mở.
- Chuẩn hóa tiếng Việt và chấm điểm theo mô tả, danh mục, vị trí, thời gian, image tags và OCR tags.
- Lưu kết quả, tier, điểm thành phần và explanation vào database.
- Cho chủ bài xem kết quả đã lưu và yêu cầu tính lại có rate limit.
- Cho `STAFF`/`ADMIN` review; người không có quyền nhận `403`.
- Hiển thị danh sách ứng viên, tỷ lệ, điểm thành phần và lý do trên Web.

Matching chỉ là **gợi ý hỗ trợ đối chiếu**. Điểm cao không tự động xác nhận quyền sở hữu, chấp nhận claim hoặc hoàn tất trao trả.

## 2. Baseline đã có

Baseline của ticket đã được merge trước phiên hardening qua PR #6, commit `4d6841b` (`feat(posts): add AI-assisted drafts and persistent matching`). Các thành phần chính:

- `apps/api-node/src/services/matching.engine.ts`
- `apps/api-node/src/services/matching.service.ts`
- `apps/api-node/src/repositories/matching.repository.ts`
- `apps/api-node/src/services/post.service.ts`
- `apps/api-node/src/routes/post.routes.ts`
- `apps/web/src/pages/post-matches-page.tsx`
- `apps/web/src/pages/posts-page.tsx`
- `apps/web/src/pages/post-detail-page.tsx`

## 3. Hardening trong phiên này

### 3.1 Chỉ trả matching của cặp bài còn hiệu lực

Mọi truy vấn kết quả và summary hiện join lại cả bài `LOST` và `FOUND`, đồng thời yêu cầu:

- `deleted_at IS NULL` ở cả hai phía;
- status của cả hai phía thuộc `OPEN` hoặc `MATCHED`.

Vì vậy kết quả cũ không còn xuất hiện khi một bài đã đóng, resolved, expired hoặc soft-delete.

### 3.2 Bảo vệ cấu hình scoring

Các threshold động phải:

- nằm trong `[0, 1]`;
- có thứ tự `weak <= suggestion <= notification <= high confidence`.

Các weight phải hữu hạn, nằm trong `[0, 1]` và có ít nhất một weight lớn hơn `0`. Cấu hình không hợp lệ được thay bằng default an toàn trước khi chấm điểm hoặc trả API.

### 3.3 Kiểm tra quyền và dữ liệu riêng tư

Test service xác nhận:

- chỉ source owner hoặc `STAFF`/`ADMIN` được xem/tính lại matching;
- chủ bài không nhìn thấy contact, mô tả riêng hoặc raw matched text/image/OCR signals của candidate `FOUND` ở chế độ `PRIVATE_DETAILS`;
- `STAFF` vẫn nhận đủ dữ liệu cần thiết cho human review.

## 4. API contract

Không có breaking change.

| Method | Endpoint | Quyền | Hành vi |
| --- | --- | --- | --- |
| `GET` | `/api/posts/:id/matches` | Source owner, `STAFF`, `ADMIN` | Đọc kết quả matching đã lưu còn hiệu lực |
| `POST` | `/api/posts/:id/matches/recalculate` | Source owner, `STAFF`, `ADMIN` | Tính lại matching, có rate limit |

Payload tiếp tục gồm source post, matcher version, thời điểm tính, thresholds, weights, ứng viên, tổng điểm, tier, điểm thành phần và explanation đã áp dụng privacy policy.

## 5. Database và migration

- Dùng schema hiện có: `match_results`, `ai_tags`, `config_entries`.
- **Không thêm migration** trong phiên hardening này.
- Không chạy migration hoặc test ghi dữ liệu trên shared Aiven database.

## 6. Test evidence

Test được bổ sung:

- `matching.service.test.ts`: validation/fallback cho threshold và weight.
- `matching.repository.test.ts`: truy vấn chỉ lấy active LOST/FOUND pair và đúng parameter order.
- `post.service.test.ts`: ownership/role guard và redaction cho private candidate.

Kết quả đã chạy:

| Command | Kết quả |
| --- | --- |
| `npm --workspace @lnfs/api-node run test` | PASS: 60 pass, 1 skip an toàn, 0 fail |
| `npm test` | PASS: API test như trên và Web TypeScript check pass |
| `npm run build` | PASS: API TypeScript build và Web Vite production build |
| `npm --workspace @lnfs/web run e2e:home` | PASS: 16/16 Playwright tests, gồm create LOST/private FOUND, persisted matching analysis và My Posts |
| `npm run migrate` | Không chạy để tránh ghi vào shared Aiven database |

## 7. Manual QA checklist

- [ ] Tạo một bài `LOST` và một bài `FOUND` có cùng danh mục/dấu hiệu; xác nhận có kết quả và điểm thành phần.
- [ ] Mở `/posts/:id/matches` bằng source owner; xác nhận xem được và recalculate hoạt động.
- [ ] Mở endpoint bằng user không sở hữu bài; xác nhận `403`.
- [ ] Đặt candidate `FOUND` thành `PRIVATE_DETAILS`; xác nhận owner phía đối diện không thấy raw private signals.
- [ ] Đóng hoặc soft-delete một trong hai bài; xác nhận kết quả và summary cũ không còn xuất hiện.
- [ ] Kiểm tra Staff/Admin vẫn xem được dữ liệu cần cho human review.

## 8. Ngoài phạm vi

- Notification, unread/seen, scheduler hoặc polling 10 phút: LNFS-58 / FR-MATCH-04.
- Claim, private conversation và quyết định Finder: LNFS-52/LNFS-53.
- Provider AI/OCR nâng cao: LNFS-57.
- Matching hiện dùng rule/TF-IDF và overlap của image/OCR tags; chưa phải custom-trained model hoặc image embedding model.

## 9. Rủi ro còn lại

- Chưa benchmark trên tập dữ liệu campus lớn; candidate prefilter đang giới hạn từ 20 đến 2.000 bản ghi.
- DB integration test chỉ nên chạy với database `_test` riêng, không chạy trên Aiven dùng chung.
- Chất lượng gợi ý phụ thuộc chất lượng mô tả, category và metadata ảnh/OCR đầu vào.
