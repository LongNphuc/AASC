# Bài 3: Server game đơn giản với NestJS

Server NestJS gồm quản lý tài khoản và hai trò chơi: **Line 98** (một người) và **Cờ caro X O** (hai người trực tuyến). Client là các trang HTML5 Canvas do chính server phục vụ.

> Tài liệu đi kèm: [readme_run.md](readme_run.md) (cài đặt và chạy) · [readme_structure.md](readme_structure.md) (ý nghĩa từng thư mục, tệp, method)

```bash
cd logic-programming/game-server
npm ci
npm run start:dev          # mở http://localhost:3001
```

**Mục lục:** [1. Đối chiếu yêu cầu](#1-đối-chiếu-yêu-cầu) · [2. Kiến trúc MVC](#2-kiến-trúc-mvc) · [3. Tài khoản](#3-tài-khoản) · [4. Line 98](#4-line-98) · [5. Cờ caro](#5-cờ-caro) · [6. Giao thức WebSocket](#6-giao-thức-websocket) · [7. Cơ sở dữ liệu](#7-cơ-sở-dữ-liệu) · [8. Mã kbn và log](#8-mã-kbn-và-log) · [9. Kiểm thử](#9-kiểm-thử) · [10. Giới hạn](#10-giới-hạn)

---

## 1. Đối chiếu yêu cầu

| Yêu cầu của đề | Làm ở đâu |
|---|---|
| NestJS, mô hình MVC | [Mục 2](#2-kiến-trúc-mvc) |
| SQLite với TypeORM | `users`, `line98_games`, `caro_matches` ([mục 7](#7-cơ-sở-dữ-liệu)) |
| WebSocket (Socket.IO) | Namespace `/line98`, `/caro`, `/presence` ([mục 6](#6-giao-thức-websocket)) |
| Đăng ký, đăng nhập bằng username và password; bcrypt; JWT | `src/auth/` ([mục 3](#3-tài-khoản)) |
| Đổi email, nickname, chỉ khi đã đăng nhập | `PATCH /users/me` có `JwtAuthGuard` |
| Line 98: lưới 9x9, 5 màu, xóa hàng 5 (ngang, dọc, chéo), sinh 3 bóng mỗi lượt | `src/line98/engines/line98.engine.ts` ([mục 4](#4-line-98)) |
| Line 98: Canvas, hiệu ứng chọn bóng (phóng to) và di chuyển | `public/js/line98.js` |
| Line 98: nút trợ giúp gợi ý nước đi hợp lệ ngẫu nhiên | Sự kiện `line98:hint`, hàm `suggestMove` |
| Line 98: đồng bộ bàn chơi qua WebSocket, lưu trạng thái vào DB | Mỗi nước đi gửi qua `/line98`, lưu vào `line98_games` |
| Caro: bàn 15x15, thắng khi có 5 liên tiếp, thông báo người thắng | `src/caro/engines/caro.engine.ts`, sự kiện `caro:over` |
| Caro: hai người đấu qua WebSocket, ghép cặp ngẫu nhiên | `caro:find`, `CaroService.joinQueue` ([mục 5](#5-cờ-caro)) |
| Caro: giao diện hiển thị lượt hiện tại và kết quả | `public/js/caro.js` |
| Caro: lưu lịch sử trận đấu | Bảng `caro_matches`, `GET /caro/matches` |
| Ít nhất một unit test cho mỗi trò chơi | 24 test Line 98, 19 test cờ caro ([mục 9](#9-kiểm-thử)) |
| 10 người chơi đồng thời, độ trễ dưới 200 ms | `npm run load-test`: trung bình 13-28 ms, lâu nhất 175 ms ([mục 9.3](#93-kiểm-tra-tải-10-người-chơi)) |
| Tài liệu hướng dẫn chạy, kết quả unit test | [readme_run.md](readme_run.md), [mục 9](#9-kiểm-thử) |

## 2. Kiến trúc MVC

| Thành phần | Ở đâu | Vai trò |
|---|---|---|
| **Model** | `*/entities/*.entity.ts` (TypeORM, SQLite) | `User`, `Line98Game`, `CaroMatch`: cấu trúc dữ liệu lưu trong DB |
| **View** | `public/` (HTML, CSS, JavaScript, Canvas) | Trang đăng nhập/sảnh, bàn Line 98, bàn cờ caro |
| **Controller** | `*/controllers/*.controller.ts` (HTTP), `*/gateways/*.gateway.ts` (WebSocket) | Nhận request/sự kiện, gọi service, trả kết quả |
| Service | `*/services/*.service.ts` | Nghiệp vụ: tài khoản, tải/lưu ván, ghép cặp, lượt đi |
| Engine | `*/engines/*.engine.ts` | Luật chơi viết thành hàm thuần (không đụng DB, mạng), test trực tiếp được |

```
Trình duyệt (public/*.html + Canvas)
   │ HTTP: /auth, /users/me, /caro/matches          │ WebSocket: /line98, /caro
   ▼                                                ▼
Controller (auth, profile, caro)            Gateway (line98, caro)  ← xác thực JWT khi kết nối
   └──────────────┬─────────────────────────────────┘
                  ▼
              Service  ──►  Engine (luật Line 98, cờ caro)
                  │
                  ▼
        Entity / TypeORM ──► SQLite (data/game.sqlite)
```

## 3. Tài khoản

| Method | Đường dẫn | Cần token | Mô tả |
|---|---|---|---|
| `POST` | `/auth/register` | | `{ username, password, nickname?, email? }` → 201, thông tin tài khoản |
| `POST` | `/auth/login` | | `{ username, password }` → 200, `{ accessToken, tokenType, expiresIn, user }` |
| `GET` | `/users/me` | ✓ | Thông tin người đang đăng nhập |
| `PATCH` | `/users/me` | ✓ | `{ email?, nickname? }`; chỉ đổi được hai trường này |
| `GET` | `/caro/matches` | ✓ | 20 trận cờ caro gần nhất của người đang đăng nhập |

Token gửi qua header `Authorization: Bearer <accessToken>`; khi kết nối WebSocket thì gửi qua `io(url, { auth: { token } })`.

- **Mật khẩu:** băm bằng `bcrypt` (cost 10, đổi được qua `BCRYPT_ROUNDS`). DB chỉ lưu chuỗi băm, có salt ngẫu nhiên bên trong. Mật khẩu 6-72 ký tự, vì bcrypt chỉ dùng 72 byte đầu.
- **Tên đăng nhập:** 3-20 ký tự gồm chữ không dấu, số, `_`; không phân biệt hoa thường (`Long` và `long` là một tài khoản).
- **Đăng nhập sai:** sai tên hay sai mật khẩu đều báo chung một câu "Sai tên đăng nhập hoặc mật khẩu", để không lộ tên đăng nhập nào đang tồn tại.
- **JWT:** chứa `sub` (uuid), `username` và `sid` (mã phiên, mỗi lần đăng nhập một mã mới), hạn mặc định 1 ngày (`JWT_EXPIRES_IN`). Mỗi lần xác thực, server đọc lại người dùng từ DB để có nickname mới nhất.
- **Khóa ký JWT:** để trống `JWT_SECRET` thì server tự sinh khóa ngẫu nhiên lúc khởi động, có cảnh báo trong log, và token cũ mất hiệu lực khi khởi động lại.
- **Một tài khoản chỉ online ở một nơi** (`PresenceService`):
  - **Online là gì:** mỗi trang (sảnh, Line 98, cờ caro) giữ một kết nối WebSocket. Tài khoản còn ít nhất một kết nối là đang online. Trang sảnh dùng namespace `/presence` cho việc này.
  - **Đăng nhập khi đang online:** báo `409`, `errorKbn: 20006` "Đã có người đang đăng nhập bằng tài khoản này ở nơi khác". Server kiểm tra mật khẩu trước, nên người không biết mật khẩu không dò được ai đang online.
  - **Token của phiên khác:** ví dụ trình duyệt cũ mở lại khi phiên mới đang online. Kết nối hay gọi API bằng token đó đều bị từ chối (`20006`), client tự đăng xuất và hiện lý do.
  - **Nhiều tab cùng trình duyệt:** dùng chung token nên chung phiên, vẫn mở song song được.
  - **Khi nào đăng nhập lại được:** khi phiên cũ đã đóng hết trang. Đăng xuất, đóng trình duyệt hay mất mạng đều tính là đóng.

## 4. Line 98

**Luật** (chốt theo cách chơi của game Line 98 gốc):

| Luật | Cách làm |
|---|---|
| Bàn 9x9, 5 màu bóng; bắt đầu với 5 bóng | `createGame` |
| Bóng đi tới ô trống bất kỳ, miễn có đường đi qua các ô trống (lên, xuống, trái, phải, không đi chéo) | `findPath`: tìm đường ngắn nhất bằng BFS |
| Từ 5 bóng cùng màu thẳng hàng trở lên (ngang, dọc, hai đường chéo) thì bị xóa, hàng 6-7 bóng xóa cả hàng; mỗi bóng 1 điểm | `findLines`: quét toàn bàn, thuật toán lấy từ [Line98-Game](https://github.com/NgoQuocBao1010/Line98-Game) (MIT) |
| Nước đi **xóa được hàng thì không sinh bóng mới**; không xóa được thì sinh 3 bóng vào ô trống ngẫu nhiên | `moveBall` |
| Màu 3 bóng sắp sinh được báo trước ("Bóng tiếp theo") | `nextColors` |
| Bóng mới sinh tạo thành hàng thì cũng bị xóa và được điểm | `moveBall` |
| **Thua** khi kín bàn (không còn ô trống, không còn nước đi) | `hasAnyMove` |
| **Gợi ý:** chọn ngẫu nhiên một bóng còn đường đi tới một ô nằm cạnh (8 hướng) bóng cùng màu khác; không có thì chọn nước đi hợp lệ bất kỳ | `suggestMove` |

**Đồng bộ và lưu trạng thái:** server giữ luật và trạng thái; client chỉ gửi `{ from, to }` và vẽ lại theo kết quả server trả về. Sau mỗi nước đi, ván được lưu vào bảng `line98_games`, nên tải lại trang hay khởi động lại server vẫn chơi tiếp được (`line98:resume`). Mỗi người có tối đa một ván đang chơi; bắt đầu ván mới thì ván cũ chuyển sang `ABANDONED`.

**Giao diện** (`public/js/line98.js`):
- bóng được chọn phóng to và nhấp nháy;
- bóng chạy từng ô theo đường server trả về;
- bóng bị xóa thu nhỏ dần, bóng mới sinh lớn dần;
- nút **Gợi ý** làm nhấp nháy bóng nên đi và đóng khung ô đích.

## 5. Cờ caro

**Luật:**
- Bàn 15x15, X đi trước, hai bên luân phiên.
- 5 ký hiệu liên tiếp trở lên (ngang, dọc, chéo) là thắng. Không áp dụng luật chặn hai đầu: bị chặn hai đầu vẫn thắng.
- Kín 225 ô mà không ai thắng thì hòa.

**Ghép cặp ngẫu nhiên** (`CaroService.joinQueue`):
1. Bấm "Tìm trận" khi hàng chờ trống thì vào hàng chờ.
2. Bấm "Tìm trận" khi đã có người chờ thì được ghép ngay với một người ngẫu nhiên trong hàng chờ; X/O chia ngẫu nhiên. Ví dụ A bấm trước (chờ), B bấm sau thì A gặp B; C bấm tiếp thì chờ người thứ tư.
3. Hai người vào chung một room Socket.IO; mỗi nước đi được gửi tới cả hai cùng lúc (`caro:moved`).
4. Một người không thể vào hàng chờ hai lần, hay vừa chờ vừa đang chơi.
5. Chỗ chờ và trận gắn với **tab** (socket) đã bấm "Tìm trận". Đóng một tab khác của cùng tài khoản không làm mất chỗ chờ hay thua trận.

**Kết thúc trận:**
- **Có người thắng hoặc hòa:** server gửi `caro:over` kèm kết quả, nickname người thắng và các ô của hàng thắng (client tô sáng).
- **Một người rời trận:** người đó bị xử thua, kết quả `ABANDONED`, người còn lại thắng.
  - Bấm sang trang khác (Sảnh, Line 98, Đăng xuất) khi đang chơi: hiện hộp "Bạn muốn rời trận?". Chọn **Có** thì xử thua rồi mới chuyển trang; chọn **Không** thì chơi tiếp.
  - Bấm nút **Rời trận**, tải lại trang (F5), đóng trình duyệt hoặc mất kết nối: xử thua ngay, không hỏi.

**Lịch sử:** trận được ghi vào `caro_matches` khi ghép cặp xong (`PLAYING`), cập nhật toàn bộ nước đi, kết quả, người thắng khi kết thúc. `GET /caro/matches` trả 20 trận gần nhất, kèm kết quả theo góc nhìn người xem (`WIN`, `LOSE`, `DRAW`).

Trận đang diễn ra được giữ trong bộ nhớ (nhanh, không phải đọc DB mỗi nước), chỉ ghi DB lúc bắt đầu và lúc kết thúc.

## 6. Giao thức WebSocket

Socket.IO, cùng cổng với HTTP. Kết nối phải kèm token: `io('/caro', { auth: { token } })`. Kết nối bị từ chối ngay (sự kiện `connect_error`) trong hai trường hợp:
- token thiếu hoặc sai: `error.data.errorKbn = 20002`;
- tài khoản đang online ở phiên khác: `error.data.errorKbn = 20006`.

**Namespace `/presence`:** không có sự kiện. Trang sảnh kết nối vào đây để được tính là đang online (xem [mục 3](#3-tài-khoản)).

Mỗi sự kiện client gửi đều nhận phản hồi qua acknowledgement của Socket.IO: `socket.emitWithAck(event, data)` trả về `{ ok: true, data }` hoặc `{ ok: false, errorKbn, message }`.

**Namespace `/line98`:**

| Sự kiện gửi | Dữ liệu | Phản hồi `data` |
|---|---|---|
| `line98:resume` | | Ván đang chơi (chưa có thì tạo mới): `{ gameUuid, board, nextColors, score, statusKbn, status }` |
| `line98:new` | | Ván mới |
| `line98:move` | `{ from: { row, col }, to: { row, col } }` | `{ game, path, removed, spawned }` |
| `line98:hint` | | `{ from, to }` hoặc `null` nếu hết nước đi |

**Namespace `/caro`:**

| Sự kiện gửi | Dữ liệu | Phản hồi `data` |
|---|---|---|
| `caro:find` | | `{ status: 'waiting' }` hoặc `{ status: 'matched' }` |
| `caro:cancel` | | Rời hàng chờ |
| `caro:move` | `{ matchUuid, row, col }` | `{ nextTurn }` |
| `caro:leave` | | Rời trận (xử thua) |

| Sự kiện server gửi | Dữ liệu |
|---|---|
| `caro:matched` | `{ matchUuid, you: 'X' \| 'O', opponent: { nickname }, turn }` (mỗi người nhận bản của mình) |
| `caro:moved` | `{ matchUuid, row, col, symbol, nextTurn }` (gửi cả hai người) |
| `caro:over` | `{ matchUuid, result, resultKbn, winnerNickname, winSymbol, winLine }` |

## 7. Cơ sở dữ liệu

SQLite, tệp `data/game.sqlite` (Docker: volume `game-data`). Khóa chính là uuid.

| Bảng | Cột chính |
|---|---|
| `users` | `uuid`, `username` (duy nhất), `password_hash`, `nickname`, `email`, `created_at`, `updated_at` |
| `line98_games` | `uuid`, `user_uuid`, `board` (JSON 9x9), `next_colors` (JSON), `score`, `status_kbn`, `created_at`, `updated_at` |
| `caro_matches` | `uuid`, `player_x_uuid`, `player_o_uuid`, `moves` (JSON `[{ row, col, symbol }]`), `result_kbn`, `winner_uuid`, `started_at`, `finished_at` |

## 8. Mã kbn và log

**Trạng thái** (`src/common/kbn/status.kbn.ts`):

| Mã | Ý nghĩa |
|---|---|
| 10000 / 10001 | SUCCESS / FAILED: kết quả một lệnh gọi, ghi trong log |
| 11000 / 11001 / 11002 | Ván Line 98: PLAYING / GAME_OVER / ABANDONED |
| 12000 / 12001 / 12002 / 12003 / 12004 | Trận caro: PLAYING / X_WIN / O_WIN / DRAW / ABANDONED |

**Lỗi** (`errorKbn`, chữ số đầu là nơi lỗi: 2 tài khoản, 3 Line 98, 4 cờ caro, 9 hệ thống):

| Mã | Ý nghĩa |
|---|---|
| 20001 | Dữ liệu không hợp lệ |
| 20002 | Thiếu hoặc sai token |
| 20003 | Không tìm thấy |
| 20004 | Tên đăng nhập đã có người dùng |
| 20005 | Sai tên đăng nhập hoặc mật khẩu |
| 20006 | Tài khoản đang được đăng nhập ở nơi khác |
| 30001 | Chưa có ván Line 98 đang chơi |
| 30002 | Nước đi Line 98 không hợp lệ (ô trống, ô đích có bóng, không có đường) |
| 30003 | Ván Line 98 đã kết thúc |
| 40001 | Đang ở hàng chờ hoặc trong trận khác |
| 40002 | Không ở trong trận này |
| 40003 | Chưa tới lượt |
| 40004 | Ô không hợp lệ hoặc đã đánh |
| 90001 | Lỗi không lường trước |

**Log** hai tầng, cùng cách làm với phần `integration`:
- `logs/app.log`: dòng thời gian mọi sự kiện, dạng `thời gian | mức | service | request_id | [lớp] nội dung`.
- `logs/services/service_auth.log`, `service_line98.log`, `service_caro.log`: mỗi request HTTP hoặc sự kiện WebSocket một dòng, dạng `thời gian | request_id | method | status_kbn | error_kbn | thời gian xử lý | lý do lỗi`.

Với WebSocket, `request_id` là 8 ký tự đầu của socket id, nên lọc được mọi sự kiện của một kết nối. Không ghi mật khẩu hay token.

## 9. Kiểm thử

```bash
npm test             # unit test
npm run test:e2e     # e2e: HTTP + WebSocket thật
npm run load-test    # 10 người chơi đồng thời (server phải đang chạy)
npm run lint:check
```

### 9.1 Unit test (52 test)

| Tệp | Nội dung |
|---|---|
| `line98/engines/line98.engine.spec.ts` (24) | Ván mới có 5 bóng; tìm đường vòng, bị chặn thì không có đường; phát hiện hàng ngang/dọc/2 chéo (cả sát mép), 6 bóng xóa cả 6 (ngang và chéo), 4 bóng không xóa, khác màu chen giữa không thành hàng; đi bóng vào giữa 3 + 3 bóng thì xóa cả 7; nước đi xóa hàng không sinh bóng, không xóa thì sinh 3 bóng đúng màu, bóng mới tạo hàng cũng bị xóa; 4 loại nước đi sai; không sửa trạng thái cũ; kín bàn thì thua; gợi ý ưu tiên cạnh bóng cùng màu, luôn hợp lệ, kín bàn thì không có gợi ý |
| `caro/engines/caro.engine.spec.ts` (13) | Thắng ngang/dọc/2 chéo, 6 liên tiếp cũng thắng, 4 chưa thắng, bị chặn hai đầu vẫn thắng; ô ngoài bàn, số âm, không phải số nguyên, ô đã đánh; không sửa bàn cũ; kín bàn |
| `caro/services/caro.service.spec.ts` (7) | Ghép cặp, chia X/O, X đi trước; không vào hàng chờ hai lần, không tự ghép với mình; đi sai lượt, ô đã đánh, người ngoài trận; X thắng thì lưu nước đi và người thắng; rời trận thì đối thủ thắng; rời khi đang chờ; đóng tab khác của cùng người chơi không mất chỗ chờ, không thua |
| `auth/services/auth.service.spec.ts` (8) | Mật khẩu lưu dạng băm bcrypt; trùng tên 409; đăng nhập cấp JWT, token xác thực ra đúng người; sai mật khẩu và sai tên cùng một lỗi; token thiếu, sai, giả mạo bị từ chối; cập nhật email, nickname; đang online thì đăng nhập nơi khác bị 409, offline rồi thì được; tab cùng phiên vào được, token phiên khác bị từ chối |

### 9.2 Kết quả chạy test

```
$ npm test
Test Suites: 4 passed, 4 total
Tests:       52 passed, 52 total

$ npm run test:e2e
Tests:       6 passed, 6 total
```

E2E (`test/app.e2e-spec.ts`) chạy app thật với SQLite trong bộ nhớ:
1. Đăng ký, đăng nhập, xem và sửa thông tin; trùng tên trả 409, thiếu token trả 401.
2. Dữ liệu đăng ký sai trả 400 kèm thông báo tiếng Việt.
3. Một tài khoản chỉ online ở một nơi: đang online thì đăng nhập nơi khác trả 409 (`20006`), token phiên cũ không kết nối hay gọi API được; tab cùng phiên vào được; đóng hết trang thì đăng nhập lại được.
4. Kết nối WebSocket không có token, hoặc token sai, bị từ chối.
5. Line 98: vào ván, xin gợi ý, đi theo gợi ý; nước đi sai bị từ chối.
6. Cờ caro: hai người được ghép cặp, đánh theo lượt (O đi trước bị từ chối), X thắng; lịch sử ghi đúng.

### 9.3 Kiểm tra tải 10 người chơi

`npm run load-test` cho 10 người chơi cùng lúc: 4 người chơi Line 98 (lặp "gợi ý → đi") và 6 người chơi 3 trận caro (đánh ô ngẫu nhiên). Độ trễ là thời gian từ lúc gửi sự kiện tới lúc nhận phản hồi.

Một lần chạy local (Node 24, WSL2, i7-13620H), in nguyên văn:

```
| Sự kiện     | Số lần | TB (ms) | p50  | p95  | Max  |
|-------------|--------|---------|------|------|------|
| caro:find   | 6      | 16.9    | 14.7 | 29.4 | 29.4 |
| caro:leave  | 1      | 9.4     | 9.4  | 9.4  | 9.4  |
| caro:move   | 198    | 12.3    | 7.2  | 33.7 | 75.8 |
| line98:hint | 120    | 12.0    | 11.2 | 24.3 | 35.9 |
| line98:move | 116    | 18.4    | 17.4 | 32.6 | 48.5 |
| line98:new  | 8      | 28.2    | 23.8 | 55.3 | 55.3 |
| TỔNG        | 449    | 14.1    | 12.7 | 32.0 | 75.8 |

Thời gian chạy: 1.2 s. Đạt: mọi sự kiện phản hồi dưới 200 ms.
```

Chạy liên tiếp 8 lần trên cùng một server local, rồi 1 lần trong Docker:

| Lần | Môi trường | Số sự kiện | Trung bình | p95 | Lâu nhất |
|---|---|---|---|---|---|
| 1 | Local | 449 | 14,1 ms | 32,0 ms | 75,8 ms |
| 2 | Local | 493 | 21,8 ms | 60,2 ms | 111,8 ms |
| 3 | Local | 493 | 27,5 ms | 71,3 ms | 174,8 ms |
| 4 | Local | 493 | 12,8 ms | 33,6 ms | 57,6 ms |
| 5 | Local | 468 | 13,5 ms | 40,5 ms | 90,5 ms |
| 6 | Local | 493 | 16,9 ms | 46,2 ms | 71,8 ms |
| 7 | Local | 493 | 14,6 ms | 41,1 ms | 66,4 ms |
| 8 | Local | 493 | 13,2 ms | 34,6 ms | 51,2 ms |
| 9 | Docker | | 38,3 ms | | 180,0 ms |

- Cả 9 lần đều đạt: mọi sự kiện phản hồi dưới 200 ms.
- Lần 1-3 chạy song song với unit test (jest) trên cùng máy nên chậm dần. Lần 4-8 máy rảnh: trung bình 13-17 ms, lâu nhất 91 ms.
- Lâu nhất là 175 ms (local, lần 3) và 180 ms (Docker), khá sát ngưỡng. Đây là các đỉnh đơn lẻ: ở cả 8 lần local, 95% sự kiện phản hồi dưới 72 ms.
- Số sự kiện thay đổi giữa các lần vì một trận caro có thể kết thúc sớm khi có người thắng.

## 10. Giới hạn

- **Một tiến trình:** hàng chờ, trận caro đang diễn ra và danh sách ai đang online nằm trong bộ nhớ. Chạy nhiều tiến trình thì cần Redis (adapter Socket.IO và kho trạng thái chung).
- **Tải lại trang khi đang chơi caro:** người đó bị xử thua, vì chưa hỗ trợ vào lại trận.
- **Chơi caro với chính mình:** không được. Muốn thử một mình thì mở thêm một trình duyệt ẩn danh và đăng nhập tài khoản khác.
- **Bảng DB:** dùng `synchronize: true` cho gọn khi demo; production nên dùng migration.
