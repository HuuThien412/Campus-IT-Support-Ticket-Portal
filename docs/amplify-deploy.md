# Deploy frontend voi AWS Amplify Hosting

Tai lieu nay huong dan buoc 1 va 2: chuan bi Amplify build va tach runtime config cho frontend Hugo.

## 1. Files da chuan bi trong project

- `amplify.yml`: buildspec cho Amplify Hosting.
- `scripts/write-runtime-config.mjs`: tao `static/js/config.js` tu environment variables truoc khi build.
- `static/js/config.js`: runtime config duoc frontend doc qua `window.CAMPUS_SUPPORT_CONFIG`.
- `layouts/partials/app-shell.html`: nap `js/config.js` truoc `js/app.js`.

## 2. Build settings trong Amplify

Khi tao app tren Amplify Hosting, chon repo va branch cua project. Neu Amplify doc duoc `amplify.yml`, build settings nen co dang:

```yaml
version: 1
frontend:
  phases:
    build:
      commands:
        - node scripts/write-runtime-config.mjs
        - hugo --minify
  artifacts:
    baseDirectory: public
    files:
      - '**/*'
  cache:
    paths: []
```

`baseDirectory` la `public` vi Hugo build static site vao thu muc nay.

## 3. Environment variables nen them trong Amplify

Vao Amplify app -> Hosting -> Environment variables, them cac bien sau:

| Name | Gia tri hien tai / vi du | Ghi chu |
| --- | --- | --- |
| `API_BASE_URL` | `https://a74geamhtb.execute-api.ap-southeast-1.amazonaws.com` | API Gateway hien tai |
| `COGNITO_ENABLED` | `false` | De `false` trong buoc deploy frontend dau tien |
| `COGNITO_DOMAIN` | de trong | Dien sau khi tao Cognito Hosted UI |
| `COGNITO_CLIENT_ID` | de trong | Dien sau khi tao Cognito App Client |
| `COGNITO_REDIRECT_URI` | de trong | De trong thi app tu dung current page URL |
| `COGNITO_LOGOUT_URI` | de trong | De trong thi app tu dung current page URL |

Khi sang buoc Cognito that, doi:

```text
COGNITO_ENABLED=true
COGNITO_DOMAIN=<your-domain>.auth.<region>.amazoncognito.com
COGNITO_CLIENT_ID=<app-client-id>
```

Neu da co custom domain Route 53, nen set redirect/logout URI ro rang, vi du:

```text
COGNITO_REDIRECT_URI=https://support.example.com/
COGNITO_LOGOUT_URI=https://support.example.com/
```

## 4. Thu tu deploy tren AWS Console

1. Push project len GitHub/GitLab/CodeCommit.
2. Mo AWS Amplify -> Create new app -> Host web app.
3. Chon repository provider va branch.
4. O man hinh build settings, kiem tra Amplify doc `amplify.yml`.
5. Them environment variables o tren.
6. Save and deploy.
7. Sau khi deploy xong, mo URL `*.amplifyapp.com`.
8. Test User Portal:
   - Dang nhap demo user.
   - Tao ticket.
   - Tra cuu ticket vua tao.
9. Test Admin Console:
   - Dang nhap demo admin.
   - Refresh danh sach.
   - Doi status / luu ghi chu.

## 5. Diem can ghi nho

- Amplify chi host frontend. Backend API Gateway, Lambda, DynamoDB va S3 attachment van la backend rieng cua project.
- Khong dua secret vao frontend env vars. API URL, Cognito domain va client ID la public config, dung duoc o frontend.
- Chua bat Cognito o lan deploy dau tien de giam rui ro. Khi frontend tren Amplify chay on dinh, moi bat Cognito va JWT authorizer.
