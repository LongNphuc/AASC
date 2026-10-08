import type { Socket } from 'socket.io';
import { ERROR } from '../constants/messages.constant';
import { ErrorKbn, errorKbnOf } from '../kbn/error.kbn';
import { StatusKbn } from '../kbn/status.kbn';
import { requestContext } from '../logging/request-context';
import { ServiceLogger } from '../logging/service-logger';

/**
 * Phản hồi của mọi sự kiện WebSocket (gửi về qua acknowledgement của
 * Socket.IO: client gọi socket.emit(event, data, callback)).
 */
export type WsResult<T> =
  { ok: true; data: T } | { ok: false; errorKbn: number; message: string };

/**
 * Bọc xử lý một sự kiện WebSocket:
 * - chạy trong ngữ cảnh có request_id (8 ký tự đầu của socket id), để mọi log
 *   của sự kiện mang cùng một mã;
 * - đo thời gian, ghi một dòng vào log service;
 * - lỗi nghiệp vụ (GameException) trả về { ok: false, errorKbn, message },
 *   lỗi lạ ghi thêm stack vào app.log.
 */
export function handleWs<T>(
  logger: ServiceLogger,
  client: Socket,
  event: string,
  handler: () => Promise<T> | T,
): Promise<WsResult<T>> {
  return requestContext.run(
    client.id.slice(0, 8),
    async (): Promise<WsResult<T>> => {
      const startedAt = Date.now();
      const method = `WS ${event}`;
      try {
        const data: T = await handler();
        logger.record({
          method,
          statusKbn: StatusKbn.SUCCESS,
          durationMs: Date.now() - startedAt,
        });
        return { ok: true, data };
      } catch (error) {
        const errorKbn = errorKbnOf(error);
        const message =
          errorKbn === ErrorKbn.UNKNOWN
            ? ERROR.SYSTEM.INTERNAL
            : (error as Error).message;
        logger.record({
          method,
          statusKbn: StatusKbn.FAILED,
          errorKbn,
          durationMs: Date.now() - startedAt,
          errorDetail: (error as Error).message,
        });
        if (errorKbn === ErrorKbn.UNKNOWN) {
          logger.error(
            ERROR.SYSTEM.WS_FAILED(event, (error as Error).message),
            (error as Error).stack,
          );
        }
        return { ok: false, errorKbn, message };
      }
    },
  );
}
