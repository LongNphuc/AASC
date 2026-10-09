import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksController } from './controllers/tasks.controller';
import { TaskDetail } from './entities/task-detail.entity';
import { Task } from './entities/task.entity';
import { TasksService } from './services/tasks.service';

/** Quản lý Task: bảng tasks, task_details và API /tasks. */
@Module({
  imports: [TypeOrmModule.forFeature([Task, TaskDetail])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
