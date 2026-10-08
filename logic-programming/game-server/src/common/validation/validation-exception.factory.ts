import { BadRequestException, ValidationError } from '@nestjs/common';
import { ERROR, VALIDATION } from '../constants/messages.constant';

/** Gom lỗi validate DTO thành danh sách thông báo tiếng Việt. */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  return new BadRequestException({
    error: ERROR.LABEL.VALIDATION_FAILED,
    message: flatten(errors),
  });
}

function flatten(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.entries(error.constraints ?? {}).map(([rule, text]) =>
      // whitelistValidation: client gửi trường không có trong DTO.
      rule === 'whitelistValidation'
        ? VALIDATION.FIELD_NOT_ALLOWED(path)
        : text,
    );
    return [...own, ...flatten(error.children ?? [], path)];
  });
}
