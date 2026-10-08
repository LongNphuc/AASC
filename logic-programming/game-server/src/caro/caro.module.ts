import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CaroController } from './controllers/caro.controller';
import { CaroMatch } from './entities/caro-match.entity';
import { CaroGateway } from './gateways/caro.gateway';
import { CaroService } from './services/caro.service';

/** Cờ caro trực tuyến: WebSocket /caro, lịch sử trận GET /caro/matches. */
@Module({
  imports: [TypeOrmModule.forFeature([CaroMatch]), AuthModule],
  controllers: [CaroController],
  providers: [CaroGateway, CaroService],
})
export class CaroModule {}
