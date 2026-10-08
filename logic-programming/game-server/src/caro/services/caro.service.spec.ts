import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { CaroResultKbn } from '../../common/kbn/status.kbn';
import { CaroMatch } from '../entities/caro-match.entity';
import type { ActiveMatch, CaroSeat } from '../types/caro.types';
import { CaroService } from './caro.service';

function seat(name: string): CaroSeat {
  return {
    userUuid: `uuid-${name}`,
    username: name,
    nickname: name.toUpperCase(),
    socketId: `socket-${name}`,
  };
}

describe('CaroService: ghép cặp và lượt đi', () => {
  let service: CaroService;
  let repository: { create: jest.Mock; save: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    repository = {
      create: jest.fn((data: object) => data),
      save: jest.fn((data: object) =>
        Promise.resolve({ ...data, uuid: 'match-1' }),
      ),
      update: jest.fn(() => Promise.resolve()),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CaroService,
        { provide: getRepositoryToken(CaroMatch), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(CaroService);
  });

  /** Ghép an và binh, trả về trận cùng người cầm X, người cầm O. */
  async function startMatch(): Promise<{
    match: ActiveMatch;
    x: CaroSeat;
    o: CaroSeat;
  }> {
    await service.joinQueue(seat('an'));
    const result = await service.joinQueue(seat('binh'));
    if (result.status !== 'matched') throw new Error('chưa ghép được');
    return {
      match: result.match,
      x: result.match.players.X,
      o: result.match.players.O,
    };
  }

  it('người đầu tiên chờ, người thứ hai được ghép; chia X/O cho đúng hai người; X đi trước', async () => {
    expect(await service.joinQueue(seat('an'))).toEqual({ status: 'waiting' });
    const result = await service.joinQueue(seat('binh'));

    expect(result.status).toBe('matched');
    if (result.status !== 'matched') return;
    const players = [
      result.match.players.X.username,
      result.match.players.O.username,
    ];
    expect(players.sort()).toEqual(['an', 'binh']);
    expect(result.match.turn).toBe('X');
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ resultKbn: CaroResultKbn.PLAYING }),
    );
  });

  it('một người không vào hàng chờ hai lần, và không tự ghép với chính mình', async () => {
    await service.joinQueue(seat('an'));
    await expect(service.joinQueue(seat('an'))).rejects.toMatchObject({
      errorKbn: ErrorKbn.CARO_ALREADY_IN_GAME,
    });
  });

  it('đi sai lượt, ô đã đánh, người ngoài trận đều bị từ chối', async () => {
    const { match, x, o } = await startMatch();
    const at = (row: number, col: number) => ({
      matchUuid: match.uuid,
      row,
      col,
    });

    await expect(service.move(o.userUuid, at(0, 0))).rejects.toMatchObject({
      errorKbn: ErrorKbn.CARO_NOT_YOUR_TURN,
    });
    await service.move(x.userUuid, at(0, 0));
    await expect(service.move(o.userUuid, at(0, 0))).rejects.toMatchObject({
      errorKbn: ErrorKbn.CARO_INVALID_CELL,
    });
    await expect(service.move('uuid-la', at(1, 1))).rejects.toMatchObject({
      errorKbn: ErrorKbn.CARO_NOT_IN_MATCH,
    });
  });

  it('X đánh đủ 5 ô liên tiếp thì thắng: lưu nước đi, người thắng; hai người được vào hàng chờ lại', async () => {
    const { match, x, o } = await startMatch();
    const at = (row: number, col: number) => ({
      matchUuid: match.uuid,
      row,
      col,
    });

    for (let col = 0; col < 4; col++) {
      await service.move(x.userUuid, at(0, col));
      await service.move(o.userUuid, at(1, col));
    }
    const outcome = await service.move(x.userUuid, at(0, 4));

    expect(outcome.finished).toMatchObject({
      result: 'X_WIN',
      winnerNickname: x.nickname,
      winSymbol: 'X',
    });
    expect(outcome.finished?.winLine).toHaveLength(5);
    expect(repository.update).toHaveBeenCalledWith(
      match.uuid,
      expect.objectContaining({
        resultKbn: CaroResultKbn.X_WIN,
        winnerUuid: x.userUuid,
      }),
    );
    const saved = (
      repository.update.mock.calls[0] as [string, { moves: unknown[] }]
    )[1];
    expect(saved.moves).toHaveLength(9);
    expect(service.isBusy(x.userUuid) || service.isBusy(o.userUuid)).toBe(
      false,
    );
  });

  it('một người rời trận (mất kết nối) thì người còn lại thắng', async () => {
    const { x, o } = await startMatch();

    const result = await service.abandon(x.userUuid);

    expect(result?.finished).toMatchObject({
      result: 'ABANDONED',
      winnerNickname: o.nickname,
    });
    expect(repository.update).toHaveBeenCalledWith(
      'match-1',
      expect.objectContaining({ winnerUuid: o.userUuid }),
    );
  });

  it('rời khi đang chờ thì chỉ ra khỏi hàng chờ', async () => {
    await service.joinQueue(seat('an'));
    expect(await service.abandon('uuid-an')).toBeNull();
    expect(service.isBusy('uuid-an')).toBe(false);
  });

  it('đóng một tab khác của cùng người chơi: không mất chỗ chờ, không bị xử thua', async () => {
    // an chờ ở tab "socket-an", đóng tab khác "socket-an-tab2".
    await service.joinQueue(seat('an'));
    expect(await service.abandon('uuid-an', 'socket-an-tab2')).toBeNull();
    expect(service.isBusy('uuid-an')).toBe(true);

    // binh vào thì vẫn ghép được với an.
    const result = await service.joinQueue(seat('binh'));
    expect(result.status).toBe('matched');

    // Trong trận: tab khác ngắt thì trận vẫn tiếp tục; đúng tab đang chơi ngắt thì thua.
    expect(await service.abandon('uuid-an', 'socket-an-tab2')).toBeNull();
    expect(service.isBusy('uuid-an')).toBe(true);
    const left = await service.abandon('uuid-an', 'socket-an');
    expect(left?.finished).toMatchObject({
      result: 'ABANDONED',
      winnerNickname: 'BINH',
    });
  });
});
