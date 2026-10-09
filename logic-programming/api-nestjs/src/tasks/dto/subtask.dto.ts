import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  API_DOC,
  FIELD,
  LABEL,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { kbnValues, SubtaskStatusKbn } from '../../common/kbn/status.kbn';
import {
  SkipIfUndefined,
  Trim,
} from '../../common/validation/validation.decorators';

export const SUBTASK_NAME_MAX = 200;
export const HOURS_MAX = 10000;

const HOURS_RANGE = (field: string) =>
  VALIDATION.HOURS_RANGE(field, 0, HOURS_MAX);

/**
 * Một task con gửi lên khi tạo hoặc sửa task.
 *
 * class-validator chạy decorator từ DƯỚI LÊN và dừng ở lỗi đầu tiên của mỗi
 * trường, nên kiểm tra kiểu đặt sát tên trường để chạy trước.
 */
export class SubtaskDto {
  @ApiProperty({
    example: API_DOC.EXAMPLE.TASK_NAME,
    description: API_DOC.FIELD.TASK_NAME,
  })
  @Trim()
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.TASK_NAME) })
  @MaxLength(SUBTASK_NAME_MAX, {
    message: VALIDATION.MAX_LENGTH(FIELD.TASK_NAME, SUBTASK_NAME_MAX),
  })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.TASK_NAME) })
  taskName: string;

  @ApiProperty({ example: 1.5, description: API_DOC.FIELD.TIME_ESTIMATE })
  @Min(0, { message: HOURS_RANGE(FIELD.TIME_ESTIMATE) })
  @Max(HOURS_MAX, { message: HOURS_RANGE(FIELD.TIME_ESTIMATE) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: VALIDATION.MUST_BE_NUMBER(FIELD.TIME_ESTIMATE) },
  )
  @IsDefined({ message: VALIDATION.REQUIRED(FIELD.TIME_ESTIMATE) })
  timeEstimate: number;

  @ApiPropertyOptional({
    example: 0.75,
    default: 0,
    description: API_DOC.FIELD.TIME_SPENT,
  })
  @SkipIfUndefined()
  @Min(0, { message: HOURS_RANGE(FIELD.TIME_SPENT) })
  @Max(HOURS_MAX, { message: HOURS_RANGE(FIELD.TIME_SPENT) })
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: VALIDATION.MUST_BE_NUMBER(FIELD.TIME_SPENT) },
  )
  timeSpent?: number;

  @ApiPropertyOptional({
    enum: kbnValues(SubtaskStatusKbn),
    example: SubtaskStatusKbn.IN_PROGRESS,
    default: SubtaskStatusKbn.IN_PROGRESS,
    description: API_DOC.FIELD.SUBTASK_STATUS,
  })
  @SkipIfUndefined()
  @IsIn(kbnValues(SubtaskStatusKbn), {
    message: VALIDATION.ONE_OF(FIELD.STATUS, LABEL.SUBTASK_STATUS),
  })
  statusKbn?: SubtaskStatusKbn;
}
