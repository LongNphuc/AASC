import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import {
  API_DOC,
  FIELD,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { Trim } from '../../common/validation/trim.decorator';

const MAX = 255;

export class BankDto {
  @ApiProperty({ example: API_DOC.EXAMPLE.BANK_NAME })
  @Trim()
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.BANK_NAME) })
  @MaxLength(MAX, { message: VALIDATION.MAX_LENGTH(FIELD.BANK_NAME, MAX) })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.BANK_NAME) })
  bankName: string;

  @ApiProperty({
    example: API_DOC.EXAMPLE.ACCOUNT_NUMBER,
    description: API_DOC.FIELD.ACCOUNT_NUMBER,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @Matches(/^\d{6,20}$/, { message: VALIDATION.ACCOUNT_NUMBER_INVALID })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.ACCOUNT_NUMBER) })
  accountNumber: string;
}
