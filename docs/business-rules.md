# Luật nghiệp vụ

Cập nhật: 23/08/2026

## 1. Quy ước

- `Enforced`: code hiện tại đang cưỡng bức rule ở backend/database.
- `Partial`: mới cưỡng bức một phần hoặc thiếu integration test.
- `Planned`: rule dành cho flow chưa có runtime.

## 2. Rules đang áp dụng

| ID | Business rule | UC | Status |
| --- | --- | --- | --- |
| BR-01 | Đăng ký phải qua OTP email còn hạn; email đang hoạt động không được đăng ký lại. Email FPT/edu không bắt buộc. | UC-031, UC-032 | Enforced |
| BR-02 | Tài khoản mới nhận role nền `USER` và audience role `STUDENT` hoặc `LECTURER`; client không tự cấp `STAFF`/`ADMIN`. | UC-002, UC-032 | Enforced |
| BR-03 | Password dùng bcrypt; OTP và refresh token chỉ lưu hash; token reset có hạn dùng và dùng một lần. | UC-031 đến UC-036 | Enforced |
| BR-04 | Login chỉ thành công với account `ACTIVE`; access session phải còn đúng session version. | UC-001, UC-033, UC-034 | Enforced |
| BR-05 | Refresh token được rotate trong transaction; logout revoke token hiện tại. | UC-034, UC-035 | Enforced |
| BR-06 | Endpoint protected phải xác thực JWT; Admin API chỉ chấp nhận role `ADMIN`. | UC-001, UC-002, UC-062 | Enforced |
| BR-07 | Post chỉ có một type `LOST` hoặc `FOUND`; chỉ owner được update/delete/upload/delete media. | UC-040 đến UC-043, UC-048, UC-050 | Enforced |
| BR-08 | Post phải có title, description, danh mục con đang hoạt động, contact, incident time không ở tương lai và location hợp lệ. | UC-040, UC-041 | Enforced |
| BR-09 | Building phải thuộc area đã chọn. `LOST` không dùng handover point. `FOUND` phải có nơi lưu/area/custom location/handover hợp lệ. | UC-040, UC-041, UC-055 | Enforced |
| BR-10 | `PRIVATE_DETAILS` chỉ dùng cho `FOUND`; public response phải che contact, vị trí chi tiết, item media và raw analysis signals. | UC-041, UC-044, UC-054 | Partial; post serializer đã có |
| BR-11 | Board không trả post soft-deleted/hidden và chỉ hỗ trợ public status hợp lệ. | UC-043, UC-046, UC-047 | Enforced |
| BR-12 | Category dùng hai cấp. Post phải chọn danh mục cụ thể, không được chọn nhóm chính. | UC-040, UC-041, UC-064 | Enforced |
| BR-13 | Không xóa category/area/building đang được tham chiếu; phải chuyển sang inactive nếu còn dữ liệu liên quan. | UC-064, UC-065 | Enforced |
| BR-14 | Upload chỉ nhận JPEG/PNG/WEBP hợp lệ, tối đa 10 MB mỗi file và giới hạn số ảnh mỗi post. MIME phải khớp file signature. | UC-048, UC-050 | Enforced |
| BR-15 | Media không trả storage URI nội bộ; client truy cập qua endpoint proxy sau khi authorization. | UC-048, UC-050, UC-054 | Enforced cho post media |
| BR-16 | Gemini chỉ chạy khi user chủ động gửi ảnh; nhận tối đa 5 ảnh và tổng tối đa 14 MB cho một lần phân tích. | UC-086, UC-088 | Enforced |
| BR-17 | Gemini response chỉ tạo bản nháp. User phải được sửa và xác nhận trước khi lưu post. | UC-086, UC-088 | Enforced ở web flow |
| BR-18 | OCR/visible text phải loại dữ liệu nhạy cảm như serial đầy đủ, IMEI, QR, barcode, email, số điện thoại và giấy tờ. | UC-086, UC-091 | Partial; prompt/schema có, cần provider regression test sâu hơn |
| BR-19 | Post create/update chạy matching best-effort; matching failure không rollback một post hợp lệ. | UC-068 | Enforced |
| BR-20 | Matching chỉ so sánh bài đối nghịch LOST/FOUND đang hoạt động và giới hạn candidate/window. | UC-068, UC-070 | Enforced |
| BR-21 | Score dùng text, category, location, time, image và OCR; weights/thresholds được đọc từ config hoặc default. | UC-069, UC-070, UC-091 | Enforced |
| BR-22 | Candidate dưới 45% bị bỏ; các tier cao hơn chỉ là gợi ý và không tự đổi post state hoặc xác nhận quyền sở hữu. | UC-070, UC-071, UC-072 | Enforced |
| BR-23 | Khác category mạnh hoặc lệch thời gian lớn phải bị cap/penalty trừ khi có tín hiệu mạnh phù hợp. | UC-070, UC-076 | Enforced |
| BR-24 | Kết quả matching phải lưu score thành phần, tier, matcher version và explanation; owner/Staff/Admin mới được xem/re-run theo quyền. | UC-071, UC-072, UC-075, UC-076 | Enforced |
| BR-25 | Matching của `PRIVATE_DETAILS` không được lộ raw tokens/OCR/location cho actor không có quyền xem chi tiết. | UC-054, UC-076 | Enforced trong serializer matching |
| BR-26 | Staff có quyền thấp hơn Admin. Việc frontend ẩn menu không thay thế backend guard. | UC-002, UC-062 | Enforced cho route hiện tại |
| BR-27 | Migration đã chạy không được sửa; checksum mismatch phải dừng migration. | N/A | Enforced |
| BR-28 | Node.js là write owner duy nhất. Java không được ghi business state khi chưa có domain ownership và integration test. | UC-001, UC-002 | Enforced theo kiến trúc hiện tại |
| BR-32 | Staff page chỉ được công bố hoàn thành khi có ít nhất một operational flow và backend role matrix test. | UC-062 | Enforced cho warehouse operations |
| BR-42 | Warehouse receive/store/return chỉ cho Staff/Admin và mỗi transition phải ghi storage log có actor, action, from/to status, condition/note và timestamp. | UC-011 đến UC-015, UC-059 đến UC-061 | Enforced |

