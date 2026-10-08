# Cấu trúc thư mục `game-server`

Mỗi dòng là một thư mục hoặc tệp, ý nghĩa ghi ngay bên phải. Dòng bắt đầu bằng `·` là method hoặc hàm chính trong tệp phía trên. Tệp `*.spec.ts` là unit test của tệp cùng tên.

**Quy ước chung** (giống phần `integration`)

- Gốc mỗi module (`users`, `auth`, `line98`, `caro`) chỉ có `*.module.ts`: nơi khai báo module dùng gì, cung cấp gì, chia sẻ gì cho module khác.
- Mọi thứ khác nằm trong thư mục đặt tên theo loại:
  - `controllers/`: nhận request HTTP;
  - `gateways/`: nhận sự kiện WebSocket;
  - `services/`: nghiệp vụ;
  - `engines/`: luật chơi, viết thành hàm thuần;
  - `entities/`: bảng DB;
  - `dto/`: dữ liệu vào;
  - `types/`: kiểu dữ liệu;
  - `guards/`, `middlewares/`, `decorators/`.
- Câu chữ (log, lỗi, thông báo validate) không viết trong code mà nằm ở `src/common/constants/messages.constant.ts`.

**Mục lục:** [1. Thư mục gốc](#1-thư-mục-gốc) · [2. src](#2-src) · [3. config](#3-srcconfig) · [4. common](#4-srccommon) · [5. users](#5-srcusers) · [6. auth](#6-srcauth) · [7. line98](#7-srcline98) · [8. caro](#8-srccaro) · [9. public](#9-public-client) · [10. test, scripts](#10-test-và-scripts)

---

## 1. Thư mục gốc

```
game-server/
├── src/                          Mã nguồn server (mục 2 đến 8)
├── public/                       Client: HTML, CSS, JavaScript, Canvas; server phục vụ trực tiếp (mục 9)
├── test/                         E2E test và cấu hình Jest (mục 10)
├── scripts/                      Kiểm tra tải 10 người chơi, không thuộc ứng dụng (mục 10)
├── data/                         (tự sinh khi chạy bằng npm, không commit) tệp SQLite: tài khoản, ván Line 98, trận caro
├── logs/                         (tự sinh khi chạy bằng npm, không commit) app.log và services/*.log
├── dist/                         (tự sinh, không commit) mã JavaScript sau khi build
├── .env                          (không commit, không bắt buộc) biến môi trường
├── .env.example                  Mẫu .env, có chú thích từng biến
├── Dockerfile                    Build image 2 tầng (build → chạy), chạy bằng user node, có HEALTHCHECK gọi /
├── docker-compose.yml            Chạy container: đọc .env nếu có, mở cổng PORT, lưu data/logs trong named volume
├── .dockerignore                 Không đưa node_modules, dist, .env, data, logs, test vào image
├── .gitignore                    Không commit .env, data/, logs/, node_modules/, dist/
├── package.json                  Thư viện và lệnh npm: build, start, test, test:e2e, lint, load-test
├── package-lock.json             Khóa phiên bản thư viện
├── tsconfig.json                 Cấu hình TypeScript
├── tsconfig.build.json           Cấu hình build: bỏ test/, scripts/, public/, *.spec.ts
├── nest-cli.json                 Cấu hình Nest CLI
├── eslint.config.mjs             Quy tắc ESLint kèm Prettier
├── .prettierrc                   Định dạng code: nháy đơn, dấu phẩy cuối
├── README.md                     Trang đầu: đối chiếu yêu cầu, luật chơi, giao thức, kết quả test
├── readme_run.md                 Các bước cài đặt và chạy
└── readme_structure.md           Tài liệu này
```

## 2. `src`

```
src/
├── main.ts                       Điểm khởi động ứng dụng
│     · (đầu tệp)                 đọc .env sớm, mở tệp log trước khi Nest khởi tạo
│     · bootstrap()               tạo app, phục vụ public/, lắng nghe PORT, in URL; cảnh báo nếu chưa đặt JWT_SECRET
│     · bootstrap().catch()       khởi động lỗi: ghi app.log, đóng tệp log, thoát mã 1
├── app.module.ts                 Module gốc: ghép các module, kết nối SQLite;
│                                 đăng ký toàn cục filter lỗi, ValidationPipe
│     · configure()               gắn RequestLoggingMiddleware cho mọi request
├── config/                       Đọc và kiểm tra cấu hình (mục 3)
├── common/                       Dùng chung cho mọi module (mục 4)
├── users/                        Bảng users và truy vấn tài khoản (mục 5)
├── auth/                         Đăng ký, đăng nhập, JWT, thông tin cá nhân (mục 6)
├── line98/                       Trò chơi Line 98 (mục 7)
└── caro/                         Cờ caro hai người (mục 8)
```

## 3. `src/config`

```
config/
├── env.validation.ts             Danh sách biến môi trường, kiểu, giá trị mặc định
│     · EnvironmentVariables      PORT, DATABASE_PATH, LOG_DIR, JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_ROUNDS (4-15)
│     · validateEnv()             kiểm tra process.env; sai thì dừng khởi động, báo biến nào sai
│     · DEFAULT_LOG_DIR           thư mục log mặc định "logs"
├── app-config.ts                 Gom cấu hình đã kiểm tra thành object có kiểu
│     · appConfig                 inject vào service bằng @Inject(appConfig.KEY); thiếu JWT_SECRET thì sinh khóa ngẫu nhiên
└── load-env-file.ts
      · loadEnvFileIfPresent()    đọc .env vào process.env trước khi Nest chạy; không ghi đè biến có sẵn
```

## 4. `src/common`

```
common/
├── constants/
│   └── messages.constant.ts                Toàn bộ câu chữ của ứng dụng; code chỉ gọi tên hằng
│         · LOG, WARN                       nội dung logger.log, logger.warn
│         · ERROR                           thông báo lỗi trả client và logger.error
│         · VALIDATION, FIELD               thông báo validate DTO, tên trường
│         · MESSAGE                         nội dung trả về không phải lỗi
├── errors/
│   └── game.exception.ts                   Lỗi nghiệp vụ mang sẵn errorKbn và mã HTTP (mặc định 400); dùng cho cả HTTP và WebSocket
├── filters/
│   └── all-exceptions.filter.ts            Bắt mọi lỗi HTTP, trả JSON thống nhất {statusCode, error, errorKbn, message, path}
│         · catch()                         dựng body lỗi; để lại error_kbn cho middleware ghi log service
│         · toBody()                        đổi GameException / HttpException / lỗi lạ thành mã HTTP và thông báo
├── kbn/                                    Mã trạng thái, mã lỗi dùng chung cho DB, log, phản hồi
│   ├── status.kbn.ts
│   │     · StatusKbn                       10000 SUCCESS, 10001 FAILED (kết quả một lệnh gọi, ghi trong log)
│   │     · Line98StatusKbn                 11000 PLAYING, 11001 GAME_OVER, 11002 ABANDONED (cột line98_games.status_kbn)
│   │     · CaroResultKbn                   12000 PLAYING, 12001 X_WIN, 12002 O_WIN, 12003 DRAW, 12004 ABANDONED
│   └── error.kbn.ts                        Mã lỗi 5 chữ số; chữ số đầu là nơi lỗi: 2 tài khoản, 3 Line 98, 4 cờ caro, 9 hệ thống
│         · ErrorKbn                        danh sách mã (20001 VALIDATION... 40004 CARO_INVALID_CELL, 90001 UNKNOWN)
│         · errorKbnOf()                    suy error_kbn từ một lỗi bất kỳ
│         · describeErrorKbn()              tên dễ đọc: 30002 → "LINE98_INVALID_MOVE"
├── logging/                                Log 2 tầng: app.log và services/<service>.log
│   ├── log-files.ts                        Quản lý tệp log trong LOG_DIR (một bản dùng chung: logFiles)
│   │     · configure()                     chọn thư mục log, tạo thư mục services/
│   │     · write()                         ghi một dòng vào tệp
│   │     · close()                         ghi hết bộ đệm rồi đóng tệp, dùng trước khi thoát vì lỗi
│   ├── app-logger.service.ts               Logger toàn cục: in console và ghi app.log
│   │                                       "thời gian | mức | service | request_id | [Lớp] nội dung"
│   │     · log() / warn() / error() / debug()   in như Nest rồi ghi app.log
│   │     · writeToFile()                   tách service và lớp từ context, tách stack trace
│   ├── service-logger.ts                   Logger theo service, ghi chi tiết từng lệnh gọi
│   │     · LogService                      3 tệp: service_auth, service_line98, service_caro
│   │     · ServiceLogger                   log() ghi app.log kèm tên service; record() ghi services/<service>.log
│   │     · formatServiceLine()             "thời gian | request_id | method | status_kbn | error_kbn | ms | error_detail"
│   │     · writeServiceLog()               ghi một dòng vào tệp service
│   ├── request-logging.middleware.ts       Chạy đầu tiên với mọi request HTTP
│   │     · use()                           cấp request_id (header x-request-id); trả lời xong thì ghi 1 dòng log service
│   ├── request-context.ts                  Giữ request_id của request hoặc sự kiện đang xử lý (AsyncLocalStorage)
│   │     · run() / requestId()             chạy code trong ngữ cảnh / đọc request_id hiện tại
│   └── route-services.ts                   Đường dẫn nào ghi vào log service nào (/auth, /users → service_auth; /caro → service_caro)
│         · serviceForPath()                trang tĩnh (/, /caro.html...) không ghi log service
├── validation/
│   └── validation-exception.factory.ts     Gom lỗi validate DTO thành danh sách thông báo tiếng Việt
│         · validationExceptionFactory()    trả 400 "Validation Failed" kèm danh sách lỗi
│         · flatten()                       duyệt lỗi lồng nhau, báo trường không được hỗ trợ
└── ws/
    └── ws-handler.ts                       Khung xử lý chung cho mọi sự kiện WebSocket (giữ vai trò của filter + middleware bên HTTP)
          · handleWs()                      request_id = 8 ký tự đầu socket id; đo thời gian, ghi log service;
                                            trả {ok: true, data} hoặc {ok: false, errorKbn, message}
          · WsResult                        kiểu phản hồi gửi về qua acknowledgement
```

## 5. `src/users`

```
users/
├── users.module.ts                         Khai báo module; chia sẻ UsersService cho AuthModule
├── entities/
│   └── user.entity.ts                      Bảng users: uuid, username (duy nhất, chữ thường), password_hash, nickname, email, created_at, updated_at
└── services/
    └── users.service.ts                    Đọc/ghi bảng users
          · create()                        thêm tài khoản
          · findByUsername() / findByUuid() tìm tài khoản
```

## 6. `src/auth`

Đăng ký, đăng nhập, JWT, đổi email và nickname. Xác thực cho cả HTTP (guard) và WebSocket (middleware). Một tài khoản chỉ online ở một nơi.

```
auth/
├── auth.module.ts                          Khai báo module, cấu hình JwtModule; chia sẻ AuthService và JwtAuthGuard cho line98, caro
├── controllers/
│   ├── auth.controller.ts                  /auth (công khai)
│   │     · register()                      POST /auth/register → 201, thông tin tài khoản
│   │     · login()                         POST /auth/login → 200, {accessToken, tokenType, expiresIn, user}
│   └── profile.controller.ts               /users/me (cần token)
│         · get()                           GET   /users/me: thông tin người đang đăng nhập
│         · update()                        PATCH /users/me: đổi email, nickname
├── services/
│   ├── auth.service.ts                     Nghiệp vụ tài khoản
│   │     · register()                      băm mật khẩu bằng bcrypt, lưu; trùng tên thì 409 USERNAME_TAKEN
│   │     · login()                         so mật khẩu với chuỗi băm, cấp JWT {sub, username, sid (mã phiên mới)};
│   │                                       sai tên hay sai mật khẩu đều trả cùng lỗi 401 INVALID_CREDENTIALS;
│   │                                       tài khoản đang online thì 409 ACCOUNT_IN_USE
│   │     · verifyToken()                   kiểm tra JWT, đọc lại người dùng từ DB (dùng cho guard và WebSocket);
│   │                                       tài khoản đang online ở phiên khác thì 409 ACCOUNT_IN_USE
│   │     · markOnline() / markOffline()    ghi nhận một kết nối WebSocket online / đã ngắt
│   │     · getProfile() / updateProfile()  xem, sửa thông tin; không gửi trường nào thì lỗi
│   │     · requireUser()                   tìm người dùng theo uuid; không có thì lỗi
│   │     · toProfile()                     User → dữ liệu trả client (không có password_hash)
│   ├── auth.service.spec.ts                test (8): lưu chuỗi băm; trùng tên; cấp và xác thực JWT; sai đăng nhập cùng lỗi; token giả;
│   │                                       cập nhật; đang online thì không đăng nhập nơi khác được; token phiên khác bị từ chối
│   └── presence.service.ts                 Ai đang online (trong bộ nhớ): userUuid → các socket kèm mã phiên
│         · isOnline()                      còn ít nhất một kết nối
│         · isOnlineElsewhere()             đang online ở phiên khác với phiên cho trước
│         · connect() / disconnect()        thêm / bỏ một kết nối; connect từ chối nếu tài khoản đang online ở phiên khác
├── gateways/
│   └── presence.gateway.ts                 WebSocket namespace /presence, không có sự kiện: trang sảnh kết nối để được tính là online
├── guards/
│   └── jwt-auth.guard.ts                   Guard cho endpoint HTTP cần đăng nhập
│         · canActivate()                   đọc header Authorization: Bearer <token>, gắn người dùng vào request; sai thì 401
├── middlewares/
│   └── ws-auth.middleware.ts               Xác thực WebSocket, chạy TRƯỚC khi kết nối được chấp nhận
│         · createWsAuthMiddleware()        đọc token trong handshake.auth; sai thì từ chối (connect_error, errorKbn 20002),
│                                           đang online ở phiên khác thì từ chối (20006); hợp lệ thì ghi nhận online tới khi ngắt
│         · socketUser()                    người dùng đã xác thực của một socket
├── decorators/
│   └── current-user.decorator.ts           @CurrentUser(): lấy người dùng mà JwtAuthGuard đã gắn vào request
├── dto/
│   ├── register.dto.ts                     username (3-20, a-z 0-9 _, đổi về chữ thường), password (6-72), nickname?, email?
│   ├── login.dto.ts                        username, password
│   └── update-profile.dto.ts               email?, nickname?; trường khác bị từ chối
└── types/
    └── auth.types.ts                       JwtPayload (có sid), AuthUser (người đang đăng nhập, có sessionId), ProfileView, LoginResult
```

## 7. `src/line98`

```
line98/
├── line98.module.ts                        Khai báo module; dùng AuthService để xác thực WebSocket
├── engines/
│   ├── line98.engine.ts                    Luật Line 98, hàm thuần (không DB, không socket); nhận RandomFn để test được
│   │     · createGame()                    bàn 9x9 với 5 bóng ngẫu nhiên, 3 màu báo trước
│   │     · moveBall()                      kiểm tra → tìm đường → di chuyển → xóa hàng; không xóa được thì sinh 3 bóng
│   │                                       (hàng do bóng mới tạo cũng xóa); hết nước đi thì gameOver
│   │     · findPath()                      đường ngắn nhất qua ô trống (BFS, 4 hướng); không có thì null
│   │     · reachableCells()                mọi ô trống bóng đi tới được
│   │     · findLines()                     quét toàn bàn, lấy mọi ô thuộc hàng ≥ 5 bóng cùng màu (ngang, dọc, 2 chéo);
│   │                                       thuật toán lấy từ github.com/NgoQuocBao1010/Line98-Game (MIT)
│   │     · suggestMove()                   gợi ý ngẫu nhiên: ưu tiên ô cạnh bóng cùng màu, không có thì nước hợp lệ bất kỳ
│   │     · hasAnyMove() / emptyCells()     còn nước đi không / danh sách ô trống
│   │     · InvalidMoveError                lý do: BAD_POSITION, NO_BALL, TARGET_OCCUPIED, NO_PATH
│   │     · spawnBalls()                    (nội bộ) sinh bóng vào ô trống ngẫu nhiên
│   │     · runsAlong() / sameColorWindow() (nội bộ) chuỗi ≥ 5 trên hàng ngang, dọc / cửa sổ 5 ô trên đường chéo
│   └── line98.engine.spec.ts               test (24): tạo ván, tìm đường, phát hiện hàng (cả hàng 6, 7 bóng), di chuyển, sinh bóng, thua, gợi ý
├── services/
│   └── line98.service.ts                   Tải/lưu ván, gọi engine
│         · resume()                        ván đang chơi; chưa có thì tạo mới
│         · newGame()                       ván cũ đang chơi → ABANDONED, tạo ván mới
│         · move()                          chạy moveBall, lưu bàn, điểm, trạng thái; nước sai → 30002
│         · hint()                          suggestMove trên bàn hiện tại
│         · requirePlaying()                lấy ván đang chơi; không có thì 30001 (chưa có ván) hoặc 30003 (đã thua)
├── gateways/
│   └── line98.gateway.ts                   WebSocket namespace /line98
│         · afterInit()                     gắn middleware xác thực
│         · resume() / newGame() / move() / hint()   sự kiện line98:resume, line98:new, line98:move, line98:hint
├── entities/
│   └── line98-game.entity.ts               Bảng line98_games: uuid, user_uuid, board (JSON), next_colors (JSON), score, status_kbn
└── types/
    └── line98.types.ts                     Line98GameView, Line98MoveView {game, path, removed, spawned}, Line98MoveRequest
```

## 8. `src/caro`

```
caro/
├── caro.module.ts                          Khai báo module; dùng AuthService để xác thực WebSocket và JwtAuthGuard cho HTTP
├── engines/
│   ├── caro.engine.ts                      Luật cờ caro, hàm thuần
│   │     · createCaroBoard()               bàn 15x15 trống
│   │     · placeMark()                     đánh một ô, trả bàn mới; ô ngoài bàn hoặc đã đánh → InvalidCellError
│   │     · findWinningLine()               các ô của hàng ≥ 5 đi qua ô vừa đánh (4 hướng); không có thì null
│   │     · isBoardFull()                   kín bàn (hòa)
│   │     · otherSymbol() / isInsideCaro()  đổi X ↔ O / ô có nằm trong bàn
│   └── caro.engine.spec.ts                 test (13): thắng 4 hướng, 6 liên tiếp, bị chặn hai đầu vẫn thắng, ô sai, kín bàn
├── services/
│   ├── caro.service.ts                     Hàng chờ, trận đang diễn ra (trong bộ nhớ), lịch sử (DB); không biết gì về socket
│   │     · joinQueue()                     chưa ai chờ thì chờ; có thì ghép ngẫu nhiên, chia X/O ngẫu nhiên, ghi DB (PLAYING)
│   │     · leaveQueue()                    rời hàng chờ (có socketId thì chỉ khi đúng socket đã vào hàng chờ)
│   │     · move()                          kiểm tra trận, lượt, ô; thắng hoặc hòa thì kết thúc trận
│   │     · abandon()                       rời trận / mất kết nối: người còn lại thắng (ABANDONED);
│   │                                       mất kết nối chỉ tính khi đúng socket (tab) đã vào hàng chờ hoặc vào trận
│   │     · history()                       20 trận gần nhất, kết quả theo góc nhìn người xem (WIN/LOSE/DRAW)
│   │     · isBusy()                        đang chờ hoặc đang trong trận
│   │     · finish()                        ghi nước đi, kết quả, người thắng vào DB; gỡ trận khỏi bộ nhớ
│   └── caro.service.spec.ts                test (7): ghép cặp, hàng chờ, lượt, thắng, rời trận, nhiều tab cùng tài khoản
├── gateways/
│   └── caro.gateway.ts                     WebSocket namespace /caro; hai người cùng trận ở chung room "match:<uuid>"
│         · afterInit()                     gắn middleware xác thực
│         · find() / cancel() / move() / leave()   sự kiện caro:find, caro:cancel, caro:move, caro:leave
│         · handleDisconnect()              mất kết nối → abandon
│         · announceMatch()                 cho hai người vào room, gửi mỗi người caro:matched của mình
│         · endMatch()                      gửi caro:over cho cả room rồi giải tán room
├── controllers/
│   └── caro.controller.ts                  GET /caro/matches (cần token): lịch sử trận
│         · history()
├── entities/
│   └── caro-match.entity.ts                Bảng caro_matches: uuid, player_x_uuid, player_o_uuid, moves (JSON), result_kbn, winner_uuid, started_at, finished_at
└── types/
    └── caro.types.ts                       CaroSeat, ActiveMatch, CaroMatchedView, CaroFinishView, CaroHistoryItem...
```

## 9. `public` (client)

Trang tĩnh, không cần build. Thư viện duy nhất là client Socket.IO do server tự phục vụ ở `/socket.io/socket.io.js`.

```
public/
├── index.html                              Trang đầu: đăng nhập / đăng ký, sảnh chọn trò chơi, sửa thông tin cá nhân
├── line98.html                             Bàn Line 98 (Canvas 450x450), điểm, bóng tiếp theo, nút Gợi ý, Ván mới
├── caro.html                               Bàn cờ caro (Canvas 540x540), nút Tìm trận / Hủy chờ / Rời trận, bảng lịch sử,
│                                           hộp "Bạn muốn rời trận?"
├── css/
│   └── style.css                           Giao diện chung
└── js/
    ├── api.js                              Phần dùng chung
    │     · Api.request()                   gọi API HTTP kèm token; 401 thì đăng xuất
    │     · Api.connect()                   mở Socket.IO kèm token; bị từ chối vì token (20002) thì đăng xuất
    │     · Api.emit()                      gửi sự kiện, chờ phản hồi tối đa 5 giây
    │     · Api.saveLogin() / logout()      lưu, xóa token trong localStorage; logout(notice) để lại lý do cho trang chủ
    │     · Api.takeNotice()                lấy lý do bị đăng xuất (ví dụ đang online ở nơi khác) để hiện ở trang chủ
    ├── lobby.js                            Trang đầu
    │     · login() / showLobby()           đăng nhập, hiện sảnh và thông tin cá nhân; kết nối /presence để được tính là online
    ├── line98.js                           Vẽ và điều khiển Line 98
    │     · drawBall() / drawGrid()         vẽ bóng (có tỷ lệ phóng to/thu nhỏ), vẽ lưới
    │     · render()                        vòng vẽ: bóng được chọn nhấp nháy, gợi ý, hiệu ứng
    │     · playMove()                      chạy hiệu ứng: bóng đi từng ô theo path, bóng bị xóa thu nhỏ, bóng mới lớn dần
    │     · load()                          gửi line98:resume (mở trang) hoặc line98:new (Ván mới), thay bàn
    │     · call()                          gửi một sự kiện, lỗi thì hiện thông báo (dùng cho move, hint)
    └── caro.js                             Vẽ và điều khiển cờ caro
          · render()                        vẽ bàn, X/O, tô sáng nước vừa đánh và hàng thắng
          · showTurn() / setButtons()       hiện lượt hiện tại, bật/tắt nút theo trạng thái (chờ, đang chơi, rảnh)
          · loadHistory()                   tải GET /caro/matches, vẽ bảng lịch sử
          · askLeave()                      đang trong trận mà bấm Sảnh / Line 98 / Đăng xuất: hỏi lại;
                                            "Có" thì gửi caro:leave (xử thua) rồi mới chuyển trang
```

## 10. `test` và `scripts`

```
test/
├── app.e2e-spec.ts                         E2E (app thật, SQLite trong bộ nhớ, client Socket.IO thật):
│                                           tài khoản; validate; một tài khoản chỉ online một nơi; WebSocket không token bị từ chối;
│                                           Line 98; trận caro tới khi X thắng
├── jest-e2e.json                           Cấu hình Jest cho e2e
└── setup-unit.ts                           Tắt log của Nest khi chạy test
scripts/
└── load-test.ts                            npm run load-test: 10 người chơi đồng thời (4 Line 98 + 6 cờ caro)
      · playLine98() / playCaro()           kịch bản một người chơi
      · timedEmit()                         gửi sự kiện, đo thời gian tới khi nhận phản hồi
      · report()                            in bảng TB, p50, p95, Max theo sự kiện; đạt nếu mọi sự kiện < 200 ms
```
