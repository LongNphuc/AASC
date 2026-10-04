import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { errorKbnOf } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { BitrixTokenService } from '../services/bitrix-token.service';
import { ERROR, LOG } from '../../common/constants/messages.constant';

/** Làm mới mọi token còn sống dưới 35 phút. */
const REFRESH_WINDOW_MS = 35 * 60 * 1000;

/**
 * Batch làm mới token chủ động, lớp bổ sung cho việc làm mới khi gọi API.
 *
 * Chạy mỗi 30 phút. Chu kỳ phải ngắn hơn tuổi thọ access_token (1 giờ) và cửa
 * sổ 35 phút lớn hơn chu kỳ, để không token nào hết hạn giữa hai lần chạy.
 * Việc làm mới định kỳ cũng giữ refresh_token luôn mới khi ứng dụng ít được dùng.
 *
 * Batch dùng chung khóa chống làm mới trùng với callBitrixAPI.
 */
@Injectable()
export class TokenRefreshScheduler {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    TokenRefreshScheduler.name,
  );

  constructor(private readonly tokens: BitrixTokenService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'bitrix-token-refresh' })
  async refreshExpiringTokens(): Promise<void> {
    const method = 'cron bitrix-token-refresh';
    const startedAt = Date.now();
    try {
      const result = await this.tokens.refreshExpiring(REFRESH_WINDOW_MS);
      this.logger.log(
        LOG.AUTH.REFRESH_BATCH(result.total, result.refreshed, result.failed),
      );
      // Chi tiết lỗi của từng portal đã có trong dòng "oauth refresh_token".
      this.logger.record({
        method,
        statusKbn: result.failed ? StatusKbn.FAILED : StatusKbn.SUCCESS,
        durationMs: Date.now() - startedAt,
        errorDetail: result.failed
          ? ERROR.AUTH.REFRESH_BATCH_PARTIAL(result.failed, result.total)
          : undefined,
      });
    } catch (error) {
      this.logger.error(
        ERROR.AUTH.REFRESH_BATCH_FAILED((error as Error).message),
      );
      this.logger.record({
        method,
        statusKbn: StatusKbn.FAILED,
        errorKbn: errorKbnOf(error),
        durationMs: Date.now() - startedAt,
        errorDetail: (error as Error).message,
      });
    }
  }
}
