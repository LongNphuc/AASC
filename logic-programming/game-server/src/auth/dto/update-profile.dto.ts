import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { FIELD, VALIDATION } from '../../common/constants/messages.constant';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Chỉ cho đổi email và nickname; gửi trường khác sẽ bị từ chối. */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: VALIDATION.EMAIL_INVALID })
  email?: string;

  @IsOptional()
  @Transform(trim)
  @Length(1, 30, { message: VALIDATION.LENGTH(FIELD.NICKNAME, 1, 30) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.NICKNAME) })
  nickname?: string;
}
