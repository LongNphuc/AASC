# Bài 1: API quản lý Task (NestJS)

API RESTful quản lý Task: NestJS 11, TypeORM, SQLite, Swagger.

| Tài liệu | Nội dung |
|---|---|
| [knowledge-about-nestjs](knowledge-about-nestjs/README.md) | Phần 1 của đề: Module, Controller, Service, TypeScript trong NestJS |
| [readme_run.md](readme_run.md) | Cài đặt, chạy, mở Swagger, chạy test |
| [readme_structure.md](readme_structure.md) | Cấu trúc thư mục, ý nghĩa từng tệp |

```bash
cd logic-programming/api-nestjs
npm ci
npm run start:dev        # Swagger: http://localhost:3002/docs
```

## 1. Đối chiếu yêu cầu đề

| Yêu cầu | Cách làm |
|---|---|
| Task gồm id (UUID), title, description, status, createdAt | Bảng `tasks`: `uuid`, `title`, `description`, `status_kbn`, `created_at` (thêm `updated_at`, `deleted_at`) |
| status: "To Do", "In Progress", "Done" | Lưu và gửi bằng mã số `statusKbn` (11000, 11001, 11002); phản hồi trả thêm chữ `status` để hiển thị |
| CRUD | `POST /tasks`, `GET /tasks`, `GET /tasks/:uuid`, `PATCH /tasks/:uuid`, `DELETE /tasks/:uuid` |
| TypeORM + SQLite | `better-sqlite3`, tệp `data/tasks.sqlite` |
| MVC | Model: `tasks/entities/`; Controller: `TasksController`; Service: `TasksService` |
| Validate bằng Pipes (title không rỗng) | `ValidationPipe` toàn cục + DTO; `TaskUuidPipe` kiểm tra `:uuid` |
| Swagger tại `/docs` | `config/swagger.ts`; JSON tại `/docs-json` |
| Ít nhất 1 unit test | 38 unit test + 4 e2e test ([mục 5](#5-kết-quả-test)) |
| GET 100 bản ghi dưới 200 ms | Đo được trung bình 3,5 ms, chậm nhất 4,3 ms ([mục 5.3](#53-tốc-độ-get-với-100-bản-ghi)) |

Phần thêm ngoài đề: mỗi task có danh sách **task con** (tên, giờ ước tính, giờ đã làm, trạng thái); xóa là **xóa mềm**.

## 2. Thiết kế dữ liệu

```
tasks                                     task_details
─────────────────────────────            ─────────────────────
uuid (khóa chính)                    ┌──▶ uuid (khóa chính)
title                                │    data_json
description                          │    created_at
status_kbn                           │    updated_at
task_detail_uuid ────────────────────┘
created_at
updated_at
deleted_at  (null là chưa xóa)
```

- **Mỗi task đúng một dòng `task_details`.** Danh sách task con nằm trong `data_json`; không có task con thì là `[]`.
- **Tách 2 bảng:** `GET /tasks` chỉ đọc bảng `tasks`, không phải đọc JSON, nên nhanh. Task con chỉ được đọc khi xem một task.
- **Sửa task con:** gửi danh sách mới thì **ghi đè toàn bộ** `data_json`, không sửa từng phần tử.
- **Xóa mềm:** `DELETE` chỉ ghi `deleted_at`. Task đã xóa không hiện ở các API `GET` nữa, nhưng dòng vẫn còn trong DB.
- **Thời gian:** `created_at`, `updated_at` lưu tới mili giây, để các task tạo trong cùng một giây vẫn xếp đúng thứ tự.

`data_json` của một task:

```json
[
  { "task_name": "create", "time_estimate": 1.5, "time_spent": 0.75, "status_kbn": 12000 },
  { "task_name": "read", "time_estimate": 2, "time_spent": 0, "status_kbn": 12002 }
]
```

**Mã trạng thái (kbn).** DB, code và client đều dùng mã số; chữ chỉ dùng để hiển thị cho người dùng.

| Task (`status_kbn`) | Task con (`status_kbn` trong `data_json`) |
|---|---|
| 11000 To Do | 12000 In Progress |
| 11001 In Progress | 12001 Done |
| 11002 Done | 12002 Blocked |

## 3. API

**Dạng phản hồi.** Mọi API trả về một object, chỉ gồm các khóa sau (khóa nào không dùng thì không có):

| Khóa | Nghĩa | Khi nào có |
|---|---|---|
| `r` | Mã kết quả: `10000` là thành công, còn lại là mã lỗi ([mục 4](#4-lỗi)) | Luôn có |
| `d` | Một object. Thành công: kết quả; lỗi: thông tin phụ của lỗi | Thành công trả một object; một số lỗi |
| `l` | Danh sách bản ghi | Thành công, API trả danh sách |
| `c` | Tổng số bản ghi để phân trang (không phải độ dài `l`) | Đi kèm `l` khi có phân trang (hiện `GET /tasks` chưa phân trang nên chưa có) |
| `m` | Câu thông báo lỗi theo mã `r` | Chỉ khi lỗi |
| `f` | Lỗi theo từng trường `{ trường: [thông báo, ...] }` | Chỉ khi lỗi validate |

Mã HTTP vẫn theo đúng loại kết quả (200, 201, 400, 404, 500).

| Phương thức | Đường dẫn | Mô tả | Thành công |
|---|---|---|---|
| `POST` | `/tasks` | Tạo task, có thể kèm task con | `201`, `{ r, d: task kèm task con }` |
| `GET` | `/tasks` | Danh sách task, mới nhất trước, không kèm task con | `200`, `{ r, l: [task] }` |
| `GET` | `/tasks/:uuid` | Một task, kèm task con | `200`, `{ r, d }` |
| `PATCH` | `/tasks/:uuid` | Sửa trường được gửi; gửi `subtasks` thì thay toàn bộ danh sách | `200`, `{ r, d: task sau khi sửa }` |
| `DELETE` | `/tasks/:uuid` | Xóa mềm | `200`, `{ r }` |

**Dữ liệu gửi lên** (`POST`; với `PATCH` mọi trường đều không bắt buộc):

| Trường | Bắt buộc | Luật | Không gửi thì |
|---|---|---|---|
| `title` | Có | Chuỗi, không rỗng (bỏ khoảng trắng hai đầu), tối đa 200 ký tự | |
| `description` | | Chuỗi, tối đa 2000 ký tự | `""` |
| `statusKbn` | | 11000, 11001 hoặc 11002 | 11000 (To Do) |
| `subtasks` | | Mảng, tối đa 100 phần tử | `[]` |
| `subtasks[].taskName` | Có | Chuỗi, không rỗng, tối đa 200 ký tự | |
| `subtasks[].timeEstimate` | Có | Số giờ từ 0 tới 10000, làm tròn 2 chữ số thập phân | |
| `subtasks[].timeSpent` | | Như trên | 0 |
| `subtasks[].statusKbn` | | 12000, 12001 hoặc 12002 | 12000 (In Progress) |

Ví dụ `POST /tasks`:

```json
{
  "title": "Làm API quản lý task",
  "subtasks": [
    { "taskName": "create", "timeEstimate": 1.5, "timeSpent": 0.75 },
    { "taskName": "read", "timeEstimate": 2, "statusKbn": 12002 }
  ]
}
```

Phản hồi `201`:

```json
{
  "r": 10000,
  "d": {
    "uuid": "77ff7056-3906-4038-86df-1c195bdbc056",
    "title": "Làm API quản lý task",
    "description": "",
    "statusKbn": 11000,
    "status": "To Do",
    "createdAt": "2026-10-08T15:55:40.207Z",
    "updatedAt": "2026-10-08T15:55:40.207Z",
    "subtasks": [
      { "taskName": "create", "timeEstimate": 1.5, "timeSpent": 0.75, "statusKbn": 12000, "status": "In Progress" },
      { "taskName": "read", "timeEstimate": 2, "timeSpent": 0, "statusKbn": 12002, "status": "Blocked" }
    ]
  }
}
```

`GET /tasks` trả `{ "r": 10000, "l": [ { "uuid": "...", "title": "...", ... } ] }`.

## 4. Lỗi

Lỗi validate: `m` là câu chung của mã, chi tiết từng trường nằm ở `f`. Trường trong mảng ghi kèm vị trí:

```json
{
  "r": 20001,
  "m": "Dữ liệu không hợp lệ",
  "f": {
    "title": ["Tiêu đề là bắt buộc"],
    "subtasks[0].timeEstimate": ["Thời gian ước tính phải từ 0 tới 10000 giờ"]
  }
}
```

Lỗi khác: thông tin phụ nằm ở `d`:

```json
{ "r": 30001, "m": "Task không tồn tại hoặc đã bị xóa", "d": { "uuid": "77ff7056-..." } }
```

| `r` | HTTP | `m` | Khi nào |
|---|---|---|---|
| 20001 | 400 | Dữ liệu không hợp lệ | Sai luật ở mục 3, trường lạ, uuid sai định dạng (`f.uuid`), JSON hỏng |
| 20002 | 404 | Đường dẫn không tồn tại | Gọi sai đường dẫn (`d.path`) |
| 20003 | 400 | Không có trường nào để cập nhật | `PATCH` với body rỗng |
| 30001 | 404 | Task không tồn tại hoặc đã bị xóa | uuid không có hoặc đã xóa (`d.uuid`) |
| 90001 | 500 | Lỗi máy chủ nội bộ | Lỗi hệ thống; chi tiết chỉ ghi trong `logs/app.log`, không trả cho client |

Câu `m` của từng mã nằm ở `ERROR_KBNS` trong `src/common/constants/messages.constant.ts`, đóng vai trò như bảng dịch `error_kbns.<code>`.

## 5. Kết quả test

### 5.1 Unit test (38 test)

```
$ npm test
Test Suites: 5 passed, 5 total
Tests:       38 passed, 38 total
```

| Tệp | Kiểm tra |
|---|---|
| `tasks/services/tasks.service.spec.ts` (8) | Chạy với SQLite thật trong bộ nhớ. Tạo task: mặc định To Do, `data_json = []`; có task con thì lưu khóa snake_case, làm tròn giờ, điền mặc định. Danh sách: mới nhất trước, không kèm task con, không có task đã xóa. Xem: kèm task con, không có thì 404. Sửa: chỉ trường được gửi; `subtasks` ghi đè toàn bộ; không gửi gì thì 400. Xóa mềm: còn dòng kèm `deleted_at`; xem, sửa, xóa lại đều 404 |
| `tasks/dto/create-task.dto.spec.ts` (12) | Chạy đúng `ValidationPipe` của ứng dụng, kiểm tra `f`: tiêu đề thiếu, rỗng, toàn khoảng trắng, là số, quá dài; `statusKbn` là chuỗi hay mã lạ; `subtasks` không phải mảng, quá 100 phần tử; lỗi trong task con ghi theo khóa `subtasks[i].tên_trường`; trường lạ bị từ chối; `PATCH` gửi `null` bị từ chối |
| `tasks/mappers/task.mapper.spec.ts` (12) | Làm tròn giờ (1.005 → 1.01, 0.1 + 0.2 → 0.3); giá trị mặc định của task con; chữ hiển thị của từng mã trạng thái |
| `tasks/pipes/task-uuid.pipe.spec.ts` (2) | uuid hợp lệ thì cho qua; sai thì lỗi validate ở `f.uuid` |
| `common/filters/all-exceptions.filter.spec.ts` (4) | Body lỗi: validate có `f`; lỗi nghiệp vụ có `d`; sai đường dẫn có `d.path`; lỗi lạ trả 90001, không lộ chi tiết |

### 5.2 E2E test (4 test)

```
$ npm run test:e2e
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

Chạy app thật qua HTTP, SQLite trong bộ nhớ:
1. CRUD đủ vòng: tạo → danh sách → xem → sửa → xóa mềm → không còn thấy; kiểm tra đúng dạng `{ r, d }`, `{ r, l }`, `{ r }`.
2. Lỗi trả `{ r, m }` kèm `f` hoặc `d`: validate, uuid sai, `PATCH` rỗng, task không tồn tại, sai đường dẫn.
3. Tạo 100 task, gọi `GET /tasks` 10 lần: lần nào cũng dưới 200 ms.
4. Swagger có tại `/docs`, tài liệu JSON có đủ 5 endpoint.

### 5.3 Tốc độ GET với 100 bản ghi

`npm run perf-test` (server đang chạy): tạo 100 task, mỗi task 3 task con, gọi mỗi API GET 20 lần, xong thì xóa dữ liệu thử. Kết quả trên máy local (Node 24, WSL2, i7-13620H):

```
GET /tasks trả về 100 task.

| API               | Số lần |  TB (ms) | Nhanh nhất |  p95 (ms) | Chậm nhất |
|-------------------|--------|----------|------------|-----------|-----------|
| GET /tasks        |     20 |     3.5 |     2.9 |     4.2 |     4.3 |
| GET /tasks/:uuid  |     20 |     3.0 |     1.6 |     3.7 |     4.3 |

Đạt: mọi lần gọi GET đều dưới 200 ms (chậm nhất 4.3 ms).
```

Chạy thêm 3 lần nữa trên local: chậm nhất 7,6 ms, 6,0 ms và 7,3 ms. Chạy trong Docker: trung bình 5,6 ms, chậm nhất 10,9 ms.

## 6. Giới hạn

- **Sửa task con phải gửi cả danh sách.** Hai người cùng sửa task con của một task thì người lưu sau ghi đè người lưu trước.
- **Khó lọc theo task con bằng SQL,** ví dụ "mọi task con đang Blocked", vì task con nằm trong JSON. Nếu cần, tách task con thành bảng riêng (mỗi task con một dòng).
- **`GET /tasks` trả toàn bộ, không phân trang** (nên chưa có `c`). Với vài trăm task vẫn nhanh; dữ liệu lớn hơn thì nên thêm phân trang.
- **Request gửi JSON hỏng** vẫn nhận đúng `{ r: 20001, m }`, nhưng không có dòng trong log service: Express đọc body và báo lỗi trước khi middleware ghi log chạy.