## 3. Rules cần hoàn thiện gần nhất

| ID | Business rule | UC | Status |
| --- | --- | --- | --- |
| BR-29 | Shared DB không được tham chiếu file chỉ tồn tại trên một máy; media phải dùng persistent shared object storage. | UC-048, UC-050 | Planned |
| BR-30 | Nếu metadata media tồn tại nhưng file/object đã mất, API phải trả 404 có kiểm soát thay vì 500 unhandled. | UC-048 | Enforced cho local post media |
| BR-31 | Admin catalog writes cần audit actor, action, before/after và timestamp. | UC-064, UC-065 | Planned |

## 4. Rules cho flow tương lai

| ID | Business rule | UC | Status |
| --- | --- | --- | --- |
| BR-33 | Claim chỉ áp dụng cho `FOUND`; owner không claim bài của mình và một user không tạo duplicate claim. | UC-052, UC-053 | Planned |
| BR-34 | Claim state transition phải dùng transaction/lock; một FOUND post không thể có hai accepted claims. | UC-003 đến UC-007 | Planned |
| BR-35 | Evidence chỉ hiển thị cho claimant, post owner và reviewer có quyền; private signal không trả về claimant như đáp án. | UC-049, UC-054, UC-087 đến UC-092 | Planned |
| BR-36 | Evidence confidence chỉ là hỗ trợ review; human verification bắt buộc trước khi bàn giao. | UC-089, UC-090, UC-092 | Planned |
| BR-37 | Chỉ accepted claim mới được tạo appointment; một claim chỉ có một active appointment. | UC-021 đến UC-024 | Planned |
| BR-38 | Warehouse disposition bị chặn nếu còn claim hoặc appointment active/pending. | UC-011 đến UC-020, UC-059 đến UC-061 | Planned |
| BR-39 | Socket phải JWT-authenticated, isolate theo user/claim room và không broadcast dữ liệu riêng cho actor không liên quan. | UC-077 đến UC-083 | Planned |
| BR-40 | Custom AI chỉ được công bố sau khi có dataset hợp pháp, anonymization, evaluation và model versioning. | UC-026 đến UC-030 | Planned |
| BR-41 | Mobile dùng chung API/privacy rules với web nhưng đang deferred, không thuộc completion hiện tại. | UC-093 đến UC-100 | Deferred |

## 5. Nguyên tắc quyết định cuối

Điểm matching, Gemini analysis và các confidence score tương lai đều là decision support. Không module AI nào được tự động:

- tuyên bố người claim là chủ sở hữu;
- accept claim;
- thay đổi vật phẩm thành returned;
- cho phép lấy đồ khỏi kho;
- công khai private evidence.
