# API và kiểm thử `integration`

Danh sách endpoint, cách gọi, các lỗi đã xử lý và cách kiểm tra, kết quả test. Cách chạy ứng dụng xem [readme_run.md](readme_run.md); lý do thiết kế xem [readme_design.md](readme_design.md).

**Mục lục:** [1. Dùng chung](#1-dùng-chung) · [2. Danh sách endpoint](#2-danh-sách-endpoint) · [3. Bitrix24 OAuth](#3-bitrix24-oauth-file-2-bài-1) · [4. Contact](#4-contact-file-2-bài-2) · [5. Jotform](#5-jotform-file-1) · [6. Lỗi đã xử lý](#6-các-lỗi-đã-xử-lý-và-cách-kiểm-tra) · [7. Kiểm thử](#7-kiểm-thử)

---

## 1. Dùng chung

- **Địa chỉ:** `http://localhost:3000` (hoặc `PUBLIC_URL` qua ngrok).
- **Xác thực:** endpoint có dấu 🔒 cần header `x-api-key: <API_KEY>`. Thiếu hoặc sai trả `401`.
- **Swagger:** `http://localhost:3000/docs`. Bấm **Authorize**, dán `API_KEY`, rồi dùng **Try it out**.
- **Mã request:** mọi phản hồi có header `x-request-id`; dùng mã này để tra log (xem [readme_design.md](readme_design.md#6-ghi-log)).
- **Định dạng lỗi:** mọi lỗi trả về cùng một dạng. `errorKbn` là mã lỗi, chữ số đầu cho biết nơi lỗi (2 request, 3 Jotform, 4 Bitrix24, 5 OAuth, 9 ứng dụng); bảng đầy đủ ở [readme_design.md](readme_design.md#53-error_kbn).

```json
{
  "statusCode": 503,
  "error": "BITRIX24_NOT_INSTALLED",
  "errorKbn": 40006,
  "message": "Chưa có token cho portal b24-4totiv.bitrix24.vn. Hãy cài đặt ứng dụng cục bộ trên Bitrix24 (đường dẫn cài đặt trỏ tới /install)",
  "details": {},
  "path": "/contacts",
  "timestamp": "2026-10-03T18:23:50.544Z"
}
```

Các ví dụ cURL dưới đây dùng hai biến:

```bash
export BASE=http://localhost:3000
export API_KEY=<giá trị API_KEY trong .env>
```

## 2. Danh sách endpoint

| | Method | Đường dẫn | Mô tả |
|---|---|---|---|
| | `GET` | `/health` | Ứng dụng còn chạy |
| | `POST`, `GET` | `/install` | Bitrix24 gọi khi cài hoặc cài lại ứng dụng (không có trong Swagger) |
| 🔒 | `GET` | `/bitrix/installation` | Trạng thái cài, hạn token |
| 🔒 | `POST` | `/bitrix/token/refresh` | Làm mới token ngay |
| 🔒 | `GET` | `/bitrix/test-call` | Gọi thử `callBitrixAPI('crm.contact.list')` |
| 🔒 | `GET` | `/contacts?start=0` | Danh sách contact |
| 🔒 | `GET` | `/contacts/:id` | Một contact |
| 🔒 | `POST` | `/contacts` | Thêm contact |
| 🔒 | `PUT` | `/contacts/:id` | Sửa contact |
| 🔒 | `DELETE` | `/contacts/:id` | Xóa contact |
| | `POST` | `/webhook/jotform` | Jotform gọi khi có submission mới |
| 🔒 | `POST` | `/jotform/sync?limit=20` | Đồng bộ bù qua Jotform API |
| 🔒 | `GET` | `/jotform/webhooks` | Webhook đang gắn với form |
| 🔒 | `POST` | `/jotform/webhooks` | Gắn webhook vào form qua Jotform API |
| 🔒 | `GET` | `/jotform/submissions` | 50 lần xử lý submission gần nhất (thành công hoặc thất bại) |
| 🔒 | `GET` | `/jotform/submissions/:uuid` | Một lần xử lý, kèm nội dung form |

---

## 3. Bitrix24 OAuth (File 2 bài 1)

### `POST /install`, `GET /install`

Chỉ Bitrix24 gọi, không cần API key. **Không có trong Swagger:** gọi tay luôn bị từ chối vì không có token thật (ứng dụng xác minh token qua `app.info`). Cách kích hoạt: bấm **Cài đặt lại** ứng dụng cục bộ trên Bitrix24 ([readme_run.md](readme_run.md#5-kết-nối-bitrix24-file-2)). Nhận 3 dạng dữ liệu: sự kiện `ONAPPINSTALL`, form `AUTH_ID`/`REFRESH_ID`, hoặc `?code=` (chi tiết: [readme_design.md](readme_design.md#21-install-ba-dạng-dữ-liệu)).

| Kết quả | Phản hồi |
|---|---|
| Sự kiện `ONAPPINSTALL` hợp lệ | `201 {"status":"ok","domain":"...","isNew":true}` |
| Form hoặc `?code=` hợp lệ | Trang HTML "Đã cài đặt ứng dụng" |
| Dữ liệu không nhận dạng được | `400`, `errorKbn 20001` |
| Portal khác `BITRIX24_DOMAIN` | `403` |
| Token không xác minh được qua `app.info` | `502`, `errorKbn 400xx` |

### `GET /bitrix/installation` 🔒

```bash
curl -s "$BASE/bitrix/installation" -H "x-api-key: $API_KEY"
```

```json
{
  "memberId": "a223c6b3710f85df22e9377d6c4f7553",
  "domain": "b24-4totiv.bitrix24.vn",
  "userId": 1,
  "userName": "Nguyễn Văn An",
  "scope": "crm,user",
  "expiresAt": "2026-10-04T10:00:00.000Z",
  "expiresInSeconds": 3412,
  "installedAt": "...",
  "updatedAt": "..."
}
```

Không bao giờ trả token. Chưa cài ứng dụng thì `503`, `errorKbn 40006`.

### `POST /bitrix/token/refresh` 🔒

Làm mới token ngay để thử luồng refresh. Trả về cùng dạng như trên với `expiresAt` mới. `refresh_token` hỏng thì `503`, `errorKbn 50005`.

### `GET /bitrix/test-call` 🔒

Gọi `callBitrixAPI('crm.contact.list')`, trả nguyên phản hồi của Bitrix24 (`{"result":[...],"total":3,...}`).

---

## 4. Contact (File 2 bài 2)

| Method | Đường dẫn | Phương thức Bitrix24 được gọi |
|---|---|---|
| `GET` | `/contacts?start=0` | `crm.contact.list`, `crm.requisite.list`, `crm.requisite.bankdetail.list`, `crm.address.list` |
| `GET` | `/contacts/:id` | `crm.contact.get` + như trên |
| `POST` | `/contacts` | `crm.contact.add`, `crm.requisite.add`, `crm.address.add`, `crm.requisite.bankdetail.add` |
| `PUT` | `/contacts/:id` | `crm.contact.update`, `crm.requisite.update`, `crm.address.update`, `crm.requisite.bankdetail.update` |
| `DELETE` | `/contacts/:id` | `crm.requisite.bankdetail.delete`, `crm.address.delete`, `crm.requisite.delete`, `crm.contact.delete` |

### 4.1 Dữ liệu gửi lên

```json
{
  "name": "Nguyễn Văn An",
  "phone": "0912345678",
  "email": "an.nguyen@example.com",
  "website": "https://example.com",
  "address": {
    "street": "12 Nguyễn Huệ",
    "ward": "Phường Bến Nghé",
    "district": "Quận 1",
    "province": "TP. Hồ Chí Minh"
  },
  "bank": { "bankName": "Vietcombank", "accountNumber": "0071000123456" }
}
```

| Trường | Ràng buộc | Thông báo lỗi |
|---|---|---|
| `name` | Bắt buộc khi thêm, tối đa 100 ký tự | "Tên là bắt buộc" |
| `phone` | Số Việt Nam (`0912345678`, `+84912345678`) hoặc số quốc tế có `+` | "Số điện thoại không hợp lệ" |
| `email` | Đúng định dạng email | "Email không hợp lệ" |
| `website` | URL http/https | "Website không hợp lệ" |
| `address.*` | Chuỗi, tối đa 255 ký tự | "Phường/xã phải là chuỗi"... |
| `bank.bankName` | Bắt buộc nếu gửi `bank` | "Tên ngân hàng là bắt buộc" |
| `bank.accountNumber` | 6-20 chữ số (bỏ khoảng trắng, dấu gạch) | "Số tài khoản không hợp lệ (chỉ gồm 6-20 chữ số)" |
| Trường lạ | Không được gửi | `Trường "foo" không được hỗ trợ` |

`PUT` nhận cùng các trường nhưng đều tùy chọn: chỉ trường được gửi lên mới thay đổi.

### 4.2 Dữ liệu trả về

Một contact (`GET /contacts/:id`, `POST`, `PUT`):

```json
{
  "id": 42,
  "name": "Nguyễn Văn An",
  "phone": "0912345678",
  "email": "an.nguyen@example.com",
  "website": "https://example.com",
  "address": { "street": "12 Nguyễn Huệ", "ward": "Phường Bến Nghé", "district": "Quận 1", "province": "TP. Hồ Chí Minh" },
  "bank": { "bankName": "Vietcombank", "accountNumber": "0071000123456" }
}
```

Danh sách (`GET /contacts`): `{"items":[...], "total": 3, "next": null}`. `next` khác `null` thì gọi tiếp với `?start=<next>`.

Xóa (`DELETE /contacts/:id`): `{"message":"Đã xóa contact 42"}`.

### 4.3 Ví dụ cURL

```bash
curl -s "$BASE/contacts" -H "x-api-key: $API_KEY"

curl -s "$BASE/contacts/42" -H "x-api-key: $API_KEY"

curl -s -X POST "$BASE/contacts" -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' \
  -d '{"name":"Nguyễn Văn An","phone":"0912345678","email":"an@example.com",
       "website":"https://example.com",
       "address":{"street":"12 Nguyễn Huệ","ward":"Phường Bến Nghé","district":"Quận 1","province":"TP. Hồ Chí Minh"},
       "bank":{"bankName":"Vietcombank","accountNumber":"0071000123456"}}'

curl -s -X PUT "$BASE/contacts/42" -H "x-api-key: $API_KEY" \
  -H 'content-type: application/json' \
  -d '{"phone":"0987654321","bank":{"bankName":"ACB","accountNumber":"123456789"}}'

curl -s -X DELETE "$BASE/contacts/42" -H "x-api-key: $API_KEY"
```

---

## 5. Jotform (File 1)

### `POST /webhook/jotform`

Jotform gọi khi có submission mới (`multipart/form-data`), không cần API key. Ứng dụng chỉ dùng `submissionID` rồi lấy lại dữ liệu qua Jotform API.

| Kết quả | Phản hồi |
|---|---|
| Tạo contact thành công | `200 {"submissionUuid":"...","jotformId":"6123456789","statusKbn":10000,"status":"SUCCESS","contactId":57}` |
| Submission đã tạo contact trước đó | `200 {"submissionUuid":null,"jotformId":"6123456789","statusKbn":10003,"status":"SKIPPED_DUPLICATE","contactId":57}`: không tạo contact, không ghi DB |
| Thiếu `submissionID` | `400` |
| Form khác `JOTFORM_FORM_ID` | `422`, `errorKbn 20004` |
| Thiếu họ tên, điện thoại, email hoặc sai định dạng | `422`, `errorKbn 20001` |
| Jotform hoặc Bitrix24 lỗi | `5xx`, `errorKbn 3xxxx` hoặc `4xxxx` |

Thử bằng cURL (giả lập Jotform):

```bash
curl -s -X POST "$BASE/webhook/jotform" -F formID=262753749396070 -F submissionID=<ID submission thật>
```

### Các endpoint quản trị 🔒

| Lệnh | Kết quả |
|---|---|
| `curl -s -X POST "$BASE/jotform/sync?limit=20" -H "x-api-key: $API_KEY"` | `{"checked":3,"success":1,"skipped":2,"failed":0,"results":[...]}` |
| `curl -s "$BASE/jotform/webhooks" -H "x-api-key: $API_KEY"` | `{"0":"https://<PUBLIC_URL>/webhook/jotform"}` |
| `curl -s -X POST "$BASE/jotform/webhooks" -H "x-api-key: $API_KEY"` | `{"webhookUrl":"...","created":true,"webhooks":[...]}` (đã có thì `created:false`) |
| `curl -s "$BASE/jotform/submissions" -H "x-api-key: $API_KEY"` | Danh sách lần xử lý, mới nhất trước (lần nhận trùng không có trong đây) |
| `curl -s "$BASE/jotform/submissions/<uuid>" -H "x-api-key: $API_KEY"` | Một lần xử lý kèm `formContent` |

Một phần tử của `/jotform/submissions`:

```json
{
  "uuid": "3d910aad-d290-4e3b-9dcd-9cf62bd744a6",
  "jotformId": "6123456789",
  "statusKbn": 10001,
  "status": "FAILED",
  "errorKbn": 30012,
  "error": "JOTFORM.CONFIG",
  "contactId": null,
  "receivedAt": "2026-10-03T18:23:50.000Z",
  "updatedAt": "2026-10-03T18:23:50.000Z"
}
```

---

## 6. Các lỗi đã xử lý và cách kiểm tra

| Tình huống | Cách xử lý | Trả về | `errorKbn` | Cách kiểm tra |
|---|---|---|---|---|
| Dữ liệu đầu vào sai | DTO + ValidationPipe, mỗi trường một thông báo | `400`, danh sách lỗi | 20001 | `POST /contacts` với email sai |
| Thiếu/sai `x-api-key` | Guard toàn cục, so sánh thời gian không đổi | `401` | 20002 | Gọi `/contacts` không kèm header |
| Contact không tồn tại | Bitrix24 trả "Not found" | `404` "Contact không tồn tại" | 20003 | `GET /contacts/999999` |
| Chưa cài ứng dụng | Không có token | `503` | 40006 | Gọi `/contacts` trước khi cài |
| access_token hết hạn | Làm mới trước khi gọi; gặp `expired_token` thì làm mới và gọi lại một lần | Bình thường | (40004 trong log nếu bị từ chối) | Xem bên dưới |
| refresh_token hỏng | Ghi log, yêu cầu cài lại | `503` | 50005 | Xem bên dưới |
| Sai `CLIENT_ID`/`CLIENT_SECRET` | | `500` | 50012 | Sửa sai một ký tự rồi `POST /bitrix/token/refresh` |
| Timeout | axios hết thời gian chờ (`HTTP_TIMEOUT_MS`) | `504` | x0001 | Unit test `bitrix-http.client.spec.ts` |
| Lỗi mạng (DNS, từ chối kết nối) | | `502` | x0002 | Tắt mạng rồi gọi `/contacts` |
| Bitrix24 4xx khác | Trả kèm mô tả lỗi gốc của Bitrix24 | `400` | 40008 | |
| Bitrix24 5xx, trả HTML | | `502` | 40010 | Unit test |
| Vượt giới hạn tần suất (`QUERY_LIMIT_EXCEEDED`) | Thử lại 2 lần (sau 1s, 2s) | `503` nếu vẫn lỗi | 40009 | |
| Sai `BITRIX24_WEBHOOK_URL` | Kèm gợi ý kiểm tra URL và quyền CRM | `502` | 40003 | Sửa sai mã trong URL rồi gửi form |
| Sai `JOTFORM_API_KEY` | | `502` | 30003 | Sửa sai key rồi `POST /jotform/sync` |
| Submission sai dữ liệu | Ghi `status_kbn=10001` | `422` | 20001 | Unit test `jotform.service.spec.ts` |
| Submission khác form | Ghi `status_kbn=10001` | `422` | 20004 | `curl -X POST $BASE/webhook/jotform -F formID=111 -F submissionID=1` |
| Submission gửi lại | Trả `statusKbn 10003` kèm `contactId` cũ; không tạo contact, không ghi DB | `200` | | Gửi lại cùng `submissionID` |
| Dữ liệu cài đặt giả | Kiểm tra tên miền, xác minh bằng `app.info` | `403` / `400` / `502` | 20002 / 20001 / 400xx | `curl -X POST $BASE/install -d foo=bar` |
| Thiếu biến môi trường | Cảnh báo khi khởi động, báo lỗi khi dùng | `500` / `503` | x0012 / 90002 | Xóa một biến rồi khởi động |
| Khởi động lỗi (biến sai, cổng bị chiếm) | Ghi lý do vào `app.log`, thoát mã 1 | | | `PORT=abc npm run start:prod` |

**Kiểm tra luồng làm mới token** bằng cách sửa trực tiếp tệp SQLite (chạy bằng Node.js, thư mục `integration`). Lệnh dưới dùng thư viện `better-sqlite3` có sẵn trong dự án:

```bash
sql() { node -e "require('better-sqlite3')('data/app.sqlite').exec(process.argv[1])" "$1"; }

# Token hết hạn: lần gọi kế tiếp tự làm mới (log: "sắp hết hạn, làm mới trước khi gọi API")
sql "UPDATE bitrix_installations SET expires_at = '2000-01-01 00:00:00'"
curl -s "$BASE/contacts" -H "x-api-key: $API_KEY"

# Token bị Bitrix24 từ chối dù chưa tới hạn: làm mới rồi gọi lại một lần
sql "UPDATE bitrix_installations SET access_token = 'sai'"
curl -s "$BASE/contacts" -H "x-api-key: $API_KEY"

# refresh_token hỏng: trả 503, errorKbn 50005
sql "UPDATE bitrix_installations SET access_token = 'sai', refresh_token = 'sai'"
curl -s "$BASE/contacts" -H "x-api-key: $API_KEY"
# Sau đó bấm "Cài đặt lại" ứng dụng trên Bitrix24 để lấy token mới.
```

---

## 7. Kiểm thử

```bash
npm test              # unit test
npm run test:e2e      # e2e
npm run test:cov      # độ bao phủ
npm run lint:check    # ESLint + Prettier
```

### 7.1 Unit test

Mỗi tệp test nằm cạnh tệp code nó kiểm tra (đường dẫn tính từ `src/`).

| Tệp | Nội dung |
|---|---|
| `bitrix/services/bitrix.service.spec.ts` | `callBitrixAPI`: gọi đúng URL và token; `expired_token` thì làm mới và gọi lại đúng một lần; không lặp lần hai; không làm mới với lỗi khác token; phân trang `listAll` |
| `bitrix/services/bitrix-token.service.spec.ts` | Làm mới token hết hạn và lưu cả refresh_token mới; đồng thời chỉ làm mới một lần; refresh_token hỏng thì báo cài lại. `refreshExpiring` (SQLite thật): chỉ làm mới token còn dưới 35 phút; một portal lỗi không chặn portal khác |
| `bitrix/schedulers/token-refresh.scheduler.spec.ts` | Cron được đăng ký lịch 30 phút; gọi `refreshExpiring(35 phút)`; ghi `SUCCESS`/`FAILED`; lỗi cả batch không làm sập ứng dụng |
| `bitrix/clients/bitrix-http.client.spec.ts` | Chuẩn hóa lỗi: timeout, mất mạng, 401 `expired_token`, 400 "Not found", 500 HTML, HTTP 200 nhưng body báo lỗi |
| `bitrix/clients/bitrix-oauth.client.spec.ts` | Tham số làm mới token, domain lấy từ `client_endpoint`; `invalid_grant`, `invalid_client`; thiếu cấu hình |
| `bitrix/mappers/bitrix-error.mapper.spec.ts` | Phân loại lỗi Bitrix24 theo mã lỗi và mã HTTP; giữ mã/mô tả gốc; body HTML |
| `bitrix/parsers/install-payload.parser.spec.ts` | Nhận dạng `ONAPPINSTALL`, form `AUTH_ID`, `?code=`, dữ liệu thiếu |
| `contacts/services/contacts.service.spec.ts` | Tạo đúng thứ tự; hủy contact khi bước ngân hàng lỗi; 404; sửa số điện thoại theo ID; gộp dữ liệu requisite vào danh sách |
| `contacts/mappers/contact.mapper.spec.ts` | Ánh xạ trường thêm/sửa contact, địa chỉ Việt Nam, thứ tự họ tên |
| `contacts/dto/create-contact.dto.spec.ts` | Thông báo validate: thiếu trường bắt buộc → "là bắt buộc", sai kiểu → "phải là chuỗi"; `PUT` không gửi tên vẫn hợp lệ |
| `jotform/services/jotform.service.spec.ts` | Lưu nội dung form và tạo contact; trùng thì trả `10003` và không ghi DB; đồng thời chỉ tạo một contact; khác form `20004`; Bitrix24 lỗi `40003` |
| `jotform/mappers/submission.mapper.spec.ts` | Ánh xạ ô văn bản, họ tên phức hợp, điện thoại `{full}`/`{area, phone}`; báo đủ lỗi |
| `jotform/repositories/form-submission.repository.spec.ts` | SQLite thật: tạo đồng thời không trùng dòng, khóa uuid; lỗi rồi gửi lại thành công là hai dòng; `form_content` đọc lại đúng JSON |
| `common/kbn/error.kbn.spec.ts` | Tính `error_kbn` từ từng loại lỗi; tên dễ đọc |
| `common/logging/service-logger.spec.ts` | Định dạng dòng log service |
| `common/logging/app-logger.service.spec.ts` | Định dạng dòng `app.log`; stack trace không bị nhận nhầm là service |

E2E (`test/app.e2e-spec.ts`): `/health` không cần key; thiếu/sai key `401`; đúng key nhưng chưa cài ứng dụng `503`; `/install` dữ liệu lạ `400`.

### 7.2 Kết quả chạy test

```
$ npm test
Test Suites: 16 passed, 16 total
Tests:       77 passed, 77 total

$ npm run test:e2e
Tests:       4 passed, 4 total
```

### 7.3 Kết quả kiểm thử API bằng cURL

Không cần Bitrix24 (chạy local):

```bash
$ curl -s -D - localhost:3000/health
x-request-id: f3d8560f
{"status":"ok","time":"..."}

$ curl -s localhost:3000/contacts
{"statusCode":401,"error":"Unauthorized","message":"Thiếu hoặc sai API key (header x-api-key)","errorKbn":20002,...}

$ curl -s -X POST localhost:3000/contacts -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d '{"name":123,"phone":"123","email":"abc","address":{"ward":5},"bank":{"bankName":"","accountNumber":"12ab"},"foo":1}'
{"statusCode":400,"error":"Validation Failed","message":["Trường \"foo\" không được hỗ trợ","Tên phải là chuỗi",
 "Số điện thoại không hợp lệ","Email không hợp lệ","address.ward: Phường/xã phải là chuỗi",
 "bank.bankName: Tên ngân hàng là bắt buộc","bank.accountNumber: Số tài khoản không hợp lệ (chỉ gồm 6-20 chữ số)"],"errorKbn":20001,...}

$ curl -s -X PUT localhost:3000/contacts/abc -H "x-api-key: $API_KEY" -H 'content-type: application/json' -d '{}'
{"statusCode":400,"error":"Bad Request","message":"ID contact phải là số nguyên dương","errorKbn":20001,...}

$ curl -s localhost:3000/contacts -H "x-api-key: $API_KEY"
{"statusCode":503,"error":"BITRIX24_NOT_INSTALLED","message":"Chưa có token cho portal b24-4totiv.bitrix24.vn. ...","errorKbn":40006,...}

$ curl -s -X POST localhost:3000/install -d 'foo=bar'
{"statusCode":400,"error":"Bad Request","message":"Không nhận dạng được dữ liệu cài đặt từ Bitrix24 (cần sự kiện ONAPPINSTALL, AUTH_ID/REFRESH_ID hoặc code)","errorKbn":20001,...}

$ curl -s -X POST localhost:3000/webhook/jotform -F formID=111 -F submissionID=6123456789
{"statusCode":422,"error":"Invalid Submission","message":["Form 111 không được hỗ trợ"],"errorKbn":20004,...}
```

**Các ca validate và lỗi** (chạy với Bitrix24 và Jotform thật, 04/10/2026). Mỗi ca trả `statusCode`, `errorKbn` và `message` như sau:

| # | Request | Kết quả |
|---|---|---|
| 1 | `POST /contacts` `{"email":"a@b.com"}` (thiếu `name`) | `400 20001` "Tên là bắt buộc" |
| 2 | `POST /contacts` `{"name":"   "}` | `400 20001` "Tên là bắt buộc" |
| 3 | `POST /contacts` `{"name":123}` | `400 20001` "Tên phải là chuỗi" |
| 4 | `POST /contacts` `{"name":"A","phone":"123"}` | `400 20001` "Số điện thoại không hợp lệ" |
| 5 | `POST /contacts` `{"name":"A","email":"abc"}` | `400 20001` "Email không hợp lệ" |
| 6 | `POST /contacts` `{"name":"A","website":"not a url"}` | `400 20001` "Website không hợp lệ" |
| 7 | `POST /contacts` `{"name":"A","address":{"ward":5}}` | `400 20001` "address.ward: Phường/xã phải là chuỗi" |
| 8 | `POST /contacts` `{"name":"A","bank":{"accountNumber":"0071000123456"}}` | `400 20001` "bank.bankName: Tên ngân hàng là bắt buộc" |
| 9 | `POST /contacts` `{"name":"A","bank":{"bankName":"VCB","accountNumber":"12ab"}}` | `400 20001` "bank.accountNumber: Số tài khoản không hợp lệ (chỉ gồm 6-20 chữ số)" |
| 10 | `POST /contacts` `{"name":"A","foo":1}` | `400 20001` "Trường \"foo\" không được hỗ trợ" |
| 11 | `PUT /contacts/9` `{}` | `400 20001` "Không có trường nào để cập nhật" |
| 12 | `GET /contacts/abc` | `400 20001` "ID contact phải là số nguyên dương" |
| 13 | `GET /contacts/999999` | `404 20003` "Contact không tồn tại (ID 999999)" |
| 14 | `GET /contacts?start=-1` | `400 20001` "start không được âm" |
| 15 | `GET /contacts` không có `x-api-key` | `401 20002` "Thiếu hoặc sai API key (header x-api-key)" |
| 16 | `POST /webhook/jotform` `-F formID=262753749396070` (thiếu `submissionID`) | `400 20001` "Thiếu hoặc sai submissionID" |
| 17 | `POST /webhook/jotform` `-F formID=111 -F submissionID=1` | `422 20004` "Form 111 không được hỗ trợ" |
| 18 | `POST /webhook/jotform` với `submissionID` không có thật | `502 30003` "Jotform từ chối truy cập (...): submission không tồn tại hoặc không thuộc tài khoản, hoặc JOTFORM_API_KEY sai/thiếu quyền" |

Các ca 1-15 dùng header `-H "x-api-key: $API_KEY" -H 'content-type: application/json'`. Ca 18: Jotform API trả `401` cho cả key sai lẫn submission không tồn tại, nên thông báo nêu cả hai khả năng.

**Luồng thành công với Bitrix24 và Jotform thật** (04/10/2026):

| Bước | Kết quả |
|---|---|
| Gửi form Jotform | `POST /webhook/jotform` `200`, `statusKbn 10000`, tạo contact `9` trên Bitrix24 |
| `POST /jotform/sync` | 3 submission: 2 tạo mới (contact `11`, `13`), 1 bỏ qua do trùng |
| Cài lại ứng dụng cục bộ | `POST /install` `201`, dạng `event` (`ONAPPINSTALL`), lưu token cho `b24-4totiv.bitrix24.vn` |
| `GET /bitrix/installation` | `memberId`, `domain`, `expiresInSeconds: 3466` |
| `GET /bitrix/test-call` | `callBitrixAPI('crm.contact.list')` trả `total = 5` |
| `POST /bitrix/token/refresh` | Làm mới thành công, `expiresInSeconds: 3600` |

<!-- TODO: bổ sung kết quả CRUD /contacts (POST, GET, PUT, DELETE) sau khi chạy thật -->
