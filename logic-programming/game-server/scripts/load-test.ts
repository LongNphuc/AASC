/**
 * Kiểm tra tải: 10 người chơi cùng lúc, đo độ trễ mỗi sự kiện WebSocket
 * (thời gian từ lúc gửi tới lúc nhận phản hồi). Yêu cầu của đề: dưới 200 ms.
 *
 * - 4 người chơi Line 98: mỗi người lặp "xin gợi ý → đi theo gợi ý".
 * - 6 người chơi cờ caro: ghép thành 3 trận, mỗi người tới lượt thì đánh vào
 *   một ô trống ngẫu nhiên, tới khi có người thắng hoặc mỗi người đủ số nước.
 *
 * Chạy (server phải đang chạy): npm run load-test
 * Đổi địa chỉ: BASE_URL=http://localhost:3001 npm run load-test
 */
import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3001';
const LINE98_PLAYERS = 4;
const CARO_PLAYERS = 6;
const LINE98_TURNS = 30;
const CARO_MAX_MOVES = 40;
const LATENCY_LIMIT_MS = 200;

interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  errorKbn?: number;
  message?: string;
}

/** event → danh sách độ trễ (ms). */
const latencies = new Map<string, number[]>();

async function timedEmit<T>(
  socket: Socket,
  event: string,
  data?: unknown,
): Promise<Ack<T>> {
  const start = performance.now();
  const ack = (await socket.timeout(10_000).emitWithAck(event, data)) as Ack<T>;
  const list = latencies.get(event) ?? [];
  list.push(performance.now() - start);
  latencies.set(event, list);
  return ack;
}

async function login(username: string): Promise<string> {
  const body = JSON.stringify({ username, password: 'loadtest123' });
  const headers = { 'Content-Type': 'application/json' };
  // Tài khoản đã có từ lần chạy trước thì đăng ký trả 409, bỏ qua.
  await fetch(`${BASE_URL}/auth/register`, { method: 'POST', headers, body });
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok)
    throw new Error(`Đăng nhập ${username} thất bại: HTTP ${res.status}`);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

function connect(namespace: string, token: string): Promise<Socket> {
  const socket = io(`${BASE_URL}${namespace}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function playLine98(index: number): Promise<void> {
  const socket = await connect('/line98', await login(`load_line98_${index}`));
  await timedEmit(socket, 'line98:new');
  for (let turn = 0; turn < LINE98_TURNS; turn++) {
    const hint = await timedEmit<{ from: unknown; to: unknown } | null>(
      socket,
      'line98:hint',
    );
    if (!hint.ok || !hint.data) {
      await timedEmit(socket, 'line98:new'); // hết nước đi thì chơi ván mới
      continue;
    }
    await timedEmit(socket, 'line98:move', hint.data);
  }
  socket.disconnect();
}

async function playCaro(index: number): Promise<void> {
  const socket = await connect('/caro', await login(`load_caro_${index}`));
  const board = new Set<string>(); // các ô đã đánh
  let me: string | null = null;
  let matchUuid: string | null = null;
  let moves = 0;
  // Lệnh đang chờ phản hồi. Với nước thắng, server gửi caro:over trước phản
  // hồi của chính nước đó, nên phải chờ phản hồi xong rồi mới ngắt kết nối.
  let pending: Promise<unknown> = Promise.resolve();

  const done = new Promise<void>((resolve) => {
    const myTurn = () => {
      if (moves >= CARO_MAX_MOVES) {
        pending = timedEmit(socket, 'caro:leave');
        return;
      }
      let row: number, col: number;
      do {
        row = Math.floor(Math.random() * 15);
        col = Math.floor(Math.random() * 15);
      } while (board.has(`${row},${col}`));
      moves++;
      pending = timedEmit(socket, 'caro:move', { matchUuid, row, col });
    };
    socket.on(
      'caro:matched',
      (info: { matchUuid: string; you: string; turn: string }) => {
        me = info.you;
        matchUuid = info.matchUuid;
        if (info.turn === me) myTurn();
      },
    );
    socket.on(
      'caro:moved',
      (move: { row: number; col: number; nextTurn: string }) => {
        board.add(`${move.row},${move.col}`);
        if (move.nextTurn === me) myTurn();
      },
    );
    socket.on('caro:over', () => resolve());
  });

  await timedEmit(socket, 'caro:find');
  await done;
  await pending;
  socket.disconnect();
}

function percentile(sorted: number[], p: number): number {
  return sorted[
    Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  ];
}

function report(): boolean {
  const rows: string[][] = [];
  const all: number[] = [];
  for (const [event, values] of [...latencies.entries()].sort()) {
    const sorted = [...values].sort((a, b) => a - b);
    all.push(...values);
    rows.push([
      event,
      String(values.length),
      (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1),
      percentile(sorted, 50).toFixed(1),
      percentile(sorted, 95).toFixed(1),
      sorted[sorted.length - 1].toFixed(1),
    ]);
  }
  const sortedAll = [...all].sort((a, b) => a - b);
  rows.push([
    'TỔNG',
    String(all.length),
    (all.reduce((s, v) => s + v, 0) / all.length).toFixed(1),
    percentile(sortedAll, 50).toFixed(1),
    percentile(sortedAll, 95).toFixed(1),
    sortedAll[sortedAll.length - 1].toFixed(1),
  ]);

  const header = ['Sự kiện', 'Số lần', 'TB (ms)', 'p50', 'p95', 'Max'];
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const line = (cells: string[]) =>
    `| ${cells.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  console.log(line(header));
  console.log(`|${widths.map((w) => '-'.repeat(w + 2)).join('|')}|`);
  rows.forEach((r) => console.log(line(r)));

  const max = sortedAll[sortedAll.length - 1];
  return max < LATENCY_LIMIT_MS;
}

async function main(): Promise<void> {
  console.log(
    `Kiểm tra tải ${BASE_URL}: ${LINE98_PLAYERS} người chơi Line 98 + ${CARO_PLAYERS} người chơi cờ caro cùng lúc\n`,
  );
  const started = performance.now();
  await Promise.all([
    ...Array.from({ length: LINE98_PLAYERS }, (_, i) => playLine98(i + 1)),
    ...Array.from({ length: CARO_PLAYERS }, (_, i) => playCaro(i + 1)),
  ]);
  const passed = report();
  console.log(
    `\nThời gian chạy: ${((performance.now() - started) / 1000).toFixed(1)} s. ` +
      (passed
        ? `Đạt: mọi sự kiện phản hồi dưới ${LATENCY_LIMIT_MS} ms.`
        : `CHƯA ĐẠT: có sự kiện phản hồi từ ${LATENCY_LIMIT_MS} ms trở lên.`),
  );
  process.exit(passed ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
