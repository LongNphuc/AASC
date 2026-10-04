import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { appConfig, type AppConfig } from '../../config/app-config';
import { AppConfigException } from '../errors/app-config.exception';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ERROR } from '../constants/messages.constant';

export const API_KEY_HEADER = 'x-api-key';

/**
 * Guard toàn cục: mọi endpoint đều cần header `x-api-key` đúng với API_KEY,
 * trừ endpoint gắn @Public(). Bảo vệ mặc định giúp endpoint mới thêm vào
 * không bị lộ do quên gắn guard.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // Thiếu cấu hình thì từ chối tất cả, không mở cửa.
    if (!this.config.apiKey) {
      throw new AppConfigException(ERROR.AUTH.API_KEY_NOT_CONFIGURED);
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header(API_KEY_HEADER);
    if (!provided || !this.safeEquals(provided, this.config.apiKey)) {
      throw new UnauthorizedException(
        ERROR.AUTH.API_KEY_INVALID(API_KEY_HEADER),
      );
    }
    return true;
  }

  /**
   * So sánh trong thời gian không đổi để tránh dò khóa qua thời gian phản hồi.
   * Băm trước để hai chuỗi luôn cùng độ dài, đúng yêu cầu của timingSafeEqual.
   */
  private safeEquals(a: string, b: string): boolean {
    const hash = (value: string) => createHash('sha256').update(value).digest();
    return timingSafeEqual(hash(a), hash(b));
  }
}
