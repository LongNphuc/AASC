import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERROR, LOG } from '../../common/constants/messages.constant';
import { GameException } from '../../common/errors/game.exception';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { CaroResultKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import {
  CaroPosition,
  CaroSymbol,
  createCaroBoard,
  findWinningLine,
  InvalidCellError,
  isBoardFull,
  otherSymbol,
  placeMark,
} from '../engines/caro.engine';
import { CaroMatch } from '../entities/caro-match.entity';
import type {
  ActiveMatch,
  CaroFinishView,
  CaroHistoryItem,
  CaroMoveRequest,
  CaroSeat,
  JoinQueueResult,
  MoveOutcome,
} from '../types/caro.types';

const HISTORY_LIMIT = 20;

/**
 * Nghiệp vụ cờ caro: hàng chờ ghép cặp, trận đang diễn ra (giữ trong bộ nhớ),
 * kiểm tra lượt và nước đi bằng engine, lưu lịch sử trận vào DB.
 *
 * Service không biết gì về socket: gateway nhận kết quả rồi tự gửi sự kiện.
 * Trạng thái nằm trong bộ nhớ nên chỉ đúng khi chạy một tiến trình.
 */
@Injectable()
export class CaroService {
  private readonly logger = new ServiceLogger(
    LogService.CARO,
    CaroService.name,
  );

  /** Người đang chờ ghép cặp. */
  private readonly queue: CaroSeat[] = [];
  private readonly matches = new Map<string, ActiveMatch>();
  /** userUuid → uuid trận đang chơi. */
  private readonly matchOfUser = new Map<string, string>();

  constructor(
    @InjectRepository(CaroMatch)
    private readonly repository: Repository<CaroMatch>,
  ) {}

  /**
   * Vào hàng chờ. Có người đang chờ thì ghép ngẫu nhiên với một người trong số
   * đó, chia X/O ngẫu nhiên; chưa có ai thì chờ.
   */
  async joinQueue(seat: CaroSeat): Promise<JoinQueueResult> {
    if (this.isBusy(seat.userUuid)) {
      throw new GameException(
        ErrorKbn.CARO_ALREADY_IN_GAME,
        ERROR.CARO.ALREADY_IN_GAME,
      );
    }
    if (this.queue.length === 0) {
      this.queue.push(seat);
      this.logger.log(LOG.CARO.QUEUED(seat.username));
      return { status: 'waiting' };
    }

    const [opponent] = this.queue.splice(randomIndex(this.queue.length), 1);
    const [x, o] = Math.random() < 0.5 ? [seat, opponent] : [opponent, seat];
    const entity = await this.repository.save(
      this.repository.create({
        playerXUuid: x.userUuid,
        playerOUuid: o.userUuid,
        moves: [],
        resultKbn: CaroResultKbn.PLAYING,
        winnerUuid: null,
        finishedAt: null,
      }),
    );
    const match: ActiveMatch = {
      uuid: entity.uuid,
      board: createCaroBoard(),
      players: { X: x, O: o },
      turn: 'X',
      moves: [],
    };
    this.matches.set(match.uuid, match);
    this.matchOfUser.set(x.userUuid, match.uuid);
    this.matchOfUser.set(o.userUuid, match.uuid);
    this.logger.log(LOG.CARO.MATCHED(match.uuid, x.username, o.username));
    return { status: 'matched', match };
  }

  /**
   * Rời hàng chờ. Trả về true nếu người này đang chờ. Có `socketId` thì chỉ
   * rời khi đúng socket đó đã vào hàng chờ (xem abandon).
   */
  leaveQueue(userUuid: string, socketId?: string): boolean {
    const index = this.queue.findIndex(
      (s) => s.userUuid === userUuid && (!socketId || s.socketId === socketId),
    );
    if (index >= 0) {
      this.queue.splice(index, 1);
    }
    return index >= 0;
  }

  async move(userUuid: string, request: CaroMoveRequest): Promise<MoveOutcome> {
    const match = this.matches.get(request?.matchUuid);
    const symbol = match ? symbolOf(match, userUuid) : null;
    if (!match || !symbol) {
      throw new GameException(
        ErrorKbn.CARO_NOT_IN_MATCH,
        ERROR.CARO.NOT_IN_MATCH,
      );
    }
    if (match.turn !== symbol) {
      throw new GameException(
        ErrorKbn.CARO_NOT_YOUR_TURN,
        ERROR.CARO.NOT_YOUR_TURN,
      );
    }

    const position: CaroPosition = { row: request.row, col: request.col };
    try {
      match.board = placeMark(match.board, position, symbol);
    } catch (error) {
      if (error instanceof InvalidCellError) {
        throw new GameException(
          ErrorKbn.CARO_INVALID_CELL,
          ERROR.CARO[error.reason],
        );
      }
      throw error;
    }
    const move = { ...position, symbol };
    match.moves.push(move);

    let finished: CaroFinishView | null = null;
    const winLine = findWinningLine(match.board, position);
    if (winLine) {
      finished = await this.finish(
        match,
        symbol === 'X' ? CaroResultKbn.X_WIN : CaroResultKbn.O_WIN,
        symbol,
        winLine,
      );
    } else if (isBoardFull(match.board)) {
      finished = await this.finish(match, CaroResultKbn.DRAW, null, null);
    } else {
      match.turn = otherSymbol(symbol);
    }
    return { match, move, nextTurn: match.turn, finished };
  }

  /**
   * Người chơi rời đi (bấm rời trận hoặc mất kết nối): rời hàng chờ nếu đang
   * chờ; nếu đang trong trận thì xử thua, người còn lại thắng.
   *
   * Mất kết nối thì truyền `socketId`: chỉ tính khi đúng socket đó đã vào hàng
   * chờ hoặc vào trận. Người chơi mở nhiều tab, đóng một tab khác thì không mất
   * chỗ chờ, không bị xử thua.
   */
  async abandon(
    userUuid: string,
    socketId?: string,
  ): Promise<{ match: ActiveMatch; finished: CaroFinishView } | null> {
    this.leaveQueue(userUuid, socketId);
    const matchUuid = this.matchOfUser.get(userUuid);
    const match = matchUuid ? this.matches.get(matchUuid) : undefined;
    const symbol = match ? symbolOf(match, userUuid) : null;
    if (!match || !symbol) {
      return null;
    }
    if (socketId && match.players[symbol].socketId !== socketId) {
      return null;
    }
    const finished = await this.finish(
      match,
      CaroResultKbn.ABANDONED,
      otherSymbol(symbol),
      null,
    );
    return { match, finished };
  }

  /** Lịch sử trận của người dùng, mới nhất trước. */
  async history(userUuid: string): Promise<CaroHistoryItem[]> {
    const rows = await this.repository.find({
      where: [{ playerXUuid: userUuid }, { playerOUuid: userUuid }],
      relations: { playerX: true, playerO: true },
      order: { startedAt: 'DESC' },
      take: HISTORY_LIMIT,
    });
    return rows.map((row) => {
      const you: CaroSymbol = row.playerXUuid === userUuid ? 'X' : 'O';
      const opponent = you === 'X' ? row.playerO : row.playerX;
      return {
        matchUuid: row.uuid,
        you,
        opponentNickname: opponent?.nickname ?? '?',
        resultKbn: row.resultKbn,
        result: CaroResultKbn[row.resultKbn],
        outcome: outcomeFor(row, userUuid),
        moveCount: row.moves.length,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      };
    });
  }

  /** Người này đang chờ hoặc đang trong một trận. */
  isBusy(userUuid: string): boolean {
    return (
      this.matchOfUser.has(userUuid) ||
      this.queue.some((s) => s.userUuid === userUuid)
    );
  }

  /** Ghi kết quả vào DB và gỡ trận khỏi bộ nhớ. */
  private async finish(
    match: ActiveMatch,
    resultKbn: CaroResultKbn,
    winSymbol: CaroSymbol | null,
    winLine: CaroPosition[] | null,
  ): Promise<CaroFinishView> {
    const winner = winSymbol ? match.players[winSymbol] : null;
    await this.repository.update(match.uuid, {
      moves: match.moves,
      resultKbn,
      winnerUuid: winner?.userUuid ?? null,
      finishedAt: new Date(),
    });
    this.matches.delete(match.uuid);
    this.matchOfUser.delete(match.players.X.userUuid);
    this.matchOfUser.delete(match.players.O.userUuid);
    this.logger.log(LOG.CARO.FINISHED(match.uuid, CaroResultKbn[resultKbn]));
    return {
      matchUuid: match.uuid,
      resultKbn,
      result: CaroResultKbn[resultKbn],
      winnerNickname: winner?.nickname ?? null,
      winSymbol,
      winLine,
    };
  }
}

function symbolOf(match: ActiveMatch, userUuid: string): CaroSymbol | null {
  if (match.players.X.userUuid === userUuid) return 'X';
  if (match.players.O.userUuid === userUuid) return 'O';
  return null;
}

function outcomeFor(
  row: CaroMatch,
  userUuid: string,
): CaroHistoryItem['outcome'] {
  if (row.resultKbn === CaroResultKbn.PLAYING) return 'PLAYING';
  if (row.resultKbn === CaroResultKbn.DRAW) return 'DRAW';
  return row.winnerUuid === userUuid ? 'WIN' : 'LOSE';
}

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}
