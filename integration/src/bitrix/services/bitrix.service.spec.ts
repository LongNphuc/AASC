import { Test } from '@nestjs/testing';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { BitrixHttpClient } from '../clients/bitrix-http.client';
import { BitrixTokenService } from './bitrix-token.service';
import { BitrixService } from './bitrix.service';
import { BitrixInstallation } from '../entities/bitrix-installation.entity';

function makeInstallation(accessToken: string): BitrixInstallation {
  return Object.assign(new BitrixInstallation(), {
    memberId: 'member-1',
    domain: 'demo.bitrix24.vn',
    accessToken,
    refreshToken: 'refresh-token',
    expiresAt: new Date(Date.now() + 3600_000),
  });
}

const expiredTokenError = () =>
  new ExternalApiError('bitrix24', 'TOKEN_EXPIRED', 'expired', {
    upstreamCode: 'expired_token',
  });

type PostArgs = [
  url: string,
  body: Record<string, unknown>,
  method: string,
  channel: string,
];

describe('BitrixService.callBitrixAPI', () => {
  let service: BitrixService;
  let http: { post: jest.Mock<Promise<unknown>, PostArgs> };
  let tokens: { getValidInstallation: jest.Mock; refresh: jest.Mock };

  beforeEach(async () => {
    http = { post: jest.fn<Promise<unknown>, PostArgs>() };
    tokens = { getValidInstallation: jest.fn(), refresh: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        BitrixService,
        { provide: BitrixHttpClient, useValue: http },
        { provide: BitrixTokenService, useValue: tokens },
      ],
    }).compile();

    service = moduleRef.get(BitrixService);
    tokens.getValidInstallation.mockResolvedValue(
      makeInstallation('token-old'),
    );
  });

  it('gọi đúng URL REST của portal, gửi access_token trong body và trả về phản hồi', async () => {
    const response = { result: [{ ID: '1', NAME: 'An' }], total: 1 };
    http.post.mockResolvedValue(response);

    const result = await service.callBitrixAPI('crm.contact.list', {
      select: ['ID', 'NAME'],
    });

    expect(result).toEqual(response);
    expect(http.post).toHaveBeenCalledWith(
      'https://demo.bitrix24.vn/rest/crm.contact.list.json',
      { select: ['ID', 'NAME'], auth: 'token-old' },
      'crm.contact.list',
      'oauth',
    );
    expect(tokens.refresh).not.toHaveBeenCalled();
  });

  it('khi Bitrix24 báo expired_token: làm mới token rồi gọi lại đúng một lần với token mới', async () => {
    tokens.refresh.mockResolvedValue(makeInstallation('token-new'));
    http.post
      .mockRejectedValueOnce(expiredTokenError())
      .mockResolvedValueOnce({ result: [], total: 0 });

    const result = await service.callBitrixAPI('crm.contact.list');

    expect(result).toEqual({ result: [], total: 0 });
    expect(tokens.refresh).toHaveBeenCalledWith('member-1');
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(http.post.mock.calls[1][1]).toEqual({ auth: 'token-new' });
  });

  it('không thử lại lần thứ hai nếu token mới vẫn bị từ chối', async () => {
    tokens.refresh.mockResolvedValue(makeInstallation('token-new'));
    http.post.mockRejectedValue(expiredTokenError());

    await expect(
      service.callBitrixAPI('crm.contact.list'),
    ).rejects.toMatchObject({
      kind: 'TOKEN_EXPIRED',
    });
    expect(tokens.refresh).toHaveBeenCalledTimes(1);
    expect(http.post).toHaveBeenCalledTimes(2);
  });

  it('không làm mới token với lỗi không liên quan tới token (ví dụ timeout)', async () => {
    http.post.mockRejectedValue(
      new ExternalApiError('bitrix24', 'TIMEOUT', 'timeout'),
    );

    await expect(
      service.callBitrixAPI('crm.contact.list'),
    ).rejects.toMatchObject({
      kind: 'TIMEOUT',
    });
    expect(tokens.refresh).not.toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('listAll đọc tiếp các trang theo `next` cho tới khi hết', async () => {
    http.post
      .mockResolvedValueOnce({ result: [{ ID: '1' }], next: 50 })
      .mockResolvedValueOnce({ result: [{ ID: '2' }] });

    const items = await service.listAll('crm.requisite.list', { filter: {} });

    expect(items).toEqual([{ ID: '1' }, { ID: '2' }]);
    expect(http.post.mock.calls[1][1]).toMatchObject({ start: 50 });
  });
});
