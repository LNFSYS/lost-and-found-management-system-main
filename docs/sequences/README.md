# Sequence Diagrams 3.1–3.17

Bộ sơ đồ đối chiếu [uc.md](../requirements/uc.md) và source hiện tại, cập nhật **09/10/2026**.
Snapshot source/catalogue được đối chiếu: `28067d34901fbf5788faf3b7dc7d66f1689ef05d`.
Khi code hoặc catalogue thay đổi sau snapshot này, cần đối chiếu và cập nhật lại sơ đồ tương ứng.
Có **167 UC nghiệp vụ: 129 Implemented, 20 Partial, 18 Planned**, mỗi UC một nguồn
PlantUML `.puml` và một ảnh `.png`. Phân nhóm thư mục theo phân công vẽ của bạn:

| Thư mục | Thành viên | Nhóm mục | Số sơ đồ |
| --- | --- | --- | ---: |
| [Dat/](Dat/README.md) | Đạt | 3.1–3.4 | 34 |
| [Tran-The-Luong/](Tran-The-Luong/README.md) | Trần Thế Lượng | 3.5–3.8 | 58 |
| [Khoa/](Khoa/README.md) | Khoa | 3.9–3.12 | 40 |
| [Q/](Q/README.md) | Q | 3.13–3.17 | 35 |

**Lưu ý số mục:** `3.1` trong catalogue là Historical Source-Control Ownership Audit,
không có UC nghiệp vụ để vẽ sequence. [Dat/3.1](Dat/3.1/README.md) giải thích phạm vi này.
UC-168 ở mục `3.18` nằm ngoài yêu cầu `3.1–3.17`. Vì vậy bộ này có 167, không phải 168 sơ đồ.
Tên thư mục là **phân công chuẩn bị sơ đồ**, không thay đổi attribution Git hay chứng minh
thành viên đó đã triển khai tất cả UC trong nhóm.

## Quy Ước

- Giữ nền trắng, nét đen, khung chữ nhật, Arial, lifeline và activation bars theo mẫu đã duyệt.
- Mỗi UC độc lập, có tên và số theo đúng thứ tự dòng trong catalogue; không đánh lại UC ID.
  Mục `3.13` là moderation/report; dashboard/statistics/audit là `3.14`.
- Chỉ **một entity chính** ở cuối, đúng tên bảng trong migration. Các join, provider, bảng phụ,
  transaction và audit được tóm tắt ở Service; không có nghĩa backend chỉ sử dụng một bảng.
- Luồng chính dùng `1, 2, 3...`. Nhánh thay thế sau bước `N` bắt đầu `(N+1).1`,
  rồi `(N+1).2...`. Ví dụ sau bước 8: success là 9, alternative là 9.1, không phải 8.1.
  Các nhánh else cùng alt tiếp tục hậu tố để không trùng số.
- Message call là nét liền; return là nét đứt. Scheduler/system dùng task/service/entity thật,
  không dựng UI hoặc HTTP cho tác vụ nền.
- `Partial` ghi rõ **phần đang chạy** hoặc **thiết kế đề xuất** và phần còn thiếu.
  Không coi custody review là general escalation, polling là immediate SSE,
  hay Staff reserve là Finder peer reservation.
- Cả 18 UC `Planned` ghi **Proposed design**. Bảng có nhãn `proposed entity` là đề xuất,
  chưa có migration/runtime. Bảng đã có không chứng minh workflow đề xuất đã triển khai.
  Không tự thêm endpoint, migration hoặc nâng trạng thái catalogue.
- Chấp nhận trao đổi/photo approval không xác minh quyền sở hữu. Intake không biến Staff
  thành Finder và không tự accept claim. Trả đồ vẫn giữ gate recipient, proof, dispute/hold;
  trả trực tiếp cần hai xác nhận vật lý hợp lệ.
- Upload chưa xác định kết quả DB giữ asset để đối soát; không mô tả xóa ảnh mù quáng.
  Queue email không đồng nghĩa đã đến inbox.
- `Implemented` là trạng thái catalogue, không chứng nhận CI, deployment hay manual UAT.
  Công việc này chỉ tạo tài liệu/ảnh; không thay code ứng dụng, DB hoặc rollout.

## Mục Lục

## Đạt

### 3.1 Historical Source-Control Ownership Audit

Không có UC nghiệp vụ; xem [ghi chú](Dat/3.1/README.md).

### 3.2 Authentication & Authorization

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.2.1 / UC-001 | Request registration OTP | Implemented | `email_otps` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.1_UC-001_request-registration-otp.png) · [Nguồn](Dat/3.2/3.2.1_UC-001_request-registration-otp.puml) |
| 3.2.2 / UC-002 | Register an account | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.2_UC-002_register-an-account.png) · [Nguồn](Dat/3.2/3.2.2_UC-002_register-an-account.puml) |
| 3.2.3 / UC-003 | Log in with email and password | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.3_UC-003_log-in-with-email-and-password.png) · [Nguồn](Dat/3.2/3.2.3_UC-003_log-in-with-email-and-password.puml) |
| 3.2.4 / UC-004 | Refresh the login session | Implemented | `refresh_tokens` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.4_UC-004_refresh-the-login-session.png) · [Nguồn](Dat/3.2/3.2.4_UC-004_refresh-the-login-session.puml) |
| 3.2.5 / UC-005 | Log out | Implemented | `refresh_tokens` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.5_UC-005_log-out.png) · [Nguồn](Dat/3.2/3.2.5_UC-005_log-out.puml) |
| 3.2.6 / UC-006 | Request password reset | Implemented | `password_reset_tokens` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.6_UC-006_request-password-reset.png) · [Nguồn](Dat/3.2/3.2.6_UC-006_request-password-reset.puml) |
| 3.2.7 / UC-007 | Reset password | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.7_UC-007_reset-password.png) · [Nguồn](Dat/3.2/3.2.7_UC-007_reset-password.puml) |
| 3.2.8 / UC-008 | View current account | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.8_UC-008_view-current-account.png) · [Nguồn](Dat/3.2/3.2.8_UC-008_view-current-account.puml) |
| 3.2.9 / UC-009 | Update personal profile | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.9_UC-009_update-personal-profile.png) · [Nguồn](Dat/3.2/3.2.9_UC-009_update-personal-profile.puml) |
| 3.2.10 / UC-010 | Update profile avatar | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.10_UC-010_update-profile-avatar.png) · [Nguồn](Dat/3.2/3.2.10_UC-010_update-profile-avatar.puml) |
| 3.2.11 / UC-011 | View protected profile avatar | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.11_UC-011_view-protected-profile-avatar.png) · [Nguồn](Dat/3.2/3.2.11_UC-011_view-protected-profile-avatar.puml) |
| 3.2.12 / UC-012 | View personal activity and reputation | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Dat/3.2/3.2.12_UC-012_view-personal-activity-and-reputation.png) · [Nguồn](Dat/3.2/3.2.12_UC-012_view-personal-activity-and-reputation.puml) |

