import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { errorKbnOf } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { fromErrorBody, toBitrixError } from '../mappers/bitrix-error.mapper';
import { BitrixResponse } from '../types/bitrix.types';
import { WARN } from '../../common/constants/messages.constant';

const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BASE_DELAY_MS = 1000;

/** Cách xác thực của lệnh gọi: OAuth (File 2) hay webhook vào (File 1). */
export type BitrixChannel = 'oauth' | 'webhook';

/**
 * Tầng HTTP thấp nhất để gọi Bitrix24 REST, dùng chung cho cả OAuth (File 2)
 * lẫn webhook vào (File 1). Nhiệm vụ:
 * - gửi POST JSON tới đúng URL;
 * - chuẩn hóa mọi lỗi thành ExternalApiError;
 * - tự thử lại khi bị giới hạn tần suất (QUERY_LIMIT_EXCEEDED). Thử lại an toàn
 *   vì Bitrix24 từ chối request đó trước khi xử lý;
 * - ghi mỗi lệnh gọi vào logs/services/service_bitrix.log.
 *
 * Lớp này không biết gì về token: bên gọi tự đưa `auth` vào body nếu cần.
 * Đặt token trong body (không đặt trên URL) để token không lọt vào access log.
 */
@Injectable()
export class BitrixHttpClient {
  private readonly logger = new ServiceLogger(
    LogService.BITRIX,
    BitrixHttpClient.name,
  );

  constructor(private readonly http: HttpService) {}

  async post<T>(
    url: string,
    body: Record<string, unknown>,
    operation: string,
    channel: BitrixChannel,
  ): Promise<BitrixResponse<T>> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.send<T>(url, body, operation, channel);
      } catch (error) {
        const canRetry =
          error instanceof ExternalApiError &&
          error.kind === 'RATE_LIMIT' &&
          attempt < MAX_RATE_LIMIT_RETRIES;
        if (!canRetry) {
          throw error;
        }
        const delay = RATE_LIMIT_BASE_DELAY_MS * (attempt + 1);
        this.logger.warn(WARN.BITRIX.RATE_LIMITED(operation, delay));
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async send<T>(
    url: string,
    body: Record<string, unknown>,
    operation: string,
    channel: BitrixChannel,
  ): Promise<BitrixResponse<T>> {
    const method = `${channel} ${operation}`;
    const startedAt = Date.now();
    try {
      const response = await firstValueFrom(
        this.http.post<BitrixResponse<T>>(url, body),
      );
      const data: unknown = response.data;
      // Bitrix24 đôi khi trả HTTP 200 nhưng body báo lỗi.
      if (!data || typeof data !== 'object' || !('result' in data)) {
        throw fromErrorBody(response.status, data, operation);
      }
      this.logger.record({
        method,
        statusKbn: StatusKbn.SUCCESS,
        durationMs: Date.now() - startedAt,
      });
      return data as BitrixResponse<T>;
    } catch (error) {
      const normalized = toBitrixError(error, operation);
      this.logger.record({
        method,
        statusKbn: StatusKbn.FAILED,
        errorKbn: errorKbnOf(normalized),
        durationMs: Date.now() - startedAt,
        errorDetail: normalized.message,
      });
      this.logger.warn(
        WARN.EXTERNAL.CALL_FAILED(method, normalized.kind, normalized.message),
      );
      throw normalized;
    }
  }
}
