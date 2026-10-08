import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../types/auth.types';

/** Request HTTP sau khi qua JwtAuthGuard có thêm `user`. */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * Chỉ cho request có header `Authorization: Bearer <token>` hợp lệ đi qua,
 * và gắn người dùng vào request.user. Dùng: @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.header('authorization') ?? '').split(' ');
    request.user = await this.auth.verifyToken(
      scheme?.toLowerCase() === 'bearer' ? token : undefined,
    );
    return true;
  }
}
