import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { LOG } from '../../common/constants/messages.constant';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import {
  createWsAuthMiddleware,
  socketUser,
} from '../middlewares/ws-auth.middleware';
import { AuthService } from '../services/auth.service';

const NAMESPACE = '/presence';

/**
 * WebSocket namespace /presence: trang sảnh mở kết nối này để người dùng được
 * tính là đang online (trang game đã có kết nối /line98, /caro). Không có sự
 * kiện nào; xác thực và ghi nhận online nằm ở middleware.
 */
@WebSocketGateway({ namespace: NAMESPACE })
export class PresenceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    PresenceGateway.name,
  );

  constructor(private readonly auth: AuthService) {}

  afterInit(server: Namespace): void {
    server.use(createWsAuthMiddleware(this.auth, this.logger, NAMESPACE));
  }

  handleConnection(client: Socket): void {
    this.logger.log(LOG.WS.CONNECTED(NAMESPACE, socketUser(client).username));
  }

  handleDisconnect(client: Socket): void {
    const user = socketUser(client);
    if (user) {
      this.logger.log(LOG.WS.DISCONNECTED(NAMESPACE, user.username));
    }
  }
}
