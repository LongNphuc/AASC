import { Logger } from '@nestjs/common';
import { describeErrorKbn } from '../kbn/error.kbn';
import { StatusKbn } from '../kbn/status.kbn';
import { logFiles } from './log-files';
import { requestContext } from './request-context';

/** Các service có tệp log riêng trong logs/services/. */
export enum LogService {
  /** Đăng ký, đăng nhập, cập nhật thông tin. */
  AUTH = 'service_auth',
  /** Line 98: kết nối, nước đi, gợi ý. */
  LINE98 = 'service_line98',
  /** Cờ caro: ghép cặp, nước đi, kết quả, lịch sử. */
  CARO = 'service_caro',
}

/** Một dòng trong services/<service>.log. */
export interface ServiceLogEntry {
  /** Lệnh gọi, ví dụ "POST /auth/login 201" hoặc "WS caro:move". */
  method: string;
  statusKbn: StatusKbn;
  errorKbn?: number | null;
  durationMs?: number;
  /** Vì sao lỗi (chỉ khi lỗi). */
  errorDetail?: string;
}

/**
 * Định dạng một dòng log service, các cột cách nhau bởi " | ":
 * thời gian | request_id | method | status_kbn | error_kbn | thời gian chạy | error_detail
 */
export function formatServiceLine(
  entry: ServiceLogEntry,
  requestId: string | undefined,
  now = new Date(),
): string {
  const errorKbn = entry.errorKbn
    ? `${entry.errorKbn}(${describeErrorKbn(entry.errorKbn)})`
    : '-';
  return [
    now.toISOString(),
    requestId ?? '-',
    entry.method,
    `status_kbn=${entry.statusKbn}(${StatusKbn[entry.statusKbn]})`,
    `error_kbn=${errorKbn}`,
    entry.durationMs !== undefined ? `${entry.durationMs}ms` : '-',
    entry.errorDetail ? oneLine(entry.errorDetail) : '-',
  ].join(' | ');
}

/** Ghi một dòng vào logs/services/<service>.log. */
export function writeServiceLog(
  service: LogService,
  entry: ServiceLogEntry,
  requestId = requestContext.requestId(),
): void {
  logFiles.write(
    `services/${service}.log`,
    formatServiceLine(entry, requestId),
  );
}

/**
 * Logger của một lớp thuộc một service.
 * - log/warn/error: như Logger của Nest, ghi ra console và app.log. Context có
 *   dạng "service_caro:CaroService" để app.log biết dòng thuộc service nào.
 * - record: ghi chi tiết một lệnh gọi vào services/<service>.log.
 */
export class ServiceLogger extends Logger {
  constructor(
    readonly service: LogService,
    className: string,
  ) {
    super(`${service}:${className}`);
  }

  record(entry: ServiceLogEntry): void {
    writeServiceLog(this.service, entry);
  }
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 1000);
}
