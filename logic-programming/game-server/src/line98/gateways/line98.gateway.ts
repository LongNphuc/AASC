import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import {
  createWsAuthMiddleware,
  socketUser,
} from '../../auth/middlewares/ws-auth.middleware';
import { AuthService } from '../../auth/services/auth.service';
import { LOG } from '../../common/constants/messages.constant';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { handleWs, WsResult } from '../../common/ws/ws-handler';
import { Line98Service } from '../services/line98.service';
import type {
  Line98GameView,
  Line98HintView,
  Line98MoveRequest,
  Line98MoveView,
} from '../types/line98.types';

const NAMESPACE = '/line98';

/**
 * WebSocket của Line 98 (namespace /line98). Mọi sự kiện trả kết quả qua
 * acknowledgement: client gọi socket.emit('line98:move', data, (res) => ...),
 * res là { ok: true, data } hoặc { ok: false, errorKbn, message }.
 *
 * Sự kiện:
 *   line98:resume  → ván đang chơi (chưa có thì tạo mới)
 *   line98:new     → bắt đầu ván mới
 *   line98:move    { from, to } → trạng thái mới, đường đi, bóng bị xóa, bóng mới sinh
 *   line98:hint    → { from, to } gợi ý, hoặc null nếu hết nước đi
 */
@WebSocketGateway({ namespace: NAMESPACE })
export class Line98Gateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new ServiceLogger(
    LogService.LINE98,
    Line98Gateway.name,
  );

  constructor(
    private readonly line98: Line98Service,
    private readonly auth: AuthService,
  ) {}

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

  @SubscribeMessage('line98:resume')
  resume(@ConnectedSocket() client: Socket): Promise<WsResult<Line98GameView>> {
    return handleWs(this.logger, client, 'line98:resume', () =>
      this.line98.resume(socketUser(client)),
    );
  }

  @SubscribeMessage('line98:new')
  newGame(
    @ConnectedSocket() client: Socket,
  ): Promise<WsResult<Line98GameView>> {
    return handleWs(this.logger, client, 'line98:new', () =>
      this.line98.newGame(socketUser(client)),
    );
  }

  @SubscribeMessage('line98:move')
  move(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: Line98MoveRequest,
  ): Promise<WsResult<Line98MoveView>> {
    return handleWs(this.logger, client, 'line98:move', () =>
      this.line98.move(socketUser(client), body),
    );
  }

  @SubscribeMessage('line98:hint')
  hint(@ConnectedSocket() client: Socket): Promise<WsResult<Line98HintView>> {
    return handleWs(this.logger, client, 'line98:hint', () =>
      this.line98.hint(socketUser(client)),
    );
  }
}
