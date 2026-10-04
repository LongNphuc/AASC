import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { redactSecrets } from '../../common/logging/redact';
import { BitrixInstallService } from '../services/bitrix-install.service';
import { renderInstallPage } from '../views/install-page';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { LOG } from '../../common/constants/messages.constant';

/**
 * Endpoint Bitrix24 gọi khi cài đặt/cài lại ứng dụng cục bộ. Không cần API key
 * (Bitrix24 không gửi được header đó). Tính xác thực được kiểm tra bằng cách
 * gọi app.info với token nhận được, xem BitrixInstallService.
 *
 * Ẩn khỏi Swagger: chỉ Bitrix24 gọi endpoint này; gọi tay luôn bị từ chối vì
 * không có token thật. Tài liệu nằm ở readme_api.md.
 */
@ApiExcludeController()
@Public()
@Controller('install')
export class InstallController {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    InstallController.name,
  );

  constructor(private readonly installService: BitrixInstallService) {}

  @Post()
  handlePost(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  @Get()
  handleGet(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.handle(req, res);
  }

  private async handle(req: Request, res: Response): Promise<void> {
    // Ghi lại dạng request thật (đã che token) để biết portal gửi dạng nào.
    this.logger.log(
      LOG.INSTALL.REQUEST_RECEIVED(
        JSON.stringify(
          redactSecrets({
            method: req.method,
            contentType: req.header('content-type'),
            query: req.query,
            body: req.body as unknown,
          }),
        ),
      ),
    );

    const outcome = await this.installService.handleInstall(
      req.query,
      (req.body ?? {}) as Record<string, unknown>,
    );

    // Sự kiện từ máy chủ Bitrix24 chỉ cần mã 200; dạng còn lại hiển thị trong trình duyệt.
    if (outcome.kind === 'event') {
      res.json({ status: 'ok', domain: outcome.domain, isNew: outcome.isNew });
      return;
    }
    res.type('html').send(renderInstallPage(outcome));
  }
}
