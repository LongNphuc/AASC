import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  API_DOC,
  FIELD,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { Trim } from '../../common/validation/trim.decorator';
import { AddressDto } from './address.dto';
import { BankDto } from './bank.dto';

const NAME_MAX = 100;

/**
 * Lưu ý: class-validator chạy decorator từ DƯỚI LÊN, và ValidationPipe dừng ở
 * lỗi đầu tiên của mỗi trường (stopAtFirstError). Vì vậy kiểm tra kiểu
 * (@IsString) đặt sát tên trường để chạy trước, báo đúng lỗi "phải là chuỗi".
 */
export class CreateContactDto {
  @ApiProperty({
    example: API_DOC.EXAMPLE.NAME,
    description: API_DOC.FIELD.NAME,
  })
  @Trim()
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.NAME) })
  @MaxLength(NAME_MAX, { message: VALIDATION.MAX_LENGTH(FIELD.NAME, NAME_MAX) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.NAME) })
  name: string;

  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.PHONE,
    description: API_DOC.FIELD.PHONE,
  })
  @Trim()
  @IsOptional()
  @IsPhoneNumber('VN', { message: VALIDATION.PHONE_INVALID })
  phone?: string;

  @ApiPropertyOptional({ example: API_DOC.EXAMPLE.EMAIL })
  @Trim()
  @IsOptional()
  @IsEmail({}, { message: VALIDATION.EMAIL_INVALID })
  email?: string;

  @ApiPropertyOptional({ example: API_DOC.EXAMPLE.WEBSITE })
  @Trim()
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: false },
    { message: VALIDATION.WEBSITE_INVALID },
  )
  website?: string;

  @ApiPropertyOptional({ type: AddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @ApiPropertyOptional({ type: BankDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BankDto)
  bank?: BankDto;
}
