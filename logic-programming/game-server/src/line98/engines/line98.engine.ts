/**
 * Luật Line 98, viết thành hàm thuần (không đụng DB, mạng): nhận trạng thái,
 * trả trạng thái mới. Nhờ vậy test được trực tiếp, và hàm ngẫu nhiên được
 * truyền vào để test cho ra kết quả cố định.
 *
 * Luật:
 * - Bàn 9x9, bóng có 5 màu (1..5), 0 là ô trống. Bắt đầu với 5 bóng.
 * - Bóng chỉ đi được tới ô trống nếu có đường đi qua các ô trống, theo 4 hướng
 *   (lên, xuống, trái, phải).
 * - Từ 5 bóng cùng màu thẳng hàng trở lên (ngang, dọc, chéo) thì bị xóa; mỗi
 *   bóng xóa được 1 điểm.
 * - Nước đi xóa được hàng thì KHÔNG sinh bóng mới. Không xóa được thì sinh 3
 *   bóng (màu đã báo trước ở nextColors) vào ô trống ngẫu nhiên; bóng mới sinh
 *   tạo thành hàng thì cũng bị xóa.
 * - Hết ô trống thì thua (không còn nước đi).
 */

export const BOARD_SIZE = 9;
export const COLOR_COUNT = 5;
export const SPAWN_COUNT = 3;
export const INITIAL_BALLS = 5;
export const MIN_LINE = 5;
export const EMPTY = 0;

/** board[row][col]: 0 là trống, 1..5 là màu bóng. */
export type Board = number[][];

export interface Position {
  row: number;
  col: number;
}

export interface SpawnedBall extends Position {
  color: number;
}

export interface Line98State {
  board: Board;
  /** Màu 3 bóng sẽ sinh ở lượt tới (hiển thị trước cho người chơi). */
  nextColors: number[];
  score: number;
  gameOver: boolean;
}

export interface MoveResult {
  state: Line98State;
  /** Đường bóng đi, gồm cả ô xuất phát và ô đích (để client vẽ hiệu ứng). */
  path: Position[];
  /** Các ô bị xóa trong lượt này (do nước đi hoặc do bóng mới sinh). */
  removed: Position[];
  spawned: SpawnedBall[];
}

export interface SuggestedMove {
  from: Position;
  to: Position;
}

/** Trả số thực trong [0, 1), mặc định Math.random. */
export type RandomFn = () => number;

export type InvalidMoveReason =
  'BAD_POSITION' | 'NO_BALL' | 'TARGET_OCCUPIED' | 'NO_PATH';

export class InvalidMoveError extends Error {
  constructor(readonly reason: InvalidMoveReason) {
    super(reason);
    this.name = 'InvalidMoveError';
  }
}

