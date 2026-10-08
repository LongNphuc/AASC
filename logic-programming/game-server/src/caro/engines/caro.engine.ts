/**
 * Luật cờ caro, viết thành hàm thuần (không đụng DB, mạng).
 *
 * - Bàn 15x15, X đi trước, hai bên luân phiên.
 * - Tạo được hàng từ 5 ký hiệu liên tiếp trở lên (ngang, dọc, chéo) là thắng,
 *   không xét luật chặn hai đầu.
 * - Kín bàn mà không ai thắng thì hòa.
 */

export const CARO_SIZE = 15;
export const WIN_LENGTH = 5;

export type CaroSymbol = 'X' | 'O';
export type CaroBoard = (CaroSymbol | null)[][];

export interface CaroPosition {
  row: number;
  col: number;
}

export type InvalidCellReason = 'BAD_POSITION' | 'CELL_OCCUPIED';

export class InvalidCellError extends Error {
  constructor(readonly reason: InvalidCellReason) {
    super(reason);
    this.name = 'InvalidCellError';
  }
}

/** 4 hướng của một hàng: ngang, dọc, chéo xuống phải, chéo xuống trái. */
const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

export function createCaroBoard(): CaroBoard {
  return Array.from({ length: CARO_SIZE }, () =>
    new Array<CaroSymbol | null>(CARO_SIZE).fill(null),
  );
}

/** Đánh `symbol` vào ô. Trả bàn mới, không sửa bàn cũ. */
export function placeMark(
  board: CaroBoard,
  position: CaroPosition,
  symbol: CaroSymbol,
): CaroBoard {
  if (!isInsideCaro(position)) {
    throw new InvalidCellError('BAD_POSITION');
  }
  if (board[position.row][position.col] !== null) {
    throw new InvalidCellError('CELL_OCCUPIED');
  }
  const next = board.map((row) => [...row]);
  next[position.row][position.col] = symbol;
  return next;
}

/**
 * Hàng thắng đi qua ô vừa đánh: các ô liên tiếp cùng ký hiệu (từ 5 trở lên)
 * theo hướng đầu tiên đạt đủ. Trả về null nếu chưa thắng.
 */
export function findWinningLine(
  board: CaroBoard,
  position: CaroPosition,
): CaroPosition[] | null {
  const symbol = board[position.row]?.[position.col];
  if (!symbol) {
    return null;
  }
  for (const [dRow, dCol] of DIRECTIONS) {
    const line = [position];
    for (const sign of [1, -1]) {
      let row = position.row + sign * dRow;
      let col = position.col + sign * dCol;
      while (isInsideCaro({ row, col }) && board[row][col] === symbol) {
        line.push({ row, col });
        row += sign * dRow;
        col += sign * dCol;
      }
    }
    if (line.length >= WIN_LENGTH) {
      return line.sort((a, b) => a.row - b.row || a.col - b.col);
    }
  }
  return null;
}

export function isBoardFull(board: CaroBoard): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export function otherSymbol(symbol: CaroSymbol): CaroSymbol {
  return symbol === 'X' ? 'O' : 'X';
}

export function isInsideCaro(position: CaroPosition): boolean {
  return (
    Number.isInteger(position?.row) &&
    Number.isInteger(position?.col) &&
    position.row >= 0 &&
    position.row < CARO_SIZE &&
    position.col >= 0 &&
    position.col < CARO_SIZE
  );
}
