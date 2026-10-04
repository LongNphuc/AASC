import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Giữ request_id của request đang xử lý, để mọi dòng log sinh ra trong request
 * đó (ở bất kỳ service nào) đều mang cùng một mã. Nhờ vậy lần được một request
 * xuyên qua app.log và các tệp services/*.log.
 *
 * AsyncLocalStorage giữ giá trị xuyên suốt chuỗi async (await, callback) mà
 * không phải truyền tham số qua từng hàm.
 */
const storage = new AsyncLocalStorage<{ requestId: string }>();

export const requestContext = {
  run<T>(requestId: string, fn: () => T): T {
    return storage.run({ requestId }, fn);
  },

  /** request_id hiện tại; undefined nếu đang chạy ngoài request (ví dụ cron). */
  requestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
};
