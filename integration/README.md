# Tích hợp Jotform và Bitrix24 (File 1 + File 2)

Ứng dụng NestJS gồm ba phần, chạy chung một ứng dụng trên cổng 3000:

| Phần | Đề bài | Xác thực với Bitrix24 |
|---|---|---|
| **OAuth 2.0** (`src/bitrix`) | File 2 bài 1: nhận sự kiện cài đặt, lưu và tự làm mới token, hàm `callBitrixAPI` | OAuth 2.0 (ứng dụng cục bộ) |
| **API quản lý contact** (`src/contacts`) | File 2 bài 2: `GET/POST/PUT/DELETE /contacts` kèm địa chỉ, ngân hàng | OAuth 2.0, qua `callBitrixAPI` |
| **Jotform → Bitrix24** (`src/jotform`) | File 1: mỗi submission Jotform tạo một contact | Webhook vào |

## Tài liệu

| Tệp | Nội dung |
|---|---|
| [readme_run.md](readme_run.md) | Các bước cài đặt và chạy: lấy thông tin cấu hình, tạo `.env`, chạy Docker hoặc Node.js, ngrok, kết nối Bitrix24 và Jotform, xử lý sự cố |
| [readme_api.md](readme_api.md) | Danh sách endpoint và cách gọi, các lỗi đã xử lý và cách kiểm tra, kết quả unit test và cURL |
| [readme_design.md](readme_design.md) | Thiết kế: luồng `/install`, vòng đời token, chống trùng submission, DB và mã kbn, log, bảo mật, giới hạn |
| [readme_structure.md](readme_structure.md) | Ý nghĩa từng thư mục, tệp và method trong project |

## Chạy nhanh

```bash
cd integration
cp .env.example .env              # điền giá trị, xem readme_run.md bước 1-2
npm ci && npm run start:dev       # khuyên dùng: log, DB nằm ngay trong logs/, data/
                                  # hoặc Docker: docker compose up -d --build
ngrok http 3000 --url <PUBLIC_URL>
```

Swagger: `http://localhost:3000/docs`. Kiểm thử: `npm test`, `npm run test:e2e` (77 unit test và 4 e2e test).

## Đối chiếu yêu cầu đề

**File 1: Jotform → Bitrix24**

| Yêu cầu | Ở đâu |
|---|---|
| Lấy dữ liệu bằng Jotform API khi có submission | `jotform/clients/jotform-api.client.ts`; luồng: [readme_design.md mục 4](readme_design.md#4-file-1-jotform-sang-bitrix24) |
| Webhook Bitrix24 nhận dữ liệu, tạo Contact (NAME, PHONE, EMAIL) | `bitrix/clients/bitrix-webhook.client.ts`, `jotform/services/jotform.service.ts` |
| Xử lý lỗi: kết nối, xác thực, định dạng dữ liệu | [readme_api.md mục 6](readme_api.md#6-các-lỗi-đã-xử-lý-và-cách-kiểm-tra) |
| Ghi log: thời điểm nhận, trạng thái gửi Bitrix24, lỗi | [readme_design.md mục 6](readme_design.md#6-ghi-log) |
| Hướng dẫn: tài khoản và API key Jotform, webhook Bitrix24, cách chạy | [readme_run.md](readme_run.md) bước 1.3, 1.4, 3, 6 |

**File 2: OAuth 2.0 và API quản lý contact**

| Yêu cầu | Ở đâu |
|---|---|
| Endpoint `/install` nhận sự kiện cài đặt | `bitrix/controllers/install.controller.ts`; [readme_design.md mục 2.1](readme_design.md#21-install-ba-dạng-dữ-liệu) |
| Lưu `access_token`, `refresh_token` (SQLite) | Bảng `bitrix_installations`; [readme_design.md mục 2.2](readme_design.md#22-lưu-trữ-token) |
| Tự làm mới token, xử lý token hết hạn/không hợp lệ | `bitrix/services/bitrix-token.service.ts`; [readme_design.md mục 2.3](readme_design.md#23-vòng-đời-token) |
| Hàm chung `callBitrixAPI(method, payload)`, thử bằng `crm.contact.list` | `bitrix/services/bitrix.service.ts`; `GET /bitrix/test-call` |
| Xử lý lỗi timeout, token hết hạn, lỗi mạng, 4xx, 5xx; ghi log | [readme_api.md mục 6](readme_api.md#6-các-lỗi-đã-xử-lý-và-cách-kiểm-tra) |
| Chạy qua ngrok, cài lại ứng dụng để kiểm tra | [readme_run.md](readme_run.md) bước 4, 5 |
| `GET/POST/PUT/DELETE /contacts`, ngân hàng qua `crm.requisite.*` | `contacts/`; [readme_api.md mục 4](readme_api.md#4-contact-file-2-bài-2) |
| Validate dữ liệu, thông báo lỗi rõ ràng | `contacts/dto/`; [readme_api.md mục 4.1](readme_api.md#41-dữ-liệu-gửi-lên) |
| Xác thực endpoint (API key) | `common/auth/api-key.guard.ts`, header `x-api-key` |
| Cấu trúc NestJS, ESLint, Prettier, comment | [readme_structure.md](readme_structure.md) |
| Ít nhất 2 unit test cho service gọi Bitrix24 | [readme_api.md mục 7](readme_api.md#7-kiểm-thử) |
| Test API bằng cURL, ghi kết quả | [readme_api.md mục 7.3](readme_api.md#73-kết-quả-kiểm-thử-api-bằng-curl) |

## Công nghệ

NestJS 11, TypeScript, TypeORM + SQLite, `@nestjs/axios`, `@nestjs/schedule`, `@nestjs/swagger`, `class-validator`, Jest, ESLint, Prettier, Docker.
