# File 3: Tư duy lập trình

Mỗi bài là một dự án riêng, cài đặt và chạy độc lập.

| Bài | Thư mục | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | [`api-nestjs/`](api-nestjs/README.md) | Lý thuyết NestJS và API RESTful quản lý Task (TypeORM, SQLite, Swagger) | Xong |
| 2 | [`fibonacci/`](fibonacci/README.md) | F(50) bằng quy hoạch động và `BigInt`; đo thời gian 10 lần | Xong |
| 3 | [`game-server/`](game-server/README.md) | Server NestJS: tài khoản (bcrypt, JWT), Line 98, cờ caro hai người qua WebSocket | Xong |

## Bài 1: API quản lý Task

```bash
cd logic-programming/api-nestjs
npm ci
npm run start:dev     # Swagger: http://localhost:3002/docs
```

- **Lý thuyết:** [knowledge-about-nestjs](api-nestjs/knowledge-about-nestjs/README.md): Module, Controller, Service, TypeScript.
- **API:** CRUD `/tasks`, mỗi task có danh sách task con; xóa mềm.
- **Test:** 38 unit test, 4 e2e test.
- **Tốc độ:** `GET /tasks` với 100 bản ghi trung bình khoảng 4 ms (yêu cầu dưới 200 ms).

Chi tiết:
- [api-nestjs/README.md](api-nestjs/README.md): thiết kế, API, kết quả test.
- [readme_run.md](api-nestjs/readme_run.md): cách chạy, Swagger.
- [readme_structure.md](api-nestjs/readme_structure.md): cấu trúc mã nguồn.

## Bài 2: Fibonacci

```bash
cd logic-programming/fibonacci
npm test          # 5 test
npm run bench     # 10 lần tính F(50)
```

- `F(50) = 12586269025`.
- Thời gian trung bình khoảng 0,01 ms mỗi lần (các lần đo: 0,0085-0,0117 ms), dưới mức 1 ms đề yêu cầu.
- Độ phức tạp O(n) thời gian, O(n) bộ nhớ.

Chi tiết: [fibonacci/README.md](fibonacci/README.md).

## Bài 3: Server game

```bash
cd logic-programming/game-server
npm ci
npm run start:dev     # mở http://localhost:3001
```

- **Line 98:** bàn 9x9, có gợi ý nước đi, lưu ván vào DB.
- **Cờ caro:** bàn 15x15, ghép cặp ngẫu nhiên, lưu lịch sử trận.
- **Test:** 52 unit test, 6 e2e test.
- **Tải:** 10 người chơi đồng thời, mọi sự kiện phản hồi dưới 200 ms.

Chi tiết:
- [game-server/README.md](game-server/README.md): luật chơi, giao thức, kết quả test.
- [readme_run.md](game-server/readme_run.md): cách chạy.
- [readme_structure.md](game-server/readme_structure.md): cấu trúc mã nguồn.
