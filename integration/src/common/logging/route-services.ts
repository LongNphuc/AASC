import { LogService } from './service-logger';

/**
 * Request vào đường dẫn nào thì ghi chi tiết vào log của service nào.
 * Đường dẫn không có trong bảng (ví dụ /health, /docs) không ghi log service.
 */
const ROUTE_SERVICES: ReadonlyArray<[prefix: string, service: LogService]> = [
  ['/install', LogService.AUTH],
  ['/bitrix', LogService.AUTH],
  ['/contacts', LogService.CONTACTS],
  ['/webhook/jotform', LogService.JOTFORM],
  ['/jotform', LogService.JOTFORM],
];

export function serviceForPath(path: string): LogService | undefined {
  return ROUTE_SERVICES.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1];
}
