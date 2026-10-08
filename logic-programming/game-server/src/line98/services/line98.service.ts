import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../auth/types/auth.types';
import { ERROR, LOG } from '../../common/constants/messages.constant';
import { GameException } from '../../common/errors/game.exception';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { Line98StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import {
  createGame,
  InvalidMoveError,
  isInside,
  moveBall,
  suggestMove,
} from '../engines/line98.engine';
import { Line98Game } from '../entities/line98-game.entity';
import type {
  Line98GameView,
  Line98HintView,
  Line98MoveRequest,
  Line98MoveView,
} from '../types/line98.types';

/**
 * Nghiệp vụ Line 98: tải/tạo ván, áp dụng nước đi bằng engine, lưu lại DB
 * sau mỗi nước, gợi ý nước đi.
 */
@Injectable()
export class Line98Service {
  private readonly logger = new ServiceLogger(
    LogService.LINE98,
    Line98Service.name,
  );

  constructor(
    @InjectRepository(Line98Game)
    private readonly games: Repository<Line98Game>,
  ) {}

  /** Ván đang chơi của người dùng; chưa có thì tạo ván mới. */
  async resume(user: AuthUser): Promise<Line98GameView> {
    const game = await this.findPlaying(user);
    return toView(game ?? (await this.createFor(user)));
  }

  /** Bắt đầu ván mới; ván đang chơi (nếu có) chuyển sang ABANDONED. */
  async newGame(user: AuthUser): Promise<Line98GameView> {
    await this.games.update(
      { userUuid: user.uuid, statusKbn: Line98StatusKbn.PLAYING },
      { statusKbn: Line98StatusKbn.ABANDONED },
    );
    return toView(await this.createFor(user));
  }

  async move(
    user: AuthUser,
    request: Line98MoveRequest,
  ): Promise<Line98MoveView> {
    if (!isInside(request?.from) || !isInside(request?.to)) {
      throw invalidMove(ERROR.LINE98.BAD_POSITION);
    }
    const game = await this.requirePlaying(user);

    let result;
    try {
      result = moveBall({ ...game, gameOver: false }, request.from, request.to);
    } catch (error) {
      if (error instanceof InvalidMoveError) {
        throw invalidMove(ERROR.LINE98[error.reason]);
      }
      throw error;
    }

    game.board = result.state.board;
    game.nextColors = result.state.nextColors;
    game.score = result.state.score;
    if (result.state.gameOver) {
      game.statusKbn = Line98StatusKbn.GAME_OVER;
      this.logger.log(LOG.LINE98.GAME_OVER(user.username, game.score));
    }
    await this.games.save(game);

    return {
      game: toView(game),
      path: result.path,
      removed: result.removed,
      spawned: result.spawned,
    };
  }

  /** Gợi ý một nước đi hợp lệ ngẫu nhiên (xem suggestMove). */
  async hint(user: AuthUser): Promise<Line98HintView> {
    const game = await this.requirePlaying(user);
    return suggestMove(game.board);
  }

  private async createFor(user: AuthUser): Promise<Line98Game> {
    const state = createGame();
    const game = await this.games.save(
      this.games.create({
        userUuid: user.uuid,
        board: state.board,
        nextColors: state.nextColors,
        score: state.score,
        statusKbn: Line98StatusKbn.PLAYING,
      }),
    );
    this.logger.log(LOG.LINE98.NEW_GAME(user.username, game.uuid));
    return game;
  }

  private findPlaying(user: AuthUser): Promise<Line98Game | null> {
    return this.games.findOne({
      where: { userUuid: user.uuid, statusKbn: Line98StatusKbn.PLAYING },
      order: { updatedAt: 'DESC' },
    });
  }

  private async requirePlaying(user: AuthUser): Promise<Line98Game> {
    const game = await this.findPlaying(user);
    if (game) {
      return game;
    }
    // Không có ván đang chơi: hoặc chưa chơi, hoặc ván gần nhất đã thua.
    const finished = await this.games.exists({
      where: { userUuid: user.uuid, statusKbn: Line98StatusKbn.GAME_OVER },
    });
    throw finished
      ? new GameException(ErrorKbn.LINE98_GAME_OVER, ERROR.LINE98.GAME_OVER)
      : new GameException(ErrorKbn.LINE98_NO_GAME, ERROR.LINE98.NO_GAME);
  }
}

function invalidMove(message: string): GameException {
  return new GameException(ErrorKbn.LINE98_INVALID_MOVE, message);
}

function toView(game: Line98Game): Line98GameView {
  return {
    gameUuid: game.uuid,
    board: game.board,
    nextColors: game.nextColors,
    score: game.score,
    statusKbn: game.statusKbn,
    status: Line98StatusKbn[game.statusKbn],
  };
}
