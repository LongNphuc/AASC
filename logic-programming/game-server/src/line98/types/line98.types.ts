import type {
  Board,
  Position,
  SpawnedBall,
  SuggestedMove,
} from '../engines/line98.engine';

/** Trạng thái ván gửi về client. */
export interface Line98GameView {
  gameUuid: string;
  board: Board;
  nextColors: number[];
  score: number;
  statusKbn: number;
  /** Tên của statusKbn: PLAYING, GAME_OVER... */
  status: string;
}

/** Kết quả một nước đi: trạng thái mới và dữ liệu để client vẽ hiệu ứng. */
export interface Line98MoveView {
  game: Line98GameView;
  path: Position[];
  removed: Position[];
  spawned: SpawnedBall[];
}

export interface Line98MoveRequest {
  from: Position;
  to: Position;
}

export type Line98HintView = SuggestedMove | null;
