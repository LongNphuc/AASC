import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitrixModule } from './bitrix/bitrix.module';
import { ApiKeyGuard } from './common/auth/api-key.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestLoggingMiddleware } from './common/logging/request-logging.middleware';
import { validationExceptionFactory } from './common/validation/validation-exception.factory';
import { appConfig, type AppConfig } from './config/app-config';
import { ContactsModule } from './contacts/contacts.module';
import { HealthModule } from './health/health.module';
import { JotformModule } from './jotform/jotform.module';

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
    ScheduleModule.forRoot(),
    BitrixModule,
    ContactsModule,
    JotformModule,
    HealthModule,
  ],
  providers: [
    // Đăng ký toàn cục qua DI (thay vì trong main.ts) để e2e test cũng có.
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // bỏ trường không khai báo trong DTO...
        forbidNonWhitelisted: true, // ...và báo lỗi nếu client gửi lên
        transform: true, // đổi body thành instance của DTO
        stopAtFirstError: true, // mỗi trường chỉ báo một lỗi
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
