import type {
  CaroBoard,
  CaroPosition,
  CaroSymbol,
} from '../engines/caro.engine';

export interface CaroMove extends CaroPosition {
  symbol: CaroSymbol;
}

/** Một người chơi trong hàng chờ hoặc trong trận. */
export interface CaroSeat {
  userUuid: string;
  username: string;
  nickname: string;
  /** Socket đang dùng, để gửi sự kiện riêng cho người này. */
  socketId: string;
}

/** Trận đang diễn ra, giữ trong bộ nhớ (chỉ ghi DB lúc tạo và lúc kết thúc). */
export interface ActiveMatch {
  uuid: string;
  board: CaroBoard;
  players: Record<CaroSymbol, CaroSeat>;
  turn: CaroSymbol;
  moves: CaroMove[];
}

export interface CaroMoveRequest extends CaroPosition {
  matchUuid: string;
}

/** Kết thúc trận, gửi cho cả hai người qua sự kiện caro:over. */
export interface CaroFinishView {
  matchUuid: string;
  resultKbn: number;
  /** Tên của resultKbn: X_WIN, O_WIN, DRAW, ABANDONED. */
  result: string;
  winnerNickname: string | null;
  winSymbol: CaroSymbol | null;
  /** Các ô của hàng thắng (để client tô sáng); null khi hòa hoặc bỏ cuộc. */
  winLine: CaroPosition[] | null;
}

export type JoinQueueResult =
  { status: 'waiting' } | { status: 'matched'; match: ActiveMatch };

export interface MoveOutcome {
  match: ActiveMatch;
  move: CaroMove;
  nextTurn: CaroSymbol;
  finished: CaroFinishView | null;
}

/** Thông báo ghép cặp xong, mỗi người nhận bản của mình (caro:matched). */
export interface CaroMatchedView {
  matchUuid: string;
  you: CaroSymbol;
  opponent: { nickname: string };
  turn: CaroSymbol;
}

/** Một dòng lịch sử trận (GET /caro/matches). */
export interface CaroHistoryItem {
  matchUuid: string;
  you: CaroSymbol;
  opponentNickname: string;
  resultKbn: number;
  result: string;
  /** Kết quả theo góc nhìn của người xem: WIN, LOSE, DRAW, PLAYING. */
  outcome: 'WIN' | 'LOSE' | 'DRAW' | 'PLAYING';
  moveCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}