### 3.3 Public Board & LOST/FOUND Post Management

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.3.1 / UC-013 | Browse the LOST/FOUND board | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.1_UC-013_browse-the-lost-found-board.png) · [Nguồn](Dat/3.3/3.3.1_UC-013_browse-the-lost-found-board.puml) |
| 3.3.2 / UC-014 | Search and filter posts | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.2_UC-014_search-and-filter-posts.png) · [Nguồn](Dat/3.3/3.3.2_UC-014_search-and-filter-posts.puml) |
| 3.3.3 / UC-015 | View post details | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.3_UC-015_view-post-details.png) · [Nguồn](Dat/3.3/3.3.3_UC-015_view-post-details.puml) |
| 3.3.4 / UC-016 | View post form reference data | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.4_UC-016_view-post-form-reference-data.png) · [Nguồn](Dat/3.3/3.3.4_UC-016_view-post-form-reference-data.puml) |
| 3.3.5 / UC-018 | Create a LOST post | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.5_UC-018_create-a-lost-post.png) · [Nguồn](Dat/3.3/3.3.5_UC-018_create-a-lost-post.puml) |
| 3.3.6 / UC-019 | Create a FOUND post | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.6_UC-019_create-a-found-post.png) · [Nguồn](Dat/3.3/3.3.6_UC-019_create-a-found-post.puml) |
| 3.3.7 / UC-020 | View my posts | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.7_UC-020_view-my-posts.png) · [Nguồn](Dat/3.3/3.3.7_UC-020_view-my-posts.puml) |
| 3.3.8 / UC-021 | Update my post | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.8_UC-021_update-my-post.png) · [Nguồn](Dat/3.3/3.3.8_UC-021_update-my-post.puml) |
| 3.3.9 / UC-022 | Close or remove my post | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.9_UC-022_close-or-remove-my-post.png) · [Nguồn](Dat/3.3/3.3.9_UC-022_close-or-remove-my-post.puml) |
| 3.3.10 / UC-023 | Upload post image | Implemented | `post_media` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.10_UC-023_upload-post-image.png) · [Nguồn](Dat/3.3/3.3.10_UC-023_upload-post-image.puml) |
| 3.3.11 / UC-024 | View protected post media | Implemented | `post_media` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.11_UC-024_view-protected-post-media.png) · [Nguồn](Dat/3.3/3.3.11_UC-024_view-protected-post-media.puml) |
| 3.3.12 / UC-025 | Delete post image | Implemented | `post_media` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.3/3.3.12_UC-025_delete-post-image.png) · [Nguồn](Dat/3.3/3.3.12_UC-025_delete-post-image.puml) |

### 3.4 Matching & Recommendations

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.4.1 / UC-026 | View matching suggestions | Implemented | `match_results` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.1_UC-026_view-matching-suggestions.png) · [Nguồn](Dat/3.4/3.4.1_UC-026_view-matching-suggestions.puml) |
| 3.4.2 / UC-027 | Recalculate matching suggestions | Implemented | `match_results` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.2_UC-027_recalculate-matching-suggestions.png) · [Nguồn](Dat/3.4/3.4.2_UC-027_recalculate-matching-suggestions.puml) |
| 3.4.3 / UC-028 | View matching explanation | Implemented | `match_results` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.3_UC-028_view-matching-explanation.png) · [Nguồn](Dat/3.4/3.4.3_UC-028_view-matching-explanation.puml) |
| 3.4.4 / UC-029 | Generate matches after post changes | Implemented | `match_results` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.4_UC-029_generate-matches-after-post-changes.png) · [Nguồn](Dat/3.4/3.4.4_UC-029_generate-matches-after-post-changes.puml) |
| 3.4.5 / UC-030 | Calculate matching score | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.5_UC-030_calculate-matching-score.png) · [Nguồn](Dat/3.4/3.4.5_UC-030_calculate-matching-score.puml) |
| 3.4.6 / UC-031 | Store active match results | Implemented | `match_results` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.6_UC-031_store-active-match-results.png) · [Nguồn](Dat/3.4/3.4.6_UC-031_store-active-match-results.puml) |
| 3.4.7 / UC-097 | Notify owner about a new match | Partial · Phần đang chạy | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Dat/3.4/3.4.7_UC-097_notify-owner-about-a-new-match.png) · [Nguồn](Dat/3.4/3.4.7_UC-097_notify-owner-about-a-new-match.puml) |
| 3.4.8 / UC-098 | Dismiss a match suggestion | Implemented | `match_suggestion_dismissals` | [054](../../apps/api-node/src/migrations/054_matching_feedback_periodic_refresh.sql) | [PNG](Dat/3.4/3.4.8_UC-098_dismiss-a-match-suggestion.png) · [Nguồn](Dat/3.4/3.4.8_UC-098_dismiss-a-match-suggestion.puml) |
| 3.4.9 / UC-099 | Submit match feedback | Implemented | `match_feedback` | [016](../../apps/api-node/src/migrations/016_ai_training_feedback.sql) | [PNG](Dat/3.4/3.4.9_UC-099_submit-match-feedback.png) · [Nguồn](Dat/3.4/3.4.9_UC-099_submit-match-feedback.puml) |
| 3.4.10 / UC-100 | Refresh matches periodically | Implemented | `matching_jobs` | [020](../../apps/api-node/src/migrations/020_matching_jobs.sql) | [PNG](Dat/3.4/3.4.10_UC-100_refresh-matches-periodically.png) · [Nguồn](Dat/3.4/3.4.10_UC-100_refresh-matches-periodically.puml) |

