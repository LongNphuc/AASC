import { Inject, Injectable } from '@nestjs/common';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { appConfig, type AppConfig } from '../../config/app-config';
import { BitrixHttpClient } from './bitrix-http.client';
import { ERROR } from '../../common/constants/messages.constant';

/**
 * Gọi Bitrix24 qua webhook vào (File 1). Khác OAuth, webhook vào là một URL cố
 * định chứa sẵn mã xác thực, không có token để làm mới và không có callback.
 *
 * URL webhook là bí mật: không ghi ra log (logger tự che phần mã trong URL).
 */
@Injectable()
export class BitrixWebhookClient {
  constructor(
    private readonly http: BitrixHttpClient,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  async call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    const baseUrl = this.config.bitrix.webhookUrl;
    if (!baseUrl) {
      throw new ExternalApiError(
        'bitrix24',
        'CONFIG',
        ERROR.BITRIX.WEBHOOK_NOT_CONFIGURED,
        { operation: method },
      );
    }

    try {
      const url = `${baseUrl.replace(/\/+$/, '')}/${method}.json`;
      return (await this.http.post<T>(url, payload, method, 'webhook')).result;
    } catch (error) {
      // Thêm gợi ý khắc phục cho lỗi xác thực, lỗi phổ biến nhất của webhook.
      if (error instanceof ExternalApiError && error.kind === 'AUTH') {
        throw new ExternalApiError(
          error.service,
          error.kind,
          ERROR.BITRIX.WEBHOOK_AUTH_HINT(error.message),
          error.details,
        );
      }
      throw error;
    }
  }
}
