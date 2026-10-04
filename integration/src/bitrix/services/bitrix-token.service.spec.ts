import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { appConfig } from '../../config/app-config';
import { BitrixOAuthClient } from '../clients/bitrix-oauth.client';
import { BitrixTokenService } from './bitrix-token.service';
import { BitrixInstallation } from '../entities/bitrix-installation.entity';

describe('BitrixTokenService', () => {
  let service: BitrixTokenService;
  let stored: BitrixInstallation;
  let repo: { findOneBy: jest.Mock; save: jest.Mock };
  let oauth: { refreshToken: jest.Mock };

  beforeEach(async () => {
    stored = Object.assign(new BitrixInstallation(), {
      memberId: 'member-1',
      domain: 'demo.bitrix24.vn',
      accessToken: 'access-old',
      refreshToken: 'refresh-old',
      expiresAt: new Date(Date.now() - 1000), // đã hết hạn
    });
    repo = {
      findOneBy: jest.fn(() =>
        Promise.resolve({ ...stored, expiresAt: stored.expiresAt }),
      ),
      save: jest.fn((entity: BitrixInstallation) => Promise.resolve(entity)),
    };
    oauth = { refreshToken: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BitrixTokenService,
        { provide: getRepositoryToken(BitrixInstallation), useValue: repo },
        { provide: BitrixOAuthClient, useValue: oauth },
        {
          provide: appConfig.KEY,
          useValue: { bitrix: { domain: 'demo.bitrix24.vn' } },
        },
      ],
    }).compile();
    service = moduleRef.get(BitrixTokenService);
  });

  it('token hết hạn: getValidInstallation làm mới và lưu CẢ refresh_token mới', async () => {
    oauth.refreshToken.mockResolvedValue({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const installation = await service.getValidInstallation();

    expect(oauth.refreshToken).toHaveBeenCalledWith('refresh-old');
    expect(installation.accessToken).toBe('access-new');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'refresh-new' }),
    );
  });

  it('nhiều request cùng làm mới một lúc chỉ gọi máy chủ OAuth một lần', async () => {
    let resolveRefresh!: (value: unknown) => void;
    oauth.refreshToken.mockReturnValue(
      new Promise((resolve) => (resolveRefresh = resolve)),
    );

    const calls = [
      service.refresh('member-1'),
      service.refresh('member-1'),
      service.refresh('member-1'),
    ];
    // Chờ performRefresh đọc DB xong và gọi OAuth.
    await new Promise((resolve) => setImmediate(resolve));
    resolveRefresh({
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(Date.now() + 3600_000),
    });
    const results = await Promise.all(calls);

    expect(oauth.refreshToken).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.accessToken === 'access-new')).toBe(true);
  });

  it('refresh_token hỏng: ném REINSTALL_REQUIRED và giữ nguyên token cũ', async () => {
    oauth.refreshToken.mockRejectedValue(
      new ExternalApiError('bitrix24-oauth', 'REINSTALL_REQUIRED', 'reinstall'),
    );

    await expect(service.refresh('member-1')).rejects.toMatchObject({
      kind: 'REINSTALL_REQUIRED',
    });
    expect(repo.save).not.toHaveBeenCalled();
  });
});

/**
 * Hàm batch gọi: chạy với SQLite in-memory thật để chắc điều kiện lọc theo
 * expires_at (so sánh thời gian trong SQLite) đúng.
 */
describe('BitrixTokenService.refreshExpiring (SQLite in-memory)', () => {
  const WINDOW_MS = 35 * 60_000;
  const inMinutes = (minutes: number) =>
    new Date(Date.now() + minutes * 60_000);

  let service: BitrixTokenService;
  let repo: Repository<BitrixInstallation>;
  let oauth: { refreshToken: jest.Mock };
  let close: () => Promise<void>;

  /** Tạo các portal với token còn sống số phút tương ứng. */
  async function seed(minutesLeft: Record<string, number>): Promise<void> {
    for (const [memberId, minutes] of Object.entries(minutesLeft)) {
      await repo.save(
        repo.create({
          memberId,
          domain: `${memberId}.bitrix24.vn`,
          accessToken: 'access-old',
          refreshToken: `refresh-${memberId}`,
          expiresAt: inMinutes(minutes),
        }),
      );
    }
  }

  beforeEach(async () => {
    oauth = {
      refreshToken: jest.fn((refreshToken: string) =>
        Promise.resolve({
          accessToken: 'access-new',
          refreshToken: `${refreshToken}-new`,
          expiresAt: inMinutes(60),
        }),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [BitrixInstallation],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([BitrixInstallation]),
      ],
      providers: [
        BitrixTokenService,
        { provide: BitrixOAuthClient, useValue: oauth },
        { provide: appConfig.KEY, useValue: { bitrix: {} } },
      ],
    }).compile();
    service = moduleRef.get(BitrixTokenService);
    repo = moduleRef.get(getRepositoryToken(BitrixInstallation));
    close = () => moduleRef.close();
  });

  afterEach(() => close());

  it('chỉ làm mới token đã hết hạn hoặc còn dưới 35 phút; token còn lâu giữ nguyên', async () => {
    await seed({ expired: -5, soon: 10, edge: 34, later: 50 });

    const result = await service.refreshExpiring(WINDOW_MS);

    expect(result).toEqual({ total: 3, refreshed: 3, failed: 0 });
    const refreshedWith = oauth.refreshToken.mock.calls.map(
      ([token]: [string]) => token,
    );
    expect(refreshedWith.sort()).toEqual([
      'refresh-edge',
      'refresh-expired',
      'refresh-soon',
    ]);
    const later = await repo.findOneByOrFail({ memberId: 'later' });
    expect(later.refreshToken).toBe('refresh-later');
    const soon = await repo.findOneByOrFail({ memberId: 'soon' });
    expect(soon.refreshToken).toBe('refresh-soon-new');
  });

  it('một portal làm mới lỗi không chặn các portal khác', async () => {
    await seed({ broken: 5, ok: 5 });
    oauth.refreshToken.mockImplementation((refreshToken: string) =>
      refreshToken === 'refresh-broken'
        ? Promise.reject(
            new ExternalApiError('bitrix24-oauth', 'REINSTALL_REQUIRED', 'x'),
          )
        : Promise.resolve({
            accessToken: 'access-new',
            refreshToken: `${refreshToken}-new`,
            expiresAt: inMinutes(60),
          }),
    );

    const result = await service.refreshExpiring(WINDOW_MS);

    expect(result).toEqual({ total: 2, refreshed: 1, failed: 1 });
    const ok = await repo.findOneByOrFail({ memberId: 'ok' });
    expect(ok.refreshToken).toBe('refresh-ok-new');
  });

  it('không có token nào sắp hết hạn thì không gọi máy chủ OAuth', async () => {
    await seed({ later: 50 });

    expect(await service.refreshExpiring(WINDOW_MS)).toEqual({
      total: 0,
      refreshed: 0,
      failed: 0,
    });
    expect(oauth.refreshToken).not.toHaveBeenCalled();
  });
});
