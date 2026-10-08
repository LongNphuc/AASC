# File 3: Tư duy lập trình

Mỗi bài là một dự án riêng, cài đặt và chạy độc lập.

| Bài | Thư mục | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | `task-api/` | API quản lý Task (NestJS) và phần giải thích lý thuyết NestJS | Chưa làm |
| 2 | [`fibonacci/`](fibonacci/README.md) | F(50) bằng quy hoạch động và `BigInt`; đo thời gian 10 lần | Xong |
| 3 | [`game-server/`](game-server/README.md) | Server NestJS: tài khoản (bcrypt, JWT), Line 98, cờ caro hai người qua WebSocket | Xong |

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
