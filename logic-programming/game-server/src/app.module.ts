import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CaroModule } from './caro/caro.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { appConfig, type AppConfig } from './config/app-config';
import { Line98Module } from './line98/line98.module';
import { UsersModule } from './users/users.module';

/**
 * Module gốc: ghép các module (MVC):
 * - Model: entity TypeORM (users, line98_games, caro_matches) trên SQLite.
 * - View: client HTML5 Canvas trong thư mục public/ (main.ts phục vụ).
 * - Controller: controller HTTP và gateway WebSocket của từng module.
 * - Service + engine: nghiệp vụ và luật chơi.
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
    UsersModule,
    AuthModule,
    Line98Module,
    CaroModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        stopAtFirstError: true,
        exceptionFactory: validationExceptionFactory,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('{*splat}');
  }
}
