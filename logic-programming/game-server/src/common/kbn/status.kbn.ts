/**
 * Mã trạng thái (kbn), dùng chung cho DB, log và dữ liệu gửi về client.
 * Mã bắt đầu bằng 1 để không trùng với mã lỗi (error_kbn bắt đầu từ 2).
 */

/** Kết quả một lệnh gọi (HTTP hoặc sự kiện WebSocket), ghi trong log service. */
export enum StatusKbn {
  SUCCESS = 10000,
  FAILED = 10001,
}

/** Trạng thái một ván Line 98 (cột line98_games.status_kbn). */
export enum Line98StatusKbn {
  PLAYING = 11000,
  /** Bàn đầy, không còn nước đi. */
  GAME_OVER = 11001,
  /** Người chơi bắt đầu ván mới khi ván này chưa kết thúc. */
  ABANDONED = 11002,
}

/** Kết quả một trận cờ caro (cột caro_matches.result_kbn). */
export enum CaroResultKbn {
  PLAYING = 12000,
  X_WIN = 12001,
  O_WIN = 12002,
  /** Hết 225 ô mà không ai thắng. */
  DRAW = 12003,
  /** Một người rời trận hoặc mất kết nối; người còn lại thắng. */
  ABANDONED = 12004,
}
