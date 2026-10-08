'use strict';

/**
 * Kiểm tra tính đúng đắn. Chạy: npm test (dùng node:test có sẵn, không cần cài gì).
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fibonacci } = require('./fibonacci');

test('F(10), F(20), F(50) đúng theo đề', () => {
  assert.equal(fibonacci(10), 55n);
  assert.equal(fibonacci(20), 6765n);
  assert.equal(fibonacci(50), 12586269025n);
});

test('trường hợp gốc: F(0) = 0, F(1) = 1, F(2) = 1', () => {
  assert.equal(fibonacci(0), 0n);
  assert.equal(fibonacci(1), 1n);
  assert.equal(fibonacci(2), 1n);
});

test('trả về BigInt, đúng cả khi vượt giới hạn của Number', () => {
  assert.equal(typeof fibonacci(50), 'bigint');
  // F(100) lớn hơn Number.MAX_SAFE_INTEGER rất nhiều; Number sẽ cho sai số.
  assert.equal(fibonacci(100), 354224848179261915075n);
});

test('mỗi số bằng tổng hai số liền trước (n = 2..100)', () => {
  for (let n = 2; n <= 100; n++) {
    assert.equal(fibonacci(n), fibonacci(n - 1) + fibonacci(n - 2));
  }
});

test('n không hợp lệ thì báo RangeError', () => {
  for (const bad of [-1, 1.5, Number.NaN, '50', undefined]) {
    assert.throws(() => fibonacci(bad), RangeError);
  }
});
