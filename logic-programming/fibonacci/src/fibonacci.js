'use strict';

/**
 * Tính số Fibonacci thứ n bằng quy hoạch động dạng bảng (bottom-up, dùng mảng).
 *
 *   F(0) = 0, F(1) = 1, F(i) = F(i - 1) + F(i - 2)
 *
 * Mỗi F(i) chỉ tính một lần từ hai giá trị đã có trong mảng, nên không tính
 * lặp lại như cách đệ quy thông thường (đệ quy thuần là O(2^n)).
 *
 * Dùng BigInt vì từ F(79) trở đi kết quả vượt Number.MAX_SAFE_INTEGER (2^53 - 1),
 * số kiểu Number sẽ mất chính xác.
 *
 * Độ phức tạp: thời gian O(n), không gian O(n) (mảng n + 1 phần tử).
 *
 * @param {number} n chỉ số, số nguyên không âm
 * @returns {bigint} F(n)
 */
function fibonacci(n) {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`n phải là số nguyên không âm, nhận được: ${n}`);
  }
  if (n < 2) {
    return BigInt(n);
  }

  const table = new Array(n + 1);
  table[0] = 0n;
  table[1] = 1n;
  for (let i = 2; i <= n; i++) {
    table[i] = table[i - 1] + table[i - 2];
  }
  return table[n];
}

module.exports = { fibonacci };
