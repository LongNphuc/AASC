import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { VALIDATION } from '../../common/constants/messages.constant';

/**
 * Kiểm tra tham số :id là số nguyên dương, báo lỗi rõ ràng nếu không.
 * Nhận cả string lẫn number, vì ValidationPipe toàn cục (transform: true) đã
 * đổi tham số sang number trước khi tới pipe này ("abc" thành NaN).
 */
@Injectable()
export class ContactIdPipe implements PipeTransform<string | number, number> {
  transform(value: string | number): number {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException(VALIDATION.CONTACT_ID_INVALID);
    }
    return id;
  }
}
