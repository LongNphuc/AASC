import {
  CARO_SIZE,
  CaroBoard,
  CaroPosition,
  CaroSymbol,
  createCaroBoard,
  findWinningLine,
  InvalidCellError,
  isBoardFull,
  placeMark,
} from './caro.engine';

/** Đánh lần lượt các ô cho một ký hiệu. */
function withMarks(
  symbol: CaroSymbol,
  cells: Array<[number, number]>,
  board: CaroBoard = createCaroBoard(),
): CaroBoard {
  return cells.reduce(
    (b, [row, col]) => placeMark(b, { row, col }, symbol),
    board,
  );
}

describe('Cờ caro: thắng khi có 5 liên tiếp', () => {
  it.each<[string, Array<[number, number]>]>([
    [
      'ngang',
      [
        [7, 3],
        [7, 4],
        [7, 5],
        [7, 6],
        [7, 7],
      ],
    ],
    [
      'dọc',
      [
        [2, 9],
        [3, 9],
        [4, 9],
        [5, 9],
        [6, 9],
      ],
    ],
    [
      'chéo xuống phải',
      [
        [0, 0],
        [1, 1],
        [2, 2],
        [3, 3],
        [4, 4],
      ],
    ],
    [
      'chéo xuống trái',
      [
        [10, 14],
        [11, 13],
        [12, 12],
        [13, 11],
        [14, 10],
      ],
    ],
  ])('%s', (_name, cells) => {
    const board = withMarks('X', cells);
    // Kiểm tra từ ô giữa hàng: phải gom được cả hai phía.
    const [row, col] = cells[2];
    expect(findWinningLine(board, { row, col })).toHaveLength(5);
  });

  it('6 liên tiếp cũng thắng', () => {
    const board = withMarks('O', [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 5],
    ]);
    expect(findWinningLine(board, { row: 0, col: 5 })).toHaveLength(6);
  });

  it('4 liên tiếp chưa thắng; ký hiệu đối thủ chen giữa thì không tính', () => {
    expect(
      findWinningLine(
        withMarks('X', [
          [5, 5],
          [5, 6],
          [5, 7],
          [5, 8],
        ]),
        { row: 5, col: 8 },
      ),
    ).toBeNull();

    const broken = withMarks(
      'O',
      [[5, 7]],
      withMarks('X', [
        [5, 5],
        [5, 6],
        [5, 8],
        [5, 9],
      ]),
    );
    expect(findWinningLine(broken, { row: 5, col: 9 })).toBeNull();
  });

  it('bị chặn hai đầu vẫn thắng (không áp dụng luật chặn hai đầu)', () => {
    const board = withMarks(
      'O',
      [
        [3, 0],
        [3, 6],
      ],
      withMarks('X', [
        [3, 1],
        [3, 2],
        [3, 3],
        [3, 4],
        [3, 5],
      ]),
    );
    expect(findWinningLine(board, { row: 3, col: 3 })).toHaveLength(5);
  });
});

describe('Cờ caro: nước đi không hợp lệ', () => {
  it.each<[string, CaroPosition, string]>([
    ['ngoài bàn', { row: CARO_SIZE, col: 0 }, 'BAD_POSITION'],
    ['số âm', { row: -1, col: 3 }, 'BAD_POSITION'],
    ['không phải số nguyên', { row: 1.5, col: 3 }, 'BAD_POSITION'],
    ['ô đã đánh', { row: 0, col: 0 }, 'CELL_OCCUPIED'],
  ])('%s', (_name, position, reason) => {
    const board = withMarks('X', [[0, 0]]);
    expect(() => placeMark(board, position, 'O')).toThrow(InvalidCellError);
    try {
      placeMark(board, position, 'O');
    } catch (error) {
      expect((error as InvalidCellError).reason).toBe(reason);
    }
  });

  it('placeMark không sửa bàn cũ', () => {
    const board = createCaroBoard();
    placeMark(board, { row: 1, col: 1 }, 'X');
    expect(board[1][1]).toBeNull();
  });
});

describe('Cờ caro: hòa', () => {
  it('kín bàn thì isBoardFull = true', () => {
    const full = createCaroBoard().map((row, r) =>
      row.map((_, c): CaroSymbol => ((r + c) % 2 === 0 ? 'X' : 'O')),
    );
    expect(isBoardFull(full)).toBe(true);
    expect(isBoardFull(createCaroBoard())).toBe(false);
  });
});
