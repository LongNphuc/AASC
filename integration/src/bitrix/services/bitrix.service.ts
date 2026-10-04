import { Injectable } from '@nestjs/common';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { BitrixHttpClient } from '../clients/bitrix-http.client';
import { BitrixTokenService } from './bitrix-token.service';
import { BitrixResponse, restEndpointFor } from '../types/bitrix.types';
import { BitrixInstallation } from '../entities/bitrix-installation.entity';
import { WARN } from '../../common/constants/messages.constant';

/** Số trang tối đa listAll đọc, chặn vòng lặp vô hạn nếu dữ liệu bất thường. */
const MAX_LIST_PAGES = 100;

/**
 * Cửa ngõ duy nhất để gọi Bitrix24 REST API bằng OAuth.
 */
@Injectable()
export class BitrixService {
  private readonly logger = new ServiceLogger(
    LogService.BITRIX,
    BitrixService.name,
  );

  constructor(
    private readonly http: BitrixHttpClient,
    private readonly tokens: BitrixTokenService,
  ) {}

  /**
   * Gọi một phương thức Bitrix24 bằng access_token hiện tại.
   *
   * Token được quản lý theo hai lớp:
   * 1. Trước khi gọi: token đã hoặc sắp hết hạn thì làm mới trước.
   * 2. Sau khi gọi: Bitrix24 vẫn báo `expired_token`/`invalid_token` (ví dụ
   *    token bị thu hồi sớm) thì làm mới và gọi lại ĐÚNG MỘT lần. Lần thứ hai
   *    vẫn lỗi thì ném lỗi ra, không thử tiếp để tránh vòng lặp vô hạn.
   *
   * @param method  tên phương thức, ví dụ `crm.contact.list`
   * @param payload tham số của phương thức (filter, select, fields, id...)
   * @param memberId portal cần gọi; bỏ trống thì dùng portal mặc định
   * @returns toàn bộ phản hồi (result, total, next) để hỗ trợ phân trang
   */
  async callBitrixAPI<T = unknown>(
    method: string,
    payload: Record<string, unknown> = {},
    memberId?: string,
  ): Promise<BitrixResponse<T>> {
    const installation = await this.tokens.getValidInstallation(memberId);
    try {
      return await this.send<T>(installation, method, payload);
    } catch (error) {
      if (
        !(error instanceof ExternalApiError) ||
        error.kind !== 'TOKEN_EXPIRED'
      ) {
        throw error;
      }
      this.logger.warn(
        WARN.BITRIX.TOKEN_REJECTED_RETRY(method, error.details.upstreamCode),
      );
      const refreshed = await this.tokens.refresh(installation.memberId);
      return this.send<T>(refreshed, method, payload);
    }
  }

  /** Như callBitrixAPI nhưng chỉ trả về `result`. */
  async call<T = unknown>(
    method: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    const response = await this.callBitrixAPI<T>(method, payload);
    return response.result;
  }

  /**
   * Đọc hết mọi trang của một phương thức *.list. Bitrix24 trả tối đa 50 bản
   * ghi mỗi trang, kèm `next` là vị trí bắt đầu của trang sau.
   */
  async listAll<T>(
    method: string,
    params: Record<string, unknown>,
  ): Promise<T[]> {
    const items: T[] = [];
    let start: number | undefined = 0;
    for (let page = 0; start !== undefined && page < MAX_LIST_PAGES; page++) {
      const response: BitrixResponse<T[]> = await this.callBitrixAPI<T[]>(
        method,
        {
          ...params,
          start,
        },
      );
      items.push(...response.result);
      start = response.next;
    }
    return items;
  }

  /** Gọi bằng một access_token cụ thể, dùng khi token chưa được lưu (lúc cài đặt). */
  callWithToken<T>(
    domain: string,
    accessToken: string,
    method: string,
    payload: Record<string, unknown> = {},
  ): Promise<BitrixResponse<T>> {
    return this.http.post<T>(
      `${restEndpointFor(domain)}${method}.json`,
      { ...payload, auth: accessToken },
      method,
      'oauth',
    );
  }

  private send<T>(
    installation: BitrixInstallation,
    method: string,
    payload: Record<string, unknown>,
  ): Promise<BitrixResponse<T>> {
    return this.callWithToken<T>(
      installation.domain,
      installation.accessToken,
      method,
      payload,
    );
  }
}
