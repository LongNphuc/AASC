import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ERROR } from '../../common/constants/messages.constant';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { appConfig } from '../../config/app-config';
import { User } from '../../users/entities/user.entity';
import { NewUser, UsersService } from '../../users/services/users.service';
import { AuthService } from './auth.service';
import { PresenceService } from './presence.service';

/** UsersService giả, lưu người dùng trong mảng. */
function fakeUsers() {
  const rows: User[] = [];
  return {
    rows,
    create: jest.fn((data: NewUser) => {
      const user = Object.assign(new User(), data, {
        uuid: `uuid-${rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      rows.push(user);
      return Promise.resolve(user);
    }),
    findByUsername: jest.fn((username: string) =>
      Promise.resolve(rows.find((u) => u.username === username) ?? null),
    ),
    findByUuid: jest.fn((uuid: string) =>
      Promise.resolve(rows.find((u) => u.uuid === uuid) ?? null),
    ),
    updateProfile: jest.fn((user: User, changes: Partial<User>) =>
      Promise.resolve(Object.assign(user, changes)),
    ),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let users: ReturnType<typeof fakeUsers>;

  beforeEach(async () => {
    users = fakeUsers();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        PresenceService,
        { provide: UsersService, useValue: users },
        {
          provide: JwtService,
          useValue: new JwtService({
            secret: 'test-secret',
            signOptions: { expiresIn: '1h' },
          }),
        },
        {
          provide: appConfig.KEY,
          // bcrypt cost 4 (thấp nhất) cho test chạy nhanh.
          useValue: { bcryptRounds: 4, jwt: { expiresIn: '1h' } },
        },
      ],
    }).compile();
    service = moduleRef.get(AuthService);
  });

  it('đăng ký: lưu mật khẩu dạng băm bcrypt, không lưu mật khẩu gốc; nickname mặc định là tên đăng nhập', async () => {
    const profile = await service.register({
      username: 'long',
      password: 'secret123',
    });

    const stored = users.rows[0];
    expect(stored.passwordHash).not.toBe('secret123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$04\$/);
    expect(profile).toMatchObject({
      username: 'long',
      nickname: 'long',
      email: null,
    });
    expect(profile).not.toHaveProperty('passwordHash');
  });

  it('tên đăng nhập đã có thì báo USERNAME_TAKEN (409)', async () => {
    await service.register({ username: 'long', password: 'secret123' });
    await expect(
      service.register({ username: 'long', password: 'khac123' }),
    ).rejects.toMatchObject({ errorKbn: ErrorKbn.USERNAME_TAKEN, status: 409 });
  });

  it('đăng nhập đúng: cấp JWT, token xác thực lại ra đúng người dùng', async () => {
    await service.register({
      username: 'long',
      password: 'secret123',
      nickname: 'Long',
    });

    const result = await service.login({
      username: 'long',
      password: 'secret123',
    });
    const authUser = await service.verifyToken(result.accessToken);

    expect(result.tokenType).toBe('Bearer');
    expect(authUser).toEqual({
      uuid: 'uuid-1',
      username: 'long',
      nickname: 'Long',
      sessionId: expect.any(String) as string,
    });
  });

  it('sai mật khẩu hoặc sai tên đăng nhập đều báo cùng lỗi INVALID_CREDENTIALS (401)', async () => {
    await service.register({ username: 'long', password: 'secret123' });
    for (const dto of [
      { username: 'long', password: 'sai-mat-khau' },
      { username: 'khong-co', password: 'secret123' },
    ]) {
      await expect(service.login(dto)).rejects.toMatchObject({
        errorKbn: ErrorKbn.INVALID_CREDENTIALS,
        status: 401,
      });
    }
  });

  it('token thiếu, sai hoặc giả mạo đều bị từ chối (UNAUTHORIZED)', async () => {
    const forged = new JwtService({ secret: 'khoa-khac' }).sign({
      sub: 'uuid-1',
      username: 'long',
    });
    for (const token of [undefined, 'abc', forged]) {
      await expect(service.verifyToken(token)).rejects.toMatchObject({
        errorKbn: ErrorKbn.UNAUTHORIZED,
      });
    }
  });

  it('đang online thì đăng nhập nơi khác bị từ chối ACCOUNT_IN_USE (409); offline rồi thì đăng nhập được', async () => {
    await service.register({ username: 'long', password: 'secret123' });
    const dto = { username: 'long', password: 'secret123' };
    const me = await service.verifyToken(
      (await service.login(dto)).accessToken,
    );
    service.markOnline(me, 'socket-1');

    await expect(service.login(dto)).rejects.toMatchObject({
      errorKbn: ErrorKbn.ACCOUNT_IN_USE,
      status: 409,
    });
    // Sai mật khẩu vẫn chỉ báo sai mật khẩu: không lộ ai đang online.
    await expect(
      service.login({ ...dto, password: 'sai-mat-khau' }),
    ).rejects.toMatchObject({ errorKbn: ErrorKbn.INVALID_CREDENTIALS });

    service.markOffline(me, 'socket-1');
    await expect(service.login(dto)).resolves.toHaveProperty('accessToken');
  });

  it('phiên đang online: tab khác cùng phiên vẫn vào được, token của phiên khác bị từ chối', async () => {
    await service.register({ username: 'long', password: 'secret123' });
    const dto = { username: 'long', password: 'secret123' };
    const oldToken = (await service.login(dto)).accessToken; // phiên cũ, đã đóng trình duyệt
    const newToken = (await service.login(dto)).accessToken; // phiên mới
    const me = await service.verifyToken(newToken);
    service.markOnline(me, 'tab-1');

    const sameSession = await service.verifyToken(newToken);
    expect(() => service.markOnline(sameSession, 'tab-2')).not.toThrow();
    await expect(service.verifyToken(oldToken)).rejects.toMatchObject({
      errorKbn: ErrorKbn.ACCOUNT_IN_USE,
    });
    // Hai nơi kết nối cùng lúc: nơi kết nối sau bị từ chối.
    expect(() =>
      service.markOnline({ ...me, sessionId: 'phien-khac' }, 'socket-x'),
    ).toThrow(ERROR.AUTH.ACCOUNT_IN_USE);
  });

  it('cập nhật email, nickname; không gửi trường nào thì báo lỗi', async () => {
    await service.register({ username: 'long', password: 'secret123' });
    const me = await service.verifyToken(
      (await service.login({ username: 'long', password: 'secret123' }))
        .accessToken,
    );

    const updated = await service.updateProfile(me, {
      email: 'long@example.com',
      nickname: 'Long Nguyễn',
    });
    expect(updated).toMatchObject({
      email: 'long@example.com',
      nickname: 'Long Nguyễn',
    });
    await expect(service.updateProfile(me, {})).rejects.toMatchObject({
      errorKbn: ErrorKbn.VALIDATION,
    });
  });
});
