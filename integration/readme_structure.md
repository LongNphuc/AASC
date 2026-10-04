# Cấu trúc thư mục `integration`

Mỗi dòng là một thư mục hoặc tệp, ý nghĩa ghi ngay bên phải. Dòng bắt đầu bằng `·` là method hoặc hàm chính trong tệp phía trên. Tệp `*.spec.ts` là unit test của tệp cùng tên.

**Quy ước chung**

- Gốc mỗi module (`bitrix`, `contacts`, `jotform`, `health`) chỉ có `*.module.ts`: nơi khai báo module dùng gì, cung cấp gì, chia sẻ gì cho module khác.
- Mọi thứ khác nằm trong thư mục đặt tên theo loại: `controllers/` (nhận request), `services/` (nghiệp vụ), `clients/` (gọi API ngoài), `mappers/` (đổi dạng dữ liệu), `repositories/` (đọc/ghi DB), `entities/` (bảng DB), `dto/` (dữ liệu vào/ra), `types/` (kiểu dữ liệu)...
- Câu chữ (log, lỗi, Swagger) không viết trong code mà nằm ở `src/common/constants/messages.constant.ts`.

**Mục lục:** [1. Thư mục gốc](#1-thư-mục-gốc) · [2. src](#2-src) · [3. config](#3-srcconfig) · [4. common](#4-srccommon) · [5. bitrix](#5-srcbitrix) · [6. contacts](#6-srccontacts) · [7. jotform](#7-srcjotform) · [8. health](#8-srchealth) · [9. test, scripts](#9-test-và-scripts)

---

## 1. Thư mục gốc

```
integration/
├── src/                          Mã nguồn ứng dụng (mục 2 đến 8)
├── test/                         E2E test và cấu hình Jest (mục 9)
├── scripts/                      Công cụ chạy tay, không thuộc ứng dụng (mục 9)
├── data/                         (tự sinh khi chạy bằng npm, không commit) tệp SQLite: token Bitrix24, submission Jotform
├── logs/                         (tự sinh khi chạy bằng npm, không commit) app.log và services/*.log
├── dist/                         (tự sinh, không commit) mã JavaScript sau khi build
├── .env                          (không commit) biến môi trường thật: key, secret
├── .env.example                  Mẫu .env để trống giá trị, có chú thích từng biến
├── Dockerfile                    Build image 2 tầng (build → chạy), chạy bằng user node, có HEALTHCHECK gọi /health
├── docker-compose.yml            Chạy container: đọc .env, mở cổng PORT, lưu data/logs trong named volume
├── .dockerignore                 Không đưa node_modules, dist, .env, data, logs, test vào image
├── .gitignore                    Không commit .env, data/, logs/, node_modules/, dist/
├── package.json                  Thư viện và lệnh npm: build, start, test, lint, inspect:bitrix
├── package-lock.json             Khóa phiên bản thư viện
├── tsconfig.json                 Cấu hình TypeScript
├── tsconfig.build.json           Cấu hình build: bỏ test/, scripts/, *.spec.ts
├── nest-cli.json                 Cấu hình Nest CLI
├── eslint.config.mjs             Quy tắc ESLint kèm Prettier
├── .prettierrc                   Định dạng code: nháy đơn, dấu phẩy cuối
├── README.md                     Trang đầu: tổng quan, liên kết tài liệu, đối chiếu yêu cầu đề
├── readme_run.md                 Các bước cài đặt và chạy
├── readme_api.md                 Endpoint, lỗi đã xử lý, kết quả test
├── readme_design.md              Thiết kế: luồng xử lý, DB, mã kbn, log, bảo mật
└── readme_structure.md           Tài liệu này
```

## 2. `src`

```
src/
├── main.ts                       Điểm khởi động ứng dụng
│     · (đầu tệp)                 đọc .env sớm, mở tệp log trước khi Nest khởi tạo
│     · bootstrap()               tạo app, bật Swagger, lắng nghe PORT, in URL và biến còn thiếu
│     · bootstrap().catch()       khởi động lỗi: ghi app.log, đóng tệp log, thoát mã 1
├── app.module.ts                 Module gốc: ghép các module, kết nối SQLite, bật ScheduleModule;
│                                 đăng ký toàn cục guard API key, filter lỗi, ValidationPipe
│     · configure()               gắn RequestLoggingMiddleware cho mọi request
├── config/                       Đọc và kiểm tra cấu hình (mục 3)
├── common/                       Dùng chung cho mọi module (mục 4)
├── bitrix/                       File 2 bài 1: OAuth 2.0 với Bitrix24 (mục 5)
├── contacts/                     File 2 bài 2: API quản lý contact (mục 6)
├── jotform/                      File 1: Jotform → Bitrix24 (mục 7)
└── health/                       GET /health (mục 8)
```

## 3. `src/config`

```
config/
├── env.validation.ts             Danh sách biến môi trường, kiểu, giá trị mặc định
│     · EnvironmentVariables      mô tả từng biến (PORT, CLIENT_ID, API_KEY, JOTFORM_API_KEY...)
│     · validateEnv()             kiểm tra process.env; sai thì dừng khởi động, báo biến nào sai
│     · DEFAULT_LOG_DIR           thư mục log mặc định "logs"
├── app-config.ts                 Gom cấu hình đã kiểm tra thành object có kiểu, chia nhóm bitrix, jotform
│     · appConfig                 inject vào service bằng @Inject(appConfig.KEY)
│     · findMissingSettings()     tên các biến còn trống, để cảnh báo lúc khởi động
├── load-env-file.ts
│     · loadEnvFileIfPresent()    đọc .env vào process.env trước khi Nest chạy; không ghi đè biến có sẵn
└── swagger.ts
      · setupSwagger()            tạo tài liệu /docs; khai báo xác thực x-api-key (nút Authorize)
```

## 4. `src/common`

```
common/
├── auth/
│   ├── api-key.guard.ts                    Guard toàn cục: mọi endpoint cần header x-api-key, trừ endpoint @Public()
│   │     · canActivate()                   @Public thì cho qua; chưa cấu hình API_KEY thì 503; sai key thì 401
│   │     · safeEquals()                    so sánh khóa trong thời gian không đổi, chống dò khóa
│   │     · API_KEY_HEADER                  tên header "x-api-key", dùng chung với Swagger
│   └── public.decorator.ts                 @Public(): endpoint không cần API key (/install, /webhook/jotform, /health)
├── constants/
│   └── messages.constant.ts                Toàn bộ câu chữ của ứng dụng; code chỉ gọi tên hằng
│         · LOG, WARN                       nội dung logger.log, logger.warn
│         · ERROR                           thông báo lỗi trả client và logger.error
│         · VALIDATION, FIELD               thông báo validate DTO, tên trường
│         · MESSAGE                         nội dung trả về không phải lỗi, chữ trên trang cài đặt
│         · API_DOC                         tóm tắt, mô tả, ví dụ trong Swagger
├── errors/
│   ├── external-api.error.ts               Lỗi chuẩn hóa khi gọi Bitrix24 hoặc Jotform (không chứa token, URL)
│   │     · ExternalApiError                dịch vụ + loại lỗi + chi tiết gốc; mã HTTP trả client suy từ loại lỗi
│   │     · ExternalErrorKind               12 loại: TIMEOUT, NETWORK, AUTH, TOKEN_EXPIRED, NOT_FOUND, SERVER...
│   │     · classifyTransportError()        lỗi mạng của axios → TIMEOUT hoặc NETWORK
│   └── app-config.exception.ts             Lỗi 503 khi ứng dụng thiếu cấu hình (error_kbn 90002)
├── filters/
│   └── all-exceptions.filter.ts            Bắt mọi lỗi, trả JSON thống nhất {statusCode, error, errorKbn, message, path}
│         · catch()                         dựng body lỗi; để lại error_kbn cho middleware ghi log service
│         · toBody()                        đổi ExternalApiError / HttpException / lỗi lạ thành mã HTTP và thông báo
│         · logToApp()                      ghi app.log với lỗi dịch vụ ngoài và lỗi 5xx
├── kbn/                                    Mã trạng thái, mã lỗi dùng chung cho DB, log, body lỗi
│   ├── status.kbn.ts                       StatusKbn: 10000 SUCCESS, 10001 FAILED, 10002 PROCESSING, 10003 SKIPPED_DUPLICATE (chỉ response, log)
│   ├── error.kbn.ts                        Mã lỗi 5 chữ số; chữ số đầu là nguồn: 2 request, 3 Jotform, 4 Bitrix24, 5 OAuth, 9 hệ thống
│   │     · errorKbnOf()                    suy error_kbn từ một lỗi bất kỳ
│   │     · externalErrorKbn()              nguồn × 10000 + loại; ví dụ Bitrix24 + AUTH = 40003
│   │     · describeErrorKbn()              tên dễ đọc: 40003 → "BITRIX24.AUTH"
│   └── error.kbn.spec.ts                   test: tính mã cho từng loại lỗi, tên dễ đọc
├── logging/                                Log 2 tầng: app.log và services/<service>.log
│   ├── log-files.ts                        Quản lý tệp log trong LOG_DIR (một bản dùng chung: logFiles)
│   │     · configure()                     chọn thư mục log, tạo thư mục services/
│   │     · write()                         ghi một dòng, che mã bí mật trong URL webhook
│   │     · close()                         ghi hết bộ đệm rồi đóng tệp, dùng trước khi thoát vì lỗi
│   ├── app-logger.service.ts               Logger toàn cục: in console và ghi app.log
│   │                                       "thời gian | mức | service | request_id | [Lớp] nội dung"
│   │     · log() / warn() / error() / debug()   in như Nest rồi ghi app.log
│   │     · writeToFile()                   tách service và lớp từ context, tách stack trace
│   ├── app-logger.service.spec.ts          test: định dạng dòng app.log, stack trace không bị nhận nhầm là service
│   ├── service-logger.ts                   Logger theo service, ghi chi tiết từng lệnh gọi API
│   │     · LogService                      4 tệp: service_auth, service_bitrix, service_contacts, service_jotform
│   │     · ServiceLogger                   log() ghi app.log kèm tên service; record() ghi services/<service>.log
│   │     · formatServiceLine()             "thời gian | request_id | method | status_kbn | error_kbn | ms | error_detail"
│   │     · writeServiceLog()               ghi một dòng vào tệp service
│   ├── service-logger.spec.ts              test: định dạng dòng log service
│   ├── request-logging.middleware.ts       Chạy đầu tiên với mọi request
│   │     · use()                           cấp request_id (header x-request-id); trả lời xong thì ghi 1 dòng log service
│   ├── request-context.ts                  Giữ request_id của request đang xử lý (AsyncLocalStorage)
│   │     · run() / requestId()             chạy code trong ngữ cảnh request / đọc request_id hiện tại
│   ├── route-services.ts                   Đường dẫn nào ghi vào log service nào (/contacts → service_contacts...)
│   │     · serviceForPath()
│   └── redact.ts                           Che bí mật trước khi ghi log
│         · redactSecrets()                 giá trị của khóa token, secret, code, api_key → [REDACTED len=..]
│         · maskWebhookUrl()                che mã trong URL webhook: /rest/1/***
└── validation/
    ├── validation-exception.factory.ts     Gom lỗi validate DTO thành danh sách thông báo tiếng Việt
    │     · validationExceptionFactory()    trả 400 "Validation Failed" kèm danh sách lỗi
    │     · flatten()                       duyệt lỗi lồng nhau (address.ward: ...), báo trường không được hỗ trợ
    └── trim.decorator.ts                   @Trim(): bỏ khoảng trắng hai đầu trước khi validate
```

## 5. `src/bitrix`

File 2 bài 1: nhận sự kiện cài đặt, lưu và làm mới token, hàm `callBitrixAPI`.

```
bitrix/
├── bitrix.module.ts                        Khai báo module; chia sẻ BitrixService (OAuth) và BitrixWebhookClient (File 1 dùng)
├── controllers/
│   ├── install.controller.ts               POST/GET /install (công khai, ẩn khỏi Swagger): Bitrix24 gọi khi cài hoặc cài lại ứng dụng
│   │     · handlePost() / handleGet()      nhận request cài đặt
│   │     · handle()                        ghi log request (đã che token), gọi BitrixInstallService,
│   │                                       trả JSON (sự kiện từ máy chủ) hoặc trang HTML (trong khung Bitrix24)
│   └── bitrix.controller.ts                /bitrix/* (cần API key): kiểm tra, demo OAuth
│         · installation()                  GET  /bitrix/installation: trạng thái cài, hạn token (không lộ token)
│         · refresh()                       POST /bitrix/token/refresh: làm mới token ngay
│         · testCall()                      GET  /bitrix/test-call: gọi thử callBitrixAPI("crm.contact.list")
├── services/
│   ├── bitrix.service.ts                   Cửa ngõ gọi Bitrix24 REST bằng OAuth
│   │     · callBitrixAPI()                 gọi method bằng access_token hiện tại; bị báo expired_token thì làm mới, gọi lại đúng 1 lần
│   │     · call()                          như trên, chỉ trả về result
│   │     · listAll()                       đọc hết các trang của method *.list (50 bản ghi mỗi trang)
│   │     · callWithToken()                 gọi bằng một token cụ thể (lúc cài đặt, token chưa được lưu)
│   ├── bitrix.service.spec.ts              test: đúng URL và token; làm mới rồi gọi lại 1 lần; không lặp; không làm mới với lỗi khác; phân trang
│   ├── bitrix-token.service.ts             Vòng đời token, lưu ở bảng bitrix_installations
│   │     · saveTokens()                    lưu token khi cài: đã có member_id thì cập nhật, chưa có thì thêm
│   │     · updateInstaller()               lưu ID và tên người cài
│   │     · getInstallation()               lấy bản cài theo member_id hoặc BITRIX24_DOMAIN; chưa cài thì lỗi NOT_INSTALLED
│   │     · getValidInstallation()          như trên; token còn dưới 60 giây thì làm mới trước
│   │     · refresh()                       làm mới token; khóa theo member_id để không làm mới trùng
│   │     · refreshExpiring()               batch: làm mới mọi token sắp hết hạn trong khoảng cho trước
│   │     · performRefresh()                đọc refresh_token mới nhất, gọi OAuth, lưu cả hai token mới
│   ├── bitrix-token.service.spec.ts        test: lưu token mới; đồng thời chỉ làm mới 1 lần; refresh_token hỏng; refreshExpiring (SQLite thật)
│   └── bitrix-install.service.ts           Xử lý cài đặt và cài lại
│         · handleInstall()                 nhận dạng dữ liệu → đổi code (nếu có) → kiểm tra portal → xác minh bằng app.info → lưu token
│         · assertAllowedDomain()           chỉ nhận portal trong BITRIX24_DOMAIN (chống SSRF)
│         · recordInstaller()               gọi user.current để lưu người cài; lỗi thì chỉ cảnh báo
├── clients/
│   ├── bitrix-http.client.ts               Tầng HTTP gọi Bitrix24 REST, dùng chung cho OAuth và webhook vào
│   │     · post()                          gửi POST JSON; bị giới hạn tần suất thì thử lại 2 lần (sau 1s, 2s)
│   │     · send()                          gửi 1 lần, chuẩn hóa lỗi, ghi services/service_bitrix.log
│   ├── bitrix-http.client.spec.ts          test: timeout, mất mạng, 401, 404, 500, HTTP 200 nhưng body báo lỗi
│   ├── bitrix-oauth.client.ts              Máy chủ OAuth oauth.bitrix.info (cần CLIENT_ID, CLIENT_SECRET)
│   │     · exchangeCode()                  đổi code lấy token
│   │     · refreshToken()                  đổi refresh_token lấy cặp token mới
│   │     · requestToken() / fetchToken()   gọi máy chủ, kiểm tra phản hồi đủ trường, ghi services/service_auth.log
│   │     · fromOAuthErrorBody()            invalid_client → CONFIG; invalid_grant → REINSTALL_REQUIRED (refresh) hoặc AUTH (code)
│   ├── bitrix-oauth.client.spec.ts         test: tham số gửi đi, domain lấy từ client_endpoint, các lỗi OAuth
│   └── bitrix-webhook.client.ts            Gọi Bitrix24 qua webhook vào (BITRIX24_WEBHOOK_URL), File 1 dùng
│         · call()                          gọi method; lỗi xác thực thì gợi ý kiểm tra URL và quyền CRM
├── schedulers/
│   ├── token-refresh.scheduler.ts          Batch làm mới token chủ động
│   │     · refreshExpiringTokens()         @Cron mỗi 30 phút: làm mới token còn dưới 35 phút, ghi kết quả vào log
│   └── token-refresh.scheduler.spec.ts     test: cron được đăng ký lịch 30 phút; ghi SUCCESS/FAILED; lỗi không làm sập ứng dụng
├── mappers/
│   ├── bitrix-error.mapper.ts              Lỗi Bitrix24 → ExternalApiError
│   │     · classifyBitrixError()           xếp loại theo mã lỗi trong body trước, rồi mới theo mã HTTP
│   │     · toBitrixError()                 chuẩn hóa mọi lỗi khi gọi Bitrix24 (mạng, HTTP, body báo lỗi)
│   │     · fromErrorBody()                 dựng lỗi từ body, giữ mã và mô tả gốc
│   └── bitrix-error.mapper.spec.ts         test: bảng phân loại lỗi, body HTML, lỗi không xác định
├── parsers/
│   ├── install-payload.parser.ts           Nhận dạng dữ liệu cài đặt Bitrix24 gửi tới
│   │     · parseInstallPayload()           event (ONAPPINSTALL) / iframe (AUTH_ID, REFRESH_ID) / code (?code=); không khớp thì null
│   └── install-payload.parser.spec.ts      test: 3 dạng dữ liệu và dữ liệu thiếu
├── views/
│   └── install-page.ts                     Trang HTML trả về khi cài trong khung Bitrix24
│         · renderInstallPage()             gọi BX24.installFinish() chỉ khi ứng dụng chưa cài xong
├── entities/
│   └── bitrix-installation.entity.ts       Bảng bitrix_installations: khóa member_id, domain, 2 token, expires_at, người cài
└── types/
    └── bitrix.types.ts                     Kiểu dữ liệu Bitrix24: phản hồi, lỗi, token, trường PHONE/EMAIL
          · computeExpiresAt()              thời điểm hết hạn từ expires (mốc) hoặc expires_in (số giây)
          · restEndpointFor()               URL REST của portal: https://<domain>/rest/
```

## 6. `src/contacts`

File 2 bài 2: thêm, sửa, xóa, xem contact kèm địa chỉ và ngân hàng. Mọi endpoint cần API key.

```
contacts/
├── contacts.module.ts                      Khai báo module; dùng BitrixService của BitrixModule
├── controllers/
│   └── contacts.controller.ts              /contacts
│         · list()                          GET    /contacts?start=: danh sách, 50 contact mỗi trang
│         · findOne()                       GET    /contacts/:id
│         · create()                        POST   /contacts
│         · update()                        PUT    /contacts/:id: chỉ đổi trường được gửi lên
│         · remove()                        DELETE /contacts/:id
├── services/
│   ├── contacts.service.ts                 Nghiệp vụ: contact → requisite → ngân hàng và địa chỉ
│   │     · list() / findOne()              đọc contact kèm requisite, ngân hàng, địa chỉ
│   │     · create()                        tạo contact rồi requisite; bước sau lỗi thì xóa contact vừa tạo
│   │     · update()                        sửa contact; tạo hoặc sửa requisite, ngân hàng, địa chỉ
│   │     · remove()                        xóa theo thứ tự ngân hàng → địa chỉ → requisite → contact
│   │     · getContactOrThrow()             crm.contact.get; không có thì 404 "Contact không tồn tại"
│   │     · loadDetails()                   đọc requisite, ngân hàng, địa chỉ của cả trang bằng 3 lệnh gọi
│   │     · createRequisite() / syncRequisite()   tạo hoặc cập nhật requisite và phần con
│   │     · upsertAddress() / upsertBankDetail()  sửa nếu đã có, tạo nếu chưa
│   │     · rollbackContact()               xóa contact tạo dở dang
│   ├── contacts.service.spec.ts            test: thứ tự tạo; hoàn tác khi bước ngân hàng lỗi; 404; sửa số theo ID; gộp danh sách
│   └── requisite-preset.service.ts         Tìm PRESET_ID (mẫu requisite) để tạo requisite
│         · getPresetId()                   dùng BITRIX24_REQUISITE_PRESET_ID hoặc tự dò mẫu "cá nhân"; nhớ kết quả
├── mappers/
│   ├── contact.mapper.ts                   Dữ liệu API ↔ trường Bitrix24
│   │     · toContactAddFields()            DTO → NAME, PHONE[], EMAIL[], WEB[]
│   │     · toContactUpdateFields()         chỉ trường được gửi; sửa giá trị cũ theo ID thay vì thêm số mới
│   │     · toAddressFields() / addressKey()      địa chỉ VN → ADDRESS_1, ADDRESS_2, REGION, PROVINCE
│   │     · toBankFields()                  → RQ_BANK_NAME, RQ_ACC_NUM
│   │     · toContactResponse() / displayName()   dữ liệu Bitrix24 → response trả client
│   └── contact.mapper.spec.ts              test: các hàm ánh xạ
├── dto/                                    Dữ liệu vào/ra và luật validate
│   ├── create-contact.dto.ts               name (bắt buộc), phone (số VN), email, website, address, bank
│   ├── create-contact.dto.spec.ts          test: thông báo validate (thiếu → "là bắt buộc", sai kiểu → "phải là chuỗi"); PUT không cần tên
│   ├── update-contact.dto.ts               như trên, mọi trường tùy chọn
│   ├── address.dto.ts                      street, ward, district, province
│   ├── bank.dto.ts                         bankName, accountNumber (6-20 chữ số)
│   ├── list-contacts.query.ts              ?start= để phân trang
│   └── contact-response.dto.ts             dạng một contact trả về và danh sách {items, total, next}
├── pipes/
│   └── contact-id.pipe.ts                  Kiểm tra tham số :id là số nguyên dương
│         · transform()
└── types/
    └── bitrix-crm.types.ts                 Kiểu contact, requisite, ngân hàng, địa chỉ; ENTITY_TYPE (3 contact, 8 requisite)
```

## 7. `src/jotform`

File 1: mỗi submission Jotform tạo một contact trên Bitrix24.

```
jotform/
├── jotform.module.ts                       Khai báo module; dùng BitrixWebhookClient của BitrixModule
├── controllers/
│   ├── jotform-webhook.controller.ts       POST /webhook/jotform (công khai): Jotform gọi khi có submission mới
│   │     · receive()                       đọc multipart, kiểm tra submissionID và formID, chuyển cho JotformService
│   │     · describeBody()                  tóm tắt body để ghi log (chỉ tên trường, không ghi dữ liệu cá nhân)
│   └── jotform.controller.ts               /jotform/* (cần API key): quản trị
│         · sync()                          POST /jotform/sync?limit=: đồng bộ bù qua Jotform API
│         · webhooks()                      GET  /jotform/webhooks: webhook đang gắn với form
│         · registerWebhook()               POST /jotform/webhooks: gắn <PUBLIC_URL>/webhook/jotform vào form
│         · submissions()                   GET  /jotform/submissions: 50 lần xử lý gần nhất
│         · submission()                    GET  /jotform/submissions/:uuid: một lần xử lý kèm nội dung form
├── services/
│   ├── jotform.service.ts                  Luồng xử lý submission
│   │     · processSubmission()             chống trùng → lấy qua Jotform API → lưu nội dung → kiểm tra form
│   │                                       → ánh xạ → crm.contact.add → ghi status_kbn, error_kbn
│   │     · syncRecent()                    đọc submission mới nhất qua API, xử lý cái chưa có contact
│   │     · ensureWebhook() / listWebhooks()      gắn và xem webhook của form qua Jotform API
│   │     · recentSubmissions() / findSubmission()  dữ liệu cho các endpoint xem submission
│   └── jotform.service.spec.ts             test: tạo contact; trùng thì trả 10003, không ghi DB; đồng thời chỉ 1 contact; khác form 20004; Bitrix24 lỗi 40003
├── clients/
│   └── jotform-api.client.ts               Gọi Jotform API (key gửi qua header APIKEY), ghi services/service_jotform.log
│         · getSubmission()                 GET /submission/{id}
│         · listSubmissions()               GET /form/{id}/submissions (mới nhất trước)
│         · listWebhooks() / createWebhook()      GET, POST /form/{id}/webhooks
│         · request()                       gửi request, chuẩn hóa lỗi: sai key, 404, 429, 5xx, timeout
├── mappers/
│   ├── submission.mapper.ts                Câu trả lời Jotform → dữ liệu contact
│   │     · mapSubmissionToContact()        tìm họ tên, điện thoại, email theo loại trường; validate; sai thì lỗi 422
│   │     · toFormContent()                 nội dung lưu vào form_content: {formId, submittedAt, answers}
│   └── submission.mapper.spec.ts           test: các dạng trường, báo đủ lỗi khi dữ liệu sai
├── repositories/
│   ├── form-submission.repository.ts       Đọc/ghi 2 bảng submission
│   │     · findOrCreateDetail()            lấy hoặc tạo dòng chi tiết theo jotform_id (an toàn khi đồng thời)
│   │     · createSubmission() / finishSubmission()  ghi một lần xử lý, cập nhật status_kbn, error_kbn
│   │     · saveContent() / saveContactId()        lưu nội dung form, ID contact
│   │     · recent() / findOne()            đọc lần xử lý kèm chi tiết
│   └── form-submission.repository.spec.ts  test (SQLite thật): không trùng chi tiết, mỗi lần xử lý 1 dòng, JSON đọc lại đúng
├── entities/
│   ├── form-submission.entity.ts           Bảng form_submissions: mỗi lần xử lý 1 dòng (uuid, status_kbn, error_kbn, received_at); trùng thì không ghi
│   └── form-submission-detail.entity.ts    Bảng form_submission_details: nội dung submission (uuid, jotform_id duy nhất, form_content, contact_id)
└── types/
    └── jotform.types.ts                    Kiểu phản hồi Jotform API, câu trả lời, body webhook, FormContent
```

## 8. `src/health`

```
health/
├── health.module.ts                        Khai báo module
└── controllers/
    └── health.controller.ts                GET /health (công khai): trả {status, time}; dùng thử ngrok và cho HEALTHCHECK Docker
          · check()
```

## 9. `test` và `scripts`

```
test/
├── app.e2e-spec.ts                         E2E: /health không cần key; thiếu/sai key 401; chưa cài thì NOT_INSTALLED; /install dữ liệu lạ 400
├── jest-e2e.json                           Cấu hình Jest cho e2e
└── setup-unit.ts                           Tắt log của Nest khi chạy unit test
scripts/
└── inspect-bitrix.ts                       npm run inspect:bitrix: đọc contact, requisite, ngân hàng, địa chỉ thật để đối chiếu trường
```
