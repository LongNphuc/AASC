# Cài đặt và chạy `api-nestjs`

Khuyên chạy **local bằng Node.js**: log và DB nằm ngay trong thư mục, mở trực tiếp bằng VS Code. Docker là cách thứ hai, khi máy không cài Node.js.

## 1. Chạy

Cần Node.js 20 trở lên.

```bash
cd logic-programming/api-nestjs
npm ci
npm run start:dev                 # tự khởi động lại khi sửa code trong src/
# hoặc bản build:
npm run build && npm run start:prod
```

Khởi động thành công thì log in ra:

```
LOG [Bootstrap] Đang chạy tại http://localhost:3002
LOG [Bootstrap] Swagger: http://localhost:3002/docs
```

Không cần tạo `.env`: mọi biến đều có mặc định. Muốn đổi thì `cp .env.example .env` rồi sửa:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3002` | Cổng HTTP (khác cổng 3000 của integration và 3001 của game-server, nên chạy cùng lúc được) |
| `DATABASE_PATH` | `data/tasks.sqlite` | Tệp SQLite |
| `LOG_DIR` | `logs` | Thư mục log |

## 2. Dùng Swagger

1. Mở **http://localhost:3002/docs**.
2. Chọn một API, ví dụ `POST /tasks`, bấm **Try it out**.
3. Sửa body mẫu rồi bấm **Execute**. Phản hồi hiện ngay bên dưới.
4. Lấy `uuid` trong phản hồi để thử `GET`, `PATCH`, `DELETE /tasks/{uuid}`.

## 3. Gọi bằng cURL

```bash
# Tạo task kèm task con → { "r": 10000, "d": { "uuid": "...", ... } }
curl -s -X POST localhost:3002/tasks -H 'content-type: application/json' \
  -d '{"title":"CRUD","subtasks":[{"taskName":"create","timeEstimate":1.5}]}'

curl -s localhost:3002/tasks                      # danh sách → { "r": 10000, "l": [...] }
curl -s localhost:3002/tasks/<uuid>               # một task, kèm task con → { "r": 10000, "d": {...} }

# Đổi trạng thái sang Done, thay toàn bộ danh sách task con
curl -s -X PATCH localhost:3002/tasks/<uuid> -H 'content-type: application/json' \
  -d '{"statusKbn":11002,"subtasks":[{"taskName":"update","timeEstimate":2,"statusKbn":12001}]}'

curl -s -X DELETE localhost:3002/tasks/<uuid>     # { "r": 10000 }
```

## 4. Test

```bash
npm test              # unit test (38 test)
npm run test:e2e      # e2e: app thật, SQLite trong bộ nhớ (4 test)
npm run lint:check    # ESLint + Prettier
npm run perf-test     # đo GET với 100 bản ghi; server phải đang chạy
```

`perf-test` tạo 100 task, đo rồi xóa (xóa mềm) 100 task đó. Server ở cổng khác thì chạy `BASE_URL=http://localhost:<cổng> npm run perf-test`.

## 5. Xem log và DB

**Log:**
- `logs/app.log`: mọi sự kiện.
- `logs/services/service_task.log`: mỗi request một dòng (`request_id | method | status_kbn | error_kbn | thời gian | lỗi`).
- `request_id` có trong header `x-request-id` của phản hồi. Lọc mọi dòng của một request: `grep <request_id> logs/app.log logs/services/*.log`.

**DB** `data/tasks.sqlite`: cài extension **SQLite Viewer** cho VS Code rồi bấm vào tệp. Hoặc truy vấn bằng lệnh (mở chỉ đọc, không cần cài `sqlite3`):

```bash
q() { node -e "console.table(require('better-sqlite3')('data/tasks.sqlite',{readonly:true}).prepare(process.argv[1]).all())" "$1"; }

q "SELECT t.title, t.status_kbn, t.created_at, t.deleted_at, d.data_json
   FROM tasks t JOIN task_details d ON d.uuid = t.task_detail_uuid
   ORDER BY t.created_at DESC LIMIT 10"
```

## 6. Docker (không bắt buộc)

```bash
docker compose up -d --build      # http://localhost:3002/docs
docker compose ps                 # STATUS "Up ... (healthy)" sau khoảng 30 giây
docker compose logs -f            # xem log
docker compose down               # dừng (dữ liệu giữ trong volume task-data)
```

## 7. Sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| `EADDRINUSE` (cổng 3002 đã bị chiếm) | Đổi `PORT` trong `.env`, chạy lại |
| App thoát ngay, log có "Biến môi trường không hợp lệ" | Sửa giá trị trong `.env` theo thông báo |
| `npm ci` lỗi khi cài `better-sqlite3` | Cài `python3`, `make`, `g++` rồi chạy lại, hoặc dùng Docker |
| `perf-test` báo "Server đã chạy ... chưa?" | Chạy server trước (mục 1) |
