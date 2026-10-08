import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Line98Game } from './entities/line98-game.entity';
import { Line98Gateway } from './gateways/line98.gateway';
import { Line98Service } from './services/line98.service';

/** Trò chơi Line 98: WebSocket /line98, lưu ván vào bảng line98_games. */
@Module({
  imports: [TypeOrmModule.forFeature([Line98Game]), AuthModule],
  providers: [Line98Gateway, Line98Service],
})
export class Line98Module {}