const NEIGHBORS_4: ReadonlyArray<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const NEIGHBORS_8: ReadonlyArray<[number, number]> = [
  ...NEIGHBORS_4,
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Ván mới: 5 bóng ngẫu nhiên và báo trước màu 3 bóng tiếp theo. */
export function createGame(random: RandomFn = Math.random): Line98State {
  const board = createEmptyBoard();
  const spawned = spawnBalls(
    board,
    randomColors(random, INITIAL_BALLS),
    random,
  );
  const removed = spawned.length > 0 ? findLines(board) : [];
  clearCells(board, removed);
  return {
    board,
    nextColors: randomColors(random, SPAWN_COUNT),
    score: removed.length,
    gameOver: false,
  };
}

/**
 * Di chuyển bóng từ `from` tới `to`. Ném InvalidMoveError nếu nước đi không
 * hợp lệ. Không sửa `state` truyền vào.
 */
export function moveBall(
  state: Line98State,
  from: Position,
  to: Position,
  random: RandomFn = Math.random,
): MoveResult {
  if (!isInside(from) || !isInside(to)) {
    throw new InvalidMoveError('BAD_POSITION');
  }
  if (state.board[from.row][from.col] === EMPTY) {
    throw new InvalidMoveError('NO_BALL');
  }
  if (state.board[to.row][to.col] !== EMPTY) {
    throw new InvalidMoveError('TARGET_OCCUPIED');
  }
  const path = findPath(state.board, from, to);
  if (!path) {
    throw new InvalidMoveError('NO_PATH');
  }

  const board = cloneBoard(state.board);
  board[to.row][to.col] = board[from.row][from.col];
  board[from.row][from.col] = EMPTY;

  let removed = findLines(board);
  let spawned: SpawnedBall[] = [];
  let nextColors = state.nextColors;
  if (removed.length > 0) {
    clearCells(board, removed);
  } else {
    spawned = spawnBalls(board, state.nextColors, random);
    removed = findLines(board);
    clearCells(board, removed);
    nextColors = randomColors(random, SPAWN_COUNT);
  }

  return {
    state: {
      board,
      nextColors,
      score: state.score + removed.length,
      gameOver: !hasAnyMove(board),
    },
    path,
    removed,
    spawned,
  };
}

/**
 * Tìm đường ngắn nhất từ `from` tới `to` qua các ô trống (BFS, 4 hướng).
 * Trả về danh sách ô từ `from` tới `to`, hoặc null nếu không có đường.
 */
export function findPath(
  board: Board,
  from: Position,
  to: Position,
): Position[] | null {
  const previous = new Map<string, Position | null>([[key(from), null]]);
  const queue: Position[] = [from];
  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    if (current.row === to.row && current.col === to.col) {
      return rebuildPath(previous, current);
    }
    for (const next of emptyNeighbors(board, current)) {
      if (!previous.has(key(next))) {
        previous.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return null;
}

/** Mọi ô trống bóng ở `from` đi tới được (BFS). */
export function reachableCells(board: Board, from: Position): Position[] {
  const seen = new Set<string>([key(from)]);
  const queue: Position[] = [from];
  for (let head = 0; head < queue.length; head++) {
    for (const next of emptyNeighbors(board, queue[head])) {
      if (!seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  }
  return queue.slice(1);
}

/**
 * Mọi ô thuộc hàng từ 5 bóng cùng màu trở lên trên toàn bàn (ngang, dọc, hai
 * đường chéo). Hàng dài hơn 5 (6, 7... bóng) thì lấy đủ cả hàng. Trả mảng rỗng
 * nếu không có hàng nào.
 *
 * Thuật toán quét toàn bàn lấy từ Grid.checking() của dự án Line98-Game
 * (https://github.com/NgoQuocBao1010/Line98-Game, src/line98.py),
 * Copyright (c) 2022 Ngô Hồng Quốc Bảo, MIT License:
 * - hàng ngang, hàng dọc: đi dọc hàng, đếm chuỗi bóng liên tiếp cùng màu, gặp
 *   ô trống hoặc màu khác thì đếm lại; chuỗi đạt từ 5 bóng thì lấy cả chuỗi;
 * - hai đường chéo: xét mọi cửa sổ 5 ô liên tiếp, cửa sổ nào đủ 5 bóng cùng
 *   màu thì lấy cả 5 ô. Hàng chéo 6, 7 bóng gồm nhiều cửa sổ chồng nhau nên
 *   cũng được lấy đủ.
 */
export function findLines(board: Board): Position[] {
  const cells: Position[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) {
    cells.push(...runsAlong(board, (k) => ({ row: i, col: k }))); // hàng ngang i
    cells.push(...runsAlong(board, (k) => ({ row: k, col: i }))); // hàng dọc i
  }
  const lastStart = BOARD_SIZE - MIN_LINE;
  for (let row = 0; row <= lastStart; row++) {
    for (let col = 0; col <= lastStart; col++) {
      // Chéo xuống phải bắt đầu ở (row, col); chéo xuống trái ở (row, col + 4).
      cells.push(...sameColorWindow(board, { row, col }, [1, 1]));
      cells.push(
        ...sameColorWindow(board, { row, col: col + MIN_LINE - 1 }, [1, -1]),
      );
    }
  }
  return uniquePositions(cells);
}

/**
 * Gợi ý một nước đi hợp lệ ngẫu nhiên. Ưu tiên nước đưa một bóng tới ô nằm
 * cạnh (8 hướng) một bóng khác cùng màu; không có thì chọn nước đi bất kỳ.
 * Trả về null nếu không còn nước đi.
 */
export function suggestMove(
  board: Board,
  random: RandomFn = Math.random,
): SuggestedMove | null {
  const besideSameColor: SuggestedMove[] = [];
  const anyMove: SuggestedMove[] = [];

  for (const from of ballPositions(board)) {
    const color = board[from.row][from.col];
    for (const to of reachableCells(board, from)) {
      anyMove.push({ from, to });
      const hasSameColorNeighbor = NEIGHBORS_8.some(([dRow, dCol]) => {
        const neighbor = { row: to.row + dRow, col: to.col + dCol };
        return (
          isInside(neighbor) &&
          !samePosition(neighbor, from) && // ô cũ của chính bóng này sẽ trống
          board[neighbor.row][neighbor.col] === color
        );
      });
      if (hasSameColorNeighbor) {
        besideSameColor.push({ from, to });
      }
    }
  }

  const candidates = besideSameColor.length > 0 ? besideSameColor : anyMove;
  return candidates.length > 0 ? pick(candidates, random) : null;
}

/**
 * Còn nước đi khi còn ô trống và còn bóng: vùng ô trống nào cũng giáp ít nhất
 * một bóng (nếu không nó đã là cả bàn), nên bóng đó đi vào được.
 */
export function hasAnyMove(board: Board): boolean {
  return emptyCells(board).length > 0 && ballPositions(board).length > 0;
}

export function emptyCells(board: Board): Position[] {
  return allPositions().filter((p) => board[p.row][p.col] === EMPTY);
}

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    new Array<number>(BOARD_SIZE).fill(EMPTY),
  );
}

export function isInside(position: Position): boolean {
  return (
    Number.isInteger(position?.row) &&
    Number.isInteger(position?.col) &&
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

// ---------- Hàm nội bộ ----------

/** Đặt bóng các màu `colors` vào ô trống ngẫu nhiên (ít hơn nếu hết chỗ). */
function spawnBalls(
  board: Board,
  colors: number[],
  random: RandomFn,
): SpawnedBall[] {
  const spawned: SpawnedBall[] = [];
  for (const color of colors) {
    const free = emptyCells(board);
    if (free.length === 0) {
      break;
    }
    const cell = pick(free, random);
    board[cell.row][cell.col] = color;
    spawned.push({ ...cell, color });
  }
  return spawned;
}

/**
 * Đi dọc một hàng (`at(k)` là ô thứ k), trả các ô thuộc chuỗi từ 5 bóng liên
 * tiếp cùng màu. Một ô có thể xuất hiện nhiều lần; findLines bỏ trùng sau.
 */
function runsAlong(board: Board, at: (k: number) => Position): Position[] {
  const found: Position[] = [];
  let run: Position[] = [];
  for (let k = 0; k < BOARD_SIZE; k++) {
    const cell = at(k);
    const color = board[cell.row][cell.col];
    if (color === EMPTY) {
      run = [];
    } else if (run.length > 0 && board[run[0].row][run[0].col] === color) {
      run.push(cell);
    } else {
      run = [cell];
    }
    if (run.length >= MIN_LINE) {
      found.push(...run);
    }
  }
  return found;
}

/** 5 ô liên tiếp từ `start` theo hướng `step` nếu cả 5 là bóng cùng màu; không thì rỗng. */
function sameColorWindow(
  board: Board,
  start: Position,
  [dRow, dCol]: [number, number],
): Position[] {
  const color = board[start.row][start.col];
  const cells = Array.from({ length: MIN_LINE }, (_, i) => ({
    row: start.row + i * dRow,
    col: start.col + i * dCol,
  }));
  return color !== EMPTY && cells.every((p) => board[p.row][p.col] === color)
    ? cells
    : [];
}

function clearCells(board: Board, cells: Position[]): void {
  for (const cell of cells) {
    board[cell.row][cell.col] = EMPTY;
  }
}

function randomColors(random: RandomFn, count: number): number[] {
  return Array.from(
    { length: count },
    () => Math.floor(random() * COLOR_COUNT) + 1,
  );
}

function pick<T>(items: T[], random: RandomFn): T {
  return items[Math.floor(random() * items.length)];
}

function emptyNeighbors(board: Board, from: Position): Position[] {
  return NEIGHBORS_4.map(([dRow, dCol]) => ({
    row: from.row + dRow,
    col: from.col + dCol,
  })).filter((p) => isInside(p) && board[p.row][p.col] === EMPTY);
}

function rebuildPath(
  previous: Map<string, Position | null>,
  end: Position,
): Position[] {
  const path: Position[] = [];
  for (let at: Position | null = end; at; at = previous.get(key(at)) ?? null) {
    path.unshift(at);
  }
  return path;
}

function ballPositions(board: Board): Position[] {
  return allPositions().filter((p) => board[p.row][p.col] !== EMPTY);
}

function allPositions(): Position[] {
  const positions: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      positions.push({ row, col });
    }
  }
  return positions;
}

function uniquePositions(positions: Position[]): Position[] {
  const seen = new Map<string, Position>();
  for (const p of positions) {
    seen.set(key(p), { row: p.row, col: p.col });
  }
  return [...seen.values()];
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function key(p: Position): string {
  return `${p.row},${p.col}`;
}
