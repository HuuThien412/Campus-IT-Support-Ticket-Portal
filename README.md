# Campus IT Support Ticket Portal

Demo này là một project web khác với form đăng ký sự kiện. Use-case là hệ thống helpdesk nhỏ cho trường học, câu lạc bộ hoặc văn phòng: người dùng gửi lỗi IT, admin xem ticket và cập nhật trạng thái xử lý.

## AWS services

- S3: host static website được build từ Hugo.
- API Gateway: nhận request tạo ticket và cập nhật trạng thái.
- Lambda: validate dữ liệu, tạo mã ticket, xử lý business logic.
- DynamoDB: lưu ticket theo `ticketId`, email, category, priority, status.
- CloudWatch: xem log Lambda, theo dõi lỗi và request.

## Cách chạy local

```powershell
hugo server
```

Sau đó mở:

```text
http://localhost:1313/
```

## Build static site

```powershell
hugo
```

Output nằm trong thư mục `public/`. Đây là thư mục có thể upload lên S3 static website hosting.

## Chức năng demo

- Tạo ticket hỗ trợ IT.
- Chọn nhóm sự cố: WiFi, tài khoản, phần mềm, thiết bị, khác.
- Chọn mức độ ưu tiên: thấp, trung bình, cao.
- Dashboard đếm tổng ticket, ticket đang xử lý, ticket ưu tiên cao.
- Admin đổi trạng thái: Open, In Progress, Resolved.
- Tạo dữ liệu mẫu và xóa dữ liệu demo.

Trong demo local, dữ liệu được lưu bằng `localStorage`. Khi triển khai AWS thật, phần tạo/cập nhật ticket trong `static/js/app.js` sẽ được thay bằng `fetch()` đến API Gateway.

## Mapping sang AWS thật

```text
User -> S3 Static Website -> API Gateway -> Lambda -> DynamoDB
                                      |
                                      v
                                CloudWatch Logs
```

## Vì sao project này hợp nội quy

- Là web app thực tế, không trùng kiểu form đăng ký sự kiện phổ biến.
- Dùng ít nhất 4 dịch vụ AWS chính.
- Có kiến trúc rõ ràng, dễ vẽ sơ đồ.
- Có workflow end-to-end: tạo ticket, lưu dữ liệu, cập nhật trạng thái.
- Có phần monitoring bằng CloudWatch.
- Dễ viết workshop step-by-step và cleanup.
