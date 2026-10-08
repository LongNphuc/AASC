import type { Socket } from 'socket.io';
import { WARN } from '../../common/constants/messages.constant';
import { errorKbnOf } from '../../common/kbn/error.kbn';
import { ServiceLogger } from '../../common/logging/service-logger';
import { AuthService } from '../services/auth.service';
import { AuthUser } from '../types/auth.types';

/** Dữ liệu gắn vào socket sau khi xác thực. */
interface SocketData {
  user?: AuthUser;
}

/**
 * Middleware xác thực của Socket.IO, chạy TRƯỚC khi kết nối được chấp nhận:
 * client gửi token qua `io(url, { auth: { token } })`. Token sai, hoặc tài
 * khoản đang online ở nơi khác, thì kết nối bị từ chối: client nhận sự kiện
 * `connect_error` với message và data.errorKbn (20002, 20006).
 *
 * Kết nối được chấp nhận thì ghi nhận người dùng online cho tới khi ngắt.
 *
 * Gắn vào namespace trong afterInit của gateway: server.use(createWsAuth(...)).
 */
export function createWsAuthMiddleware(
  auth: AuthService,
  logger: ServiceLogger,
  namespace: string,
) {
  return (socket: Socket, next: (error?: Error) => void): void => {
    const token = (socket.handshake.auth as { token?: string })?.token;
    auth
      .verifyToken(token)
      .then((user) => {
        auth.markOnline(user, socket.id);
        return user;
      })
      .then(
        (user) => {
          (socket.data as SocketData).user = user;
          socket.on('disconnect', () => auth.markOffline(user, socket.id));
          next();
        },
        (error: unknown) => {
          const message = (error as Error).message;
          logger.warn(WARN.WS.AUTH_FAILED(namespace, message));
          next(
            Object.assign(new Error(message), {
              data: { errorKbn: errorKbnOf(error) },
            }),
          );
        },
      );
  };
}

/** Người dùng đã xác thực của socket (middleware ở trên gắn vào). */
export function socketUser(socket: Socket): AuthUser {
  return (socket.data as SocketData).user as AuthUser;
}
