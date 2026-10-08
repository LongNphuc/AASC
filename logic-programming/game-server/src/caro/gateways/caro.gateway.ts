import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
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
import type { CaroSymbol } from '../engines/caro.engine';
import { CaroService } from '../services/caro.service';
import type {
  ActiveMatch,
  CaroFinishView,
  CaroMatchedView,
  CaroMoveRequest,
} from '../types/caro.types';

const NAMESPACE = '/caro';
const roomOf = (matchUuid: string) => `match:${matchUuid}`;

/**
 * WebSocket của cờ caro (namespace /caro). Hai người cùng trận ở chung một
 * room Socket.IO, nên mỗi nước đi được gửi tới cả hai cùng lúc.
 *
 * Client gửi (kết quả trả qua acknowledgement { ok, data | errorKbn, message }):
 *   caro:find    → vào hàng chờ: { status: 'waiting' | 'matched' }
 *   caro:cancel  → rời hàng chờ
 *   caro:move    { matchUuid, row, col }
 *   caro:leave   → rời trận (xử thua)
 *
 * Server gửi:
 *   caro:matched { matchUuid, you, opponent, turn }   khi ghép cặp xong
 *   caro:moved   { matchUuid, row, col, symbol, nextTurn }
 *   caro:over    { matchUuid, result, winnerNickname, winLine, ... }
 */
@WebSocketGateway({ namespace: NAMESPACE })
export class CaroGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private readonly server: Namespace;

  private readonly logger = new ServiceLogger(
    LogService.CARO,
    CaroGateway.name,
  );

  constructor(
    private readonly caro: CaroService,
    private readonly auth: AuthService,
  ) {}

  afterInit(server: Namespace): void {
    server.use(createWsAuthMiddleware(this.auth, this.logger, NAMESPACE));
  }

  handleConnection(client: Socket): void {
    this.logger.log(LOG.WS.CONNECTED(NAMESPACE, socketUser(client).username));
  }

  /**
   * Mất kết nối: rời hàng chờ, hoặc xử thua nếu đang trong trận. Chỉ tính khi
   * chính socket này đã vào hàng chờ hoặc vào trận (không phải tab khác).
   */
  async handleDisconnect(client: Socket): Promise<void> {
    const user = socketUser(client);
    if (!user) {
      return;
    }
    this.logger.log(LOG.WS.DISCONNECTED(NAMESPACE, user.username));
    await handleWs(this.logger, client, 'disconnect', () =>
      this.abandon(user.uuid, client.id),
    );
  }

  @SubscribeMessage('caro:find')
  find(
    @ConnectedSocket() client: Socket,
  ): Promise<WsResult<{ status: 'waiting' | 'matched' }>> {
    return handleWs(this.logger, client, 'caro:find', async () => {
      const user = socketUser(client);
      const result = await this.caro.joinQueue({
        userUuid: user.uuid,
        username: user.username,
        nickname: user.nickname,
        socketId: client.id,
      });
      if (result.status === 'matched') {
        this.announceMatch(result.match);
      }
      return { status: result.status };
    });
  }

  @SubscribeMessage('caro:cancel')
  cancel(@ConnectedSocket() client: Socket): Promise<WsResult<boolean>> {
    return handleWs(this.logger, client, 'caro:cancel', () =>
      this.caro.leaveQueue(socketUser(client).uuid),
    );
  }

  @SubscribeMessage('caro:move')
  move(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: CaroMoveRequest,
  ): Promise<WsResult<{ nextTurn: CaroSymbol }>> {
    return handleWs(this.logger, client, 'caro:move', async () => {
      const outcome = await this.caro.move(socketUser(client).uuid, body);
      const room = roomOf(outcome.match.uuid);
      this.server.to(room).emit('caro:moved', {
        matchUuid: outcome.match.uuid,
        ...outcome.move,
        nextTurn: outcome.nextTurn,
      });
      if (outcome.finished) {
        this.endMatch(outcome.finished);
      }
      return { nextTurn: outcome.nextTurn };
    });
  }

  @SubscribeMessage('caro:leave')
  leave(@ConnectedSocket() client: Socket): Promise<WsResult<boolean>> {
    return handleWs(this.logger, client, 'caro:leave', () =>
      this.abandon(socketUser(client).uuid),
    );
  }

  /** Cho hai người vào chung room, gửi mỗi người thông tin trận của mình. */
  private announceMatch(match: ActiveMatch): void {
    for (const symbol of ['X', 'O'] as const) {
      const me = match.players[symbol];
      const opponent = match.players[symbol === 'X' ? 'O' : 'X'];
      this.server.in(me.socketId).socketsJoin(roomOf(match.uuid));
      const view: CaroMatchedView = {
        matchUuid: match.uuid,
        you: symbol,
        opponent: { nickname: opponent.nickname },
        turn: match.turn,
      };
      this.server.to(me.socketId).emit('caro:matched', view);
    }
  }

  private async abandon(userUuid: string, socketId?: string): Promise<boolean> {
    const result = await this.caro.abandon(userUuid, socketId);
    if (result) {
      this.endMatch(result.finished);
    }
    return result !== null;
  }

  /** Báo kết quả cho cả room rồi giải tán room. */
  private endMatch(finished: CaroFinishView): void {
    const room = roomOf(finished.matchUuid);
    this.server.to(room).emit('caro:over', finished);
    this.server.in(room).socketsLeave(room);
  }
}
