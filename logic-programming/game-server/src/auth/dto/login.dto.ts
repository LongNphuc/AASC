import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { FIELD, VALIDATION } from '../../common/constants/messages.constant';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.USERNAME) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.USERNAME) })
  username: string;

  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.PASSWORD) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.PASSWORD) })
  password: string;
}
