import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { appConfig, type AppConfig } from '../../config/app-config';
import { BitrixOAuthClient } from '../clients/bitrix-oauth.client';
import { BitrixTokenService } from './bitrix-token.service';
import { BitrixService } from './bitrix.service';
import { BitrixTokenSet } from '../types/bitrix.types';
import {
  parseInstallPayload,
  ParsedInstall,
} from '../parsers/install-payload.parser';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { ERROR, LOG, WARN } from '../../common/constants/messages.constant';

interface BitrixAppInfo {
  CODE?: string;
  INSTALLED?: boolean;
}

interface BitrixUser {
  ID: string;
  NAME?: string;
  LAST_NAME?: string;
  EMAIL?: string;
}

export interface InstallOutcome {
  kind: ParsedInstall['kind'];
  domain: string;
  memberId: string;
  isNew: boolean;
  /** Ứng dụng có giao diện đang ở bước cài: trang trả về phải gọi BX24.installFinish(). */
  needsInstallFinish: boolean;
}

/**
 * Xử lý sự kiện cài đặt và cài đặt lại ứng dụng trên Bitrix24.
 *
 * Các bước:
 * 1. Nhận dạng dữ liệu (event / iframe / code). Với `code` thì đổi lấy token.
 * 2. Chỉ chấp nhận portal khai báo trong BITRIX24_DOMAIN.
 * 3. Gọi app.info bằng chính token vừa nhận để xác minh token thật, tránh việc
 *    ai đó POST token giả vào /install để ghi đè token đang dùng.
 * 4. Lưu token (upsert theo member_id).
 * 5. Ghi nhận người cài qua user.current (không bắt buộc, lỗi thì bỏ qua).
 */
@Injectable()
export class BitrixInstallService {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    BitrixInstallService.name,
  );

  constructor(
    private readonly oauth: BitrixOAuthClient,
    private readonly tokens: BitrixTokenService,
    private readonly bitrix: BitrixService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  async handleInstall(
    query: Record<string, unknown>,
    body: Record<string, unknown>,
  ): Promise<InstallOutcome> {
    const parsed = parseInstallPayload(query, body);
    if (!parsed) {
      throw new BadRequestException(ERROR.INSTALL.UNRECOGNIZED_PAYLOAD);
    }
    this.logger.log(LOG.INSTALL.PAYLOAD_KIND(parsed.kind));

    const tokens =
      parsed.kind === 'code'
        ? await this.oauth.exchangeCode(parsed.code)
        : parsed.tokens;
    this.assertAllowedDomain(tokens.domain);

    const appInfo = await this.bitrix.callWithToken<BitrixAppInfo>(
      tokens.domain,
      tokens.accessToken,
      'app.info',
    );

    const { isNew } = await this.tokens.saveTokens(tokens);
    this.logger.log(
      LOG.INSTALL.SAVED(
        isNew,
        tokens.domain,
        tokens.memberId,
        tokens.expiresAt.toISOString(),
      ),
    );
    await this.recordInstaller(tokens);

    return {
      kind: parsed.kind,
      domain: tokens.domain,
      memberId: tokens.memberId,
      isNew,
      needsInstallFinish:
        parsed.kind === 'iframe' && appInfo.result.INSTALLED === false,
    };
  }

  /**
   * Chỉ nhận cài đặt từ portal đã cấu hình. Tên miền này còn dùng để dựng URL
   * gọi REST, nên kiểm tra nó cũng chặn việc dữ liệu giả lái request của máy
   * chủ tới một địa chỉ tùy ý (SSRF).
   */
  private assertAllowedDomain(domain: string): void {
    const allowed = this.config.bitrix.domain?.toLowerCase();
    if (!allowed) {
      throw new ExternalApiError(
        'bitrix24',
        'CONFIG',
        ERROR.INSTALL.DOMAIN_NOT_CONFIGURED,
      );
    }
    if (domain.toLowerCase() !== allowed) {
      throw new ForbiddenException(ERROR.INSTALL.DOMAIN_NOT_ALLOWED(domain));
    }
  }

  private async recordInstaller(tokens: BitrixTokenSet): Promise<void> {
    try {
      const { result: user } = await this.bitrix.callWithToken<BitrixUser>(
        tokens.domain,
        tokens.accessToken,
        'user.current',
      );
      const name =
        [user.NAME, user.LAST_NAME].filter(Boolean).join(' ') ||
        user.EMAIL ||
        `#${user.ID}`;
      await this.tokens.updateInstaller(tokens.memberId, Number(user.ID), name);
      this.logger.log(LOG.INSTALL.INSTALLER(name, user.ID));
    } catch (error) {
      this.logger.warn(
        WARN.INSTALL.INSTALLER_UNAVAILABLE((error as Error).message),
      );
    }
  }
}
