import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  API_DOC,
  FIELD,
  LABEL,
  VALIDATION,
} from '../../common/constants/messages.constant';
import { kbnValues, TaskStatusKbn } from '../../common/kbn/status.kbn';
import {
  SkipIfUndefined,
  Trim,
} from '../../common/validation/validation.decorators';
import { SubtaskDto } from './subtask.dto';

export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 2000;
export const SUBTASKS_MAX = 100;

/**
 * Body của POST /tasks. Chỉ title là bắt buộc; ValidationPipe toàn cục kiểm
 * tra các luật dưới đây trước khi tới controller.
 *
 * class-validator chạy decorator từ DƯỚI LÊN và dừng ở lỗi đầu tiên của mỗi
 * trường, nên kiểm tra kiểu đặt sát tên trường để chạy trước.
 */
export class CreateTaskDto {
  @ApiProperty({
    example: API_DOC.EXAMPLE.TITLE,
    description: API_DOC.FIELD.TITLE,
  })
  @Trim()
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.TITLE) })
  @MaxLength(TITLE_MAX, {
    message: VALIDATION.MAX_LENGTH(FIELD.TITLE, TITLE_MAX),
  })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.TITLE) })
  title: string;

  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.DESCRIPTION,
    description: API_DOC.FIELD.DESCRIPTION,
  })
  @SkipIfUndefined()
  @Trim()
  @MaxLength(DESCRIPTION_MAX, {
    message: VALIDATION.MAX_LENGTH(FIELD.DESCRIPTION, DESCRIPTION_MAX),
  })
  @IsString({ message: VALIDATION.MUST_BE_STRING(FIELD.DESCRIPTION) })
  description?: string;

  @ApiPropertyOptional({
    enum: kbnValues(TaskStatusKbn),
    example: TaskStatusKbn.TO_DO,
    default: TaskStatusKbn.TO_DO,
    description: API_DOC.FIELD.TASK_STATUS,
  })
  @SkipIfUndefined()
  @IsIn(kbnValues(TaskStatusKbn), {
    message: VALIDATION.ONE_OF(FIELD.STATUS, LABEL.TASK_STATUS),
  })
  statusKbn?: TaskStatusKbn;

  @ApiPropertyOptional({
    type: [SubtaskDto],
    description: API_DOC.FIELD.SUBTASKS,
  })
  @SkipIfUndefined()
  @ValidateNested({ each: true, message: VALIDATION.SUBTASK_MUST_BE_OBJECT })
  @Type(() => SubtaskDto)
  @ArrayMaxSize(SUBTASKS_MAX, {
    message: VALIDATION.MAX_ITEMS(FIELD.SUBTASKS, SUBTASKS_MAX),
  })
  @IsArray({ message: VALIDATION.MUST_BE_ARRAY(FIELD.SUBTASKS) })
  subtasks?: SubtaskDto[];
}
