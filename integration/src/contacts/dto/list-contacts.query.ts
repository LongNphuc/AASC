import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import {
  API_DOC,
  FIELD,
  VALIDATION,
} from '../../common/constants/messages.constant';

export class ListContactsQuery {
  @ApiPropertyOptional({ description: API_DOC.FIELD.START, example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: VALIDATION.MUST_BE_INTEGER(FIELD.START) })
  @Min(0, { message: VALIDATION.NOT_NEGATIVE(FIELD.START) })
  start?: number;
}
