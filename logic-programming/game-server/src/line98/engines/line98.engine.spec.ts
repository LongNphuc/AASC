import {
  Board,
  BOARD_SIZE,
  createEmptyBoard,
  createGame,
  EMPTY,
  findLines,
  findPath,
  hasAnyMove,
  InvalidMoveError,
  Line98State,
  moveBall,
  RandomFn,
  suggestMove,
} from './line98.engine';

/** Hàm ngẫu nhiên trả lần lượt các giá trị cho trước (lặp lại khi hết). */
function sequence(...values: number[]): RandomFn {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Dựng bàn từ chuỗi: '.' trống, '1'..'5' màu; thiếu hàng thì coi là trống. */
function boardOf(...rows: string[]): Board {
  const board = createEmptyBoard();
  rows.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      board[row][col] = ch === '.' ? EMPTY : Number(ch);
    }),
  );
  return board;
}

function stateOf(board: Board, nextColors = [1, 2, 3]): Line98State {
  return { board, nextColors, score: 0, gameOver: false };
}

describe('Line 98: tạo ván', () => {
  it('ván mới có đúng 5 bóng, báo trước 3 màu, chưa thua', () => {
    const state = createGame(sequence(0.1, 0.3, 0.5, 0.7, 0.9));
    const balls = state.board.flat().filter((cell) => cell !== EMPTY);

    expect(state.board).toHaveLength(BOARD_SIZE);
    expect(balls).toHaveLength(5);
    expect(balls.every((c) => c >= 1 && c <= 5)).toBe(true);
    expect(state.nextColors).toHaveLength(3);
    expect(state.gameOver).toBe(false);
  });
});

describe('Line 98: tìm đường', () => {
  it('có đường vòng qua ô trống thì trả đường đi ngắn nhất', () => {
    const board = boardOf('1........', '22222222.');
    // Từ (0,0) tới (2,0): phải vòng qua cột 8 vì hàng 1 bị chắn.
    const path = findPath(board, { row: 0, col: 0 }, { row: 2, col: 0 });

    expect(path?.[0]).toEqual({ row: 0, col: 0 });
    expect(path?.at(-1)).toEqual({ row: 2, col: 0 });
    expect(path).toHaveLength(1 + 8 + 2 + 8); // 8 ngang, 2 dọc, 8 ngang
  });

  it('bị chặn hết lối thì không có đường (không đi chéo)', () => {
    const board = boardOf('12.......', '2........');
    expect(findPath(board, { row: 0, col: 0 }, { row: 5, col: 5 })).toBeNull();
  });
});

describe('Line 98: phát hiện hàng', () => {
  it.each([
    ['ngang', boardOf('11111....')],
    ['dọc', boardOf('2', '2', '2', '2', '2')],
    ['chéo xuống phải', boardOf('3', '.3', '..3', '...3', '....3')],
    ['chéo xuống trái', boardOf('....4', '...4', '..4', '.4', '4')],
    [
      'chéo xuống trái sát mép phải',
      boardOf('........5', '.......5', '......5', '.....5', '....5'),
    ],
  ])('5 bóng %s', (_name, board) => {
    expect(findLines(board)).toHaveLength(5);
  });

  it('6 bóng thẳng hàng thì xóa cả 6; 4 bóng thì không xóa', () => {
    expect(findLines(boardOf('111111...'))).toHaveLength(6);
    expect(findLines(boardOf('1111.....'))).toHaveLength(0);
  });

  it('hàng chéo 6 bóng thì lấy đủ 6 ô', () => {
    const board = boardOf('2', '.2', '..2', '...2', '....2', '.....2');
    expect(findLines(board)).toHaveLength(6);
  });

  it('bóng khác màu chen giữa thì không thành hàng', () => {
    expect(findLines(boardOf('1121111..'))).toHaveLength(0);
  });
});

