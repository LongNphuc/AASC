'use strict';

/**
 * Đo thời gian tính F(50) qua 10 lần chạy. Chạy: npm run bench
 *
 * - Mỗi lần chạy đo bằng console.time / console.timeEnd (theo yêu cầu đề), đồng
 *   thời đo bằng performance.now() để tính trung bình, vì console.timeEnd chỉ
 *   in ra màn hình chứ không trả về giá trị.
 * - Hàm fibonacci không giữ cache giữa các lần gọi, nên lần nào cũng tính lại từ
 *   đầu; thời gian đo được là thời gian tính thật, không phải đọc cache.
 * - Đo trước khi gọi hàm ở bất kỳ đâu khác, nên lần 1 là lần chạy "nguội": V8
 *   chưa tối ưu (JIT) hàm nên chậm hơn. Vẫn tính vào trung bình để không làm
 *   đẹp số liệu.
 * - Số console.timeEnd in ra lớn hơn số performance.now() một chút vì có cả
 *   thời gian của chính bộ đếm console.time.
 */
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { fibonacci } = require('./fibonacci');

const N = 50;
const RUNS = 10;

console.log(`Máy: ${os.cpus()[0].model}, Node ${process.version}\n`);

console.log(`Đo F(${N}) qua ${RUNS} lần chạy (console.time):`);
const durations = [];
for (let run = 1; run <= RUNS; run++) {
  const label = `  lần ${String(run).padStart(2)}`;
  console.time(label);
  const start = performance.now();
  fibonacci(N);
  durations.push(performance.now() - start);
  console.timeEnd(label);
}

const average = durations.reduce((sum, ms) => sum + ms, 0) / RUNS;
console.log(`\nTheo performance.now():`);
console.log(`  từng lần (ms): ${durations.map((ms) => ms.toFixed(4)).join(', ')}`);
console.log(`  trung bình ${RUNS} lần: ${average.toFixed(4)} ms`);
console.log(`  chậm nhất: ${Math.max(...durations).toFixed(4)} ms`);
console.log(average < 1 ? '  → Đạt: trung bình dưới 1 ms' : '  → CHƯA ĐẠT: trung bình từ 1 ms trở lên');

console.log('\nKiểm tra kết quả:');
const expected = { 10: 55n, 20: 6765n, 50: 12586269025n };
for (const [n, value] of Object.entries(expected)) {
  const result = fibonacci(Number(n));
  console.log(`  F(${n}) = ${result} ${result === value ? '✓' : `✗ (mong đợi ${value})`}`);
}
