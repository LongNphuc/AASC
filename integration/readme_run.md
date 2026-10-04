# Cài đặt và chạy `integration`

Làm lần lượt từ bước 0 đến bước 7. Có hai cách chạy ứng dụng: **local bằng Node.js** (khuyên dùng: log và DB nằm ngay trong thư mục, mở trực tiếp bằng VS Code) hoặc **Docker** (không cần cài Node.js, nhưng phải xem log và DB qua lệnh).

**Mục lục:** [0. Chuẩn bị](#0-chuẩn-bị) · [1. Lấy thông tin cấu hình](#1-lấy-thông-tin-cấu-hình) · [2. Tạo .env](#2-tạo-tệp-env) · [3. Khởi chạy](#3-khởi-chạy) · [4. ngrok](#4-mở-đường-hầm-ngrok) · [5. Bitrix24](#5-kết-nối-bitrix24-file-2) · [6. Jotform](#6-kết-nối-jotform-file-1) · [7. Kiểm tra](#7-kiểm-tra-nhanh) · [8. Test](#8-chạy-test) · [9. Sự cố](#9-xử-lý-sự-cố)

---

## 0. Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Node.js 20+ và npm 10+ | Cách A (khuyên dùng), và để chạy test |
| hoặc Docker và Docker Compose v2 | Cách B. Kiểm tra: `docker compose version` |
| Tài khoản ngrok (miễn phí) | Để Bitrix24 và Jotform gọi được vào máy. Cần một tên miền cố định |
| Portal Bitrix24 | Đã bật bản dùng thử |
| Tài khoản Jotform | Có form gồm 3 trường: Họ và tên, Số điện thoại, Email |

## 1. Lấy thông tin cấu hình

Ghi lại các giá trị dưới đây, bước 2 sẽ điền vào `.env`.

### 1.1 Tên miền ngrok → `PUBLIC_URL`

1. Đăng nhập [dashboard.ngrok.com](https://dashboard.ngrok.com), mục **Domains**, lấy tên miền cố định miễn phí, ví dụ `https://abc-xyz.ngrok-free.dev`.
2. Mục **Your Authtoken**: lấy authtoken (dùng ở bước 4).

### 1.2 Ứng dụng cục bộ Bitrix24 → `CLIENT_ID`, `CLIENT_SECRET` (File 2)

1. Trên Bitrix24: **Ứng dụng → Tài nguyên dành cho nhà phát triển → Khác → Ứng dụng cục bộ**.
2. Điền form:
   - Loại: **ứng dụng máy chủ**.
   - Bật **Chỉ dùng script, không có giao diện người dùng** (ngrok miễn phí chặn request cài đặt từ trình duyệt; bật mục này thì Bitrix24 gọi thẳng từ máy chủ).
   - **Đường dẫn xử lý** và **Đường dẫn cài đặt ban đầu**: `<PUBLIC_URL>/install`.
   - **Quyền**: `CRM (crm)`. Thêm `Người dùng (user)` nếu muốn lưu tên người cài.
3. Lưu, sao chép **Mã ứng dụng** (`CLIENT_ID`) và **Khóa ứng dụng** (`CLIENT_SECRET`).
4. Tên miền portal (ví dụ `b24-4totiv.bitrix24.vn`) là `BITRIX24_DOMAIN`.

### 1.3 Webhook vào Bitrix24 → `BITRIX24_WEBHOOK_URL` (File 1)

1. **Ứng dụng → Tài nguyên dành cho nhà phát triển → Khác → Webhook vào**.
2. Chọn quyền **CRM (crm)**, lưu.
3. Sao chép URL dạng `https://<portal>/rest/<user_id>/<mã>/`. Đây là bí mật: ai có URL đều gọi được CRM.

### 1.4 Jotform → `JOTFORM_API_KEY`, `JOTFORM_FORM_ID` (File 1)

1. Ảnh đại diện → **Settings → API → Create New Key**. Chọn **Full Access** nếu muốn ứng dụng tự gắn webhook vào form (bước 6).
2. ID form là dãy số cuối URL form: `https://form.jotform.com/<ID>`.
3. Trường Số điện thoại: trong Properties tắt **Input Mask** để nhập một ô liền.

### 1.5 Khóa bảo vệ API → `API_KEY`

Tự tạo một chuỗi ngẫu nhiên, client gửi qua header `x-api-key`:

```bash
openssl rand -base64 24
```

## 2. Tạo tệp `.env`

```bash
cd integration
cp .env.example .env
```

Mở `.env` và điền:

| Biến | Bắt buộc | Giá trị |
|---|---|---|
| `PORT` | | Cổng HTTP, mặc định `3000` |
| `PUBLIC_URL` | File 1 + 2 | Tên miền ngrok ở bước 1.1 (không có `/` cuối) |
| `BITRIX24_DOMAIN` | File 2 | Tên miền portal, ví dụ `b24-4totiv.bitrix24.vn` |
| `CLIENT_ID`, `CLIENT_SECRET` | File 2 | Bước 1.2 |
| `API_KEY` | File 2 | Bước 1.5 |
| `BITRIX24_WEBHOOK_URL` | File 1 | Bước 1.3 |
| `JOTFORM_API_KEY`, `JOTFORM_FORM_ID` | File 1 | Bước 1.4 |
| `JOTFORM_API_BASE_URL` | | Giữ mặc định; tài khoản Jotform vùng EU dùng `https://eu-api.jotform.com` |
| `BITRIX24_REQUISITE_PRESET_ID` | | Để trống: tự dò mẫu requisite "cá nhân" |
| `DATABASE_PATH`, `LOG_DIR`, `HTTP_TIMEOUT_MS` | | Giữ mặc định |

Thiếu biến nào thì ứng dụng vẫn chạy, cảnh báo lúc khởi động, và chỉ tính năng cần biến đó báo lỗi.

## 3. Khởi chạy

| | Cách A: local bằng Node.js (khuyên dùng) | Cách B: Docker |
|---|---|---|
| Log | `logs/app.log`, `logs/services/*.log`: mở thẳng trong VS Code | Trong volume `aasc-logs`: xem qua lệnh `docker compose ...` |
| DB | `data/app.sqlite`: mở thẳng trong VS Code | Trong volume `aasc-data`: truy vấn qua lệnh hoặc chép ra máy |
| Sửa code | Tự khởi động lại | Phải build lại image |
| Cần cài | Node.js | Docker |

Chỉ chạy **một** cách tại một thời điểm, vì cả hai cùng dùng cổng 3000. Hai cách dùng **hai DB riêng**: chuyển cách thì phải cài lại ứng dụng trên Bitrix24 (bước 5) để DB mới có token.

### Cách A: Local bằng Node.js (khuyên dùng)

```bash
cd integration
npm ci
npm run start:dev                 # chế độ phát triển, tự khởi động lại khi sửa code trong src/
# hoặc bản build:
npm run build && npm run start:prod
```

DB nằm ở `data/app.sqlite`, log nằm ở `logs/`. `start:dev` không theo dõi `.env`: sửa `.env` xong thì dừng (Ctrl+C) và chạy lại.

### Cách B: Docker

```bash
cd integration
docker compose up -d --build
docker compose ps                 # STATUS phải là "Up ... (healthy)" sau khoảng 30 giây
```

| Việc | Lệnh |
|---|---|
| Sửa `.env` xong, áp dụng | `docker compose up -d --force-recreate` |
| Sửa code xong, áp dụng | `docker compose up -d --build` |
| Dừng | `docker compose down` (dữ liệu vẫn giữ) |
| Xóa sạch dữ liệu | `docker compose down -v` (mất token, phải cài lại ứng dụng ở bước 5) |

Docker gọi `GET /health` mỗi 30 giây; 3 lần liên tiếp không trả lời trong 5 giây thì trạng thái chuyển thành `unhealthy`. Token và log nằm trong named volume (`aasc-data`, `aasc-logs`), không mất khi tạo lại container. Đổi `PORT` trong `.env` thì cổng ngoài đổi theo; bên trong container luôn là 3000.

### Xem log và DB trực tiếp

**Log** (thêm `-f` để xem live, Ctrl+C để thoát):

| Việc | Cách A: local | Cách B: Docker |
|---|---|---|
| Log console | Terminal đang chạy `npm run start:dev` | `docker compose logs -f` |
| `app.log` | Mở `logs/app.log` trong VS Code, hoặc `tail -f logs/app.log` | `docker compose exec integration tail -f /app/logs/app.log` |
| Log một service | `tail -f logs/services/service_jotform.log` | `docker compose exec integration tail -f /app/logs/services/service_jotform.log` |
| Log mọi service | `tail -f logs/services/*.log` | `docker compose exec integration sh -c 'tail -f /app/logs/services/*.log'` |
| Chỉ dòng lỗi | `grep ERROR logs/app.log` | `docker compose exec integration grep ERROR /app/logs/app.log` |
| Mọi dòng của một request | `grep <request_id> logs/services/*.log` | `docker compose exec integration sh -c 'grep <request_id> /app/logs/services/*.log'` |
| Chép log ra máy để mở bằng VS Code | | `docker compose cp integration:/app/logs ./logs-docker` |

`request_id` lấy từ cột thứ 4 của `app.log`, hoặc header `x-request-id` trong phản hồi API.

**DB** (SQLite, 3 bảng: `bitrix_installations`, `form_submissions`, `form_submission_details`):

- **Cách A, xem bằng giao diện:** cài extension **SQLite Viewer** cho VS Code, rồi bấm vào `data/app.sqlite`.
- **Cách A, truy vấn bằng lệnh** (mở chỉ đọc, dùng thư viện có sẵn trong dự án, không cần cài `sqlite3`):

```bash
q() { node -e "console.table(require('better-sqlite3')('data/app.sqlite',{readonly:true}).prepare(process.argv[1]).all())" "$1"; }

# Bản cài Bitrix24 (không chọn cột token để không lộ ra màn hình)
q "SELECT member_id, domain, expires_at, updated_at FROM bitrix_installations"

# 10 lần xử lý submission gần nhất
q "SELECT s.received_at, s.status_kbn, s.error_kbn, d.jotform_id, d.contact_id
   FROM form_submissions s JOIN form_submission_details d ON d.uuid = s.form_submission_detail_uuid
   ORDER BY s.received_at DESC LIMIT 10"
```

- **Cách B, truy vấn trong container:** thay đường dẫn DB thành `/app/data/app.sqlite` và chạy qua `docker compose exec`:

```bash
qd() { docker compose exec -T integration node -e "console.table(require('better-sqlite3')('/app/data/app.sqlite',{readonly:true}).prepare(process.argv[1]).all())" "$1"; }

qd "SELECT member_id, domain, expires_at, updated_at FROM bitrix_installations"
```

- **Cách B, xem bằng giao diện:** chép DB ra máy rồi mở bằng SQLite Viewer. Đây là bản chụp tại thời điểm chép, muốn cập nhật thì chép lại:

```bash
docker compose cp integration:/app/data/app.sqlite ./app-docker.sqlite
```

Các tệp chép ra (`logs-docker/`, `app-docker.sqlite`) đã nằm trong `.gitignore`. Ngoài ra có thể xem dữ liệu qua API: `GET /bitrix/installation` và `GET /jotform/submissions` (Swagger hoặc cURL, xem bước 7).

### Khởi động thành công

Log in ra (Docker: `docker compose logs`):

```
LOG  [Bootstrap] Đang chạy tại http://localhost:3000
LOG  [Bootstrap] Swagger: http://localhost:3000/docs
LOG  [Bootstrap] Đường dẫn cài đặt Bitrix24: https://<PUBLIC_URL>/install
LOG  [Bootstrap] Webhook Jotform: https://<PUBLIC_URL>/webhook/jotform
WARN [Bootstrap] Chưa cấu hình ...        ← chỉ hiện nếu còn biến trống
```

## 4. Mở đường hầm ngrok

```bash
ngrok config add-authtoken <authtoken ở bước 1.1>    # chỉ làm một lần
ngrok http 3000 --url <PUBLIC_URL>                    # 3000 = PORT trong .env
```

Kiểm tra từ máy khác hoặc từ trình duyệt:

```bash
curl <PUBLIC_URL>/health
# {"status":"ok","time":"..."}
```

## 5. Kết nối Bitrix24 (File 2)

1. Ứng dụng và ngrok đang chạy.
2. Trên Bitrix24, mở ứng dụng cục bộ ở bước 1.2, bấm **Cài đặt lại**.
3. Log có dòng:

```
LOG [InstallController] Nhận request cài đặt: {...,"body":{"event":"ONAPPINSTALL","auth":{"access_token":"[REDACTED len=..]",...}}}
LOG [BitrixInstallService] Cài mới ứng dụng trên <portal> (member_id=...), access_token hết hạn lúc ...
```

4. Kiểm tra token đã lưu (không lộ token):

```bash
curl -s localhost:3000/bitrix/installation -H "x-api-key: <API_KEY>"
```

Từ đây token tự làm mới, không cần cài lại.

## 6. Kết nối Jotform (File 1)

1. Gắn webhook vào form. Chọn một trong hai cách:
   - Qua API: `curl -s -X POST localhost:3000/jotform/webhooks -H "x-api-key: <API_KEY>"`
   - Trên giao diện: Form Builder → **Settings → Integrations → WebHooks** → dán `<PUBLIC_URL>/webhook/jotform`.
2. Mở form, gửi thử một lần.
3. Kiểm tra:

```bash
curl -s localhost:3000/jotform/submissions -H "x-api-key: <API_KEY>"
# [{"jotformId":"...","statusKbn":10000,"status":"SUCCESS","contactId":57,...}]
```

4. Trên Bitrix24, **CRM → Liên hệ** có contact mới với họ tên, số điện thoại, email vừa gửi.

Không dùng ngrok vẫn thử được File 1: gửi form, rồi gọi `POST /jotform/sync` để ứng dụng tự kéo submission về qua Jotform API.

## 7. Kiểm tra nhanh

Mở Swagger tại **http://localhost:3000/docs**, bấm **Authorize**, dán `API_KEY`, rồi dùng **Try it out**. Hoặc dùng cURL:

| Lệnh | Kết quả đúng |
|---|---|
| `curl localhost:3000/health` | `{"status":"ok",...}` |
| `curl localhost:3000/contacts` | `401`, `errorKbn: 20002` (thiếu API key) |
| `curl localhost:3000/contacts -H "x-api-key: <API_KEY>"` | Danh sách contact (sau khi làm bước 5) |
| `curl localhost:3000/bitrix/test-call -H "x-api-key: <API_KEY>"` | Phản hồi gốc của `crm.contact.list` |
| `curl -X POST localhost:3000/contacts -H "x-api-key: <API_KEY>" -H 'content-type: application/json' -d '{"name":"Test","email":"sai"}'` | `400`, "Email không hợp lệ" |

Danh sách đầy đủ endpoint và ví dụ: [readme_api.md](readme_api.md).

## 8. Chạy test

Cần Node.js (test không có trong image Docker):

```bash
cd integration
npm ci
npm test              # unit test
npm run test:e2e      # e2e
npm run lint:check    # ESLint + Prettier
```

## 9. Xử lý sự cố

Mọi lỗi API trả về `errorKbn`. Chữ số đầu cho biết nơi lỗi: 2 request, 3 Jotform, 4 Bitrix24, 5 OAuth Bitrix24, 9 ứng dụng.

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `docker compose ps` báo `Restarting`, hoặc app thoát ngay | Biến môi trường sai | Xem `docker compose logs`, tìm dòng "Biến môi trường không hợp lệ", sửa `.env` |
| `port is already allocated` hoặc `EADDRINUSE` | Cổng đã bị chiếm | Đổi `PORT` trong `.env`, chạy lại; ngrok trỏ theo cổng mới |
| `401`, `errorKbn: 20002` | Thiếu hoặc sai header `x-api-key` | Gửi đúng `API_KEY` |
| `503`, `errorKbn: 90002` | Chưa đặt `API_KEY` | Điền `.env`, chạy lại |
| `503`, `errorKbn: 40006` | Chưa cài ứng dụng trên Bitrix24 | Làm bước 5 |
| `503`, `errorKbn: 50005` | `refresh_token` hết hạn hoặc ứng dụng bị gỡ | Cài lại ứng dụng (bước 5) |
| `500`, `errorKbn: 50012` | Sai `CLIENT_ID`/`CLIENT_SECRET` | Sửa `.env`, chạy lại |
| `403` "Portal ... không được phép" | `BITRIX24_DOMAIN` không khớp portal cài ứng dụng | Sửa `BITRIX24_DOMAIN` |
| Gửi form, `errorKbn: 40003` | `BITRIX24_WEBHOOK_URL` sai hoặc webhook thiếu quyền CRM | Tạo lại webhook (bước 1.3) |
| Gửi form, `errorKbn: 30003` | Sai `JOTFORM_API_KEY` | Kiểm tra key; tài khoản EU thì đổi `JOTFORM_API_BASE_URL` |
| Cài lại ứng dụng nhưng không có log `/install` | ngrok chưa chạy, sai cổng, hoặc sai đường dẫn | Kiểm tra `curl <PUBLIC_URL>/health`; đường dẫn ứng dụng phải là `<PUBLIC_URL>/install` |
| Mở URL ngrok trên trình duyệt thấy trang cảnh báo | Trang cảnh báo của ngrok miễn phí | Bấm **Visit Site**; request từ máy chủ không bị ảnh hưởng |
| `npm ci` lỗi khi cài `better-sqlite3` | Thiếu bản dựng sẵn cho máy | Cài `python3`, `make`, `g++` rồi chạy lại, hoặc dùng Docker (cách B) |

Tra lỗi theo log: tìm dòng `ERROR` trong `app.log` để lấy `request_id`, rồi lọc `logs/services/*.log` theo mã đó. Lệnh tương ứng khi chạy Docker: xem [mục 3, Xem log và DB trực tiếp](#xem-log-và-db-trực-tiếp).

```bash
grep ERROR logs/app.log | tail
grep <request_id> logs/services/*.log
```
