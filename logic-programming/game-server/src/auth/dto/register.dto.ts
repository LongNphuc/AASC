import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { FIELD, VALIDATION } from '../../common/constants/messages.constant';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/**
 * Lưu ý: class-validator chạy decorator từ DƯỚI LÊN và ValidationPipe dừng ở
 * lỗi đầu tiên của mỗi trường, nên @IsString đặt sát tên trường để chạy trước.
 */
export class RegisterDto {
  /** Không phân biệt hoa thường: "Long" và "long" là một tài khoản. */
  @Transform(trimLower)
  @Matches(/^[a-z0-9_]+$/, { message: VALIDATION.USERNAME_FORMAT })
  @Length(3, 20, { message: VALIDATION.LENGTH(FIELD.USERNAME, 3, 20) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.USERNAME) })
  username: string;

  /** bcrypt chỉ dùng 72 byte đầu của mật khẩu, nên giới hạn 72 ký tự. */
  @Length(6, 72, { message: VALIDATION.LENGTH(FIELD.PASSWORD, 6, 72) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.PASSWORD) })
  password: string;

  /** Để trống thì dùng tên đăng nhập. */
  @IsOptional()
  @Transform(trim)
  @Length(1, 30, { message: VALIDATION.LENGTH(FIELD.NICKNAME, 1, 30) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.NICKNAME) })
  nickname?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: VALIDATION.EMAIL_INVALID })
  email?: string;
}
