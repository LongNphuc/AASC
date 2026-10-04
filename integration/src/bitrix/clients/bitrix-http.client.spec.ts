import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { of, throwError } from 'rxjs';
import { BitrixHttpClient } from './bitrix-http.client';

const URL = 'https://demo.bitrix24.vn/rest/crm.contact.get.json';

function httpError(status: number, data: unknown): AxiosError {
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
    'ERR_BAD_RESPONSE',
    config,
    null,
    response,
  );
}

describe('BitrixHttpClient: chuẩn hóa lỗi', () => {
  let client: BitrixHttpClient;
  let http: { post: jest.Mock };

  beforeEach(async () => {
    http = { post: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [BitrixHttpClient, { provide: HttpService, useValue: http }],
    }).compile();
    client = moduleRef.get(BitrixHttpClient);
  });

  const call = () => client.post(URL, { id: 1 }, 'crm.contact.get', 'oauth');

  it('timeout -> TIMEOUT', async () => {
    http.post.mockReturnValue(
      throwError(
        () => new AxiosError('timeout of 10000ms exceeded', 'ECONNABORTED'),
      ),
    );
    await expect(call()).rejects.toMatchObject({ kind: 'TIMEOUT' });
  });

  it('mất kết nối -> NETWORK', async () => {
    http.post.mockReturnValue(
      throwError(() => new AxiosError('getaddrinfo ENOTFOUND', 'ENOTFOUND')),
    );
    await expect(call()).rejects.toMatchObject({ kind: 'NETWORK' });
  });

  it('401 expired_token -> TOKEN_EXPIRED, giữ mã lỗi gốc', async () => {
    http.post.mockReturnValue(
      throwError(() =>
        httpError(401, {
          error: 'expired_token',
          error_description: 'The access token provided has expired.',
        }),
      ),
    );
    await expect(call()).rejects.toMatchObject({
      kind: 'TOKEN_EXPIRED',
      details: { upstreamStatus: 401, upstreamCode: 'expired_token' },
    });
  });

  it('400 "Not found" -> NOT_FOUND', async () => {
    http.post.mockReturnValue(
      throwError(() =>
        httpError(400, { error: '', error_description: 'Not found' }),
      ),
    );
    await expect(call()).rejects.toMatchObject({ kind: 'NOT_FOUND' });
  });

  it('500 -> SERVER', async () => {
    http.post.mockReturnValue(
      throwError(() => httpError(500, '<html>error</html>')),
    );
    await expect(call()).rejects.toMatchObject({ kind: 'SERVER' });
  });

  it('HTTP 200 nhưng body báo lỗi -> vẫn ném lỗi', async () => {
    http.post.mockReturnValue(
      of({
        status: 200,
        data: { error: 'INVALID_CREDENTIALS', error_description: 'Invalid' },
      }),
    );
    await expect(call()).rejects.toMatchObject({ kind: 'AUTH' });
  });
});