## Trần Thế Lượng

### 3.5 Matching Model & AI Operations

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.5.1 / UC-017 | Analyze item images with Gemini | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.5/3.5.1_UC-017_analyze-item-images-with-gemini.png) · [Nguồn](Tran-The-Luong/3.5/3.5.1_UC-017_analyze-item-images-with-gemini.puml) |
| 3.5.2 / UC-101 | Collect eligible matching examples | Planned · Đề xuất | `matching_training_examples` | Chưa có; entity đề xuất | [PNG](Tran-The-Luong/3.5/3.5.2_UC-101_collect-eligible-matching-examples.png) · [Nguồn](Tran-The-Luong/3.5/3.5.2_UC-101_collect-eligible-matching-examples.puml) |
| 3.5.3 / UC-102 | Label matching outcomes | Planned · Đề xuất | `matching_training_examples` | Chưa có; entity đề xuất | [PNG](Tran-The-Luong/3.5/3.5.3_UC-102_label-matching-outcomes.png) · [Nguồn](Tran-The-Luong/3.5/3.5.3_UC-102_label-matching-outcomes.puml) |
| 3.5.4 / UC-103 | Anonymize matching training data | Planned · Đề xuất | `matching_training_examples` | Chưa có; entity đề xuất | [PNG](Tran-The-Luong/3.5/3.5.4_UC-103_anonymize-matching-training-data.png) · [Nguồn](Tran-The-Luong/3.5/3.5.4_UC-103_anonymize-matching-training-data.puml) |
| 3.5.5 / UC-104 | Train a custom matching model | Planned · Đề xuất | `matching_model_jobs` | Chưa có; entity đề xuất | [PNG](Tran-The-Luong/3.5/3.5.5_UC-104_train-a-custom-matching-model.png) · [Nguồn](Tran-The-Luong/3.5/3.5.5_UC-104_train-a-custom-matching-model.puml) |
| 3.5.6 / UC-105 | Evaluate and version a matching model | Planned · Đề xuất | `matching_model_versions` | Chưa có; entity đề xuất | [PNG](Tran-The-Luong/3.5/3.5.6_UC-105_evaluate-and-version-a-matching-model.png) · [Nguồn](Tran-The-Luong/3.5/3.5.6_UC-105_evaluate-and-version-a-matching-model.puml) |

### 3.6 Claims & Ownership Verification

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.6.1 / UC-032 | View my claim requests | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.1_UC-032_view-my-claim-requests.png) · [Nguồn](Tran-The-Luong/3.6/3.6.1_UC-032_view-my-claim-requests.puml) |
| 3.6.2 / UC-033 | View claim request details | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.2_UC-033_view-claim-request-details.png) · [Nguồn](Tran-The-Luong/3.6/3.6.2_UC-033_view-claim-request-details.puml) |
| 3.6.3 / UC-034 | Create a claim request | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.3_UC-034_create-a-claim-request.png) · [Nguồn](Tran-The-Luong/3.6/3.6.3_UC-034_create-a-claim-request.puml) |
| 3.6.4 / UC-035 | Accept a claim request | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.4_UC-035_accept-a-claim-request.png) · [Nguồn](Tran-The-Luong/3.6/3.6.4_UC-035_accept-a-claim-request.puml) |
| 3.6.5 / UC-036 | Request more claim information | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.5_UC-036_request-more-claim-information.png) · [Nguồn](Tran-The-Luong/3.6/3.6.5_UC-036_request-more-claim-information.puml) |
| 3.6.6 / UC-037 | Decline a claim request | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.6_UC-037_decline-a-claim-request.png) · [Nguồn](Tran-The-Luong/3.6/3.6.6_UC-037_decline-a-claim-request.puml) |
| 3.6.7 / UC-038 | Withdraw a claim request | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.7_UC-038_withdraw-a-claim-request.png) · [Nguồn](Tran-The-Luong/3.6/3.6.7_UC-038_withdraw-a-claim-request.puml) |
| 3.6.8 / UC-039 | View private claim rooms | Implemented | `chat_rooms` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.8_UC-039_view-private-claim-rooms.png) · [Nguồn](Tran-The-Luong/3.6/3.6.8_UC-039_view-private-claim-rooms.puml) |
| 3.6.9 / UC-040 | Open a private claim room | Implemented | `chat_rooms` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.9_UC-040_open-a-private-claim-room.png) · [Nguồn](Tran-The-Luong/3.6/3.6.9_UC-040_open-a-private-claim-room.puml) |
| 3.6.10 / UC-106 | View guided verification questions | Implemented | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.10_UC-106_view-guided-verification-questions.png) · [Nguồn](Tran-The-Luong/3.6/3.6.10_UC-106_view-guided-verification-questions.puml) |
| 3.6.11 / UC-107 | Ask a guided verification question | Implemented | `item_verification_questions` | [029](../../apps/api-node/src/migrations/029_ai_verification_questions.sql) | [PNG](Tran-The-Luong/3.6/3.6.11_UC-107_ask-a-guided-verification-question.png) · [Nguồn](Tran-The-Luong/3.6/3.6.11_UC-107_ask-a-guided-verification-question.puml) |
| 3.6.12 / UC-108 | Answer a guided verification question | Implemented | `claim_verification_answers` | [029](../../apps/api-node/src/migrations/029_ai_verification_questions.sql) | [PNG](Tran-The-Luong/3.6/3.6.12_UC-108_answer-a-guided-verification-question.png) · [Nguồn](Tran-The-Luong/3.6/3.6.12_UC-108_answer-a-guided-verification-question.puml) |
| 3.6.13 / UC-109 | Review private claim evidence | Implemented | `claim_evidence` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.13_UC-109_review-private-claim-evidence.png) · [Nguồn](Tran-The-Luong/3.6/3.6.13_UC-109_review-private-claim-evidence.puml) |
| 3.6.14 / UC-110 | Calculate verification confidence | Planned · Đề xuất | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.14_UC-110_calculate-verification-confidence.png) · [Nguồn](Tran-The-Luong/3.6/3.6.14_UC-110_calculate-verification-confidence.puml) |
| 3.6.15 / UC-111 | Escalate a claim for staff support | Partial · Phần đang chạy | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Tran-The-Luong/3.6/3.6.15_UC-111_escalate-a-claim-for-staff-support.png) · [Nguồn](Tran-The-Luong/3.6/3.6.15_UC-111_escalate-a-claim-for-staff-support.puml) |
| 3.6.16 / UC-112 | List escalated claims | Planned · Đề xuất | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.16_UC-112_list-escalated-claims.png) · [Nguồn](Tran-The-Luong/3.6/3.6.16_UC-112_list-escalated-claims.puml) |
| 3.6.17 / UC-113 | View an escalated claim | Partial · Phần đang chạy | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.17_UC-113_view-an-escalated-claim.png) · [Nguồn](Tran-The-Luong/3.6/3.6.17_UC-113_view-an-escalated-claim.puml) |
| 3.6.18 / UC-114 | Record an escalation decision | Partial · Phần đang chạy | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.18_UC-114_record-an-escalation-decision.png) · [Nguồn](Tran-The-Luong/3.6/3.6.18_UC-114_record-an-escalation-decision.puml) |
| 3.6.19 / UC-115 | View claimants for a found item | Partial · Phần đang chạy | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.19_UC-115_view-claimants-for-a-found-item.png) · [Nguồn](Tran-The-Luong/3.6/3.6.19_UC-115_view-claimants-for-a-found-item.puml) |
| 3.6.20 / UC-116 | Compare claimant verification results | Partial · Phần đang chạy | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.20_UC-116_compare-claimant-verification-results.png) · [Nguồn](Tran-The-Luong/3.6/3.6.20_UC-116_compare-claimant-verification-results.puml) |
| 3.6.21 / UC-117 | Reserve an item for one claimant | Planned · Đề xuất | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.21_UC-117_reserve-an-item-for-one-claimant.png) · [Nguồn](Tran-The-Luong/3.6/3.6.21_UC-117_reserve-an-item-for-one-claimant.puml) |
| 3.6.22 / UC-118 | Release reservation and reopen another claim | Planned · Đề xuất | `claims` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.6/3.6.22_UC-118_release-reservation-and-reopen-another-claim.png) · [Nguồn](Tran-The-Luong/3.6/3.6.22_UC-118_release-reservation-and-reopen-another-claim.puml) |

