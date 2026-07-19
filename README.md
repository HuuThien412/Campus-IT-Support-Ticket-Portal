# Campus IT Support Ticket Portal

Campus IT Support Ticket Portal là hệ thống helpdesk serverless dành cho môi trường trường học. Sinh viên và nhân viên có thể gửi yêu cầu hỗ trợ kỹ thuật, theo dõi trạng thái xử lý và nhận thông báo khi ticket được cập nhật. Đội ngũ IT sử dụng trang quản trị để xem, phân loại, cập nhật và xóa ticket.

## Tính năng chính

- Đăng ký và đăng nhập bằng Amazon Cognito Hosted UI.
- Phân quyền người dùng theo hai nhóm Cognito: `Users` và `Admins`.
- Tạo ticket hỗ trợ theo nhóm sự cố và mức độ ưu tiên.
- Đính kèm tệp PDF, PNG, JPG hoặc WebP.
- Tra cứu ticket bằng mã ticket.
- Admin lọc, xem chi tiết, cập nhật trạng thái, ghi chú và xóa ticket.
- Gửi email xác nhận khi tạo ticket và email thông báo khi trạng thái thay đổi.
- Gửi cảnh báo cho đội IT khi có ticket ưu tiên `High` hoặc `Critical`.
- Nhận thông báo cập nhật ticket theo thời gian thực qua WebSocket mà không cần tải lại trang.
- Theo dõi log và lỗi vận hành bằng Amazon CloudWatch.

## Kiến trúc hệ thống

```text
User/Admin Browser
  |
  +-- HTTPS --> AWS Amplify Hosting
  |
  +-- Sign-in --> Amazon Cognito Hosted UI
  |                 |
  |                 +-- JWT token
  |
  +-- REST request + JWT --> API Gateway HTTP API
  |                            |
  |                            +-- JWT Authorizer
  |                            |
  |                            +-- CampusSupportTicketService
  |                                  |
  |                                  +-- DynamoDB: CampusSupportTickets
  |                                  +-- Amazon S3: attachment storage
  |
  +-- WebSocket + ID token --> API Gateway WebSocket API
                                 |
                                 +-- CampusSupportWebSocketService
                                 +-- DynamoDB: CampusSupportConnections

CampusSupportTickets DynamoDB Stream
  |
  +-- CampusSupportNotificationService
        |
        +-- Amazon SES: email notification
        +-- API Gateway Management API: real-time notification
```

## Dịch vụ AWS sử dụng

| Dịch vụ | Vai trò |
| --- | --- |
| AWS Amplify Hosting | Build và host frontend Hugo từ GitHub |
| Amazon Cognito | Xác thực, Hosted UI và phân quyền `Users`/`Admins` |
| Amazon API Gateway HTTP API | Cung cấp REST API cho ticket |
| Amazon API Gateway WebSocket API | Duy trì kết nối và gửi thông báo thời gian thực |
| AWS Lambda | Xử lý ticket, kết nối WebSocket và gửi thông báo |
| Amazon DynamoDB | Lưu ticket và connection WebSocket |
| DynamoDB Streams | Phát hiện ticket mới hoặc ticket được cập nhật |
| Amazon S3 | Lưu tệp đính kèm |
| Amazon SES | Gửi email xác nhận và cập nhật ticket |
| Amazon CloudWatch | Lưu log, metric và hỗ trợ xử lý sự cố |
| AWS IAM | Cấp quyền tối thiểu cho từng Lambda |

Route 53 không nằm trong phạm vi triển khai hiện tại. Website sử dụng domain mặc định do AWS Amplify cung cấp.

## Cấu trúc project

```text
.
|-- amplify.yml
|-- aws/lambda/
|   |-- CampusSupportTicketService/index.mjs
|   |-- CampusSupportNotificationService/index.mjs
|   `-- CampusSupportWebSocketService/index.mjs
|-- content/
|-- docs/
|   |-- amplify-deploy.md
|   `-- notification-phase1.md
|-- layouts/
|-- scripts/write-runtime-config.mjs
|-- static/css/styles.css
|-- static/js/app.js
|-- static/js/config.js
`-- hugo.toml
```

## Chạy local

Yêu cầu máy đã cài Hugo và Node.js.

```powershell
node scripts/write-runtime-config.mjs
hugo server
```

Truy cập `http://localhost:1313/`.

> Cognito chỉ chuyển hướng về URL đã được khai báo trong App client. Nếu muốn đăng nhập khi chạy local, cần thêm URL localhost tương ứng vào Cognito callback và sign-out URLs.

## Build production

```powershell
node scripts/write-runtime-config.mjs
hugo --minify
```

Website sau khi build nằm trong thư mục `public/`. AWS Amplify thực hiện lại hai lệnh này theo cấu hình trong `amplify.yml`.

