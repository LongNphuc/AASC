import { PartialType } from '@nestjs/swagger';
import { CreateContactDto } from './create-contact.dto';

/**
 * Mọi trường đều tùy chọn: chỉ trường được gửi lên mới thay đổi.
 * Riêng `bank`, nếu gửi thì phải đủ cả tên ngân hàng lẫn số tài khoản.
 */
export class UpdateContactDto extends PartialType(CreateContactDto) {}
