import { Logger } from '@nestjs/common';
import { describeErrorKbn } from '../kbn/error.kbn';
import { StatusKbn } from '../kbn/status.kbn';
import { logFiles } from './log-files';
import { requestContext } from './request-context';

/** Các service có tệp log riêng trong logs/services/. */
export enum LogService {
  /** API quản lý task. */
  TASK = 'service_task',
}

/** Một dòng trong services/<service>.log. */
export interface ServiceLogEntry {
  /** Lệnh gọi, ví dụ "POST /tasks 201". */
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
 * Logger của một lớp thuộc một service: như Logger của Nest (ghi console và
 * app.log), context có dạng "service_task:TasksService" để app.log biết dòng
 * thuộc service nào.
 */
export class ServiceLogger extends Logger {
  constructor(
    readonly service: LogService,
    className: string,
  ) {
    super(`${service}:${className}`);
  }
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').slice(0, 1000);
}
