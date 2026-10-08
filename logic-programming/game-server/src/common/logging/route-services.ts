import { LogService } from './service-logger';

/**
 * Request HTTP vào đường dẫn nào thì ghi vào log của service nào. Đường dẫn
 * không có trong bảng (trang tĩnh của client) không ghi log service.
 */
const ROUTE_SERVICES: ReadonlyArray<[prefix: string, service: LogService]> = [
  ['/auth', LogService.AUTH],
  ['/users', LogService.AUTH],
  ['/caro', LogService.CARO],
];

export function serviceForPath(path: string): LogService | undefined {
  return ROUTE_SERVICES.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1];
}
