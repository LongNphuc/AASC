# AASC: bài kiểm tra lập trình

Bài làm cho ba đề kiểm tra của Hãng Kiểm toán AASC.

| Thư mục | Đề | Nội dung | Hướng dẫn |
|---|---|---|---|
| [`integration/`](integration/) | File 1 + File 2 | Ứng dụng NestJS: Jotform → Bitrix24 qua webhook (File 1); OAuth 2.0 với Bitrix24 và API quản lý contact kèm địa chỉ, ngân hàng (File 2) | [integration/README.md](integration/README.md) |
| `programming/` | File 3 | API Task, Fibonacci, server game (Line 98, Cờ caro) | Đang thực hiện |

File 1 và File 2 nằm chung một ứng dụng vì tài khoản ngrok miễn phí chỉ có một tên miền cố định: một ứng dụng trên cổng 3000 phục vụ được cả `/install` (Bitrix24) lẫn `/webhook/jotform` (Jotform) qua cùng một đường hầm. Hai phần vẫn tách module riêng.

## Chạy nhanh phần tích hợp

```bash
cd integration
cp .env.example .env      # điền CLIENT_ID, CLIENT_SECRET, API_KEY, BITRIX24_WEBHOOK_URL, JOTFORM_API_KEY...

# Cách 1: Node.js 20+ (khuyên dùng: log và DB nằm ngay trong logs/, data/)
npm ci
npm run start:dev

# Cách 2: Docker (không cần cài Node.js; xem log, DB qua lệnh, xem integration/readme_run.md)
docker compose up -d --build
```

Sau đó mở đường hầm ngrok tới cổng 3000, cài ứng dụng trên Bitrix24 và gắn webhook vào form Jotform theo [integration/readme_run.md](integration/readme_run.md).

- Swagger: `http://localhost:3000/docs`
- Kiểm thử: `npm test`, `npm run test:e2e`

Tài liệu phần tích hợp:

| Tệp | Nội dung |
|---|---|
| [integration/README.md](integration/README.md) | Trang đầu, đối chiếu từng yêu cầu của đề |
| [integration/readme_run.md](integration/readme_run.md) | Cài đặt và chạy |
| [integration/readme_api.md](integration/readme_api.md) | Endpoint, lỗi đã xử lý, kết quả test |
| [integration/readme_design.md](integration/readme_design.md) | Thiết kế |
| [integration/readme_structure.md](integration/readme_structure.md) | Ý nghĩa từng thư mục, tệp, method |

## Công nghệ

NestJS 11, TypeScript, TypeORM + SQLite, Jest, ESLint, Prettier, Docker.
