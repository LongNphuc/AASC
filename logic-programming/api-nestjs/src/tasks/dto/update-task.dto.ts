import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { DESCRIPTION_MAX, SUBTASKS_MAX, TITLE_MAX } from './create-task.dto';
import { SubtaskDto } from './subtask.dto';

/**
 * Body của PATCH /tasks/:uuid: cùng luật với CreateTaskDto, nhưng mọi trường
 * đều không bắt buộc. Trường không gửi thì giữ nguyên; gửi subtasks thì thay
 * toàn bộ danh sách task con cũ.
 *
 * Không dùng PartialType(CreateTaskDto) vì nó thêm @IsOptional, vốn bỏ qua cả
 * giá trị null: PATCH { "title": null } sẽ lọt qua validate.
 */
export class UpdateTaskDto {
  @ApiPropertyOptional({
    example: API_DOC.EXAMPLE.TITLE,
    description: API_DOC.FIELD.TITLE,
  })
  @SkipIfUndefined()
  @Trim()
  @IsNotEmpty({ message: VALIDATION.REQUIRED(FIELD.TITLE) })
  @MaxLength(TITLE_MAX, {
    message: VALIDATION.MAX_LENGTH(FIELD.TITLE, TITLE_MAX),
  })
  @IsString({ message: VALIDATION.REQUIRED_STRING(FIELD.TITLE) })
  title?: string;

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
    example: TaskStatusKbn.IN_PROGRESS,
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