### 3.7 Private Communication, Evidence & Notifications

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.7.1 / UC-041 | View direct messages | Implemented | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.1_UC-041_view-direct-messages.png) · [Nguồn](Tran-The-Luong/3.7/3.7.1_UC-041_view-direct-messages.puml) |
| 3.7.2 / UC-042 | Send a direct message | Implemented | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.2_UC-042_send-a-direct-message.png) · [Nguồn](Tran-The-Luong/3.7/3.7.2_UC-042_send-a-direct-message.puml) |
| 3.7.3 / UC-043 | View claim evidence | Implemented | `claim_evidence` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.3_UC-043_view-claim-evidence.png) · [Nguồn](Tran-The-Luong/3.7/3.7.3_UC-043_view-claim-evidence.puml) |
| 3.7.4 / UC-044 | Upload claim evidence | Implemented | `claim_evidence` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.4_UC-044_upload-claim-evidence.png) · [Nguồn](Tran-The-Luong/3.7/3.7.4_UC-044_upload-claim-evidence.puml) |
| 3.7.5 / UC-045 | View protected claim evidence | Implemented | `claim_evidence` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.5_UC-045_view-protected-claim-evidence.png) · [Nguồn](Tran-The-Luong/3.7/3.7.5_UC-045_view-protected-claim-evidence.puml) |
| 3.7.6 / UC-046 | View notifications | Implemented | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.6_UC-046_view-notifications.png) · [Nguồn](Tran-The-Luong/3.7/3.7.6_UC-046_view-notifications.puml) |
| 3.7.7 / UC-047 | Mark a notification as read | Implemented | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.7_UC-047_mark-a-notification-as-read.png) · [Nguồn](Tran-The-Luong/3.7/3.7.7_UC-047_mark-a-notification-as-read.puml) |
| 3.7.8 / UC-048 | Mark all notifications as read | Implemented | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.8_UC-048_mark-all-notifications-as-read.png) · [Nguồn](Tran-The-Luong/3.7/3.7.8_UC-048_mark-all-notifications-as-read.puml) |
| 3.7.9 / UC-119 | Receive new private messages immediately | Partial · Phần đang chạy | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.9_UC-119_receive-new-private-messages-immediately.png) · [Nguồn](Tran-The-Luong/3.7/3.7.9_UC-119_receive-new-private-messages-immediately.puml) |
| 3.7.10 / UC-120 | Send an image in a private conversation | Implemented | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.10_UC-120_send-an-image-in-a-private-conversation.png) · [Nguồn](Tran-The-Luong/3.7/3.7.10_UC-120_send-an-image-in-a-private-conversation.puml) |
| 3.7.11 / UC-121 | View unread conversation count | Implemented | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.11_UC-121_view-unread-conversation-count.png) · [Nguồn](Tran-The-Luong/3.7/3.7.11_UC-121_view-unread-conversation-count.puml) |
| 3.7.12 / UC-122 | Mark a conversation as read | Implemented | `chat_messages` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.12_UC-122_mark-a-conversation-as-read.png) · [Nguồn](Tran-The-Luong/3.7/3.7.12_UC-122_mark-a-conversation-as-read.puml) |
| 3.7.13 / UC-123 | Receive claim status notifications | Partial · Phần đang chạy | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.13_UC-123_receive-claim-status-notifications.png) · [Nguồn](Tran-The-Luong/3.7/3.7.13_UC-123_receive-claim-status-notifications.puml) |
| 3.7.14 / UC-124 | Receive new-message notifications | Implemented | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.14_UC-124_receive-new-message-notifications.png) · [Nguồn](Tran-The-Luong/3.7/3.7.14_UC-124_receive-new-message-notifications.puml) |
| 3.7.15 / UC-125 | Receive appointment and handover notifications | Partial · Phần đang chạy | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.7/3.7.15_UC-125_receive-appointment-and-handover-notifications.png) · [Nguồn](Tran-The-Luong/3.7/3.7.15_UC-125_receive-appointment-and-handover-notifications.puml) |

