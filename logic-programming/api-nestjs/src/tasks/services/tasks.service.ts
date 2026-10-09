import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { LOG } from '../../common/constants/messages.constant';
import { AppException } from '../../common/errors/app.exception';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { TaskStatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { CreateTaskDto } from '../dto/create-task.dto';
import {
  TaskResponseDto,
  TaskWithSubtasksResponseDto,
} from '../dto/task-response.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskDetail } from '../entities/task-detail.entity';
import { Task } from '../entities/task.entity';
import {
  toSubtaskJson,
  toTaskResponse,
  toTaskWithSubtasksResponse,
} from '../mappers/task.mapper';

/** Task đã nạp kèm dòng task_details. */
type TaskWithDetail = Task & { detail: TaskDetail };

/**
 * Nghiệp vụ Task (Service của MVC): thêm, đọc, sửa, xóa mềm. Mỗi task gồm một
 * dòng tasks và một dòng task_details (danh sách task con trong data_json).
 */
@Injectable()
export class TasksService {
  private readonly logger = new ServiceLogger(
    LogService.TASK,
    TasksService.name,
  );

  constructor(
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    private readonly dataSource: DataSource,
  ) {}

  /** Tạo task cùng dòng task_details; không gửi task con thì data_json = []. */
  async create(dto: CreateTaskDto): Promise<TaskWithSubtasksResponseDto> {
    // Hai bảng ghi trong một transaction: lỗi giữa chừng thì không còn dòng dở dang.
    const { task, detail } = await this.dataSource.transaction(
      async (manager) => {
        const detail = await manager.save(
          manager.create(TaskDetail, {
            dataJson: (dto.subtasks ?? []).map(toSubtaskJson),
          }),
        );
        const task = await manager.save(
          manager.create(Task, {
            title: dto.title,
            description: dto.description ?? '',
            statusKbn: dto.statusKbn ?? TaskStatusKbn.TO_DO,
            taskDetailUuid: detail.uuid,
          }),
        );
        return { task, detail };
      },
    );
    this.logger.log(LOG.TASK.CREATED(task.uuid));
    return toTaskWithSubtasksResponse(task, detail);
  }

  /**
   * Danh sách task chưa xóa, mới nhất trước. Chỉ đọc bảng tasks (không đọc
   * data_json) để nhanh; xem task con qua findOne.
   */
  async findAll(): Promise<TaskResponseDto[]> {
    const tasks = await this.tasks.find({ order: { createdAt: 'DESC' } });
    return tasks.map(toTaskResponse);
  }

  async findOne(uuid: string): Promise<TaskWithSubtasksResponseDto> {
    const task = await this.requireTask(uuid);
    return toTaskWithSubtasksResponse(task, task.detail);
  }

  /**
   * Chỉ sửa trường được gửi. Gửi subtasks thì ghi đè toàn bộ data_json bằng
   * danh sách mới (không sửa từng phần tử).
   */
  async update(
    uuid: string,
    dto: UpdateTaskDto,
  ): Promise<TaskWithSubtasksResponseDto> {
    const { title, description, statusKbn, subtasks } = dto;
    if (
      [title, description, statusKbn, subtasks].every((v) => v === undefined)
    ) {
      throw new AppException(ErrorKbn.NOTHING_TO_UPDATE);
    }
    const task = await this.requireTask(uuid);

    await this.dataSource.transaction(async (manager) => {
      if (subtasks !== undefined) {
        task.detail.dataJson = subtasks.map(toSubtaskJson);
        await manager.save(task.detail);
      }
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (statusKbn !== undefined) task.statusKbn = statusKbn;
      // Sửa thành công thì luôn tính là task vừa được cập nhật, kể cả khi chỉ
      // đổi task con (nằm ở bảng task_details).
      task.updatedAt = new Date();
      await manager.save(task);
    });
    this.logger.log(LOG.TASK.UPDATED(uuid));
    return toTaskWithSubtasksResponse(task, task.detail);
  }

  /** Xóa mềm: ghi deleted_at. Task không tồn tại hoặc đã xóa thì 404. */
  async remove(uuid: string): Promise<void> {
    const result = await this.tasks.softDelete({ uuid, deletedAt: IsNull() });
    if (!result.affected) {
      throw notFound(uuid);
    }
    this.logger.log(LOG.TASK.DELETED(uuid));
  }

  /** Task chưa xóa kèm task_details; không có thì 404. */
  private async requireTask(uuid: string): Promise<TaskWithDetail> {
    const task = await this.tasks.findOne({
      where: { uuid },
      relations: { detail: true },
    });
    if (!task?.detail) {
      throw notFound(uuid);
    }
    return task as TaskWithDetail;
  }
}

/** 404, trả uuid không tìm thấy ở `d`. */
function notFound(uuid: string): AppException {
  return new AppException(ErrorKbn.TASK_NOT_FOUND, HttpStatus.NOT_FOUND, {
    uuid,
  });
}
