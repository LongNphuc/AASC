import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  classifyTransportError,
  ExternalApiError,
} from '../../common/errors/external-api.error';
import { errorKbnOf } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { appConfig, type AppConfig } from '../../config/app-config';
import {
  BitrixErrorBody,
  BitrixOAuthTokenResponse,
  BitrixTokenSet,
  computeExpiresAt,
} from '../types/bitrix.types';
import { ERROR } from '../../common/constants/messages.constant';

type GrantType = 'authorization_code' | 'refresh_token';

// refresh_token hết hạn, đã dùng rồi, hoặc ứng dụng đã bị gỡ.
const INVALID_GRANT_CODES = new Set([
  'invalid_grant',
  'expired_token',
  'invalid_token',
  'NO_AUTH_FOUND',
]);

/**
 * Làm việc với máy chủ OAuth của Bitrix24 (oauth.bitrix.info):
 * - đổi `code` lấy token (grant_type=authorization_code);
 * - làm mới token (grant_type=refresh_token). Mỗi lần làm mới, Bitrix24 cấp
 *   một refresh_token MỚI và vô hiệu hóa cái cũ, nên bên gọi phải lưu lại ngay.
 *
 * Cả hai đều cần client_secret, nên chỉ chạy ở backend.
 * Mỗi lần gọi được ghi vào logs/services/service_auth.log.
 */
@Injectable()
export class BitrixOAuthClient {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    BitrixOAuthClient.name,
  );

  constructor(
    private readonly http: HttpService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  exchangeCode(code: string): Promise<BitrixTokenSet> {
    return this.requestToken('authorization_code', { code });
  }

  refreshToken(refreshToken: string): Promise<BitrixTokenSet> {
    return this.requestToken('refresh_token', { refresh_token: refreshToken });
  }

  /** Gọi máy chủ OAuth và ghi kết quả vào log service. */
  private async requestToken(
    grantType: GrantType,
    grantParams: Record<string, string>,
  ): Promise<BitrixTokenSet> {
    const method = `oauth ${grantType}`;
    const startedAt = Date.now();
    try {
      const tokens = await this.fetchToken(grantType, grantParams);
      this.logger.record({
        method,
        statusKbn: StatusKbn.SUCCESS,
        durationMs: Date.now() - startedAt,
      });
      return tokens;
    } catch (error) {
      this.logger.record({
        method,
        statusKbn: StatusKbn.FAILED,
        errorKbn: errorKbnOf(error),
        durationMs: Date.now() - startedAt,
        errorDetail: (error as Error).message,
      });
      throw error;
    }
  }

  private async fetchToken(
    grantType: GrantType,
    grantParams: Record<string, string>,
  ): Promise<BitrixTokenSet> {
    const { clientId, clientSecret, oauthTokenUrl } = this.config.bitrix;
    if (!clientId || !clientSecret) {
      throw new ExternalApiError(
        'bitrix24-oauth',
        'CONFIG',
        ERROR.OAUTH.CLIENT_NOT_CONFIGURED,
        { operation: grantType },
      );
    }

    let data: BitrixOAuthTokenResponse & BitrixErrorBody;
    try {
      const response = await firstValueFrom(
        this.http.get<BitrixOAuthTokenResponse & BitrixErrorBody>(
          oauthTokenUrl,
          {
            params: {
              grant_type: grantType,
              client_id: clientId,
              client_secret: clientSecret,
              ...grantParams,
            },
          },
        ),
      );
      data = response.data;
    } catch (error) {
      throw this.toOAuthError(error, grantType);
    }

    if (data?.error) {
      throw this.fromOAuthErrorBody(undefined, data, grantType);
    }
    if (!data?.access_token || !data.refresh_token || !data.client_endpoint) {
      throw new ExternalApiError(
        'bitrix24-oauth',
        'INVALID_RESPONSE',
        ERROR.OAUTH.INCOMPLETE_RESPONSE,
        { operation: grantType },
      );
    }
    return this.toTokenSet(data);
  }

  /**
   * `domain` trong phản hồi là oauth.bitrix.info (máy chủ OAuth), nên tên miền
   * portal phải lấy từ host của client_endpoint.
   */
  private toTokenSet(data: BitrixOAuthTokenResponse): BitrixTokenSet {
    return {
      memberId: data.member_id,
      domain: new URL(data.client_endpoint).host,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: computeExpiresAt(data.expires, data.expires_in),
      scope: data.scope,
      userId: data.user_id ? Number(data.user_id) : undefined,
    };
  }

  private toOAuthError(error: unknown, grantType: GrantType): ExternalApiError {
    const transport = classifyTransportError(
      error,
      'bitrix24-oauth',
      grantType,
    );
    if (transport) {
      return transport;
    }
    if (isAxiosError(error) && error.response) {
      return this.fromOAuthErrorBody(
        error.response.status,
        (error.response.data ?? {}) as BitrixErrorBody,
        grantType,
      );
    }
    return new ExternalApiError(
      'bitrix24-oauth',
      'INVALID_RESPONSE',
      ERROR.EXTERNAL.UNKNOWN('bitrix24-oauth', grantType, String(error)),
      { operation: grantType },
    );
  }

  private fromOAuthErrorBody(
    status: number | undefined,
    body: BitrixErrorBody,
    grantType: GrantType,
  ): ExternalApiError {
    const code = body.error ?? '';
    const details = {
      operation: grantType,
      upstreamStatus: status,
      upstreamCode: code || undefined,
      upstreamMessage: body.error_description,
    };

    if (code === 'invalid_client') {
      return new ExternalApiError(
        'bitrix24-oauth',
        'CONFIG',
        ERROR.OAUTH.INVALID_CLIENT,
        details,
      );
    }
    if (INVALID_GRANT_CODES.has(code)) {
      return grantType === 'refresh_token'
        ? new ExternalApiError(
            'bitrix24-oauth',
            'REINSTALL_REQUIRED',
            ERROR.OAUTH.REINSTALL_REQUIRED,
            details,
          )
        : new ExternalApiError(
            'bitrix24-oauth',
            'AUTH',
            ERROR.OAUTH.CODE_INVALID,
            details,
          );
    }
    const kind = status !== undefined && status >= 500 ? 'SERVER' : 'AUTH';
    return new ExternalApiError(
      'bitrix24-oauth',
      kind,
      ERROR.OAUTH.REJECTED(body.error_description || code || `HTTP ${status}`),
      details,
    );
  }
}
