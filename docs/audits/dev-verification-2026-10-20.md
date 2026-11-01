# Kiểm thử trước khi push nhánh dev - 20/10/2026

## Kết luận

**Chưa đạt toàn bộ kiểm tra và chưa đủ bằng chứng để merge main hoặc deploy.** Theo yêu cầu, vẫn đưa bản hiện tại lên nhánh `dev`, ghi rõ các lỗi thay vì bỏ kiểm tra hoặc sửa gate để làm xanh.

Đợt này kiểm thử lại, hoàn tất merge đã resolve và lưu tài liệu. Không sửa thêm nghiệp vụ, đổi WebSocket sang Socket.IO, chạy migration write hoặc thay đổi nhánh `main`.

## Phiên bản và nhánh

| Nội dung | Giá trị |
| --- | --- |
| Candidate code đã kiểm thử | `b39c2ea5d0e6e14ab4037483c8d4fd3e6c63033d` |
| Parent dev-new | `959e3cacbb73e1c9011954f46b659f7ae6c6c478` |
| Parent main | `aa75e0d3298dfdbe1634b97c53736a7c96db3206` |
| Nhánh mới | `dev`, tạo từ candidate code sau merge |
| Giữ dev local cũ | `backup/dev-before-refresh-2026-10-20-01459ec`, giữ nguyên commit `01459ec` |
| Lịch sử | Merge bình thường; không squash, sửa author cũ hoặc force-push |

Hai parent được giữ nguyên. Các thay đổi từ `main` không được tính lại thành công việc mới của người resolve merge. Commit tài liệu sau candidate code không thay đổi source, tests hoặc cấu hình build đã kiểm thử.

## Kết quả local

Môi trường: Windows, Node.js `22.15.0`; dependency đang có trong workspace, không chạy `npm audit fix` hoặc thay lockfile. Playwright dùng Google Chrome local, hai workers; không coi đây là bằng chứng CI Linux.

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | FAIL ở architecture gate: 8 vi phạm; 2 test của checker pass. Root script chưa chạy tới API/Web lint |
| `npm --workspace @lnfs/api-node run test` | 477 tests: **438 pass, 2 fail, 37 skip**, 0 cancelled |
| `npm run build` | FAIL ở API: 3 diagnostic TypeScript; root script chưa chạy tới Web build |
| `npm --workspace @lnfs/web run lint` | PASS |
| `npm --workspace @lnfs/web run build` | PASS; còn cảnh báo chunk JavaScript lớn hơn 500 kB |
| Playwright toàn bộ: `playwright test --workers=2 --reporter=line` | 168 tests: **167 pass, 1 fail**; khoảng 2,5 phút |
| `npm audit --omit=dev --audit-level=moderate` | PASS: 0 vulnerability production theo npm audit |
| `npm audit --audit-level=moderate` | FAIL: 2 mục critical liên quan `shell-quote` và `concurrently` trong dependency phát triển |
| `node scripts/check-uc-catalogue.mjs` | PASS: 168 UC = 126 Implemented + 24 Partial + 18 Planned |
| `node docs/architecture/use-cases/verify.mjs` | PASS: 6 sơ đồ, kiểm tra labels/nodes/straight edges/PNG |
| `node scripts/check-env.mjs` | PASS; không in giá trị secret |
| `npm run migrate:preflight` | PASS, transaction chỉ đọc: 61 source migrations, 64 ledger entries, 31 APPLIED attempts, không có pending |
| Unresolved index, conflict marker trong source/tests | Không còn |
| `git diff --cached --check` trước merge commit | PASS |

### Những lỗi còn tái hiện

