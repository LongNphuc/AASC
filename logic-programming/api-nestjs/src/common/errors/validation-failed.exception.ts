import { HttpStatus } from '@nestjs/common';
import { ErrorKbn } from '../kbn/error.kbn';
import { AppException } from './app.exception';

/** Lỗi theo từng trường: { "title": ["Tiêu đề là bắt buộc"], ... }. */
export type FieldErrors = Record<string, string[]>;

/**
 * Dữ liệu gửi lên không hợp lệ (400, mã 20001). AllExceptionsFilter trả các
 * lỗi theo từng trường ở `f`.
 */
export class ValidationFailedException extends AppException {
  constructor(readonly fields: FieldErrors) {
    super(ErrorKbn.VALIDATION, HttpStatus.BAD_REQUEST);
  }
}
