import { LogService } from './service-logger';

/**
 * Request HTTP vào đường dẫn nào thì ghi vào log của service nào. Đường dẫn
 * không có trong bảng (ví dụ /docs) không ghi log service.
 */
const ROUTE_SERVICES: ReadonlyArray<[prefix: string, service: LogService]> = [
  ['/tasks', LogService.TASK],
];

export function serviceForPath(path: string): LogService | undefined {
  return ROUTE_SERVICES.find(
    ([prefix]) => path === prefix || path.startsWith(`${prefix}/`),
  )?.[1];
}
