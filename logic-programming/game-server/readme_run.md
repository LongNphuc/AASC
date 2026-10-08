# Cài đặt và chạy `game-server`

Có hai cách chạy: **local bằng Node.js** (khuyên dùng: log và DB nằm ngay trong thư mục, mở trực tiếp bằng VS Code) hoặc **Docker** (không cần cài Node.js, nhưng phải xem log và DB qua lệnh). Không cần tài khoản hay dịch vụ bên ngoài nào.

**Mục lục:** [0. Chuẩn bị](#0-chuẩn-bị) · [1. Tạo .env](#1-tạo-tệp-env-không-bắt-buộc) · [2. Khởi chạy](#2-khởi-chạy) · [3. Chơi trên trình duyệt](#3-chơi-trên-trình-duyệt) · [4. Gọi API bằng cURL](#4-gọi-api-bằng-curl) · [5. Test](#5-chạy-test) · [6. Log và DB](#6-xem-log-và-db) · [7. Sự cố](#7-xử-lý-sự-cố)

---

## 0. Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Node.js 20+ và npm 10+ | Cách A (khuyên dùng), và để chạy test, load test |
| hoặc Docker và Docker Compose v2 | Cách B. Kiểm tra: `docker compose version` |
| Trình duyệt | Chrome, Edge hoặc Firefox. Chơi caro một mình thì cần thêm một cửa sổ ẩn danh (mục 3) |

## 1. Tạo tệp `.env` (không bắt buộc)

Mọi biến đều có giá trị mặc định, nên bỏ qua bước này vẫn chạy được.

```bash
cd logic-programming/game-server
cp .env.example .env
```

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng HTTP và WebSocket (khác cổng 3000 của phần `integration`, nên chạy cùng lúc được) |
| `DATABASE_PATH` | `data/game.sqlite` | Tệp SQLite |
| `LOG_DIR` | `logs` | Thư mục log |
| `JWT_SECRET` | trống | Khóa ký JWT. Để trống: server tự sinh khóa ngẫu nhiên mỗi lần khởi động, đăng nhập lại sau mỗi lần khởi động lại. Tạo khóa cố định: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `1d` | Thời hạn token: `1d`, `12h`, `30m`... |
| `BCRYPT_ROUNDS` | `10` | Số vòng băm mật khẩu (4-15) |

## 2. Khởi chạy

| | Cách A: local bằng Node.js (khuyên dùng) | Cách B: Docker |
|---|---|---|
| Log | `logs/app.log`, `logs/services/*.log`: mở thẳng trong VS Code | Trong volume `game-logs`: xem qua lệnh `docker compose ...` |
| DB | `data/game.sqlite`: mở thẳng trong VS Code | Trong volume `game-data`: truy vấn qua lệnh hoặc chép ra máy |
| Sửa code | Tự khởi động lại | Phải build lại image |
| Cần cài | Node.js | Docker |

Chỉ chạy **một** cách tại một thời điểm, vì cả hai cùng dùng cổng 3001. Hai cách dùng **hai DB riêng**: tài khoản tạo ở cách A không có ở cách B.

### Cách A: Local bằng Node.js (khuyên dùng)

```bash
cd logic-programming/game-server
npm ci
npm run start:dev                 # chế độ phát triển, tự khởi động lại khi sửa code trong src/
# hoặc bản build:
npm run build && npm run start:prod
```

Sửa tệp trong `public/` (giao diện) thì chỉ cần tải lại trang, không phải khởi động lại. `start:dev` không theo dõi `.env`: sửa `.env` xong thì dừng (Ctrl+C) và chạy lại.

### Cách B: Docker

```bash
cd logic-programming/game-server
docker compose up -d --build
docker compose ps                 # STATUS phải là "Up ... (healthy)" sau khoảng 30 giây
```

| Việc | Lệnh |
|---|---|
| Sửa `.env` xong, áp dụng | `docker compose up -d --force-recreate` |
| Sửa code xong, áp dụng | `docker compose up -d --build` |
| Dừng | `docker compose down` (dữ liệu vẫn giữ) |
| Xóa sạch dữ liệu | `docker compose down -v` (mất tài khoản, ván chơi, lịch sử trận) |

Docker gọi `GET /` mỗi 30 giây; 3 lần liên tiếp không trả lời trong 5 giây thì trạng thái chuyển thành `unhealthy`. Đổi `PORT` trong `.env` thì cổng ngoài đổi theo; bên trong container luôn là 3001.

### Khởi động thành công

Log in ra (Docker: `docker compose logs`):

```
LOG  [Bootstrap] Đang chạy tại http://localhost:3001
LOG  [Bootstrap] Mở trình duyệt: http://localhost:3001 (đăng ký, đăng nhập, chơi Line 98 và cờ caro)
WARN [Bootstrap] Chưa đặt JWT_SECRET: dùng khóa ngẫu nhiên, ...   ← chỉ hiện khi để trống JWT_SECRET
```

## 3. Chơi trên trình duyệt

Mở **http://localhost:3001**.

1. **Tài khoản:** tab **Đăng ký** tạo tài khoản (tên đăng nhập 3-20 ký tự `a-z`, `0-9`, `_`; mật khẩu 6-72 ký tự), rồi **Đăng nhập**. Ở sảnh sửa được nickname và email. Một tài khoản chỉ online ở một nơi: đang mở trang ở trình duyệt này thì trình duyệt khác không đăng nhập được, báo "Đã có người đang đăng nhập bằng tài khoản này ở nơi khác". Nhiều tab trong cùng một trình duyệt thì vẫn được.
2. **Line 98:** bấm vào một bóng (bóng phóng to), rồi bấm ô trống để di chuyển. **Gợi ý** chỉ ra một nước đi; **Ván mới** bỏ ván đang chơi. Tải lại trang thì chơi tiếp đúng ván cũ.
3. **Cờ caro:** cần hai tài khoản khác nhau đăng nhập ở hai **phiên trình duyệt khác nhau**. Hai tab trong cùng một trình duyệt dùng chung token (lưu trong `localStorage`), nên là cùng một người:
   1. Cửa sổ thường: đăng nhập tài khoản A, vào **Cờ caro**, bấm **Tìm trận**.
   2. Cửa sổ ẩn danh (Ctrl+Shift+N), hoặc trình duyệt khác: đăng nhập tài khoản B, vào **Cờ caro**, bấm **Tìm trận**.
   3. Hai bên được ghép cặp, X đi trước. Màn hình hiện lượt hiện tại; khi kết thúc thì hiện người thắng và tô sáng hàng thắng.
   4. Đang chơi mà bấm **Sảnh**, **Line 98** hay **Đăng xuất** thì hiện hộp "Bạn muốn rời trận?": **Có** là xử thua, **Không** là chơi tiếp.
   5. Bấm **Rời trận**, tải lại trang (F5), đóng trình duyệt: xử thua ngay, đối thủ thắng. Bảng **Lịch sử** cập nhật sau mỗi trận.

## 4. Gọi API bằng cURL

```bash
# Đăng ký
curl -s -X POST localhost:3001/auth/register -H 'content-type: application/json' \
  -d '{"username":"long","password":"secret123","nickname":"Long"}'

# Đăng nhập, lưu token vào biến
TOKEN=$(curl -s -X POST localhost:3001/auth/login -H 'content-type: application/json' \
  -d '{"username":"long","password":"secret123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')

# Xem và sửa thông tin
curl -s localhost:3001/users/me -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH localhost:3001/users/me -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"email":"long@example.com"}'

# Lịch sử cờ caro
curl -s localhost:3001/caro/matches -H "Authorization: Bearer $TOKEN"
```

| Lệnh | Kết quả đúng |
|---|---|
| Đăng ký lại cùng tên | `409`, `errorKbn: 20004` |
| Đăng nhập sai mật khẩu | `401`, `errorKbn: 20005` |
| `curl localhost:3001/users/me` (không token) | `401`, `errorKbn: 20002` |
| `PATCH /users/me` với `{"username":"x"}` | `400`, không cho đổi trường này |
| `PATCH /users/me` với `{"email":"sai"}` | `400`, "Email không hợp lệ" |

Hai trò chơi chạy qua WebSocket, không gọi được bằng cURL. Giao thức: [README.md, mục 6](README.md#6-giao-thức-websocket). Ví dụ gọi bằng code: `test/app.e2e-spec.ts` và `scripts/load-test.ts`.

## 5. Chạy test

Cần Node.js (test không có trong image Docker):

```bash
cd logic-programming/game-server
npm ci
npm test              # unit test (52 test)
npm run test:e2e      # e2e: HTTP + WebSocket thật, SQLite trong bộ nhớ (6 test)
npm run lint:check    # ESLint + Prettier
```

**Load test** (10 người chơi đồng thời, yêu cầu mọi sự kiện phản hồi dưới 200 ms): server phải đang chạy.

```bash
npm run load-test                                   # server local ở cổng 3001
BASE_URL=http://localhost:3005 npm run load-test    # server ở địa chỉ khác, ví dụ Docker với PORT=3005
```

Script tạo các tài khoản `load_line98_*`, `load_caro_*` (chạy lại thì dùng lại), in bảng độ trễ từng sự kiện, thoát mã `0` nếu đạt, `1` nếu có sự kiện chậm hơn 200 ms. Kết quả đã đo: [README.md, mục 9.3](README.md#93-kiểm-tra-tải-10-người-chơi).

## 6. Xem log và DB

**Log** (thêm `-f` để xem live, Ctrl+C để thoát):

| Việc | Cách A: local | Cách B: Docker |
|---|---|---|
| Log console | Terminal đang chạy `npm run start:dev` | `docker compose logs -f` |
| `app.log` | Mở `logs/app.log` trong VS Code, hoặc `tail -f logs/app.log` | `docker compose exec game-server tail -f /app/logs/app.log` |
| Log một trò chơi | `tail -f logs/services/service_caro.log` | `docker compose exec game-server tail -f /app/logs/services/service_caro.log` |
| Log mọi service | `tail -f logs/services/*.log` | `docker compose exec game-server sh -c 'tail -f /app/logs/services/*.log'` |
| Chỉ dòng lỗi | `grep ERROR logs/app.log` | `docker compose exec game-server grep ERROR /app/logs/app.log` |
| Mọi sự kiện của một kết nối | `grep <request_id> logs/services/*.log` | `docker compose exec game-server sh -c 'grep <request_id> /app/logs/services/*.log'` |
| Chép log ra máy để mở bằng VS Code | | `docker compose cp game-server:/app/logs ./logs-docker` |

Ba tệp log service: `service_auth.log` (đăng ký, đăng nhập, thông tin), `service_line98.log`, `service_caro.log`. Với WebSocket, `request_id` là 8 ký tự đầu của socket id, nên một mã lọc ra mọi sự kiện của một kết nối.

**DB** (SQLite, 3 bảng: `users`, `line98_games`, `caro_matches`):

- **Cách A, xem bằng giao diện:** cài extension **SQLite Viewer** cho VS Code, rồi bấm vào `data/game.sqlite`.
- **Cách A, truy vấn bằng lệnh** (mở chỉ đọc, dùng thư viện có sẵn trong dự án, không cần cài `sqlite3`):

```bash
q() { node -e "console.table(require('better-sqlite3')('data/game.sqlite',{readonly:true}).prepare(process.argv[1]).all())" "$1"; }

# Tài khoản (không chọn cột password_hash)
q "SELECT username, nickname, email, created_at FROM users"

# Ván Line 98: 11000 PLAYING, 11001 GAME_OVER, 11002 ABANDONED
q "SELECT u.username, g.score, g.status_kbn, g.updated_at
   FROM line98_games g JOIN users u ON u.uuid = g.user_uuid
   ORDER BY g.updated_at DESC LIMIT 10"

# 10 trận caro gần nhất: 12001 X thắng, 12002 O thắng, 12003 hòa, 12004 bỏ cuộc
q "SELECT x.username AS x, o.username AS o, m.result_kbn, json_array_length(m.moves) AS moves, m.finished_at
   FROM caro_matches m JOIN users x ON x.uuid = m.player_x_uuid JOIN users o ON o.uuid = m.player_o_uuid
   ORDER BY m.started_at DESC LIMIT 10"
```

- **Cách B, truy vấn trong container:** thay đường dẫn DB thành `/app/data/game.sqlite` và chạy qua `docker compose exec`:

```bash
qd() { docker compose exec -T game-server node -e "console.table(require('better-sqlite3')('/app/data/game.sqlite',{readonly:true}).prepare(process.argv[1]).all())" "$1"; }

qd "SELECT username, nickname, email, created_at FROM users"
```

- **Cách B, xem bằng giao diện:** chép DB ra máy rồi mở bằng SQLite Viewer. Đây là bản chụp tại thời điểm chép, muốn cập nhật thì chép lại:

```bash
docker compose cp game-server:/app/data/game.sqlite ./game-docker.sqlite
```

## 7. Xử lý sự cố

Mọi lỗi trả về `errorKbn`. Chữ số đầu cho biết nơi lỗi: 2 tài khoản, 3 Line 98, 4 cờ caro, 9 hệ thống. Bảng mã đầy đủ: [README.md, mục 8](README.md#8-mã-kbn-và-log).

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| App thoát ngay, log có "Biến môi trường không hợp lệ" | Giá trị trong `.env` sai (ví dụ `BCRYPT_ROUNDS=20`) | Sửa theo thông báo, chạy lại |
| `EADDRINUSE` hoặc `port is already allocated` | Cổng 3001 đã bị chiếm (thường do cách A và B chạy cùng lúc) | Dừng một cách, hoặc đổi `PORT` trong `.env` |
| Đang chơi thì bị đưa về trang đăng nhập | Token hết hạn, hoặc server khởi động lại khi `JWT_SECRET` để trống | Đăng nhập lại. Muốn giữ phiên qua các lần khởi động: đặt `JWT_SECRET` |
| Caro bấm **Tìm trận** báo `40001` | Tài khoản này đang chờ hoặc đang trong trận ở tab khác | Đóng tab kia, hoặc bấm **Rời trận** ở tab kia |
| Đăng nhập báo "Đã có người đang đăng nhập bằng tài khoản này ở nơi khác" (`20006`) | Tài khoản đang mở trang ở trình duyệt hoặc cửa sổ ẩn danh khác | Đăng xuất hoặc đóng hết trang ở nơi kia, rồi đăng nhập lại |
| Đang ở trang thì bị đưa về đăng nhập, báo cùng câu trên | Trình duyệt này dùng token cũ, trong khi tài khoản đã đăng nhập và đang online ở nơi khác | Như trên |
| Caro chờ mãi không được ghép | Chưa có người thứ hai, hoặc hai tab cùng một tài khoản | Làm theo [mục 3](#3-chơi-trên-trình-duyệt): tài khoản thứ hai trong cửa sổ ẩn danh |
| Thông báo "Máy chủ không phản hồi" | Server dừng hoặc mất kết nối quá 5 giây | Kiểm tra server còn chạy, tải lại trang |
| `npm run load-test` báo lỗi kết nối | Server chưa chạy, hoặc chạy ở cổng khác | Chạy server trước; cổng khác thì đặt `BASE_URL` |
| `npm ci` lỗi khi cài `better-sqlite3` hoặc `bcrypt` | Thiếu bản dựng sẵn cho máy | Cài `python3`, `make`, `g++` rồi chạy lại, hoặc dùng Docker (cách B) |

Tra lỗi theo log: tìm dòng `ERROR` hay `WARN` trong `app.log` để lấy `request_id`, rồi lọc `logs/services/*.log` theo mã đó.

```bash
grep -E "ERROR|WARN" logs/app.log | tail
grep <request_id> logs/services/*.log
```
