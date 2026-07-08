# Campus IT Support Ticket Portal

Campus IT Support Ticket Portal là demo helpdesk serverless cho môi trường trường học, câu lạc bộ hoặc văn phòng nhỏ. Người dùng gửi yêu cầu hỗ trợ IT, admin xem danh sách ticket, cập nhật trạng thái xử lý và ghi chú phản hồi.

## Tính năng chính

- User Portal để tạo ticket hỗ trợ IT.
- Admin Console để lọc, xem chi tiết và cập nhật trạng thái ticket.
- Tra cứu ticket bằng mã ticket.
- Upload file minh họa dạng PDF, PNG, JPG hoặc WebP.
- Dashboard đếm tổng ticket, ticket đang xử lý, ticket ưu tiên cao và ticket đã giải quyết.
- Runtime config riêng cho API Gateway và Cognito, phù hợp deploy bằng AWS Amplify.

## AWS services

Project hiện dùng hoặc đã chuẩn bị dùng các dịch vụ AWS sau:

- AWS Amplify Hosting: host frontend Hugo và tự động build/deploy từ GitHub.
- API Gateway: nhận request từ frontend.
- AWS Lambda: xử lý logic tạo, xem và cập nhật ticket.
- Amazon DynamoDB: lưu ticket theo `ticketId`.
- Amazon S3: lưu file đính kèm.
- Amazon CloudWatch: theo dõi log Lambda/API.
- Amazon Cognito: chuẩn bị dùng cho đăng nhập và phân quyền User/Admin.
- Amazon Route 53: chuẩn bị dùng cho domain riêng.

## Cấu trúc project

```text
.
├── amplify.yml                         # Build settings cho Amplify Hosting
├── aws/lambda/CampusSupportTicketService
│   └── index.mjs                       # Lambda handler cho ticket API
├── content/                            # Hugo content pages
├── docs/
│   └── amplify-deploy.md               # Hướng dẫn deploy Amplify
├── layouts/                            # Hugo templates
├── scripts/
│   └── write-runtime-config.mjs        # Tạo static/js/config.js từ env vars
├── static/css/styles.css               # UI styles
├── static/js/app.js                    # Frontend logic
├── static/js/config.js                 # Runtime config local mặc định
└── hugo.toml                           # Hugo config
```

## Chạy local

```powershell
hugo server
```

Sau đó mở:

```text
http://localhost:1313/
```

## Build local

```powershell
node scripts/write-runtime-config.mjs
hugo --minify
```

Output nằm trong thư mục `public/`. Thư mục này được ignore vì Amplify sẽ tự build lại khi deploy.

## Deploy frontend bằng Amplify

1. Push source lên GitHub.
2. Vào AWS Amplify -> Create new app -> Host web app.
3. Chọn repository và branch `main`.
4. Amplify sẽ đọc `amplify.yml`.
5. Thêm environment variables:

```text
API_BASE_URL=https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com
COGNITO_ENABLED=false
COGNITO_DOMAIN=
COGNITO_CLIENT_ID=
COGNITO_REDIRECT_URI=
COGNITO_LOGOUT_URI=
```

6. Save and deploy.

Chi tiết xem thêm: `docs/amplify-deploy.md`.

## Luồng kiến trúc

```text
User Browser
  -> Amplify Hosting
  -> API Gateway
  -> Lambda
  -> DynamoDB

Attachment upload:
  Lambda -> S3

Monitoring:
  Lambda/API Gateway -> CloudWatch Logs
```

Khi bật Cognito thật:

```text
User Browser
  -> Cognito Hosted UI
  -> API Gateway JWT Authorizer
  -> Lambda
```

## Tài khoản demo hiện tại

```text
User:  student@campus.edu.vn / student123
Admin: admin@campus.edu.vn   / admin123
```

Các tài khoản này chỉ phục vụ demo frontend khi `COGNITO_ENABLED=false`.