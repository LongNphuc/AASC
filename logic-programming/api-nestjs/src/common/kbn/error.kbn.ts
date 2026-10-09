import { HttpException } from '@nestjs/common';

/**
 * Mã lỗi (error_kbn): giá trị `r` trong body lỗi và cột error_kbn trong log.
 * Câu thông báo của từng mã nằm ở ERROR_KBNS (messages.constant.ts).
 * Mã gồm 5 chữ số, chữ số đầu là nơi xảy ra lỗi:
 *   2 = request    3 = task    9 = hệ thống
 */
export enum ErrorKbn {
  /** Dữ liệu gửi lên không hợp lệ; chi tiết từng trường nằm ở `f`. */
  VALIDATION = 20001,
  /** Đường dẫn không tồn tại. */
  NOT_FOUND = 20002,
  /** PATCH không gửi trường nào. */
  NOTHING_TO_UPDATE = 20003,

  TASK_NOT_FOUND = 30001,

  UNKNOWN = 90001,
}

/** Lỗi mang sẵn mã kbn của nó (xem AppException). */
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
    if (status === 404) return ErrorKbn.NOT_FOUND;
    if (status < 500) return ErrorKbn.VALIDATION;
  }
  return ErrorKbn.UNKNOWN;
}

/** Tên dễ đọc của mã lỗi, dùng trong log: 30001 -> "TASK_NOT_FOUND". */
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
