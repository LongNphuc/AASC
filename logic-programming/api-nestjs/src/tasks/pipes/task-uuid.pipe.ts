import { Injectable, ParseUUIDPipe } from '@nestjs/common';
import { VALIDATION } from '../../common/constants/messages.constant';
import { ValidationFailedException } from '../../common/errors/validation-failed.exception';

/**
 * Kiểm tra tham số :uuid trên đường dẫn là uuid hợp lệ. Sai thì trả lỗi
 * validate (r = 20001, f = { uuid: [...] }), không cần truy vấn DB.
 */
@Injectable()
export class TaskUuidPipe extends ParseUUIDPipe {
  constructor() {
    super({
      exceptionFactory: () =>
        new ValidationFailedException({ uuid: [VALIDATION.UUID_INVALID] }),
    });
  }
}
