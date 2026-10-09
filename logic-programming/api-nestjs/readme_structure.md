# Cấu trúc thư mục `api-nestjs`

Mỗi dòng là một thư mục hoặc tệp, ý nghĩa ghi bên phải. Dòng bắt đầu bằng `·` là hàm hoặc method chính. Tệp `*.spec.ts` là unit test của tệp cùng tên.

**Quy ước** (giống `integration` và `game-server`):
- Gốc module chỉ có `*.module.ts`; các tệp khác nằm trong thư mục đặt theo loại (`controllers/`, `services/`, `entities/`, `dto/`...).
- Câu chữ (log, lỗi, Swagger, chữ hiển thị trạng thái) nằm ở `src/common/constants/messages.constant.ts`.

## Thư mục gốc

```
api-nestjs/
├── knowledge-about-nestjs/       Phần 1 của đề: giải thích Module, Controller, Service, TypeScript
├── src/                          Mã nguồn
├── test/                         E2E test, cấu hình Jest
├── scripts/perf-test.ts          npm run perf-test: đo GET với 100 bản ghi
├── data/, logs/, dist/           (tự sinh, không commit) SQLite, log, mã đã build
├── .env.example                  Mẫu biến môi trường (không bắt buộc)
├── Dockerfile, docker-compose.yml, .dockerignore
├── package.json                  Thư viện và lệnh npm
├── tsconfig*.json, nest-cli.json, eslint.config.mjs, .prettierrc
├── README.md                     Đối chiếu đề, thiết kế, API, kết quả test
├── readme_run.md                 Cài đặt, chạy, Swagger, test
└── readme_structure.md           Tài liệu này
```

## `src`

