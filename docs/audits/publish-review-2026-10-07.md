# Rà soát trước publish dev-clean - 07/10/2026

Receipt kiểm tra local trước đợt commit/push ngày 07/10. Trạng thái head, merge candidate và CI mới theo [PR dev-clean vào main](https://github.com/LNFSYS/lost-and-found-management-system-main/pull/82), không dùng CI của head `6296694` để chứng nhận thay đổi mới. Không tự merge hoặc chứng nhận production từ receipt local.

## Phạm vi

- Matching: popup sau tạo bài khi chưa có gợi ý đạt 60%; thông báo cả hai chủ bài khác nhau, outbox transactional/dedupe và kiểm tra bài còn mở trước SMTP. Đọc GET không tạo thư. [Policy và giới hạn](../workflows/matching-notification-rules.md).
- Thông báo: menu chuông, toast và trang thông báo dùng chung resolver nội bộ; mở matching/post/claim/appointment/custody đúng đích, không chờ acknowledgement đánh dấu đã đọc. Menu mobile không bị cắt mép.
- Lịch hẹn: ảnh ITEM công khai qua endpoint media, thẻ có ngày giờ/địa điểm/trạng thái và detail/zoom có hỗ trợ bàn phím. Không đưa ảnh evidence riêng tư vào thumbnail hoặc thay đổi các gate bàn giao. [Runbook](../runbooks/appointment-journey-rollout.md).
- Không thêm migration hoặc ghi Aiven. 063 đã áp dụng theo receipt lịch sử, không replay. Các giới hạn 053/055 giữ nguyên.

## Privacy và file publish

- Kiểm tra 492 file tracked/candidate và 743 blob khác nhau trong các snapshot của 23 commit riêng nhánh trước đợt publish. Không có `.env` thật, upload, backup, certificate private key, generated dist hoặc test-results trong danh sách tracked/candidate. `.env.example` được giữ làm template, địa chỉ SMTP mẫu đổi sang miền `example.invalid`; không thay cấu hình `.env` thật.
- Rà bổ sung đường dẫn máy cá nhân, email không phải fixture, database hostname thật, credential URL, JWT/provider tokens, signed URL và định danh UAT trong tài liệu. Ba tiền tố hồ sơ UAT còn sót được thay bằng mô tả chung; receipt đối chiếu cụ thể giữ ngoài Git. Không xóa dữ liệu nghiệp vụ hoặc bỏ bằng chứng audit cần thiết.
- Gitleaks **8.30.1**, archive chính thức được đối chiếu SHA256: scan diff lịch sử 23 commit riêng nhánh không phát hiện secret. Scan toàn bộ 141 commit reachable tại head trước publish báo hai cảnh báo `generic-api-key`; đối chiếu cả hai là false positive: idempotency key cố định trong test và câu mô tả MIME/signature/size validation trong checklist cũ. Không dùng broad allowlist/baseline để che cảnh báo.
- Scan staged cho từng nhóm code và tài liệu không phát hiện secret. Báo cáo scanner và helper cô lập nằm trong ignored test-results, không publish. Git Author/Committer là metadata attribution, không phải credential; không thay author các commit có sẵn.
- Redaction mới không xóa nội dung đã có trong commit cũ. Các tiền tố UAT đã public trong snapshot trước vẫn có thể xem qua history; không gọi toàn bộ history là đã được xóa sạch. Nhánh `dev` cũ và lịch sử `main` không bị rewrite/force-push trong đợt này. Nếu cần gỡ dữ liệu khỏi history, đó là recovery riêng có phối hợp chủ repo.

## Verification Local

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| `npm test` bình thường | 445 tests: 413 pass, 0 fail, 32 opt-in SQL skips; process tự kết thúc, không force-exit |
| Architecture và Web typecheck | 204 production files, 0 violations; typecheck pass |
| `npm run build` | API/Web pass trên code cuối của đợt UI trước publish |
| Full Playwright | 137/137 pass, 2 workers, không skip; gồm matching popup, notification navigation, appointment images và các regression cũ |
| Native SQL focused | 20/20 pass, 0 skip: matching-email integration và appointment integration; MySQL 9.3 loopback UTC, DB cô lập được dừng sau kiểm tra |
| `npm audit --omit=dev` | 0 vulnerabilities |
| UC catalogue | 168 = 129 Implemented + 21 Partial + 18 Planned; UC-097 Partial, không thêm UC hoặc nâng trạng thái bằng tests |
| Liên kết tài liệu | 37 Markdown files, 372 local links; hậu tố source line đổi sang `#L` để mở trên GitHub, không còn local path thiếu |

SQL focused không thay thế toàn bộ SQL suite hoặc CI MySQL 8.0/8.4. Transport matching trong integration là bộ ghi nhận kiểm thử, không phải chứng nhận Gmail nhận thư. Browser sử dụng route fixtures và ảnh synthetic, không phải UAT provider thật. Giữ nguyên API/Vite đang phục vụ người dùng.

## Follow-up lỗi browser CI

- [Run thất bại](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37572759747) kiểm tra head `6a87f51`, PR merge candidate `0d66f86`. MySQL 8.0/8.4 pass; browser 136 pass và 1 fail: vị trí upload FOUND ở 1440px bị topbar che. Đây là bằng chứng CI cũ, không được đánh dấu toàn bộ CI xanh.
- Code cuộn ép `smooth` dù người dùng bật giảm chuyển động, nhắm đầu section mà không trừ topbar; timer cuộn cũ không bị hủy. Test còn chỉnh vị trí cuộn trực tiếp trong lúc hiệu ứng/timer ứng dụng có thể đang chạy. Test cũ vẫn pass 12/12 lượt local Chromium trước sửa, nên một lần pass local không đủ loại trừ race trên CI.
- Sửa cuộn về đầu form thực tế, chừa khoảng với topbar theo chiều cao hiện tại, dùng layout offset không phụ thuộc transform đang animate. Tôn trọng reduced motion cho cuộn và Motion; hủy timer khi đổi/reset workflow hoặc unmount, kiểm tra generation trước khi cuộn.
- Giữ nguyên các assertion hình ảnh của test cũ. Thêm 8 ca LOST/FOUND, desktop/mobile, chuyển động thường/giảm chuyển động: quan sát nhiều frame sau thao tác chọn thật, không tự chỉnh scroll; form phải ổn định, không bị topbar che và hai thao tác ảnh nằm trong viewport. Không buộc khoảng cách đúng một số pixel khi font/layout đổi nhưng nội dung vẫn không bị che.
- Không thay đổi workflow CI, thêm retry, tăng timeout, skip hoặc force-exit để xử lý lỗi này. Không thêm migration, UC hoặc nâng trạng thái nghiệm thu. Kết quả CI mới và exact candidate tiếp tục được cập nhật trong PR; các gate inbox/bàn giao thật bên dưới vẫn còn nguyên.

Candidate trung gian `ed24145`: local full Playwright **145/145 pass**; [CI](https://github.com/LNFSYS/lost-and-found-management-system-main/actions/runs/37575573453) xanh MySQL 8.0/8.4 và browser trên PR merge candidate `b66d4ab`. Tuy nhiên chạy lặp bổ sung vẫn bắt một trường hợp layout đổi khi font tải xong làm header form mobile bị che. Không dùng một lần full pass hoặc CI này để chứng nhận bản sửa font tiếp theo.

Bổ sung chờ `document.fonts.ready` trước khi ứng dụng đo và cuộn; generation riêng chặn cả callback đang chờ font khi đổi/reset luồng hoặc rời trang. Các test đo hình học cũng chờ font thật, dùng ngưỡng không bị che và kiểm tra ổn định qua nhiều frame thay vì buộc padding đúng một giá trị pixel. Thêm một regression font đang chờ rồi rời trang, không được cuộn trang mới. Focused **104/104 lượt pass** (13 ca x 8 lần, 2 workers), không retry/skip. Các giới hạn test fixture, SQL local trước đó và nghiệm thu deployment vẫn áp dụng; CI của candidate cuối tiếp tục theo PR.

Verification local của bản sửa font cuối: `npm test` 413 pass / 0 fail / 32 opt-in SQL skips (445 tests), architecture 204 files / 0 violations và Web typecheck pass; API/Web build pass; full Playwright **146/146 pass** bằng bundled Chromium với `CI=true`, 2 workers / 0 skip; production audit 0 vulnerabilities; UC không đổi (168), 37 tài liệu / 372 local links không lỗi. Không dùng các SQL skip local để thay thế MySQL 8.0/8.4 trên candidate CI cuối.

## Gate trước merge/deploy

- CI phải chạy trên head/PR merge candidate mới, gồm MySQL 8.0/8.4 và browser; link/status trong PR, không tái dùng receipt của candidate cũ. Không tự merge.
- Matching producer mới yêu cầu drain worker cũ trước rollout worker có template `MATCH`. Kiểm tra lượng cặp lịch sử chưa notified và tốc độ worker; không sửa marker/ledger để che lịch sử.
- Còn nghiệm thu inbox/spam và authenticated link của email matching, reminder; bàn giao vật lý thật; deployment/load/failover/privacy/accessibility sâu. SMTP acknowledgement hoặc automated tests không hoàn tất các gate này.
