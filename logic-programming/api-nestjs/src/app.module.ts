import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { createValidationPipe } from './common/validation/validation.pipe';
import { appConfig, type AppConfig } from './config/app-config';
import { TasksModule } from './tasks/tasks.module';

/**
 * Module gốc. Mô hình MVC:
 * - Model: entity TypeORM (tasks, task_details) trên SQLite.
 * - Controller: TasksController nhận request HTTP.
 * - Service: TasksService chứa nghiệp vụ.
 * (Không có giao diện: client là Swagger tại /docs hoặc Postman, cURL.)
 *
 * Đăng ký toàn cục: filter trả lỗi JSON thống nhất, ValidationPipe kiểm tra
 * body theo DTO, middleware ghi log mỗi request.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, load: [appConfig] }),
    TypeOrmModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => ({
        type: 'better-sqlite3',
        database: config.databasePath,
        autoLoadEntities: true,
        // Tự tạo bảng từ entity cho gọn khi chạy demo. Production nên dùng migration.
        synchronize: true,
      }),
    }),
    TasksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useValue: createValidationPipe() },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('{*splat}');
  }
}
