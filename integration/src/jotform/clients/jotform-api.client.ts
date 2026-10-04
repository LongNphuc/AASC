import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { isAxiosError, Method } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  classifyTransportError,
  ExternalApiError,
  ExternalErrorKind,
} from '../../common/errors/external-api.error';
import { errorKbnOf } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { appConfig, type AppConfig } from '../../config/app-config';
import { JotformApiResponse, JotformSubmission } from '../types/jotform.types';
import { ERROR, WARN } from '../../common/constants/messages.constant';

interface RequestOptions {
  params?: Record<string, string | number>;
  form?: Record<string, string>;
}

/**
 * Gọi Jotform REST API (https://api.jotform.com/docs/).
 * API key gửi qua header APIKEY thay vì query string, để không lọt vào log.
 * Mỗi lệnh gọi được ghi vào logs/services/service_jotform.log.
 */
@Injectable()
export class JotformApiClient {
  private readonly logger = new ServiceLogger(
    LogService.JOTFORM,
    JotformApiClient.name,
  );

  constructor(
    private readonly http: HttpService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  getSubmission(submissionId: string): Promise<JotformSubmission> {
    return this.request(
      'GET',
      `/submission/${encodeURIComponent(submissionId)}`,
    );
  }

  /** Submission mới nhất trước. */
  listSubmissions(formId: string, limit: number): Promise<JotformSubmission[]> {
    return this.request(
      'GET',
      `/form/${encodeURIComponent(formId)}/submissions`,
      {
        params: { limit, offset: 0, orderby: 'created_at' },
      },
    );
  }

  /** Danh sách webhook của form, dạng { "0": "https://..." }. */
  listWebhooks(formId: string): Promise<Record<string, string>> {
    return this.request('GET', `/form/${encodeURIComponent(formId)}/webhooks`);
  }

  createWebhook(
    formId: string,
    webhookUrl: string,
  ): Promise<Record<string, string>> {
    return this.request(
      'POST',
      `/form/${encodeURIComponent(formId)}/webhooks`,
      {
        form: { webhookURL: webhookUrl },
      },
    );
  }

  private async request<T>(
    method: Method,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const { apiKey, apiBaseUrl } = this.config.jotform;
    if (!apiKey) {
      throw new ExternalApiError(
        'jotform',
        'CONFIG',
        ERROR.JOTFORM.API_KEY_NOT_CONFIGURED,
        {
          operation: path,
        },
      );
    }

    const startedAt = Date.now();
    try {
      const response = await firstValueFrom(
        this.http.request<JotformApiResponse<T>>({
          method,
          url: `${apiBaseUrl}${path}`,
          headers: { APIKEY: apiKey },
          params: options.params,
          data: options.form ? new URLSearchParams(options.form) : undefined,
        }),
      );
      const body = response.data;
      if (!body || typeof body !== 'object' || body.responseCode !== 200) {
        throw this.fromStatus(
          body?.responseCode ?? response.status,
          body?.message,
          path,
        );
      }
      this.logger.record({
        method: `${method} ${path}`,
        statusKbn: StatusKbn.SUCCESS,
        durationMs: Date.now() - startedAt,
      });
      return body.content;
    } catch (error) {
      const normalized = this.normalize(error, path);
      this.logger.record({
        method: `${method} ${path}`,
        statusKbn: StatusKbn.FAILED,
        errorKbn: errorKbnOf(normalized),
        durationMs: Date.now() - startedAt,
        errorDetail: normalized.message,
      });
      this.logger.warn(
        WARN.EXTERNAL.CALL_FAILED(
          `${method} ${path}`,
          normalized.kind,
          normalized.message,
        ),
      );
      throw normalized;
    }
  }

  private normalize(error: unknown, path: string): ExternalApiError {
    if (error instanceof ExternalApiError) {
      return error;
    }
    const transport = classifyTransportError(error, 'jotform', path);
    if (transport) {
      return transport;
    }
    if (isAxiosError(error) && error.response) {
      const data = error.response.data as
        Partial<JotformApiResponse<unknown>> | undefined;
      return this.fromStatus(error.response.status, data?.message, path);
    }
    return new ExternalApiError(
      'jotform',
      'INVALID_RESPONSE',
      ERROR.EXTERNAL.UNKNOWN('jotform', path, String(error)),
      { operation: path },
    );
  }

  private fromStatus(
    status: number,
    upstreamMessage: string | undefined,
    path: string,
  ): ExternalApiError {
    const [kind, message] = describeStatus(status, path);
    return new ExternalApiError('jotform', kind, message, {
      operation: path,
      upstreamStatus: status,
      upstreamMessage,
    });
  }
}

function describeStatus(
  status: number,
  path: string,
): [ExternalErrorKind, string] {
  if (status === 401 || status === 403) {
    return ['AUTH', ERROR.JOTFORM.HTTP.AUTH(path)];
  }
  if (status === 404) return ['NOT_FOUND', ERROR.JOTFORM.HTTP.NOT_FOUND(path)];
  if (status === 429)
    return ['RATE_LIMIT', ERROR.JOTFORM.HTTP.RATE_LIMIT(path)];
  if (status >= 500) return ['SERVER', ERROR.JOTFORM.HTTP.SERVER(path)];
  return ['BAD_REQUEST', ERROR.JOTFORM.HTTP.BAD_REQUEST(path, status)];
}
