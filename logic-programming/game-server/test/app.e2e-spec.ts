import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Cấu hình chỉ được đọc khi module khởi tạo (beforeAll), nên đặt ở đây là kịp.
process.env.DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'e2e-secret';
process.env.BCRYPT_ROUNDS = '4';

interface Ack<T = unknown> {
  ok: boolean;
  data?: T;
  errorKbn?: number;
  message?: string;
}

describe('Game server (e2e: HTTP + WebSocket)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    const server = app.getHttpServer() as unknown as Server;
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    await app.close();
  });

  async function registerAndLogin(username: string): Promise<string> {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username,
        password: 'secret123',
        nickname: username.toUpperCase(),
      })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password: 'secret123' })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  }

  function connect(namespace: string, token?: string): Promise<Socket> {
    const socket = io(`${baseUrl}${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function emit<T>(
    socket: Socket,
    event: string,
    data?: unknown,
  ): Promise<Ack<T>> {
    return socket.timeout(5000).emitWithAck(event, data) as Promise<Ack<T>>;
  }

  describe('tài khoản', () => {
    it('đăng ký, đăng nhập, xem và cập nhật thông tin; trùng tên thì 409; không token thì 401', async () => {
      const token = await registerAndLogin('alice');
      const server = app.getHttpServer();

      await request(server)
        .post('/auth/register')
        .send({ username: 'ALICE', password: 'secret123' })
        .expect(409);
      await request(server).get('/users/me').expect(401);
      await request(server)
        .post('/auth/login')
        .send({ username: 'alice', password: 'sai' })
        .expect(401);

      const me = await request(server)
        .patch('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'Alice Nguyễn', email: 'alice@example.com' })
        .expect(200);
      expect(me.body).toMatchObject({
        username: 'alice',
        nickname: 'Alice Nguyễn',
        email: 'alice@example.com',
      });
      expect(me.body).not.toHaveProperty('passwordHash');
    });

    it('dữ liệu sai thì 400 kèm thông báo tiếng Việt', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'a', password: '123', email: 'sai' })
        .expect(400);
      expect(res.body).toMatchObject({ errorKbn: 20001 });
      expect((res.body as { message: string[] }).message).toEqual([
        'Tên đăng nhập dài từ 3 tới 20 ký tự',
        'Mật khẩu dài từ 6 tới 72 ký tự',
        'Email không hợp lệ',
      ]);
    });
  });

  describe('một tài khoản chỉ online ở một nơi', () => {
    it('đang online thì đăng nhập nơi khác bị 409 (20006), token phiên cũ bị từ chối; offline rồi thì đăng nhập được', async () => {
      const server = app.getHttpServer();
      const login = () =>
        request(server)
          .post('/auth/login')
          .send({ username: 'duy', password: 'secret123' });
      const oldToken = await registerAndLogin('duy'); // phiên cũ, chưa mở trang nào
      const token = (
        (await login().expect(200)).body as { accessToken: string }
      ).accessToken;
      const lobby = await connect('/presence', token); // đang ở sảnh: online

      const blocked = await login().expect(409);
      expect(blocked.body).toMatchObject({
        errorKbn: 20006,
        message: 'Đã có người đang đăng nhập bằng tài khoản này ở nơi khác',
      });
      await expect(connect('/line98', oldToken)).rejects.toMatchObject({
        data: { errorKbn: 20006 },
      });
      await request(server)
        .get('/users/me')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(409);

      // Tab khác cùng phiên (cùng token) vẫn vào được.
      const game = await connect('/caro', token);
      lobby.disconnect();
      game.disconnect();
      // Server nhận ngắt kết nối không đồng bộ: thử lại vài lần.
      let status = 0;
      for (let i = 0; i < 20 && status !== 200; i++) {
        await new Promise((r) => setTimeout(r, 25));
        status = (await login()).status;
      }
      expect(status).toBe(200);
    });
  });

  describe('WebSocket: xác thực', () => {
    it('kết nối không có token hoặc token sai bị từ chối', async () => {
      await expect(connect('/line98')).rejects.toMatchObject({
        data: { errorKbn: 20002 },
      });
      await expect(connect('/caro', 'token-gia')).rejects.toMatchObject({
        data: { errorKbn: 20002 },
      });
    });
  });

  describe('Line 98', () => {
    it('vào ván, xin gợi ý, đi theo gợi ý; nước đi sai bị từ chối', async () => {
      const socket = await connect('/line98', await registerAndLogin('linh'));

      const resumed = await emit<{ board: number[][]; nextColors: number[] }>(
        socket,
        'line98:resume',
      );
      expect(resumed.ok).toBe(true);
      expect(resumed.data!.board.flat().filter((c) => c !== 0)).toHaveLength(5);
      expect(resumed.data!.nextColors).toHaveLength(3);

      const hint = await emit<{ from: object; to: object }>(
        socket,
        'line98:hint',
      );
      expect(hint.ok).toBe(true);

      const moved = await emit<{ path: object[]; game: { status: string } }>(
        socket,
        'line98:move',
        hint.data,
      );
      expect(moved.ok).toBe(true);
      expect(moved.data!.path.length).toBeGreaterThanOrEqual(2);

      const bad = await emit(socket, 'line98:move', {
        from: { row: 0, col: 0 },
        to: { row: 99, col: 0 },
      });
      expect(bad).toMatchObject({ ok: false, errorKbn: 30002 });
    });
  });

  describe('Cờ caro', () => {
    it('hai người được ghép cặp, đánh theo lượt, X thắng; lịch sử lưu đúng', async () => {
      const tokenA = await registerAndLogin('caro_a');
      const tokenB = await registerAndLogin('caro_b');
      const a = await connect('/caro', tokenA);
      const b = await connect('/caro', tokenB);

      const matchedA = new Promise<{ matchUuid: string; you: string }>((r) =>
        a.once('caro:matched', r),
      );
      const matchedB = new Promise<{ matchUuid: string; you: string }>((r) =>
        b.once('caro:matched', r),
      );
      expect((await emit(a, 'caro:find')).data).toEqual({ status: 'waiting' });
      expect((await emit(b, 'caro:find')).data).toEqual({ status: 'matched' });
      const [infoA, infoB] = await Promise.all([matchedA, matchedB]);
      expect(infoA.matchUuid).toBe(infoB.matchUuid);
      expect([infoA.you, infoB.you].sort()).toEqual(['O', 'X']);

      const [x, o] = infoA.you === 'X' ? [a, b] : [b, a];
      const matchUuid = infoA.matchUuid;
      const overOnO = new Promise<{ result: string; winLine: unknown[] }>((r) =>
        o.once('caro:over', r),
      );

      // O đi trước X thì bị từ chối.
      expect(
        await emit(o, 'caro:move', { matchUuid, row: 7, col: 7 }),
      ).toMatchObject({
        ok: false,
        errorKbn: 40003,
      });
      for (let col = 0; col < 4; col++) {
        expect(
          (await emit(x, 'caro:move', { matchUuid, row: 0, col })).ok,
        ).toBe(true);
        expect(
          (await emit(o, 'caro:move', { matchUuid, row: 1, col })).ok,
        ).toBe(true);
      }
      await emit(x, 'caro:move', { matchUuid, row: 0, col: 4 });

      const over = await overOnO;
      expect(over.result).toBe('X_WIN');
      expect(over.winLine).toHaveLength(5);

      const history = await request(app.getHttpServer())
        .get('/caro/matches')
        .set('Authorization', `Bearer ${infoA.you === 'X' ? tokenA : tokenB}`)
        .expect(200);
      expect((history.body as unknown[])[0]).toMatchObject({
        matchUuid,
        you: 'X',
        result: 'X_WIN',
        outcome: 'WIN',
        moveCount: 9,
      });
    });
  });
});
