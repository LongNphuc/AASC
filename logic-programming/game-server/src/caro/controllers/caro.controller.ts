import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import type { AuthUser } from '../../auth/types/auth.types';
import { CaroService } from '../services/caro.service';
import type { CaroHistoryItem } from '../types/caro.types';

/** Lịch sử trận cờ caro của người đang đăng nhập. */
@Controller('caro')
@UseGuards(JwtAuthGuard)
export class CaroController {
  constructor(private readonly caro: CaroService) {}

  /** GET /caro/matches → 20 trận gần nhất. */
  @Get('matches')
  history(@CurrentUser() user: AuthUser): Promise<CaroHistoryItem[]> {
    return this.caro.history(user.uuid);
  }
}
