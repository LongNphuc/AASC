import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_KBNS } from '../constants/messages.constant';
import { ErrorKbn, WithErrorKbn } from '../kbn/error.kbn';

/**
 * Lỗi nghiệp vụ mang mã kbn. AllExceptionsFilter trả về
 * { r: errorKbn, m: ERROR_KBNS[errorKbn], d: data }.
 */
export class AppException extends HttpException implements WithErrorKbn {
  constructor(
    readonly errorKbn: ErrorKbn,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    /** Thông tin phụ của lỗi, trả về ở `d`. */
    readonly data?: Record<string, unknown>,
  ) {
    super(ERROR_KBNS[errorKbn], status);
  }
}
