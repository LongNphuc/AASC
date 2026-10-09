/**
 * Đo tốc độ API GET với 100 bản ghi (yêu cầu: dưới 200 ms).
 *
 * Cách chạy (server phải đang chạy):
 *   npm run perf-test
 *   BASE_URL=http://localhost:3002 npm run perf-test
 *
 * Các bước: tạo 100 task (mỗi task 3 task con), gọi GET /tasks và
 * GET /tasks/:uuid mỗi loại 20 lần, in bảng thời gian, rồi xóa 100 task vừa
 * tạo. Thoát mã 0 nếu mọi lần gọi GET dưới 200 ms, mã 1 nếu không.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3002';
const TASK_COUNT = 100;
const ROUNDS = 20;
const LIMIT_MS = 200;

/** Body phản hồi { r, d | l } (xem src/common/response/api-response.ts). */
interface ResponseBody {
  r: number;
  d?: { uuid: string };
  l?: unknown[];
}

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as ResponseBody;
}

/** Gọi `fn` ROUNDS lần, trả về thời gian từng lần (ms). */
async function measure(fn: () => Promise<unknown>): Promise<number[]> {
  const timings: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    const startedAt = performance.now();
    await fn();
    timings.push(performance.now() - startedAt);
  }
  return timings;
}

function row(name: string, timings: number[]): string {
  const sorted = [...timings].sort((a, b) => a - b);
  const avg = sorted.reduce((sum, t) => sum + t, 0) / sorted.length;
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  const cells = [avg, sorted[0], p95, sorted[sorted.length - 1]].map((t) =>
    t.toFixed(1).padStart(7),
  );
  return `| ${name.padEnd(17)} | ${String(sorted.length).padStart(6)} | ${cells.join(' | ')} |`;
}

async function main(): Promise<void> {
  console.log(
    `Đo ${BASE_URL}: tạo ${TASK_COUNT} task rồi gọi GET mỗi loại ${ROUNDS} lần\n`,
  );

  const uuids: string[] = [];
  for (let i = 1; i <= TASK_COUNT; i++) {
    const created = await call('POST', '/tasks', {
      title: `Perf task ${i}`,
      description: 'Task tạo bởi scripts/perf-test.ts',
      subtasks: [
        { taskName: 'create', timeEstimate: 1.5 },
        { taskName: 'update', timeEstimate: 2, timeSpent: 0.5 },
        { taskName: 'delete', timeEstimate: 0.75, statusKbn: 12001 },
      ],
    });
    uuids.push(created.d!.uuid);
  }

  try {
    const total = (await call('GET', '/tasks')).l!.length;
    const list = await measure(() => call('GET', '/tasks'));
    const one = await measure(() => call('GET', `/tasks/${uuids[0]}`));

    console.log(`GET /tasks trả về ${total} task.\n`);
    console.log(
      '| API               | Số lần |  TB (ms) | Nhanh nhất |  p95 (ms) | Chậm nhất |',
    );
    console.log(
      '|-------------------|--------|----------|------------|-----------|-----------|',
    );
    console.log(row('GET /tasks', list));
    console.log(row('GET /tasks/:uuid', one));

    const slowest = Math.max(...list, ...one);
    const passed = slowest < LIMIT_MS;
    console.log(
      passed
        ? `\nĐạt: mọi lần gọi GET đều dưới ${LIMIT_MS} ms (chậm nhất ${slowest.toFixed(1)} ms).`
        : `\nKhông đạt: có lần gọi GET mất ${slowest.toFixed(1)} ms (yêu cầu dưới ${LIMIT_MS} ms).`,
    );
    process.exitCode = passed ? 0 : 1;
  } finally {
    // Dọn dữ liệu thử (xóa mềm), để chạy lại vẫn đo đúng khoảng 100 bản ghi.
    for (const uuid of uuids) {
      await call('DELETE', `/tasks/${uuid}`);
    }
    console.log(`Đã xóa ${uuids.length} task thử.`);
  }
}

main().catch((error: unknown) => {
  console.error(
    `Lỗi: ${(error as Error).message}. Server đã chạy ở ${BASE_URL} chưa?`,
  );
  process.exit(1);
});
