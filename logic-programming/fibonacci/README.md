# Bài 2: Tính số Fibonacci thứ 50

JavaScript thuần (Node.js), không cần cài thư viện.

```bash
cd logic-programming/fibonacci
npm test          # kiểm tra tính đúng đắn (node:test)
npm run bench     # đo thời gian F(50) qua 10 lần chạy
```

| Tệp | Nội dung |
|---|---|
| `src/fibonacci.js` | Hàm `fibonacci(n)`: quy hoạch động dạng bảng, trả về `BigInt` |
| `src/fibonacci.test.js` | Kiểm tra n = 10, 20, 50 và các trường hợp biên |
| `src/benchmark.js` | Đo bằng `console.time` / `console.timeEnd`, tính trung bình 10 lần |

## 1. Thuật toán

Định nghĩa: `F(0) = 0`, `F(1) = 1`, `F(i) = F(i - 1) + F(i - 2)`.

Đệ quy thuần tính lại cùng một giá trị rất nhiều lần (để tính `F(50)` phải gọi hàm khoảng 40 tỷ lần). Quy hoạch động khắc phục bằng cách **lưu kết quả đã tính vào mảng** và tính từ dưới lên:

```js
const table = new Array(n + 1);
table[0] = 0n;
table[1] = 1n;
for (let i = 2; i <= n; i++) {
  table[i] = table[i - 1] + table[i - 2];   // mỗi F(i) chỉ tính đúng một lần
}
return table[n];
```

**Vì sao dùng `BigInt`:** `Number` chỉ biểu diễn chính xác số nguyên tới `2^53 - 1` (`Number.MAX_SAFE_INTEGER` ≈ 9×10^15). `F(50) = 12586269025` vẫn nằm trong giới hạn, nhưng từ `F(79)` trở đi thì vượt, kết quả bị sai số. Hậu tố `n` (`0n`, `1n`) tạo số `BigInt`, cộng với nhau không bao giờ mất chính xác.

Hàm kiểm tra đầu vào: `n` phải là số nguyên không âm, sai thì ném `RangeError`.

## 2. Độ phức tạp

| | Độ phức tạp | Giải thích |
|---|---|---|
| Thời gian | **O(n)** | Một vòng lặp từ 2 tới n, mỗi bước một phép cộng |
| Không gian | **O(n)** | Mảng `n + 1` phần tử |

Chính xác hơn, phép cộng `BigInt` tốn thời gian theo số chữ số. `F(n)` có khoảng `0,21·n` chữ số thập phân, nên khi n rất lớn tổng thời gian tiến gần O(n²). Với n = 50 (11 chữ số) ảnh hưởng này không đáng kể.

**Tối ưu không gian xuống O(1):** mỗi bước chỉ cần hai giá trị liền trước, nên có thể thay mảng bằng hai biến:

```js
let prev = 0n, curr = 1n;
for (let i = 2; i <= n; i++) [prev, curr] = [curr, prev + curr];
return curr;
```

Bài này dùng mảng vì đề yêu cầu "quy hoạch động với memoization hoặc mảng", và mảng thể hiện rõ ý "lưu kết quả bài toán con".

**So với memoization (đệ quy có nhớ):** cũng O(n) thời gian và O(n) không gian, nhưng dùng đệ quy nên tốn thêm ngăn xếp lời gọi, và với n lớn (khoảng 10.000) có thể tràn ngăn xếp. Cách lặp bằng mảng không gặp vấn đề này.

## 3. Kết quả kiểm tra

| n | Kết quả | Mong đợi |
|---|---|---|
| 10 | 55 | 55 ✓ |
| 20 | 6765 | 6765 ✓ |
| 50 | 12586269025 | 12586269025 ✓ |

`npm test`:

```
✔ F(10), F(20), F(50) đúng theo đề
✔ trường hợp gốc: F(0) = 0, F(1) = 1, F(2) = 1
✔ trả về BigInt, đúng cả khi vượt giới hạn của Number
✔ mỗi số bằng tổng hai số liền trước (n = 2..100)
✔ n không hợp lệ thì báo RangeError
ℹ pass 5
ℹ fail 0
```

## 4. Thời gian thực thi

Máy đo: Intel Core i7-13620H (xung cơ bản 2,4 GHz, tăng tốc tới 4,9 GHz), Node.js 24, WSL2.

`npm run bench`:

```
Đo F(50) qua 10 lần chạy (console.time):
  lần  1: 0.066ms
  lần  2: 0.018ms
  lần  3: 0.006ms
  lần  4: 0.007ms
  lần  5: 0.008ms
  lần  6: 0.008ms
  lần  7: 0.007ms
  lần  8: 0.005ms
  lần  9: 0.008ms
  lần 10: 0.005ms

Theo performance.now():
  từng lần (ms): 0.0484, 0.0122, 0.0035, 0.0036, 0.0038, 0.0038, 0.0028, 0.0023, 0.0023, 0.0023
  trung bình 10 lần: 0.0085 ms
  chậm nhất: 0.0484 ms
  → Đạt: trung bình dưới 1 ms
```

**Trung bình 10 lần: khoảng 0,009 ms**, thấp hơn yêu cầu 1 ms hơn 100 lần. Chạy lại nhiều lần cho kết quả 0,0085 đến 0,0093 ms.

Cách đo:

- Mỗi lần chạy đo bằng `console.time` / `console.timeEnd` theo yêu cầu đề. Vì `console.timeEnd` chỉ in ra màn hình mà không trả về giá trị, trung bình được tính bằng `performance.now()` đo cùng lúc. Số của `console.time` lớn hơn một chút vì tính cả thời gian của chính bộ đếm.
- Lần 1 chậm nhất vì hàm chạy lần đầu, V8 chưa tối ưu (JIT). Lần này vẫn được tính vào trung bình.
- Hàm không giữ cache giữa các lần gọi, nên lần nào cũng tính lại từ đầu.
- Lúc đo, CPU có thể đã tăng tốc tới 4,9 GHz. Một CPU 2,5 GHz không tăng tốc chậm hơn khoảng 2 lần, tức khoảng 0,02 ms, vẫn dưới 1 ms rất xa.
