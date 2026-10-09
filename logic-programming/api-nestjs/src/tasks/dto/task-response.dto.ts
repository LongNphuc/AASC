import { ApiProperty } from '@nestjs/swagger';
import { API_DOC, LABEL } from '../../common/constants/messages.constant';
import {
  kbnValues,
  SubtaskStatusKbn,
  TaskStatusKbn,
} from '../../common/kbn/status.kbn';

/**
 * Dữ liệu trả về (dùng cho Swagger và kiểu trả về của controller). Mỗi mã
 * statusKbn đi kèm chữ status để hiển thị cho người dùng.
 */
export class SubtaskResponseDto {
  @ApiProperty({ example: API_DOC.EXAMPLE.TASK_NAME })
  taskName: string;

  @ApiProperty({ example: 1.5, description: API_DOC.FIELD.TIME_ESTIMATE })
  timeEstimate: number;

  @ApiProperty({ example: 0.75, description: API_DOC.FIELD.TIME_SPENT })
  timeSpent: number;

  @ApiProperty({
    enum: kbnValues(SubtaskStatusKbn),
    example: SubtaskStatusKbn.IN_PROGRESS,
    description: API_DOC.FIELD.SUBTASK_STATUS,
  })
  statusKbn: SubtaskStatusKbn;

  @ApiProperty({
    example: LABEL.SUBTASK_STATUS[SubtaskStatusKbn.IN_PROGRESS],
    description: API_DOC.FIELD.SUBTASK_STATUS_LABEL,
  })
  status: string;
}

/** Một task trong danh sách (GET /tasks), không kèm task con. */
export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  uuid: string;

  @ApiProperty({ example: API_DOC.EXAMPLE.TITLE })
  title: string;

  @ApiProperty({ example: API_DOC.EXAMPLE.DESCRIPTION })
  description: string;

  @ApiProperty({
    enum: kbnValues(TaskStatusKbn),
    example: TaskStatusKbn.TO_DO,
    description: API_DOC.FIELD.TASK_STATUS,
  })
  statusKbn: TaskStatusKbn;

  @ApiProperty({
    example: LABEL.TASK_STATUS[TaskStatusKbn.TO_DO],
    description: API_DOC.FIELD.TASK_STATUS_LABEL,
  })
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

/** Một task kèm danh sách task con (tạo, xem, sửa một task). */
export class TaskWithSubtasksResponseDto extends TaskResponseDto {
  @ApiProperty({ type: [SubtaskResponseDto] })
  subtasks: SubtaskResponseDto[];
}