### 3.8 Handover, Appointment & Direct Return

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.8.1 / UC-126 | List my appointments | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.1_UC-126_list-my-appointments.png) · [Nguồn](Tran-The-Luong/3.8/3.8.1_UC-126_list-my-appointments.puml) |
| 3.8.2 / UC-127 | View appointment detail | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.2_UC-127_view-appointment-detail.png) · [Nguồn](Tran-The-Luong/3.8/3.8.2_UC-127_view-appointment-detail.puml) |
| 3.8.3 / UC-128 | Propose a meetup appointment | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.3_UC-128_propose-a-meetup-appointment.png) · [Nguồn](Tran-The-Luong/3.8/3.8.3_UC-128_propose-a-meetup-appointment.puml) |
| 3.8.4 / UC-129 | Counter-propose an appointment | Planned · Đề xuất | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.4_UC-129_counter-propose-an-appointment.png) · [Nguồn](Tran-The-Luong/3.8/3.8.4_UC-129_counter-propose-an-appointment.puml) |
| 3.8.5 / UC-130 | Accept an appointment proposal | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.5_UC-130_accept-an-appointment-proposal.png) · [Nguồn](Tran-The-Luong/3.8/3.8.5_UC-130_accept-an-appointment-proposal.puml) |
| 3.8.6 / UC-131 | Decline an appointment proposal | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.6_UC-131_decline-an-appointment-proposal.png) · [Nguồn](Tran-The-Luong/3.8/3.8.6_UC-131_decline-an-appointment-proposal.puml) |
| 3.8.7 / UC-132 | Reschedule a confirmed appointment | Planned · Đề xuất | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.7_UC-132_reschedule-a-confirmed-appointment.png) · [Nguồn](Tran-The-Luong/3.8/3.8.7_UC-132_reschedule-a-confirmed-appointment.puml) |
| 3.8.8 / UC-133 | Cancel an appointment | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.8_UC-133_cancel-an-appointment.png) · [Nguồn](Tran-The-Luong/3.8/3.8.8_UC-133_cancel-an-appointment.puml) |
| 3.8.9 / UC-134 | Send appointment reminders | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.9_UC-134_send-appointment-reminders.png) · [Nguồn](Tran-The-Luong/3.8/3.8.9_UC-134_send-appointment-reminders.puml) |
| 3.8.10 / UC-135 | Record an appointment no-show | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.10_UC-135_record-an-appointment-no-show.png) · [Nguồn](Tran-The-Luong/3.8/3.8.10_UC-135_record-an-appointment-no-show.puml) |
| 3.8.11 / UC-136 | Confirm item handed over | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.11_UC-136_confirm-item-handed-over.png) · [Nguồn](Tran-The-Luong/3.8/3.8.11_UC-136_confirm-item-handed-over.puml) |
| 3.8.12 / UC-137 | Confirm item received | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.12_UC-137_confirm-item-received.png) · [Nguồn](Tran-The-Luong/3.8/3.8.12_UC-137_confirm-item-received.puml) |
| 3.8.13 / UC-138 | Hold conflicting handover confirmations | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.13_UC-138_hold-conflicting-handover-confirmations.png) · [Nguồn](Tran-The-Luong/3.8/3.8.13_UC-138_hold-conflicting-handover-confirmations.puml) |
| 3.8.14 / UC-139 | Complete a direct return | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.14_UC-139_complete-a-direct-return.png) · [Nguồn](Tran-The-Luong/3.8/3.8.14_UC-139_complete-a-direct-return.puml) |
| 3.8.15 / UC-140 | Report a handover issue | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Tran-The-Luong/3.8/3.8.15_UC-140_report-a-handover-issue.png) · [Nguồn](Tran-The-Luong/3.8/3.8.15_UC-140_report-a-handover-issue.puml) |

## Khoa

### 3.9 Warehouse Intake, Custody & Transfer

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.9.1 / UC-049 | View active handover points | Implemented | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.9/3.9.1_UC-049_view-active-handover-points.png) · [Nguồn](Khoa/3.9/3.9.1_UC-049_view-active-handover-points.puml) |
| 3.9.2 / UC-050 | View warehouse reference data | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.9/3.9.2_UC-050_view-warehouse-reference-data.png) · [Nguồn](Khoa/3.9/3.9.2_UC-050_view-warehouse-reference-data.puml) |
| 3.9.3 / UC-051 | Browse warehouse items | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.3_UC-051_browse-warehouse-items.png) · [Nguồn](Khoa/3.9/3.9.3_UC-051_browse-warehouse-items.puml) |
| 3.9.4 / UC-052 | Receive a warehouse item | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.4_UC-052_receive-a-warehouse-item.png) · [Nguồn](Khoa/3.9/3.9.4_UC-052_receive-a-warehouse-item.puml) |
| 3.9.5 / UC-053 | Update warehouse item details | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.5_UC-053_update-warehouse-item-details.png) · [Nguồn](Khoa/3.9/3.9.5_UC-053_update-warehouse-item-details.puml) |
| 3.9.6 / UC-054 | Move an item to stored state | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.6_UC-054_move-an-item-to-stored-state.png) · [Nguồn](Khoa/3.9/3.9.6_UC-054_move-an-item-to-stored-state.puml) |
| 3.9.7 / UC-055 | Confirm a warehouse return | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.7_UC-055_confirm-a-warehouse-return.png) · [Nguồn](Khoa/3.9/3.9.7_UC-055_confirm-a-warehouse-return.puml) |
| 3.9.8 / UC-056 | View warehouse storage logs | Implemented | `storage_logs` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.9/3.9.8_UC-056_view-warehouse-storage-logs.png) · [Nguồn](Khoa/3.9/3.9.8_UC-056_view-warehouse-storage-logs.puml) |
| 3.9.9 / UC-057 | Calculate item retention deadline | Implemented | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Khoa/3.9/3.9.9_UC-057_calculate-item-retention-deadline.png) · [Nguồn](Khoa/3.9/3.9.9_UC-057_calculate-item-retention-deadline.puml) |
| 3.9.10 / UC-141 | Request transfer to staff custody | Implemented | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Khoa/3.9/3.9.10_UC-141_request-transfer-to-staff-custody.png) · [Nguồn](Khoa/3.9/3.9.10_UC-141_request-transfer-to-staff-custody.puml) |
| 3.9.11 / UC-142 | Select staff intake point and time | Partial · Phần đang chạy | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.9/3.9.11_UC-142_select-staff-intake-point-and-time.png) · [Nguồn](Khoa/3.9/3.9.11_UC-142_select-staff-intake-point-and-time.puml) |
| 3.9.12 / UC-143 | List custody transfer requests | Implemented | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Khoa/3.9/3.9.12_UC-143_list-custody-transfer-requests.png) · [Nguồn](Khoa/3.9/3.9.12_UC-143_list-custody-transfer-requests.puml) |
| 3.9.13 / UC-144 | Review a custody transfer request | Implemented | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Khoa/3.9/3.9.13_UC-144_review-a-custody-transfer-request.png) · [Nguồn](Khoa/3.9/3.9.13_UC-144_review-a-custody-transfer-request.puml) |
| 3.9.14 / UC-145 | Reject or cancel a custody transfer request | Implemented | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Khoa/3.9/3.9.14_UC-145_reject-or-cancel-a-custody-transfer-request.png) · [Nguồn](Khoa/3.9/3.9.14_UC-145_reject-or-cancel-a-custody-transfer-request.puml) |
| 3.9.15 / UC-146 | Confirm staff intake | Implemented | `custody_requests` | [053](../../apps/api-node/src/migrations/053_custody_requests.sql) | [PNG](Khoa/3.9/3.9.15_UC-146_confirm-staff-intake.png) · [Nguồn](Khoa/3.9/3.9.15_UC-146_confirm-staff-intake.puml) |
| 3.9.16 / UC-147 | Receive custody status notifications | Partial · Phần đang chạy | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.9/3.9.16_UC-147_receive-custody-status-notifications.png) · [Nguồn](Khoa/3.9/3.9.16_UC-147_receive-custody-status-notifications.puml) |

