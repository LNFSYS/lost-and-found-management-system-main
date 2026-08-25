# Báo cáo cập nhật tài liệu LNFS

Cập nhật: 26/08/2026

## 1. Phạm vi kiểm tra

Đợt cập nhật này làm việc trên repository `fptu-lost-found-system-main` và dùng code/test hiện tại làm nguồn xác minh chính. Không sử dụng repository cũ để nâng trạng thái chức năng.

Các file tài liệu đã kiểm tra:

- `README.md`.
- `docs/README.md`.
- `docs/project-overview.md`.
- `docs/requirements.md`.
- `docs/use-case-checklist.md`.
- `docs/business-rules.md`.
- `docs/traceability-matrix.md`.
- `docs/node-java-service-boundary.md`.
- `apps/java-admin-service/README.md`.

Các nguồn implementation đã đối chiếu:

- React routes/pages/components và Playwright tests trong `apps/web`.
- Node routes/controllers/services/repositories/validators và tests trong `apps/api-node`.
- Node migration files từ `001_auth.sql` đến `038_seed_default_handover_point.sql`.
- Spring Boot source và configuration trong `apps/java-admin-service`.
- Root/package workspace scripts và environment examples.

## 2. File đã sửa

| File | Nội dung thay đổi chính |
| --- | --- |
| `README.md` | Định vị Web + PWA, sửa current implementation, Warehouse và future enhancements |
| `package.json` | Bỏ mô tả Sprint 1 authentication base; dùng mô tả current product scope |
| `docs/README.md` | Snapshot, trạng thái PWA, Warehouse và kết quả test/build mới |
| `docs/project-overview.md` | Current baseline, planned scope, kiến trúc Web/PWA, 9 sprint, 416 man-days, deployment/feedback strategy |
| `docs/requirements.md` | `FR-PWA-01`, `NFR-PWA-01`, status theo code và wording performance có thể kiểm chứng |
| `docs/use-case-checklist.md` | UC-093–UC-100 chuyển từ Mobile sang PWA và tính lại status |
| `docs/business-rules.md` | BR-41 chuyển thành privacy/transaction rule cho PWA |
| `docs/traceability-matrix.md` | Mapping BR-41 → FR-PWA-01 → UC-093–UC-100 và evidence thực tế |
| `docs/node-java-service-boundary.md` | Warehouse hiện do Node sở hữu; Java vẫn chỉ là skeleton |
| `apps/java-admin-service/README.md` | Bỏ wording Sprint 1 và ghi đúng one-writer boundary hiện tại |

## 3. File Report và spreadsheet

Không tìm thấy Report 1, Report 2, Report 3/SRS, Report 4/Design, Report 5/Implementation and Testing, meeting records, DOCX, XLSX, XLS, PDF hoặc thư mục report tương ứng trong workspace. Vì không có source file, đợt cập nhật này không tạo bản thay thế giả và không bịa nội dung/hình ảnh/nguồn tham khảo.

Khi team cung cấp các Report chính thức, cần đồng bộ lại Web + PWA, 9 sprint, 416 man-days, Node/Java ownership, requirement/design/test evidence và release strategy theo bộ Markdown hiện hành.

## 4. Thuật ngữ đã chuẩn hóa

- Product type: **Web Application with Progressive Web App (PWA) support**.
- `MVP` không còn là tên hoặc trạng thái chính thức của current product.
- Native mobile/Expo/React Native chỉ được nhắc như future enhancement.
- AI được mô tả là **Gemini-assisted image/OCR analysis** và **rule-based/hybrid matching**.
- AI/matching là decision support; không tự xác minh quyền sở hữu, accept claim, hoàn tất handover hoặc công khai private evidence.
- Java được mô tả là extension skeleton, không phải production microservice hoặc business owner hiện tại.
- Deployment được mô tả là planned server deployment; repository chưa chứng minh production deployment.

`FR-MOBILE-01` chỉ còn xuất hiện như historical alias của `FR-PWA-01`; tài liệu hiện hành dùng `FR-PWA-01`.

Chuỗi `MVP` còn nằm trong nội dung seed của migration đã phát hành `002_lost_found_schema.sql`. File migration đã chạy không được sửa để tránh checksum mismatch; đây là immutable historical text, không phải product positioning hiện hành.

## 5. Mâu thuẫn đã giải quyết

