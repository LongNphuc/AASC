import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { appConfig } from '../../config/app-config';
import { BitrixOAuthClient } from './bitrix-oauth.client';

const CONFIG = {
  bitrix: {
    clientId: 'local.app',
    clientSecret: 'secret',
    oauthTokenUrl: 'https://oauth.bitrix.info/oauth/token/',
  },
};

function oauthError(status: number, data: unknown): AxiosError {
  const config = { headers: {} } as InternalAxiosRequestConfig;
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError(
    'Request failed',
    'ERR_BAD_REQUEST',
    config,
    null,
    response,
  );
}

describe('BitrixOAuthClient', () => {
  let client: BitrixOAuthClient;
  let http: { get: jest.Mock };

  async function createClient(config: unknown = CONFIG) {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BitrixOAuthClient,
        { provide: HttpService, useValue: http },
        { provide: appConfig.KEY, useValue: config },
      ],
    }).compile();
    return moduleRef.get(BitrixOAuthClient);
  }

  beforeEach(async () => {
    http = { get: jest.fn() };
    client = await createClient();
  });

  it('làm mới token: gửi đúng tham số, lấy tên miền portal từ client_endpoint', async () => {
    http.get.mockReturnValue(
      of({
        data: {
          access_token: 'access-new',
          refresh_token: 'refresh-new',
          expires: 1_900_000_000,
          expires_in: 3600,
          domain: 'oauth.bitrix.info',
          client_endpoint: 'https://b24-demo.bitrix24.vn/rest/',
          member_id: 'm1',
          user_id: 1,
        },
      }),
    );

    const tokens = await client.refreshToken('refresh-old');

    expect(http.get).toHaveBeenCalledWith(CONFIG.bitrix.oauthTokenUrl, {
      params: {
        grant_type: 'refresh_token',
        client_id: 'local.app',
        client_secret: 'secret',
        refresh_token: 'refresh-old',
      },
    });
    expect(tokens).toMatchObject({
      memberId: 'm1',
      domain: 'b24-demo.bitrix24.vn',
      accessToken: 'access-new',
      refreshToken: 'refresh-new',
      expiresAt: new Date(1_900_000_000 * 1000),
    });
  });

  it('refresh_token hỏng (invalid_grant) -> REINSTALL_REQUIRED', async () => {
    http.get.mockReturnValue(
      throwError(() => oauthError(400, { error: 'invalid_grant' })),
    );
    await expect(client.refreshToken('sai')).rejects.toMatchObject({
      kind: 'REINSTALL_REQUIRED',
    });
  });

  it('code hết hạn khi đổi lấy token -> AUTH', async () => {
    http.get.mockReturnValue(
      throwError(() => oauthError(400, { error: 'invalid_grant' })),
    );
    await expect(client.exchangeCode('code-cu')).rejects.toMatchObject({
      kind: 'AUTH',
    });
  });

  it('sai CLIENT_ID/CLIENT_SECRET (invalid_client) -> CONFIG', async () => {
    http.get.mockReturnValue(
      throwError(() => oauthError(401, { error: 'invalid_client' })),
    );
    await expect(client.refreshToken('x')).rejects.toMatchObject({
      kind: 'CONFIG',
    });
  });

  it('chưa cấu hình CLIENT_ID thì báo CONFIG, không gọi máy chủ OAuth', async () => {
    client = await createClient({ bitrix: { oauthTokenUrl: 'x' } });
    await expect(client.refreshToken('x')).rejects.toMatchObject({
      kind: 'CONFIG',
    });
    expect(http.get).not.toHaveBeenCalled();
  });
});