### 3.10 Feedback & Reputation

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.10.1 / UC-058 | Check return-feedback eligibility | Implemented | `return_appointments` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.10/3.10.1_UC-058_check-return-feedback-eligibility.png) · [Nguồn](Khoa/3.10/3.10.1_UC-058_check-return-feedback-eligibility.puml) |
| 3.10.2 / UC-059 | Submit return feedback | Implemented | `return_feedback` | [018](../../apps/api-node/src/migrations/018_return_feedback.sql) | [PNG](Khoa/3.10/3.10.2_UC-059_submit-return-feedback.png) · [Nguồn](Khoa/3.10/3.10.2_UC-059_submit-return-feedback.puml) |
| 3.10.3 / UC-060 | Update reputation after feedback | Implemented | `reputation_scores` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.10/3.10.3_UC-060_update-reputation-after-feedback.png) · [Nguồn](Khoa/3.10/3.10.3_UC-060_update-reputation-after-feedback.puml) |

### 3.11 User & Role Administration

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.11.1 / UC-062 | List and search user accounts | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.1_UC-062_list-and-search-user-accounts.png) · [Nguồn](Khoa/3.11/3.11.1_UC-062_list-and-search-user-accounts.puml) |
| 3.11.2 / UC-063 | Create a user account | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.2_UC-063_create-a-user-account.png) · [Nguồn](Khoa/3.11/3.11.2_UC-063_create-a-user-account.puml) |
| 3.11.3 / UC-064 | View user account details | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.3_UC-064_view-user-account-details.png) · [Nguồn](Khoa/3.11/3.11.3_UC-064_view-user-account-details.puml) |
| 3.11.4 / UC-065 | Update user information | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.4_UC-065_update-user-information.png) · [Nguồn](Khoa/3.11/3.11.4_UC-065_update-user-information.puml) |
| 3.11.5 / UC-066 | Change user role | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.5_UC-066_change-user-role.png) · [Nguồn](Khoa/3.11/3.11.5_UC-066_change-user-role.puml) |
| 3.11.6 / UC-067 | Enable or disable user account | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.6_UC-067_enable-or-disable-user-account.png) · [Nguồn](Khoa/3.11/3.11.6_UC-067_enable-or-disable-user-account.puml) |
| 3.11.7 / UC-068 | Delete user account | Implemented | `users` | [001](../../apps/api-node/src/migrations/001_auth.sql) | [PNG](Khoa/3.11/3.11.7_UC-068_delete-user-account.png) · [Nguồn](Khoa/3.11/3.11.7_UC-068_delete-user-account.puml) |

### 3.12 Master Data & Location Administration

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.12.1 / UC-061 | View administrative catalog | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.1_UC-061_view-administrative-catalog.png) · [Nguồn](Khoa/3.12/3.12.1_UC-061_view-administrative-catalog.puml) |
| 3.12.2 / UC-069 | Create item category | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.2_UC-069_create-item-category.png) · [Nguồn](Khoa/3.12/3.12.2_UC-069_create-item-category.puml) |
| 3.12.3 / UC-070 | Update item category | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.3_UC-070_update-item-category.png) · [Nguồn](Khoa/3.12/3.12.3_UC-070_update-item-category.puml) |
| 3.12.4 / UC-071 | Delete item category | Implemented | `item_categories` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.4_UC-071_delete-item-category.png) · [Nguồn](Khoa/3.12/3.12.4_UC-071_delete-item-category.puml) |
| 3.12.5 / UC-072 | Create campus area | Implemented | `campus_areas` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.5_UC-072_create-campus-area.png) · [Nguồn](Khoa/3.12/3.12.5_UC-072_create-campus-area.puml) |
| 3.12.6 / UC-073 | Update campus area | Implemented | `campus_areas` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.6_UC-073_update-campus-area.png) · [Nguồn](Khoa/3.12/3.12.6_UC-073_update-campus-area.puml) |
| 3.12.7 / UC-074 | Delete campus area | Implemented | `campus_areas` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.7_UC-074_delete-campus-area.png) · [Nguồn](Khoa/3.12/3.12.7_UC-074_delete-campus-area.puml) |
| 3.12.8 / UC-075 | Create campus building | Implemented | `campus_buildings` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.8_UC-075_create-campus-building.png) · [Nguồn](Khoa/3.12/3.12.8_UC-075_create-campus-building.puml) |
| 3.12.9 / UC-076 | Update campus building | Implemented | `campus_buildings` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.9_UC-076_update-campus-building.png) · [Nguồn](Khoa/3.12/3.12.9_UC-076_update-campus-building.puml) |
| 3.12.10 / UC-077 | Delete campus building | Implemented | `campus_buildings` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.10_UC-077_delete-campus-building.png) · [Nguồn](Khoa/3.12/3.12.10_UC-077_delete-campus-building.puml) |
| 3.12.11 / UC-078 | Create handover point | Implemented | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.11_UC-078_create-handover-point.png) · [Nguồn](Khoa/3.12/3.12.11_UC-078_create-handover-point.puml) |
| 3.12.12 / UC-079 | Update handover point | Implemented | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.12_UC-079_update-handover-point.png) · [Nguồn](Khoa/3.12/3.12.12_UC-079_update-handover-point.puml) |
| 3.12.13 / UC-080 | Upload handover map image | Implemented | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.13_UC-080_upload-handover-map-image.png) · [Nguồn](Khoa/3.12/3.12.13_UC-080_upload-handover-map-image.puml) |
| 3.12.14 / UC-081 | Delete handover point | Implemented | `handover_points` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Khoa/3.12/3.12.14_UC-081_delete-handover-point.png) · [Nguồn](Khoa/3.12/3.12.14_UC-081_delete-handover-point.puml) |

