import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { API_DOC } from '../../common/constants/messages.constant';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import {
  DataResponse,
  EmptyResponse,
  ListResponse,
  ok,
  okEmpty,
  okList,
} from '../../common/response/api-response';
import {
  ApiDataResponse,
  ApiEmptyResponse,
  ApiErrorResponse,
  ApiListResponse,
} from '../../common/response/api-response.swagger';
import { CreateTaskDto } from '../dto/create-task.dto';
import {
  TaskResponseDto,
  TaskWithSubtasksResponseDto,
} from '../dto/task-response.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskUuidPipe } from '../pipes/task-uuid.pipe';
import { TasksService } from '../services/tasks.service';

/**
 * API RESTful quản lý task (Controller của MVC): nhận request HTTP, gọi
 * TasksService, bọc kết quả vào body { r, d | l } (xem api-response.ts).
 * Body đã được ValidationPipe kiểm tra trước khi vào đây; tham số :uuid được
 * TaskUuidPipe kiểm tra.
 */
@ApiTags('Tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  @ApiOperation({ summary: API_DOC.TASK.CREATE })
  @ApiDataResponse(TaskWithSubtasksResponseDto, HttpStatus.CREATED)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, [ErrorKbn.VALIDATION])
  async create(
    @Body() dto: CreateTaskDto,
  ): Promise<DataResponse<TaskWithSubtasksResponseDto>> {
    return ok(await this.tasks.create(dto));
  }

  @Get()
  @ApiOperation({ summary: API_DOC.TASK.LIST })
  @ApiListResponse(TaskResponseDto)
  async findAll(): Promise<ListResponse<TaskResponseDto>> {
    return okList(await this.tasks.findAll());
  }

  @Get(':uuid')
  @ApiOperation({ summary: API_DOC.TASK.GET })
  @ApiParam({ name: 'uuid', description: API_DOC.TASK.UUID })
  @ApiDataResponse(TaskWithSubtasksResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, [ErrorKbn.VALIDATION])
  @ApiErrorResponse(HttpStatus.NOT_FOUND, [ErrorKbn.TASK_NOT_FOUND])
  async findOne(
    @Param('uuid', TaskUuidPipe) uuid: string,
  ): Promise<DataResponse<TaskWithSubtasksResponseDto>> {
    return ok(await this.tasks.findOne(uuid));
  }

  @Patch(':uuid')
  @ApiOperation({ summary: API_DOC.TASK.UPDATE })
  @ApiParam({ name: 'uuid', description: API_DOC.TASK.UUID })
  @ApiDataResponse(TaskWithSubtasksResponseDto)
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, [
    ErrorKbn.VALIDATION,
    ErrorKbn.NOTHING_TO_UPDATE,
  ])
  @ApiErrorResponse(HttpStatus.NOT_FOUND, [ErrorKbn.TASK_NOT_FOUND])
  async update(
    @Param('uuid', TaskUuidPipe) uuid: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<DataResponse<TaskWithSubtasksResponseDto>> {
    return ok(await this.tasks.update(uuid, dto));
  }

  @Delete(':uuid')
  @ApiOperation({ summary: API_DOC.TASK.DELETE })
  @ApiParam({ name: 'uuid', description: API_DOC.TASK.UUID })
  @ApiEmptyResponse()
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, [ErrorKbn.VALIDATION])
  @ApiErrorResponse(HttpStatus.NOT_FOUND, [ErrorKbn.TASK_NOT_FOUND])
  async remove(
    @Param('uuid', TaskUuidPipe) uuid: string,
  ): Promise<EmptyResponse> {
    await this.tasks.remove(uuid);
    return okEmpty();
  }
}
