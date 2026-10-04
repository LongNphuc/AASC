import {
  CronExpression,
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { ServiceLogger } from '../../common/logging/service-logger';
import { BitrixTokenService } from '../services/bitrix-token.service';
import { TokenRefreshScheduler } from './token-refresh.scheduler';

describe('TokenRefreshScheduler', () => {
  let moduleRef: TestingModule;
  let scheduler: TokenRefreshScheduler;
  let tokens: { refreshExpiring: jest.Mock };
  let record: jest.SpyInstance;

  beforeEach(async () => {
    tokens = { refreshExpiring: jest.fn() };
    record = jest
      .spyOn(ServiceLogger.prototype, 'record')
      .mockImplementation(() => undefined);
    moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot()],
      providers: [
        TokenRefreshScheduler,
        { provide: BitrixTokenService, useValue: tokens },
      ],
    }).compile();
    // init() để ScheduleModule quét @Cron và đăng ký job.
    await moduleRef.init();
    scheduler = moduleRef.get(TokenRefreshScheduler);
  });

  afterEach(async () => {
    record.mockRestore();
    await moduleRef.close(); // dừng cron job
  });

  it('đăng ký cron "bitrix-token-refresh" chạy mỗi 30 phút', () => {
    const job = moduleRef
      .get(SchedulerRegistry)
      .getCronJob('bitrix-token-refresh');

    expect(job.cronTime.source).toBe(CronExpression.EVERY_30_MINUTES);
  });

  it('làm mới các token còn dưới 35 phút và ghi SUCCESS khi không có lỗi', async () => {
    tokens.refreshExpiring.mockResolvedValue({
      total: 2,
      refreshed: 2,
      failed: 0,
    });

    await scheduler.refreshExpiringTokens();

    expect(tokens.refreshExpiring).toHaveBeenCalledWith(35 * 60 * 1000);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'cron bitrix-token-refresh',
        statusKbn: StatusKbn.SUCCESS,
      }),
    );
  });

  it('có portal làm mới lỗi thì ghi FAILED kèm số portal lỗi', async () => {
    tokens.refreshExpiring.mockResolvedValue({
      total: 3,
      refreshed: 2,
      failed: 1,
    });

    await scheduler.refreshExpiringTokens();

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusKbn: StatusKbn.FAILED,
        errorDetail: expect.stringContaining('1/3') as unknown,
      }),
    );
  });

  it('lỗi cả batch (ví dụ DB lỗi) không làm sập ứng dụng, chỉ ghi FAILED kèm error_kbn', async () => {
    tokens.refreshExpiring.mockRejectedValue(
      new ExternalApiError('bitrix24-oauth', 'NETWORK', 'mất mạng'),
    );

    await expect(scheduler.refreshExpiringTokens()).resolves.toBeUndefined();
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusKbn: StatusKbn.FAILED,
        errorKbn: 50002,
        errorDetail: 'mất mạng',
      }),
    );
  });
});
