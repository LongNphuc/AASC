import { StatusKbn } from '../kbn/status.kbn';
import { formatServiceLine } from './service-logger';

describe('formatServiceLine', () => {
  const now = new Date('2026-10-04T09:15:02.118Z');

  it('dòng lỗi: đủ cột, mã kbn kèm tên dễ đọc, lý do lỗi gom về một dòng', () => {
    const line = formatServiceLine(
      {
        method: 'webhook crm.contact.add',
        statusKbn: StatusKbn.FAILED,
        errorKbn: 40003,
        durationMs: 231,
        errorDetail: 'Bitrix24 từ chối xác thực\n(INVALID_CREDENTIALS)',
      },
      'a1b2c3d4',
      now,
    );

    expect(line).toBe(
      '2026-10-04T09:15:02.118Z | a1b2c3d4 | webhook crm.contact.add | status_kbn=10001(FAILED) | error_kbn=40003(BITRIX24.AUTH) | 231ms | Bitrix24 từ chối xác thực (INVALID_CREDENTIALS)',
    );
  });

  it('dòng thành công ngoài request (ví dụ cron): các cột trống ghi "-"', () => {
    const line = formatServiceLine(
      { method: 'cron bitrix-token-refresh', statusKbn: StatusKbn.SUCCESS },
      undefined,
      now,
    );

    expect(line).toBe(
      '2026-10-04T09:15:02.118Z | - | cron bitrix-token-refresh | status_kbn=10000(SUCCESS) | error_kbn=- | - | -',
    );
  });
});
