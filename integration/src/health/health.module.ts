import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';

/** GET /health: kiểm tra ứng dụng đang chạy. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
