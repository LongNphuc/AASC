# Thiết kế `integration`

Giải thích vì sao ứng dụng được làm như hiện tại: luồng xử lý, cách lưu dữ liệu, mã trạng thái, log, bảo mật. Ý nghĩa từng tệp xem [readme_structure.md](readme_structure.md); endpoint xem [readme_api.md](readme_api.md).

**Mục lục:** [1. Kiến trúc](#1-kiến-trúc) · [2. OAuth 2.0 với Bitrix24](#2-file-2-bài-1-oauth-20-với-bitrix24) · [3. Quản lý contact](#3-file-2-bài-2-quản-lý-contact) · [4. Jotform sang Bitrix24](#4-file-1-jotform-sang-bitrix24) · [5. DB và mã kbn](#5-db-và-mã-kbn) · [6. Ghi log](#6-ghi-log) · [7. Bảo mật](#7-bảo-mật) · [8. Giới hạn](#8-giới-hạn-và-hướng-mở-rộng)

---

## 1. Kiến trúc

```
                     ngrok (https://<tên-miền>.ngrok-free.dev)
                                      │
             ┌────────────────────────┼─────────────────────────┐
  Bitrix24 ──┤ POST /install          │ POST /webhook/jotform   ├── Jotform
             │ (không cần API key)    │ (không cần API key)     │
             │                        │                         │
  Client  ───┤ /contacts, /bitrix/*, /jotform/*  (header x-api-key)
             └────────────────────────┼─────────────────────────┘
                                      ▼
                        Ứng dụng NestJS (cổng 3000)
   ┌──────────────────────────┬───────────────────────┬────────────────────────┐
   │ BitrixModule             │ ContactsModule        │ JotformModule          │
   │ - /install               │ - CRUD contact        │ - nhận webhook         │
   │ - lưu, làm mới token     │ - requisite, ngân     │ - lấy submission qua   │
   │ - callBitrixAPI (OAuth)  │   hàng, địa chỉ       │   Jotform API          │
   │ - BitrixWebhookClient    │                       │ - lưu nội dung, chống  │
   │                          │                       │   tạo trùng            │
   └─────────────┬────────────┴───────────┬───────────┴───────────┬────────────┘
                 │ OAuth                  │ OAuth                 │ webhook vào
                 ▼                        ▼                       ▼
                               Bitrix24 REST API
            SQLite (data/app.sqlite): token Bitrix24, lịch sử submission Jotform
```

**Vì sao File 1 và File 2 chung một ứng dụng:** tài khoản ngrok miễn phí chỉ có một tên miền cố định. Một ứng dụng trên cổng 3000 phục vụ được cả `/install` (Bitrix24 gọi) lẫn `/webhook/jotform` (Jotform gọi) qua cùng một đường hầm. Mỗi phần vẫn là một module riêng.

**Hai cách xác thực với Bitrix24:**

| Phần | Cách xác thực | Lý do |
|---|---|---|
| File 2 (OAuth, contact) | OAuth 2.0 qua ứng dụng cục bộ: `access_token` sống 1 giờ, làm mới bằng `refresh_token` | Đề yêu cầu |
| File 1 (Jotform) | Webhook vào: một URL cố định chứa sẵn mã xác thực, không cần làm mới | Đề yêu cầu "thiết lập webhook trên Bitrix24" |

**Công nghệ:** NestJS 11, TypeScript, `@nestjs/axios`, `@nestjs/config`, `@nestjs/schedule`, `@nestjs/swagger`, TypeORM + SQLite (`better-sqlite3`), `class-validator`, Jest, ESLint, Prettier, Docker.

**Vì sao NestJS 11 mà không phải 12:** NestJS 12 chỉ chạy ESM và mặc định dùng Vitest + oxlint. Đề yêu cầu Jest (File 3) và ESLint, mà Jest chạy ESM vẫn là tính năng thử nghiệm. NestJS 11 vẫn được hỗ trợ, chạy CommonJS, dùng Jest và ESLint ổn định.

---

## 2. File 2 bài 1: OAuth 2.0 với Bitrix24

### 2.1 `/install`: ba dạng dữ liệu

Bitrix24 gửi dữ liệu cài đặt theo một trong ba dạng, tùy cấu hình ứng dụng cục bộ. `/install` nhận cả ba (`bitrix/parsers/install-payload.parser.ts`):

| Dạng | Khi nào | Dữ liệu |
|---|---|---|
| `event` | Ứng dụng "chỉ script". Máy chủ Bitrix24 POST sự kiện `ONAPPINSTALL` | `auth[access_token]`, `auth[refresh_token]`, `auth[expires_in]`, `auth[domain]`, `auth[member_id]`, `auth[application_token]` |
| `iframe` | Ứng dụng có giao diện. Trình duyệt POST form vào khung ứng dụng | `AUTH_ID`, `REFRESH_ID`, `AUTH_EXPIRES`, `member_id`; `DOMAIN` trên query |
| `code` | Luồng OAuth chuẩn, chuyển hướng về với `?code=` | Backend tự đổi `code` lấy token tại `oauth.bitrix.info` |

Nên bật "chỉ script": ngrok miễn phí chèn trang cảnh báo vào request từ trình duyệt, làm hỏng dạng `iframe`; dạng `event` đi từ máy chủ tới máy chủ nên không bị ảnh hưởng. Nếu dùng dạng `iframe`, trang trả về gọi `BX24.installFinish()` chỉ khi `app.info` báo ứng dụng chưa cài xong. Đường dẫn xử lý và đường dẫn cài đặt cùng là `/install`, nên gọi lúc đã cài sẽ làm khung tải lại liên tục.

**Các bước xử lý** (`BitrixInstallService.handleInstall`):

1. Ghi log method, query, body (đã che token) để biết portal gửi dạng nào.
2. Nhận dạng dữ liệu; dạng `code` thì đổi lấy token. Việc đổi cần `client_secret` nên chỉ làm ở backend.
3. Chỉ chấp nhận portal trong `BITRIX24_DOMAIN`. URL gọi REST dựng từ tên miền này, nên kiểm tra nó cũng chặn dữ liệu giả lái request của máy chủ đi nơi khác (SSRF).
4. Gọi `app.info` bằng chính token vừa nhận để xác minh token thật. `/install` để công khai nên không thể tin dữ liệu POST vào.
5. Lưu token: tìm theo `member_id`, có rồi thì cập nhật (cài lại), chưa có thì thêm mới.
6. Gọi `user.current` để lưu ID và tên người cài (không bắt buộc, lỗi thì chỉ cảnh báo).

### 2.2 Lưu trữ token

Bảng `bitrix_installations` trong SQLite, khóa chính `member_id` (mã duy nhất của portal, do Bitrix24 cấp):

| Cột | Ý nghĩa |
|---|---|
| `member_id` | Mã duy nhất của portal |
| `domain` | Tên miền portal |
| `access_token`, `refresh_token` | Bộ token hiện hành |
| `expires_at` | Thời điểm access_token hết hạn |
| `user_id`, `user_name` | Người cài ứng dụng |
| `scope`, `application_token` | Quyền, mã xác minh sự kiện |
| `installed_at`, `updated_at` | Thời điểm cài lần đầu, cập nhật gần nhất |

Chọn SQLite thay vì tệp JSON vì cần upsert theo khóa và ghi đồng thời an toàn.

### 2.3 Vòng đời token

`access_token` sống 1 giờ. Mỗi lần làm mới, Bitrix24 cấp `refresh_token` mới và vô hiệu cái cũ, nên luôn lưu cả hai.

**Lớp 1, làm mới khi gọi API** (`BitrixService.callBitrixAPI`):

```
callBitrixAPI(method, payload)
  ├─ token còn dưới 60 giây? ──► làm mới trước
  ├─ gọi https://<portal>/rest/<method>.json, token đặt trong body (auth)
  └─ Bitrix24 trả expired_token / invalid_token?
        └─► làm mới, gọi lại ĐÚNG MỘT lần (lần 2 vẫn lỗi thì báo lỗi, không lặp)
```

**Lớp 2, batch làm mới chủ động** (`TokenRefreshScheduler`): chạy mỗi 30 phút (phút :00 và :30), làm mới mọi token còn dưới 35 phút. Việc này cũng giữ `refresh_token` luôn mới khi ứng dụng ít được dùng.

- **Vì sao 30 phút, không phải 1 giờ:** token sống 60 phút. Chạy mỗi giờ thì token cấp ngay sau một lần chạy chỉ còn khoảng 1 phút khi tới lần kế, chậm một chút là hết hạn. Chu kỳ 30 phút + cửa sổ 35 phút bắt mọi token khi còn 5 đến 35 phút.
- **Truy vấn:** lọc ngay trong SQL `WHERE expires_at < bây giờ + 35 phút`, không đọc hết bảng ra rồi lọc.
- **Code:** `ScheduleModule.forRoot()` trong `app.module.ts` bật cơ chế chạy định kỳ; `bitrix/schedulers/token-refresh.scheduler.ts` khai báo `@Cron(EVERY_30_MINUTES)`; `bitrix.module.ts` đăng ký scheduler; `BitrixTokenService.refreshExpiring` thực hiện. Mỗi lần chạy ghi dòng `cron bitrix-token-refresh` vào `logs/services/service_auth.log`.

**Khóa chống làm mới trùng:** mỗi `member_id` chỉ có một lần làm mới tại một thời điểm, request đến sau chờ chung kết quả. Hai request cùng gửi một `refresh_token` thì request thứ hai sẽ thất bại vì token đó đã bị vô hiệu.

**refresh_token hỏng** (hết hạn, ứng dụng bị gỡ): ghi log lỗi, trả `503` với `errorKbn 50005` và hướng dẫn cài lại ứng dụng.

---

## 3. File 2 bài 2: Quản lý contact

### 3.1 Dữ liệu trên Bitrix24

Ngân hàng và địa chỉ không nằm trực tiếp trên contact mà nằm trong một bản "chi tiết" (requisite) gắn với contact:

```
contact  (NAME, PHONE[], EMAIL[], WEB[])
  └─ requisite  (ENTITY_TYPE_ID=3, ENTITY_ID=<id contact>, PRESET_ID=<mẫu cá nhân>)
       ├─ bank detail  (RQ_BANK_NAME, RQ_ACC_NUM)
       └─ address      (ENTITY_TYPE_ID=8, TYPE_ID=1 địa chỉ thực tế)
```

| Trường API | Trường Bitrix24 |
|---|---|
| `name` | `NAME` (cả họ tên) |
| `phone`, `email`, `website` | `PHONE`, `EMAIL`, `WEB`: mảng `[{ VALUE, VALUE_TYPE: "WORK" }]` |
| `address.street` | `ADDRESS_1` |
| `address.ward` | `ADDRESS_2` |
| `address.district` | `REGION` |
| `address.province` | `PROVINCE` |
| `bank.bankName` | `RQ_BANK_NAME` (và `NAME` của bank detail) |
| `bank.accountNumber` | `RQ_ACC_NUM` |

Ánh xạ địa chỉ được chọn để chuỗi địa chỉ Bitrix24 ghép ra đúng thứ tự Việt Nam: "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh". Toàn bộ ánh xạ nằm ở `contacts/mappers/contact.mapper.ts`. `PRESET_ID` lấy từ `BITRIX24_REQUISITE_PRESET_ID` nếu có, không thì gọi `crm.requisite.preset.list` và chọn mẫu dành cho cá nhân.

### 3.2 Xử lý khi một bước thất bại

Bitrix24 REST không có transaction, nên:

- **Tạo:** đi từ trên xuống (contact → requisite → địa chỉ → ngân hàng). Bước sau lỗi thì xóa contact vừa tạo rồi báo lỗi, để không để lại contact dở dang.
- **Sửa:** chỉ trường được gửi lên mới thay đổi. Với `PHONE`/`EMAIL`/`WEB`, gửi `{ VALUE }` sẽ thêm số mới chứ không thay thế, nên ứng dụng đọc contact hiện tại và sửa giá trị đầu tiên theo `ID`. Không hoàn tác được nếu lỗi giữa chừng, nhưng mỗi bước là ghi đè nên gửi lại cùng request là an toàn. Đổi tên thì tên requisite cũng được cập nhật (`crm.requisite.update`).
- **Xóa:** đi từ dưới lên (ngân hàng → địa chỉ → requisite → contact).
- **Đọc danh sách:** requisite, ngân hàng, địa chỉ của cả trang được đọc bằng 3 lệnh gọi lọc theo danh sách ID, thay vì 3 lệnh cho mỗi contact.

---

## 4. File 1: Jotform sang Bitrix24

```
Người dùng gửi form
  → Jotform POST multipart/form-data tới <ngrok>/webhook/jotform
  → submissionID đã có contact? → trả "bỏ qua do trùng", không ghi DB, dừng
  → ghi lần xử lý vào form_submissions (10002 đang xử lý)
  → lấy lại submission qua Jotform API bằng submissionID, lưu form_content
  → kiểm tra đúng form, ánh xạ, validate
  → crm.contact.add qua BITRIX24_WEBHOOK_URL, lưu contact_id
  → cập nhật status_kbn / error_kbn, ghi log
```

- **Dùng Jotform API để lấy dữ liệu:** chỉ lấy `submissionID` từ webhook rồi gọi `GET /submission/{id}`. URL webhook công khai nên ai cũng POST vào được; dữ liệu lấy bằng API key của mình thì chắc chắn có thật và thuộc tài khoản của mình. Submission của form khác `JOTFORM_FORM_ID` bị từ chối (`422`, `errorKbn 20004`).
- **Ánh xạ trường:** tìm theo loại trường (`control_email`, `control_phone`, `control_fullname`) trước, rồi đến ô văn bản có tên/nhãn gợi ý ("tên", "name"). Không phụ thuộc vào qid, vốn đổi khi sửa form. Họ và tên → `NAME`, số điện thoại → `PHONE`, email → `EMAIL`. Số điện thoại được bỏ khoảng trắng, dấu chấm, gạch, ngoặc.
- **Tự lưu nội dung form:** Jotform không chắc giữ lịch sử từng lần gửi webhook, nên ứng dụng lưu nội dung mỗi submission vào `form_submission_details.form_content` (JSON) và ghi mỗi lần xử lý (thành công hoặc thất bại) vào `form_submissions`.
- **Chống tạo trùng** (không cần bộ đếm số lần thử):
  - `jotform_id` là duy nhất trong `form_submission_details`, nên một submission chỉ có một dòng chi tiết.
  - Nhận lại submission đã có `contact_id` thì trả về `statusKbn: 10003` (bỏ qua do trùng) kèm `contactId` cũ: không tạo contact, **không ghi DB**. Lần nhận lặp lại chỉ để lại một dòng trong `services/service_jotform.log`.
  - Hai request cùng một submission đến đồng thời: khóa trong bộ nhớ theo `jotform_id` cho một request xử lý, request kia trả `10003`.
- **Không tự thử lại:** lỗi thì ghi `status_kbn=10001` kèm `error_kbn`. Submission chưa tạo được contact mà được nhận lại (Jotform gửi lại, hoặc gọi đồng bộ bù) thì được xử lý như mới.
- **Đồng bộ bù:** `POST /jotform/sync` đọc các submission mới nhất qua Jotform API và tạo contact cho cái chưa có. Dùng khi webhook bị lỡ lúc máy hoặc ngrok tắt.

---

## 5. DB và mã kbn

SQLite, tệp `data/app.sqlite` (Docker: trong volume `aasc-data`). Bảng được TypeORM tạo từ entity. Bảng của ứng dụng dùng khóa chính uuid; riêng `bitrix_installations` dùng `member_id` vì đó là mã do Bitrix24 cấp.

### 5.1 Các bảng

**`bitrix_installations`**: token OAuth của từng portal (xem [2.2](#22-lưu-trữ-token)).

**`form_submission_details`**: nội dung submission, mỗi submission Jotform một dòng.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `uuid` | varchar (uuid) | Khóa chính |
| `jotform_id` | varchar, duy nhất, có thể null | `submissionID` của Jotform (nếu có) |
| `form_content` | json | Nội dung form: `{ formId, submittedAt, answers: { "<nhãn câu hỏi>": "<câu trả lời>" } }` |
| `contact_id` | integer, có thể null | ID contact đã tạo trên Bitrix24; null là chưa tạo được |

**`form_submissions`**: mỗi lần ứng dụng xử lý một submission (thành công hoặc thất bại) là một dòng. Lần nhận lặp lại của submission đã có contact thì không ghi.

| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `uuid` | varchar (uuid) | Khóa chính |
| `form_submission_detail_uuid` | varchar | Khóa ngoại tới `form_submission_details.uuid` |
| `status_kbn` | integer | Kết quả xử lý (5.2) |
| `error_kbn` | integer, có thể null | Lý do thất bại (5.3) |
| `received_at`, `updated_at` | datetime | Thời điểm nhận, cập nhật |

SQLite không có kiểu `jsonb` (của PostgreSQL); cột `form_content` lưu JSON dạng TEXT và truy vấn được bằng `json_extract()`. Chuyển sang PostgreSQL thì đổi kiểu cột thành `jsonb`.

```sql
-- Các lần xử lý thất bại, kèm nội dung form
SELECT s.received_at, s.error_kbn, d.jotform_id, json_extract(d.form_content, '$.answers')
FROM form_submissions s JOIN form_submission_details d ON d.uuid = s.form_submission_detail_uuid
WHERE s.status_kbn = 10001;
```

### 5.2 `status_kbn`

| Mã | Tên | Ý nghĩa |
|---|---|---|
| 10000 | SUCCESS | Xử lý xong (đã tạo contact) |
| 10001 | FAILED | Thất bại; lý do ở `error_kbn` |
| 10002 | PROCESSING | Đang xử lý. Còn ở trạng thái này lâu nghĩa là tiến trình dừng giữa chừng |
| 10003 | SKIPPED_DUPLICATE | Bỏ qua do trùng: đã tạo contact trước đó, hoặc request khác đang xử lý. **Chỉ có trong response và log, không ghi DB** |

### 5.3 `error_kbn`

Mã gồm 5 chữ số: **chữ số đầu là nơi xảy ra lỗi**, 4 số cuối là loại lỗi.

| Chữ số đầu | Nguồn |
|---|---|
| 2 | Request hoặc dữ liệu gửi vào ứng dụng |
| 3 | Jotform |
| 4 | Bitrix24 REST |
| 5 | Máy chủ OAuth Bitrix24 |
| 9 | Bên trong ứng dụng |

Lỗi khi gọi dịch vụ ngoài (nguồn 3, 4, 5), mã = nguồn × 10000 + loại:

| 4 số cuối | Loại | Ví dụ |
|---|---|---|
| 0001 | TIMEOUT | `30001` Jotform quá thời gian chờ |
| 0002 | NETWORK | `40002` không kết nối được Bitrix24 |
| 0003 | AUTH | `40003` Bitrix24 từ chối xác thực (sai webhook URL, thiếu quyền) |
| 0004 | TOKEN_EXPIRED | `40004` access_token hết hạn |
| 0005 | REINSTALL_REQUIRED | `50005` refresh_token hỏng, cần cài lại ứng dụng |
| 0006 | NOT_INSTALLED | `40006` chưa cài ứng dụng |
| 0007 | NOT_FOUND | `40007` bản ghi không tồn tại trên Bitrix24 |
| 0008 | BAD_REQUEST | `40008` Bitrix24 từ chối dữ liệu |
| 0009 | RATE_LIMIT | `40009` vượt giới hạn tần suất |
| 0010 | SERVER | `40010` máy chủ Bitrix24 lỗi |
| 0011 | INVALID_RESPONSE | `30011` phản hồi sai định dạng |
| 0012 | CONFIG | `30012` thiếu `JOTFORM_API_KEY` |

Lỗi của request gửi vào và lỗi hệ thống:

| Mã | Tên | Ý nghĩa |
|---|---|---|
| 20001 | VALIDATION | Dữ liệu không hợp lệ (DTO, submission thiếu/sai trường) |
| 20002 | UNAUTHORIZED | Thiếu hoặc sai API key |
| 20003 | NOT_FOUND | Bản ghi hoặc đường dẫn không tồn tại |
| 20004 | FORM_MISMATCH | Submission không thuộc form đã cấu hình |
| 90001 | UNKNOWN | Lỗi không lường trước |
| 90002 | CONFIG | Ứng dụng thiếu cấu hình (ví dụ chưa đặt `API_KEY`) |

Cùng bộ mã dùng ở ba nơi: cột DB, log (`error_kbn=40003(BITRIX24.AUTH)`) và trường `errorKbn` trong body lỗi trả về client. Định nghĩa ở `src/common/kbn/`.

---

## 6. Ghi log

Log chia hai tầng trong `LOG_DIR` (mặc định `logs/`; Docker: trong volume `aasc-logs`):

```
logs/
├── app.log                    dòng thời gian của mọi sự kiện
└── services/
    ├── service_auth.log       request vào /install, /bitrix/*; lệnh gọi máy chủ OAuth; batch làm mới token
    ├── service_bitrix.log     từng lệnh gọi Bitrix24 REST (cả OAuth lẫn webhook vào)
    ├── service_contacts.log   request vào /contacts
    └── service_jotform.log    request vào /webhook/jotform, /jotform/*; lệnh gọi Jotform API; kết quả xử lý submission
```

**`app.log`**: mỗi sự kiện một dòng: thời gian | mức | service | request_id | [lớp] nội dung.

```
2026-10-03T18:23:46.188Z | WARN  | system | - | [Bootstrap] Chưa cấu hình JOTFORM_API_KEY (File 1 không đọc được submission)
2026-10-03T18:23:50.567Z | LOG   | service_jotform | c6b61864 | [JotformService] [6123456789] Nhận submission
2026-10-03T18:23:50.592Z | ERROR | service_jotform | c6b61864 | [JotformService] [6123456789] Xử lý thất bại (error_kbn=30012 JOTFORM.CONFIG): Chưa cấu hình JOTFORM_API_KEY
```

**`services/<service>.log`**: mỗi lệnh gọi API (vào hoặc ra) một dòng: thời gian | request_id | method | status_kbn | error_kbn | thời gian chạy | error_detail.

```
2026-10-03T18:23:50.520Z | 1787c386 | GET /contacts 401 | status_kbn=10001(FAILED) | error_kbn=20002(REQUEST.UNAUTHORIZED) | 2ms | Unauthorized: Thiếu hoặc sai API key (header x-api-key)
2026-10-03T18:23:50.592Z | c6b61864 | process submission 6123456789 | status_kbn=10001(FAILED) | error_kbn=30012(JOTFORM.CONFIG) | 25ms | Chưa cấu hình JOTFORM_API_KEY
2026-10-04T09:00:00.049Z | - | cron bitrix-token-refresh | status_kbn=10000(SUCCESS) | error_kbn=- | 8ms | -
```

- **`request_id`:** mỗi request được cấp một mã 8 ký tự, trả về trong header `x-request-id`. Mọi dòng log sinh ra trong request đó (ở bất kỳ service nào) đều mang mã này. Dòng chạy ngoài request (khởi động, batch) ghi `-`.
- **Lỗi khởi động** (biến môi trường sai, cổng bị chiếm...) cũng vào `app.log`: tệp log được mở trước khi Nest khởi tạo, ứng dụng ghi một dòng tóm tắt, chờ ghi xong rồi thoát với mã 1.
- **Cách debug:** tìm dòng `WARN`/`ERROR` trong `app.log` để biết service và `request_id`, rồi `grep <request_id> logs/services/*.log` để thấy mọi lệnh gọi của request đó.
- **Không ghi bí mật:** không ghi token, `client_secret`, API key hay mã trong URL webhook. Body request cài đặt được ghi với giá trị bí mật thay bằng `[REDACTED len=..]`. Webhook Jotform chỉ ghi tên các trường, không ghi câu trả lời (dữ liệu cá nhân). Query string không được ghi (có thể chứa mã OAuth `code`).
- **Healthcheck không ghi log:** Docker gọi `/health` mỗi 30 giây nhưng đường dẫn này không thuộc service nào nên không làm đầy log.

---

## 7. Bảo mật

- Bí mật chỉ nằm trong `.env` (đã `.gitignore`); repo chỉ có `.env.example` để trống.
- Endpoint của ứng dụng được bảo vệ mặc định bằng guard toàn cục (`x-api-key`, so sánh thời gian không đổi); chỉ `/install`, `/webhook/jotform`, `/health` gắn `@Public()` vì bên gọi không gửi được header.
- Đổi `code` và làm mới token cần `client_secret`, nên chỉ chạy ở backend.
- `/install`: chỉ nhận portal đã cấu hình, xác minh token bằng `app.info` trước khi lưu.
- `/webhook/jotform`: không tin body, lấy lại dữ liệu qua Jotform API; chỉ nhận form đã cấu hình.
- Token đặt trong body request thay vì URL; API key Jotform gửi qua header `APIKEY`. Log tự che token, secret và mã trong URL webhook.
- Container chạy bằng user `node`, không chạy bằng root.
- Trang `/docs` (Swagger) không nằm sau guard: ai cũng đọc được tài liệu API, nhưng không gọi được endpoint có khóa nếu thiếu key.

---

## 8. Giới hạn và hướng mở rộng

- **Nhiều portal, nhiều tiến trình:** khóa chống làm mới token trùng và khóa chống xử lý submission trùng nằm trong bộ nhớ, chỉ đúng khi chạy một tiến trình. Mở rộng thì dùng khóa phân tán (Redis) và hàng đợi như BullMQ. Hiện không dùng để người chấm không phải cài Redis.
- **Mã hóa token khi lưu:** có thể thêm column transformer AES-GCM với khóa trong biến môi trường.
- **Migration:** đang dùng `synchronize: true` cho gọn khi demo; production nên dùng migration của TypeORM.
- **Xoay vòng log:** tệp log ghi nối tiếp, chưa tự cắt theo ngày; production nên dùng logrotate hoặc winston.
- **Contact nhiều số điện thoại, nhiều requisite:** API làm việc với giá trị đầu tiên (số điện thoại, email, website) và requisite tạo sớm nhất.
- **`/health` chỉ kiểm tra tiến trình còn sống:** chưa kiểm tra DB, token hay kết nối Bitrix24/Jotform.