1. **Build API:** `apps/api-node/src/modules/claims/application/claim.use-cases.ts:1301` báo TS2339 cho `roomId` và `message` trên kiểu `never`; `apps/api-node/src/modules/notifications/infrastructure/notification-email.repository.ts:260` báo TS2722 khi gọi method có thể undefined.
2. **Kiến trúc:** 8 vi phạm import giữa claims/realtime/warehouse/system-config và dependency từ interface socket tới shared infrastructure. Chi tiết D2 trong [audit dev-new](dev-new-audit-2026-10-19.md).
3. **API test migration:** `apps/api-node/src/migrations/historical-migration.test.ts:13` kỳ vọng 59 forward files nhưng hiện có 61. Không sửa SQL/ledger để đáp ứng số đếm cũ.
4. **API test validator:** ca `verification writes require bounded input and an idempotency key` trong `apps/api-node/src/modules/claims/interfaces/http/claim.validator.test.ts` còn payload custody thiếu `requestedIntakeAt` theo contract mới.
5. **Browser matching toast:** `apps/web/tests/notification-navigation.spec.ts:100`; assertion tại dòng 114 chờ `.notification-toast__content` 15 giây nhưng không có phần tử. Không bỏ assertion hoặc skip test; đối chiếu D4 trong audit trước.
6. **Dependency phát triển:** `shell-quote` nằm trong dependency tree của `concurrently`; kết quả production audit bằng 0 không có nghĩa toàn bộ dependency tree an toàn.

Các lỗi trên vẫn tồn tại sau khi ghép code. Đợt này không được yêu cầu sửa toàn bộ lỗi trước khi push nên giữ nguyên để người review thấy đúng trạng thái.

## Giới hạn và bảo mật

- 37 test skip là kết quả thật của suite, không tính thành pass. Chưa cấu hình `LNFS_DB_INTEGRATION=1` và `LNFS_TEST_DB_*` cho DB test cô lập; không trỏ destructive integration tests vào Aiven hoặc tự dùng DB local khác đang chạy.
- Preflight Aiven chỉ đọc; không replay migration, thay checksum, sửa ledger hoặc rollout lại media. Cảnh báo lịch sử `053` và SQL gốc custody-time `055` chưa có vẫn còn.
- Browser suite dùng API fixtures có kiểm soát. Không thay thế nghiệm thu DB thật, provider email/push/Cloudinary, mobile, tải/failover hoặc bàn giao ngoài đời.
- Các finding bảo mật/realtime D3/D5/D6/D7 của audit trước chưa được sửa hoặc chứng nhận lại trong lượt này. Cần xử lý riêng trước release, đặc biệt chính sách đích browser push và vòng đời quyền truy cập phòng.
- Rà mẫu secret có độ tin cậy cao trong 62 file dự kiến đưa vào merge/audit không phát hiện kết quả khớp. Đây không phải secret scan toàn bộ lịch sử hay đánh giá security đầy đủ.
- `.env`, private key/certificate, upload local, cache Expo, log và browser artifacts không được stage. Chỉ `.env.example` thuộc file env được Git quản lý; báo cáo không chứa credentials, endpoint DB thật hoặc dữ liệu người nhận.

## CI và điều kiện tiếp theo

Tài liệu này ghi kết quả local trước push. Workflow hiện có trigger cho push `dev`; cần xem run gắn với **đúng SHA đầu nhánh sau push**, không dùng CI của parent hoặc candidate cũ.

CI cấu hình MySQL 8.0/8.4; browser job phụ thuộc verify. Nếu architecture gate còn fail, SQL tests/build ở các bước sau và browser job có thể chưa được chạy. Không coi việc có runner MySQL là SQL integration đã pass.

Sau push cần ghi nhận trạng thái CI thực tế; không tự merge `main`. Các lỗi build/architecture/tests và finding bảo mật còn mở phải được xử lý, sau đó chạy lại verification và nghiệm thu scope còn thiếu trước release.

## Bằng chứng local

Các log dưới đây được ignore, không publish theo commit:

- `push-dev-root-test-2026-10-20.log`
- `push-dev-api-test-2026-10-20.log`
- `push-dev-build-2026-10-20.log`
- `push-dev-web-lint-2026-10-20.log`
- `push-dev-web-build-2026-10-20.log`
- `push-dev-playwright-2026-10-20.log`
- `push-dev-audit-prod-2026-10-20.log`
- `push-dev-audit-all-2026-10-20.log`
- `push-dev-migration-preflight-2026-10-20.log`
- `push-dev-diagrams-2026-10-20.log`
- `test-results/home/`: ảnh và error context của browser suite.
