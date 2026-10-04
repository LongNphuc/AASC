import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import {
  API_DOC,
  FIELD,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { Trim } from '../../common/validation/trim.decorator';

const MAX = 255;

export class AddressDto {
  @ApiPropertyOptional({ example: API_DOC.EXAMPLE.STREET })
  @Trim()
  @IsOptional()
  @MaxLength(MAX, { message: VALIDATION.MAX_LENGTH(FIELD.STREET, MAX) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.STREET) })
  street?: string;

  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.WARD,
    description: API_DOC.FIELD.WARD,
  })
  @Trim()
  @IsOptional()
  @MaxLength(MAX, { message: VALIDATION.MAX_LENGTH(FIELD.WARD, MAX) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.WARD) })
  ward?: string;

  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.DISTRICT,
    description: API_DOC.FIELD.DISTRICT,
  })
  @Trim()
  @IsOptional()
  @MaxLength(MAX, { message: VALIDATION.MAX_LENGTH(FIELD.DISTRICT, MAX) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.DISTRICT) })
  district?: string;

  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.PROVINCE,
    description: API_DOC.FIELD.PROVINCE,
  })
  @Trim()
  @IsOptional()
  @MaxLength(MAX, { message: VALIDATION.MAX_LENGTH(FIELD.PROVINCE, MAX) })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.PROVINCE) })
  province?: string;
}
