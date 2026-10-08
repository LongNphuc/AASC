/**
 * Toàn bộ câu chữ của ứng dụng: nội dung log, thông báo lỗi, thông báo
 * validate. Code chỉ gọi tên hằng, ví dụ:
 *
 *   throw new GameException(ErrorKbn.CARO_NOT_YOUR_TURN, ERROR.CARO.NOT_YOUR_TURN);
 *   this.logger.log(LOG.CARO.MATCHED(match.uuid, x, o));
 *
 * Câu có giá trị thay đổi được viết thành hàm nhận tham số. Không gom vào đây
 * các chuỗi định danh kỹ thuật (tên sự kiện WebSocket, tên bảng...).
 */

// ---------------------------------------------------------------------------
// LOG: sự kiện bình thường (logger.log)
// ---------------------------------------------------------------------------
export const LOG = {
  BOOTSTRAP: {
    LISTENING: (port: number) => `Đang chạy tại http://localhost:${port}`,
    CLIENT: (port: number) =>
      `Mở trình duyệt: http://localhost:${port} (đăng ký, đăng nhập, chơi Line 98 và cờ caro)`,
  },
  AUTH: {
    REGISTERED: (username: string) => `Đăng ký tài khoản ${username}`,
    LOGGED_IN: (username: string) => `${username} đăng nhập`,
    PROFILE_UPDATED: (username: string) =>
      `${username} cập nhật thông tin cá nhân`,
  },
  WS: {
    CONNECTED: (namespace: string, username: string) =>
      `${username} kết nối ${namespace}`,
    DISCONNECTED: (namespace: string, username: string) =>
      `${username} ngắt kết nối ${namespace}`,
  },
  LINE98: {
    NEW_GAME: (username: string, gameUuid: string) =>
      `${username} bắt đầu ván Line 98 ${gameUuid}`,
    GAME_OVER: (username: string, score: number) =>
      `Ván Line 98 của ${username} kết thúc, điểm ${score}`,
  },
  CARO: {
    QUEUED: (username: string) => `${username} vào hàng chờ cờ caro`,
    MATCHED: (matchUuid: string, playerX: string, playerO: string) =>
      `Ghép trận ${matchUuid}: ${playerX} (X) gặp ${playerO} (O)`,
    FINISHED: (matchUuid: string, result: string) =>
      `Trận ${matchUuid} kết thúc: ${result}`,
  },
} as const;

// ---------------------------------------------------------------------------
// WARN: bất thường nhưng ứng dụng vẫn chạy tiếp (logger.warn)
// ---------------------------------------------------------------------------
export const WARN = {
  BOOTSTRAP: {
    JWT_SECRET_GENERATED:
      'Chưa đặt JWT_SECRET: dùng khóa ngẫu nhiên, mọi token mất hiệu lực khi khởi động lại',
  },
  WS: {
    AUTH_FAILED: (namespace: string, reason: string) =>
      `Từ chối kết nối ${namespace}: ${reason}`,
  },
} as const;

// ---------------------------------------------------------------------------
// ERROR: thông báo lỗi trả về client và log lỗi (logger.error)
// ---------------------------------------------------------------------------
export const ERROR = {
  /** Giá trị trường `error` trong body lỗi. */
  LABEL: {
    VALIDATION_FAILED: 'Validation Failed',
    INTERNAL_SERVER_ERROR: 'Internal Server Error',
  },
  SYSTEM: {
    INTERNAL: 'Lỗi máy chủ nội bộ',
    INVALID_ENV: (details: string) =>
      `Biến môi trường không hợp lệ: ${details}`,
    STARTUP_FAILED: (reason: string) =>
      `Khởi động thất bại, dừng ứng dụng: ${reason}`,
    REQUEST_FAILED: (
      method: string,
      path: string,
      status: number,
      errorKbn: number,
      reason: string,
    ) => `${method} ${path} -> ${status} (error_kbn=${errorKbn}): ${reason}`,
    WS_FAILED: (event: string, reason: string) =>
      `Sự kiện ${event} lỗi: ${reason}`,
  },
  AUTH: {
    TOKEN_MISSING:
      'Thiếu token đăng nhập (header Authorization: Bearer <token>)',
    TOKEN_INVALID: 'Token không hợp lệ hoặc đã hết hạn, hãy đăng nhập lại',
    USERNAME_TAKEN: (username: string) =>
      `Tên đăng nhập "${username}" đã có người dùng`,
    INVALID_CREDENTIALS: 'Sai tên đăng nhập hoặc mật khẩu',
    USER_NOT_FOUND: 'Tài khoản không tồn tại',
    ACCOUNT_IN_USE: 'Đã có người đang đăng nhập bằng tài khoản này ở nơi khác',
  },
  LINE98: {
    NO_GAME: 'Chưa có ván đang chơi, hãy bắt đầu ván mới',
    GAME_OVER: 'Ván đã kết thúc, hãy bắt đầu ván mới',
    BAD_POSITION: 'Vị trí không hợp lệ (hàng, cột phải là số nguyên 0-8)',
    NO_BALL: 'Ô xuất phát không có bóng',
    TARGET_OCCUPIED: 'Ô đích đã có bóng',
    NO_PATH: 'Không có đường đi tới ô đích',
  },
  CARO: {
    ALREADY_IN_GAME: 'Bạn đang ở trong hàng chờ hoặc trong một trận khác',
    NOT_IN_MATCH: 'Bạn không ở trong trận này',
    NOT_YOUR_TURN: 'Chưa tới lượt của bạn',
    BAD_POSITION: 'Vị trí không hợp lệ (hàng, cột phải là số nguyên 0-14)',
    CELL_OCCUPIED: 'Ô này đã được đánh',
  },
} as const;

// ---------------------------------------------------------------------------
// VALIDATION: thông báo khi dữ liệu gửi vào không hợp lệ
// ---------------------------------------------------------------------------

/** Tên trường hiển thị trong thông báo validate. */
export const FIELD = {
  USERNAME: 'Tên đăng nhập',
  PASSWORD: 'Mật khẩu',
  NICKNAME: 'Nickname',
  EMAIL: 'Email',
} as const;

const REQUIRED = (field: string) => `${field} là bắt buộc`;
const MUST_BE_STRING = (field: string) => `${field} phải là chuỗi`;

export const VALIDATION = {
  REQUIRED,
  /** Thiếu trường thì "là bắt buộc", có nhưng sai kiểu thì "phải là chuỗi". */
  REQUIRED_STRING:
    (field: string) =>
    ({ value }: { value: unknown }) =>
      value === undefined || value === null
        ? REQUIRED(field)
        : MUST_BE_STRING(field),
  MUST_BE_STRING,
  LENGTH: (field: string, min: number, max: number) =>
    `${field} dài từ ${min} tới ${max} ký tự`,
  USERNAME_FORMAT: 'Tên đăng nhập chỉ gồm chữ không dấu, số và dấu gạch dưới',
  EMAIL_INVALID: 'Email không hợp lệ',
  FIELD_NOT_ALLOWED: (path: string) => `Trường "${path}" không được hỗ trợ`,
  NOTHING_TO_UPDATE: 'Không có trường nào để cập nhật (email, nickname)',
} as const;

// ---------------------------------------------------------------------------
// MESSAGE: nội dung trả về không phải lỗi
// ---------------------------------------------------------------------------
export const MESSAGE = {
  CARO: {
    WAITING: 'Đang chờ người chơi khác...',
    LEFT_QUEUE: 'Đã rời hàng chờ',
  },
} as const;