## Q

### 3.13 Moderation & User Reports

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.13.1 / UC-082 | View user reports | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.1_UC-082_view-user-reports.png) · [Nguồn](Q/3.13/3.13.1_UC-082_view-user-reports.puml) |
| 3.13.2 / UC-083 | Review report and apply moderation | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.2_UC-083_review-report-and-apply-moderation.png) · [Nguồn](Q/3.13/3.13.2_UC-083_review-report-and-apply-moderation.puml) |
| 3.13.3 / UC-093 | Submit a user report | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.3_UC-093_submit-a-user-report.png) · [Nguồn](Q/3.13/3.13.3_UC-093_submit-a-user-report.puml) |
| 3.13.4 / UC-094 | View my submitted reports | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.4_UC-094_view-my-submitted-reports.png) · [Nguồn](Q/3.13/3.13.4_UC-094_view-my-submitted-reports.puml) |
| 3.13.5 / UC-095 | View my report detail | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.5_UC-095_view-my-report-detail.png) · [Nguồn](Q/3.13/3.13.5_UC-095_view-my-report-detail.puml) |
| 3.13.6 / UC-096 | Withdraw a pending report | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.6_UC-096_withdraw-a-pending-report.png) · [Nguồn](Q/3.13/3.13.6_UC-096_withdraw-a-pending-report.puml) |
| 3.13.7 / UC-165 | View moderation report detail | Implemented | `reports` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.13/3.13.7_UC-165_view-moderation-report-detail.png) · [Nguồn](Q/3.13/3.13.7_UC-165_view-moderation-report-detail.puml) |

### 3.14 Dashboard, Statistics & Audit

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.14.1 / UC-084 | View administration dashboard | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.14/3.14.1_UC-084_view-administration-dashboard.png) · [Nguồn](Q/3.14/3.14.1_UC-084_view-administration-dashboard.puml) |
| 3.14.2 / UC-085 | Export system statistics | Implemented | `admin_audit_logs` | [039](../../apps/api-node/src/migrations/039_admin_user_and_config_audit.sql) | [PNG](Q/3.14/3.14.2_UC-085_export-system-statistics.png) · [Nguồn](Q/3.14/3.14.2_UC-085_export-system-statistics.puml) |
| 3.14.3 / UC-163 | View administrative audit logs | Implemented | `admin_audit_logs` | [039](../../apps/api-node/src/migrations/039_admin_user_and_config_audit.sql) | [PNG](Q/3.14/3.14.3_UC-163_view-administrative-audit-logs.png) · [Nguồn](Q/3.14/3.14.3_UC-163_view-administrative-audit-logs.puml) |
| 3.14.4 / UC-164 | View claim and verification history | Partial · Phần đang chạy | `claim_audit_events` | [045](../../apps/api-node/src/migrations/045_peer_claim_conversations.sql) | [PNG](Q/3.14/3.14.4_UC-164_view-claim-and-verification-history.png) · [Nguồn](Q/3.14/3.14.4_UC-164_view-claim-and-verification-history.puml) |
| 3.14.5 / UC-166 | Export audit and moderation data | Implemented | `admin_audit_logs` | [039](../../apps/api-node/src/migrations/039_admin_user_and_config_audit.sql) | [PNG](Q/3.14/3.14.5_UC-166_export-audit-and-moderation-data.png) · [Nguồn](Q/3.14/3.14.5_UC-166_export-audit-and-moderation-data.puml) |

### 3.15 System Configuration

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.15.1 / UC-086 | View public system configuration | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.1_UC-086_view-public-system-configuration.png) · [Nguồn](Q/3.15/3.15.1_UC-086_view-public-system-configuration.puml) |
| 3.15.2 / UC-087 | List system configurations | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.2_UC-087_list-system-configurations.png) · [Nguồn](Q/3.15/3.15.2_UC-087_list-system-configurations.puml) |
| 3.15.3 / UC-088 | Create system configuration | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.3_UC-088_create-system-configuration.png) · [Nguồn](Q/3.15/3.15.3_UC-088_create-system-configuration.puml) |
| 3.15.4 / UC-089 | View system configuration details | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.4_UC-089_view-system-configuration-details.png) · [Nguồn](Q/3.15/3.15.4_UC-089_view-system-configuration-details.puml) |
| 3.15.5 / UC-090 | View configuration history | Implemented | `config_history` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.5_UC-090_view-configuration-history.png) · [Nguồn](Q/3.15/3.15.5_UC-090_view-configuration-history.puml) |
| 3.15.6 / UC-091 | Update system configuration | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.6_UC-091_update-system-configuration.png) · [Nguồn](Q/3.15/3.15.6_UC-091_update-system-configuration.puml) |
| 3.15.7 / UC-092 | Delete system configuration | Implemented | `config_entries` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.15/3.15.7_UC-092_delete-system-configuration.png) · [Nguồn](Q/3.15/3.15.7_UC-092_delete-system-configuration.puml) |