### Warehouse, Staff và Node/Java

Tài liệu cũ ghi Staff page là placeholder và Warehouse chưa có runtime. Code hiện có:

- `/api/staff/warehouse-items` list/create/update routes với backend role guard `STAFF`/`ADMIN`.
- Warehouse service/repository với transaction, row lock, state transition, retention deadline và storage log.
- Staff warehouse page và Playwright tests cho receive/update/log flow.

Kết luận: Node.js là write owner của Warehouse operations hiện tại. Receive/store/return, retention deadline, handover counts và storage log được xem là implemented trong phạm vi có test. Overdue scanning, disposition guard khi có claim/appointment, donation/transfer/disposal documents vẫn Planned.

Java chỉ có Spring Boot application và Actuator health. Không có Java business controller, shared JWT test, schema writer hoặc Node-to-Java integration.

### PWA

Code có responsive layouts, file selection/upload và mobile viewport browser tests. Repository không có web app manifest, service worker, install prompt, offline application shell hoặc offline transaction controls.

Kết luận: `FR-PWA-01` là `Partial`; không UC PWA nào được đánh dấu Done. UC-093–UC-097 là Partial, UC-098–UC-100 là Planned.

### Use-case status

Checklist sau cập nhật có **42 Done, 7 Partial, 51 Planned, 0 Deferred**, tổng 100 UC duy nhất từ UC-001 đến UC-100.

## 6. Kế hoạch và effort

- 9 sprint từ 01/08/2026 đến 13/12/2026, không chồng ngày.
- Planned effort: 416 man-days.
- Planning envelope: 456 man-days.
- Reserve: 40 man-days.
- Milestone Timeliness Target: 95%.
- Allocation: 48 + 52 + 190 + 56 + 36 + 34 = 416 man-days.
- Top-level WBS: 20 + 40 + 64 + 80 + 80 + 28 + 20 + 84 = 416 man-days.

Jira không có connector trong phiên làm việc này. Vì vậy lịch sử Done, assignee và ticket Sprint 1–3 chưa được đối chiếu với Jira; tài liệu không tự thay đổi lịch sử ticket.

## 7. Verification đã chạy

| Command/check | Kết quả |
| --- | --- |
| `npm test` | Pass: 47 API tests; 1 DB integration test safety-skip; web TypeScript check pass |
| `npm run build` | Pass: API TypeScript build và web Vite production build |
| `npm --workspace @lnfs/web run e2e:home` | Pass: 14/14 Playwright tests |
| `npm run build:java` | Không chạy được vì `mvn` không có trong `PATH`; không kết luận source Java lỗi |
| UC ID/count check | 100 ID duy nhất, UC-001–UC-100; status total = 100 |
| Markdown link check | Pass; không có relative link hỏng |
| Evidence basename check | Pass; các file code/test được dẫn bằng tên trong docs đều tồn tại |
| Requirement traceability check | Pass; mọi FR/NFR hiện hành có mapping hoặc historical alias rõ ràng |
| Legacy-term scan | Pass; chỉ còn immutable migration text, historical alias và explicit future enhancement đã được phân loại |

Không chạy migration hoặc destructive database test. Shared Aiven database không bị sử dụng trong đợt cập nhật tài liệu này.

## 8. TBD và nội dung cần team xác nhận

- Cung cấp Report 1–5 và meeting spreadsheet để đồng bộ trực tiếp.
- Xác nhận Jira sprint history, assignee và ticket chưa Done trong Sprint 3.
- Chốt server/platform deployment, shared media storage và rollback procedure.
- Triển khai và kiểm tra PWA manifest, service worker, installability, offline/error fallback và browser/device matrix.
- Chạy DB integration suite trên MySQL local riêng có hậu tố `_test`; không dùng Aiven/shared DB.
- Cài Maven để xác minh Java build.
- Xác nhận camera/file capture trên thiết bị mobile thật.
- Bổ sung CI/CD và deployment evidence trước khi mô tả hệ thống là deployable release đã triển khai.

## 9. Quy tắc cập nhật tiếp theo

Một trạng thái chỉ được nâng thành Done/Implemented khi có runtime implementation, authorization/validation phù hợp, test hoặc bằng chứng tái lập được và traceability đồng bộ. Migration, roadmap, Jira ticket hoặc nội dung Report không tự tạo thành implementation evidence.