```
src/
├── main.ts                                   Khởi động: mở tệp log, tạo app, bật Swagger (/docs), lắng nghe PORT
├── app.module.ts                             Module gốc: SQLite, TasksModule; đăng ký filter lỗi, ValidationPipe, middleware log
├── config/
│   ├── env.validation.ts                     Biến môi trường: PORT, DATABASE_PATH, LOG_DIR (đều có mặc định)
│   ├── app-config.ts                         Cấu hình đã kiểm tra, inject bằng @Inject(appConfig.KEY)
│   ├── load-env-file.ts                      Đọc .env trước khi Nest chạy
│   └── swagger.ts                            · setupSwagger(): tài liệu /docs, JSON tại /docs-json
├── common/
│   ├── constants/messages.constant.ts        ERROR_KBNS (câu m của từng mã lỗi), LOG, ERROR, FIELD, VALIDATION,
│                                             LABEL (chữ của mã trạng thái), API_DOC
│   ├── kbn/
│   │   ├── status.kbn.ts                     StatusKbn (log), TaskStatusKbn 11000-11002, SubtaskStatusKbn 12000-12002
│   │   └── error.kbn.ts                      ErrorKbn: 20001 VALIDATION, 20002 NOT_FOUND, 20003 NOTHING_TO_UPDATE,
│   │                                         30001 TASK_NOT_FOUND, 90001 UNKNOWN
│   ├── errors/
│   │   ├── app.exception.ts                  Lỗi nghiệp vụ: mã lỗi (r), mã HTTP, thông tin phụ (d)
│   │   └── validation-failed.exception.ts    Lỗi validate (r = 20001) kèm lỗi theo từng trường (f)
│   ├── filters/
│   │   ├── all-exceptions.filter.ts          Bắt mọi lỗi, trả body { r, m, f?, d? }; lỗi 5xx ghi stack vào app.log
│   │   │                                     · toErrorResponse(): dựng body lỗi từ một lỗi bất kỳ
│   │   └── all-exceptions.filter.spec.ts     test (4)
│   ├── response/
│   │   ├── api-response.ts                   Dạng body phản hồi { r, d, l, c, m, f }
│   │   │                                     · ok(d) / okList(l, c?) / okEmpty(): body khi thành công
│   │   └── api-response.swagger.ts           Decorator Swagger mô tả đúng body: @ApiDataResponse, @ApiListResponse,
│   │                                         @ApiEmptyResponse, @ApiErrorResponse; ErrorResponseDto
│   ├── validation/
│   │   ├── validation.pipe.ts                · createValidationPipe(): ValidationPipe dùng cho app và test
│   │   │                                     · toFieldErrors(): lỗi class-validator → { "subtasks[1].taskName": [...] }
│   │   └── validation.decorators.ts          · @Trim(): bỏ khoảng trắng hai đầu
│   │                                         · @SkipIfUndefined(): không gửi thì bỏ qua, gửi null vẫn kiểm tra
│   └── logging/                              Log 2 tầng: app.log và services/service_task.log
│       ├── log-files.ts                      Ghi tệp log trong LOG_DIR
│       ├── app-logger.service.ts             Logger toàn cục: console + app.log
│       ├── service-logger.ts                 Logger theo service; định dạng dòng log service
│       ├── request-logging.middleware.ts     Cấp request_id, ghi một dòng log service cho mỗi request
│       ├── request-context.ts                Giữ request_id trong suốt request
│       └── route-services.ts                 /tasks → service_task
└── tasks/
    ├── tasks.module.ts                       Khai báo entity, controller, service của Task
    ├── entities/                             Model của MVC
    │   ├── task.entity.ts                    Bảng tasks; deleted_at để xóa mềm; created_at, updated_at tới mili giây
    │   └── task-detail.entity.ts             Bảng task_details: data_json (danh sách task con)
    ├── controllers/
    │   └── tasks.controller.ts               Controller của MVC: POST/GET/PATCH/DELETE /tasks; bọc kết quả vào { r, d | l }
    ├── services/
    │   ├── tasks.service.ts                  Service của MVC
    │   │     · create()                      ghi tasks + task_details trong một transaction
    │   │     · findAll()                     danh sách chưa xóa, mới nhất trước, chỉ đọc bảng tasks
    │   │     · findOne()                     một task kèm task con
    │   │     · update()                      sửa trường được gửi; subtasks thì ghi đè toàn bộ data_json
    │   │     · remove()                      xóa mềm; không có hoặc đã xóa thì 404
    │   └── tasks.service.spec.ts             test (8) với SQLite thật trong bộ nhớ
    ├── dto/
    │   ├── create-task.dto.ts                Body POST: title bắt buộc; description, statusKbn, subtasks không bắt buộc
    │   ├── update-task.dto.ts                Body PATCH: cùng luật, mọi trường không bắt buộc, gửi null bị từ chối
    │   ├── subtask.dto.ts                    Một task con: taskName, timeEstimate, timeSpent, statusKbn
    │   ├── task-response.dto.ts              Dữ liệu trả về (cho Swagger): task, task kèm task con
    │   └── create-task.dto.spec.ts           test (12) các thông báo validate
    ├── mappers/
    │   ├── task.mapper.ts                    · roundHours(): làm tròn 2 chữ số
    │   │                                     · toSubtaskJson() / toSubtaskResponse(): API (camelCase) ↔ data_json (snake_case)
    │   │                                     · toTaskResponse(): thêm chữ hiển thị của statusKbn
    │   └── task.mapper.spec.ts               test (12)
    ├── pipes/
    │   ├── task-uuid.pipe.ts                 Kiểm tra :uuid trên đường dẫn, sai thì lỗi validate ở f.uuid
    │   └── task-uuid.pipe.spec.ts            test (2)
    └── types/task.types.ts                   SubtaskJson: một phần tử trong data_json
```

## `test`

```
test/
├── app.e2e-spec.ts       E2E (4): CRUD đủ vòng; body lỗi { r, m, f | d }; GET 100 bản ghi dưới 200 ms; Swagger đủ endpoint
├── jest-e2e.json         Cấu hình Jest cho e2e
└── setup-unit.ts         Tắt log của Nest khi chạy test
```
