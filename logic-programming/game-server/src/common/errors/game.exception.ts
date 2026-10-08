import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorKbn, WithErrorKbn } from '../kbn/error.kbn';

/**
 * Lỗi nghiệp vụ mang mã kbn. Dùng chung cho HTTP (AllExceptionsFilter trả về
 * statusCode, errorKbn, message) và WebSocket (handleWs trả về errorKbn,
 * message trong phản hồi của sự kiện).
 */
export class GameException extends HttpException implements WithErrorKbn {
  constructor(
    readonly errorKbn: ErrorKbn,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ error: ErrorKbn[errorKbn], message }, status);
    this.message = message;
  }
}
