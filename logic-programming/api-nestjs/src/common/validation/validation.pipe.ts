import { ValidationError, ValidationPipe } from '@nestjs/common';
import { VALIDATION } from '../constants/messages.constant';
import {
  FieldErrors,
  ValidationFailedException,
} from '../errors/validation-failed.exception';

/**
 * ValidationPipe dùng cho toàn ứng dụng (app.module.ts) và cho test, để test
 * kiểm tra đúng cấu hình thật:
 * - whitelist + forbidNonWhitelisted: trường không khai báo trong DTO bị từ chối;
 * - transform: body được đổi thành instance của DTO (chạy @Transform, @Type);
 * - stopAtFirstError: mỗi trường chỉ báo lỗi đầu tiên.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) =>
      new ValidationFailedException(toFieldErrors(errors)),
  });
}

/**
 * Gom lỗi của class-validator thành { tên trường: [thông báo] }. Trường nằm
 * trong mảng ghi kèm vị trí, ví dụ "subtasks[1].taskName"; lỗi của cả một
 * phần tử (ví dụ phần tử không phải object) ghi ở "subtasks[1]".
 */
export function toFieldErrors(
  errors: ValidationError[],
  parentPath = '',
  fields: FieldErrors = {},
): FieldErrors {
  for (const error of errors) {
    const path = joinPath(parentPath, error.property);
    for (const [rule, text] of Object.entries(error.constraints ?? {})) {
      // whitelistValidation: client gửi trường không có trong DTO.
      const message =
        rule === 'whitelistValidation' ? VALIDATION.FIELD_NOT_ALLOWED : text;
      (fields[path] ??= []).push(message);
    }
    toFieldErrors(error.children ?? [], path, fields);
  }
  return fields;
}

/** "subtasks" + "1" → "subtasks[1]"; "subtasks[1]" + "taskName" → "subtasks[1].taskName". */
function joinPath(parent: string, property: string): string {
  if (!parent) return property;
  return /^\d+$/.test(property)
    ? `${parent}[${property}]`
    : `${parent}.${property}`;
}