## Biến môi trường Amplify

Khai báo các biến sau trong Amplify Hosting:

```text
API_BASE_URL=https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com
WEB_SOCKET_URL=wss://y9d2pszfs7.execute-api.ap-southeast-1.amazonaws.com/production/
COGNITO_ENABLED=true
COGNITO_DOMAIN=https://ap-southeast-1dlwufncru.auth.ap-southeast-1.amazoncognito.com
COGNITO_CLIENT_ID=6b0npdra3clhdlpfen45iekr5l
COGNITO_REDIRECT_URI=
COGNITO_LOGOUT_URI=
```

Khi `COGNITO_REDIRECT_URI` và `COGNITO_LOGOUT_URI` để trống, frontend sử dụng URL hiện tại của trang.

## Các Lambda chính

### CampusSupportTicketService

Xử lý các route:

- `GET /tickets`
- `POST /tickets`
- `GET /tickets/{ticketId}`
- `PATCH /tickets/{ticketId}`
- `DELETE /tickets/{ticketId}` nếu route xóa đã được cấu hình trong API Gateway

Lambda này đọc nhóm Cognito từ JWT để kiểm tra quyền admin.

### CampusSupportNotificationService

Được kích hoạt bởi DynamoDB Streams với chế độ `New and old images` để:

- Gửi email xác nhận ticket mới.
- Cảnh báo đội IT về ticket ưu tiên cao.
- Gửi email khi trạng thái hoặc ghi chú xử lý thay đổi.
- Đẩy sự kiện `ticket.updated` đến WebSocket của đúng người dùng.

Các biến môi trường chính:

```text
FROM_EMAIL
IT_TEAM_EMAIL
APP_BASE_URL
NOTIFICATION_ENABLED=true
CONNECTIONS_TABLE=CampusSupportConnections
WEBSOCKET_MANAGEMENT_ENDPOINT=https://y9d2pszfs7.execute-api.ap-southeast-1.amazonaws.com/production
```

### CampusSupportWebSocketService

Xử lý các route `$connect`, `$disconnect` và `$default`. Lambda xác minh Cognito ID token rồi lưu hoặc xóa `connectionId` trong bảng `CampusSupportConnections`.

Các biến môi trường chính:

```text
COGNITO_APP_CLIENT_ID=6b0npdra3clhdlpfen45iekr5l
COGNITO_ISSUER=https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_dLwufNCru
CONNECTIONS_TABLE=CampusSupportConnections
```

## Kiểm thử thông báo thời gian thực

1. Đăng nhập bằng tài khoản người dùng và giữ trang đang mở.
2. Mở DevTools, chọn `Network` rồi chọn `WS`. Kết nối phải trả về HTTP `101`.
3. Kiểm tra bảng `CampusSupportConnections`; phải có item chứa `connectionId` và email người dùng.
4. Trong cửa sổ khác, đăng nhập admin và cập nhật ticket thuộc người dùng đó.
5. Trang người dùng phải hiển thị thông báo và cập nhật ticket mà không cần tải lại.
6. Nếu không hoạt động, kiểm tra CloudWatch logs của hai Lambda Notification và WebSocket.

## Trạng thái Amazon SES

SES hiện được cấu hình tại Region `ap-southeast-1`. Khi tài khoản còn ở Sandbox:

- Địa chỉ gửi phải được xác minh.
- Địa chỉ nhận cũng phải được xác minh.
- Email có thể bị chuyển vào Spam khi dùng địa chỉ Gmail cá nhân làm người gửi.

Để gửi email đến mọi người dùng thực tế, cần xác minh sending domain và yêu cầu AWS cấp SES production access.

## Bảo mật và vận hành

- Không lưu mật khẩu, access key hoặc secret key trong repository.
- Cognito App client dành cho frontend không sử dụng client secret.
- API Gateway HTTP API phải gắn JWT Authorizer vào các route cần bảo vệ.
- Lambda chỉ được cấp các quyền IAM cần thiết trên đúng bảng, bucket và API.
- S3 bucket không public; tệp được truy cập bằng URL ký trước có thời hạn.
- CloudWatch log không nên ghi JWT, mật khẩu hoặc dữ liệu nhạy cảm.
- Nên cấu hình thời gian lưu log và cảnh báo lỗi Lambda để kiểm soát chi phí.

## Trạng thái triển khai

- Frontend: AWS Amplify Hosting.
- Authentication: Amazon Cognito.
- Ticket API: API Gateway HTTP API và Lambda.
- Database: Amazon DynamoDB.
- Attachment: Amazon S3.
- Email notification: DynamoDB Streams, Lambda và Amazon SES.
- Real-time notification: API Gateway WebSocket API, Lambda và DynamoDB connection table.
- Custom domain: chưa sử dụng.