### 3.16 Warehouse Retention & Disposition

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.16.1 / UC-148 | List overdue warehouse items | Partial · Phần đang chạy | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Q/3.16/3.16.1_UC-148_list-overdue-warehouse-items.png) · [Nguồn](Q/3.16/3.16.1_UC-148_list-overdue-warehouse-items.puml) |
| 3.16.2 / UC-149 | View overdue item detail | Partial · Phần đang chạy | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Q/3.16/3.16.2_UC-149_view-overdue-item-detail.png) · [Nguồn](Q/3.16/3.16.2_UC-149_view-overdue-item-detail.puml) |
| 3.16.3 / UC-150 | Send retention deadline alerts | Partial · Phần đang chạy | `notifications` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.16/3.16.3_UC-150_send-retention-deadline-alerts.png) · [Nguồn](Q/3.16/3.16.3_UC-150_send-retention-deadline-alerts.puml) |
| 3.16.4 / UC-151 | Check disposition eligibility | Partial · Đề xuất | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Q/3.16/3.16.4_UC-151_check-disposition-eligibility.png) · [Nguồn](Q/3.16/3.16.4_UC-151_check-disposition-eligibility.puml) |
| 3.16.5 / UC-152 | Apply or remove a legal hold | Partial · Phần đang chạy | `warehouse_items` | [010](../../apps/api-node/src/migrations/010_notifications_and_warehouse.sql) | [PNG](Q/3.16/3.16.5_UC-152_apply-or-remove-a-legal-hold.png) · [Nguồn](Q/3.16/3.16.5_UC-152_apply-or-remove-a-legal-hold.puml) |
| 3.16.6 / UC-153 | Create a disposition order | Partial · Phần đang chạy | `warehouse_action_approvals` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.6_UC-153_create-a-disposition-order.png) · [Nguồn](Q/3.16/3.16.6_UC-153_create-a-disposition-order.puml) |
| 3.16.7 / UC-154 | View disposition order detail | Planned · Đề xuất | `warehouse_action_approvals` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.7_UC-154_view-disposition-order-detail.png) · [Nguồn](Q/3.16/3.16.7_UC-154_view-disposition-order-detail.puml) |
| 3.16.8 / UC-155 | Approve a disposition order | Partial · Phần đang chạy | `warehouse_action_approvals` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.8_UC-155_approve-a-disposition-order.png) · [Nguồn](Q/3.16/3.16.8_UC-155_approve-a-disposition-order.puml) |
| 3.16.9 / UC-156 | Reject a disposition order | Planned · Đề xuất | `warehouse_action_approvals` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.9_UC-156_reject-a-disposition-order.png) · [Nguồn](Q/3.16/3.16.9_UC-156_reject-a-disposition-order.puml) |
| 3.16.10 / UC-157 | Cancel a disposition order | Planned · Đề xuất | `warehouse_action_approvals` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.10_UC-157_cancel-a-disposition-order.png) · [Nguồn](Q/3.16/3.16.10_UC-157_cancel-a-disposition-order.puml) |
| 3.16.11 / UC-158 | Record disposition evidence | Partial · Phần đang chạy | `warehouse_private_proofs` | [054](../../apps/api-node/src/migrations/054_custody_safety_contract.sql) | [PNG](Q/3.16/3.16.11_UC-158_record-disposition-evidence.png) · [Nguồn](Q/3.16/3.16.11_UC-158_record-disposition-evidence.puml) |
| 3.16.12 / UC-159 | Create a donation campaign | Planned · Đề xuất | `donation_campaigns` | Chưa có; entity đề xuất | [PNG](Q/3.16/3.16.12_UC-159_create-a-donation-campaign.png) · [Nguồn](Q/3.16/3.16.12_UC-159_create-a-donation-campaign.puml) |
| 3.16.13 / UC-160 | Update a donation campaign | Planned · Đề xuất | `donation_campaigns` | Chưa có; entity đề xuất | [PNG](Q/3.16/3.16.13_UC-160_update-a-donation-campaign.png) · [Nguồn](Q/3.16/3.16.13_UC-160_update-a-donation-campaign.puml) |
| 3.16.14 / UC-161 | Assign or remove campaign items | Planned · Đề xuất | `donation_campaigns` | Chưa có; entity đề xuất | [PNG](Q/3.16/3.16.14_UC-161_assign-or-remove-campaign-items.png) · [Nguồn](Q/3.16/3.16.14_UC-161_assign-or-remove-campaign-items.puml) |
| 3.16.15 / UC-162 | Complete a donation campaign | Planned · Đề xuất | `donation_campaigns` | Chưa có; entity đề xuất | [PNG](Q/3.16/3.16.15_UC-162_complete-a-donation-campaign.png) · [Nguồn](Q/3.16/3.16.15_UC-162_complete-a-donation-campaign.puml) |

### 3.17 End-to-End Item Journey

| Mục / UC | Use Case | Trạng thái / phạm vi | Entity chính | Migration | Tệp |
| --- | --- | --- | --- | --- | --- |
| 3.17.1 / UC-167 | View end-to-end item journey | Implemented | `posts` | [002](../../apps/api-node/src/migrations/002_lost_found_schema.sql) | [PNG](Q/3.17/3.17.1_UC-167_view-end-to-end-item-journey.png) · [Nguồn](Q/3.17/3.17.1_UC-167_view-end-to-end-item-journey.puml) |

## Xuất Ảnh Và Kiểm Tra

Cần Node.js, Java và PlantUML JAR. Renderer không dùng server public để gửi nội dung tài liệu.

```powershell
./docs/sequences/render.ps1 -PlantUmlJar <path-to-plantuml.jar>
node docs/sequences/check.mjs
git diff --check
```

`render.ps1` tìm source đệ quy qua các thư mục thành viên, kiểm tra cú pháp, xuất PNG không nhúng
source metadata, rồi kiểm tra catalogue. `check.mjs` kiểm tra đủ 167 UC, tên/status,
entity/migration, source tham chiếu, số bước/alt, activation, PNG và liên kết mục lục.
Không đưa JAR, ảnh contact-sheet hoặc tool cache tạm vào repository.
