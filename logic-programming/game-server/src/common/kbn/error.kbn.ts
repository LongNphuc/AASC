import { HttpException } from '@nestjs/common';

/**
 * Mã lỗi (error_kbn), dùng chung cho log và phản hồi (HTTP lẫn WebSocket).
 * Mã gồm 5 chữ số, chữ số đầu là nơi xảy ra lỗi:
 *   2 = tài khoản, request    3 = Line 98    4 = cờ caro    9 = hệ thống
 */
export enum ErrorKbn {
  VALIDATION = 20001,
  UNAUTHORIZED = 20002,
  NOT_FOUND = 20003,
  USERNAME_TAKEN = 20004,
  INVALID_CREDENTIALS = 20005,
  /** Tài khoản đang online ở nơi khác (phiên đăng nhập khác). */
  ACCOUNT_IN_USE = 20006,

  LINE98_NO_GAME = 30001,
  LINE98_INVALID_MOVE = 30002,
  LINE98_GAME_OVER = 30003,

  CARO_ALREADY_IN_GAME = 40001,
  CARO_NOT_IN_MATCH = 40002,
  CARO_NOT_YOUR_TURN = 40003,
  CARO_INVALID_CELL = 40004,

  UNKNOWN = 90001,
}

/** Lỗi mang sẵn mã kbn của nó (xem GameException). */
export interface WithErrorKbn {
  errorKbn: number;
}

/** Suy ra error_kbn từ một lỗi bất kỳ. */
export function errorKbnOf(error: unknown): ErrorKbn {
  if (hasErrorKbn(error)) {
    return error.errorKbn;
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 401 || status === 403) return ErrorKbn.UNAUTHORIZED;
    if (status === 404) return ErrorKbn.NOT_FOUND;
    if (status < 500) return ErrorKbn.VALIDATION;
  }
  return ErrorKbn.UNKNOWN;
}

/** Tên dễ đọc của mã lỗi, dùng trong log: 30002 -> "LINE98_INVALID_MOVE". */
export function describeErrorKbn(code: number): string {
  return ErrorKbn[code] ?? String(code);
}

function hasErrorKbn(error: unknown): error is WithErrorKbn {
  return (
    !!error &&
    typeof error === 'object' &&
    typeof (error as Partial<WithErrorKbn>).errorKbn === 'number'
  );
}
