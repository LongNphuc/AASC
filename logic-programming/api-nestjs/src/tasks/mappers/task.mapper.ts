import { LABEL } from '../../common/constants/messages.constant';
import { SubtaskStatusKbn } from '../../common/kbn/status.kbn';
import { SubtaskDto } from '../dto/subtask.dto';
import {
  SubtaskResponseDto,
  TaskResponseDto,
  TaskWithSubtasksResponseDto,
} from '../dto/task-response.dto';
import { TaskDetail } from '../entities/task-detail.entity';
import { Task } from '../entities/task.entity';
import { SubtaskJson } from '../types/task.types';

/**
 * Làm tròn số giờ tới 2 chữ số thập phân. Cộng Number.EPSILON để số như 1.005
 * (thật ra lưu là 1.00499...) làm tròn đúng thành 1.01.
 */
export function roundHours(hours: number): number {
  return Math.round((hours + Number.EPSILON) * 100) / 100;
}

/** Task con gửi lên → phần tử lưu trong data_json (điền giá trị mặc định). */
export function toSubtaskJson(dto: SubtaskDto): SubtaskJson {
  return {
    task_name: dto.taskName,
    time_estimate: roundHours(dto.timeEstimate),
    time_spent: roundHours(dto.timeSpent ?? 0),
    status_kbn: dto.statusKbn ?? SubtaskStatusKbn.IN_PROGRESS,
  };
}

/** Phần tử data_json → task con trả về, kèm chữ hiển thị của trạng thái. */
export function toSubtaskResponse(json: SubtaskJson): SubtaskResponseDto {
  return {
    taskName: json.task_name,
    timeEstimate: json.time_estimate,
    timeSpent: json.time_spent,
    statusKbn: json.status_kbn,
    status: LABEL.SUBTASK_STATUS[json.status_kbn],
  };
}

/** Task → một dòng trong danh sách (không kèm task con). */
export function toTaskResponse(task: Task): TaskResponseDto {
  return {
    uuid: task.uuid,
    title: task.title,
    description: task.description,
    statusKbn: task.statusKbn,
    status: LABEL.TASK_STATUS[task.statusKbn],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

/** Task cùng dòng task_details của nó → task kèm danh sách task con. */
export function toTaskWithSubtasksResponse(
  task: Task,
  detail: TaskDetail,
): TaskWithSubtasksResponseDto {
  return {
    ...toTaskResponse(task),
    subtasks: detail.dataJson.map(toSubtaskResponse),
  };
}