describe('Line 98: di chuyển', () => {
  it('nước đi tạo hàng: xóa hàng, cộng điểm, KHÔNG sinh bóng mới', () => {
    const state = stateOf(boardOf('1111.....', '1........'));
    const result = moveBall(state, { row: 1, col: 0 }, { row: 0, col: 4 });

    expect(result.removed).toHaveLength(5);
    expect(result.spawned).toHaveLength(0);
    expect(result.state.score).toBe(5);
    expect(result.state.board.flat().every((c) => c === EMPTY)).toBe(true);
    expect(result.state.nextColors).toEqual([1, 2, 3]); // giữ màu báo trước
  });

  it('đi bóng vào ô trống giữa 3 + 3 bóng cùng màu: xóa cả 7, không chừa bóng nào', () => {
    const state = stateOf(boardOf('111.111..', '1........'));
    const result = moveBall(state, { row: 1, col: 0 }, { row: 0, col: 3 });

    expect(result.removed).toHaveLength(7);
    expect(result.state.score).toBe(7);
    expect(result.state.board.flat().every((c) => c === EMPTY)).toBe(true);
  });

  it('nước đi không tạo hàng: sinh 3 bóng đúng màu báo trước, đổi màu báo trước', () => {
    const state = stateOf(boardOf('1........'), [2, 3, 4]);
    const result = moveBall(
      state,
      { row: 0, col: 0 },
      { row: 8, col: 8 },
      sequence(0),
    );

    expect(result.removed).toHaveLength(0);
    expect(result.spawned.map((b) => b.color)).toEqual([2, 3, 4]);
    expect(result.state.board.flat().filter((c) => c !== EMPTY)).toHaveLength(
      4,
    );
    expect(result.path.at(-1)).toEqual({ row: 8, col: 8 });
  });

  it('bóng mới sinh tạo thành hàng thì cũng bị xóa và được điểm', () => {
    // Hàng 0 có 4 bóng màu 5, ô (0,4) trống; random 0 luôn chọn ô trống đầu tiên.
    const state = stateOf(boardOf('5555.....', '........1'), [5, 1, 1]);
    const result = moveBall(
      state,
      { row: 1, col: 8 },
      { row: 8, col: 8 },
      sequence(0),
    );

    expect(result.spawned[0]).toEqual({ row: 0, col: 4, color: 5 });
    expect(result.removed).toHaveLength(5);
    expect(result.state.score).toBe(5);
  });

  it.each([
    ['ô xuất phát trống', { row: 3, col: 3 }, { row: 0, col: 1 }, 'NO_BALL'],
    [
      'ô đích có bóng',
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      'TARGET_OCCUPIED',
    ],
    ['bị chặn đường', { row: 0, col: 0 }, { row: 5, col: 5 }, 'NO_PATH'],
    ['ngoài bàn', { row: 0, col: 0 }, { row: 9, col: 0 }, 'BAD_POSITION'],
  ])('%s → InvalidMoveError(%s)', (_name, from, to, reason) => {
    const state = stateOf(boardOf('12.......', '2........'));
    expect(() => moveBall(state, from, to)).toThrow(InvalidMoveError);
    try {
      moveBall(state, from, to);
    } catch (error) {
      expect((error as InvalidMoveError).reason).toBe(reason);
    }
  });

  it('không sửa trạng thái truyền vào', () => {
    const state = stateOf(boardOf('1........'));
    const before = JSON.stringify(state);
    moveBall(state, { row: 0, col: 0 }, { row: 8, col: 8 }, sequence(0.5));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('bàn đầy sau khi sinh bóng thì thua', () => {
    // Màu (hàng + 2×cột) mod 5: hai ô kề nhau theo mọi hướng luôn khác màu,
    // nên không bao giờ có hàng 5. Còn 2 ô trống (0,0), (0,1): bóng ở (0,2)
    // đi vào (0,1), ô cũ trống, 2 bóng mới lấp kín bàn.
    const board = createEmptyBoard().map((row, r) =>
      row.map((_, c) => ((r + 2 * c) % 5) + 1),
    );
    board[0][0] = EMPTY;
    board[0][1] = EMPTY;
    board[0][2] = 4;
    const result = moveBall(
      stateOf(board),
      { row: 0, col: 2 },
      { row: 0, col: 1 },
      sequence(0),
    );

    expect(result.state.board.flat().includes(EMPTY)).toBe(false);
    expect(result.state.gameOver).toBe(true);
    expect(hasAnyMove(result.state.board)).toBe(false);
  });
});

describe('Line 98: gợi ý nước đi', () => {
  it('ưu tiên đưa bóng tới cạnh bóng cùng màu', () => {
    // Bóng màu 3 ở (0,0) và (8,8); màu 4 ở (4,4). Gợi ý phải đưa một bóng màu 3
    // tới cạnh bóng màu 3 còn lại.
    const board = createEmptyBoard();
    board[0][0] = 3;
    board[8][8] = 3;
    board[4][4] = 4;

    for (const value of [0, 0.3, 0.6, 0.99]) {
      const hint = suggestMove(board, () => value);
      expect(hint).not.toBeNull();
      const { from, to } = hint!;
      expect(board[from.row][from.col]).toBe(3);
      const other = from.row === 0 ? { row: 8, col: 8 } : { row: 0, col: 0 };
      expect(
        Math.max(Math.abs(to.row - other.row), Math.abs(to.col - other.col)),
      ).toBe(1);
    }
  });

  it('gợi ý luôn là nước đi hợp lệ', () => {
    const state = createGame(
      sequence(0.12, 0.47, 0.83, 0.29, 0.65, 0.91, 0.05),
    );
    const hint = suggestMove(state.board, sequence(0.42))!;
    expect(() => moveBall(state, hint.from, hint.to)).not.toThrow();
  });

  it('bàn đầy thì không có gợi ý', () => {
    const full = createEmptyBoard().map((row) => row.map(() => 1));
    expect(suggestMove(full)).toBeNull();
  });
});
