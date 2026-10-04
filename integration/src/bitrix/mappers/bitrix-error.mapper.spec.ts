import { AxiosError } from 'axios';
import { ExternalApiError } from '../../common/errors/external-api.error';
import {
  classifyBitrixError,
  fromErrorBody,
  toBitrixError,
} from './bitrix-error.mapper';

describe('bitrix-error.mapper', () => {
  describe('classifyBitrixError: ưu tiên mã lỗi trong body, sau đó mới tới mã HTTP', () => {
    it.each([
      [401, 'expired_token', '', 'TOKEN_EXPIRED'],
      [401, 'invalid_token', '', 'TOKEN_EXPIRED'],
      [401, 'NO_AUTH_FOUND', '', 'AUTH'],
      [401, 'INVALID_CREDENTIALS', '', 'AUTH'],
      [403, 'insufficient_scope', '', 'AUTH'],
      [503, 'QUERY_LIMIT_EXCEEDED', '', 'RATE_LIMIT'],
      [400, '', 'Not found', 'NOT_FOUND'],
      [404, 'ERROR_METHOD_NOT_FOUND', 'Method not found!', 'BAD_REQUEST'],
      [400, 'ERROR_CORE', 'Wrong value', 'BAD_REQUEST'],
      [502, '', '', 'SERVER'],
      [403, '', '', 'AUTH'],
    ])(
      'HTTP %s, error=%s, mô tả=%s -> %s',
      (status, error, description, kind) => {
        expect(
          classifyBitrixError(status, {
            error,
            error_description: description,
          }),
        ).toBe(kind);
      },
    );
  });

  it('fromErrorBody giữ mã lỗi và mô tả gốc trong details', () => {
    const error = fromErrorBody(
      401,
      {
        error: 'expired_token',
        error_description: 'The access token provided has expired.',
      },
      'crm.contact.list',
    );

    expect(error).toMatchObject({
      service: 'bitrix24',
      kind: 'TOKEN_EXPIRED',
      details: {
        operation: 'crm.contact.list',
        upstreamStatus: 401,
        upstreamCode: 'expired_token',
        upstreamMessage: 'The access token provided has expired.',
      },
    });
    expect(error.message).toContain('The access token provided has expired.');
  });

  it('fromErrorBody chịu được body không phải JSON (trang lỗi HTML)', () => {
    expect(fromErrorBody(500, '<html>Bad Gateway</html>', 'x').kind).toBe(
      'SERVER',
    );
  });

  it('toBitrixError: lỗi đã chuẩn hóa thì giữ nguyên, timeout thành TIMEOUT', () => {
    const existing = new ExternalApiError('bitrix24', 'AUTH', 'x');
    expect(toBitrixError(existing, 'x')).toBe(existing);
    expect(
      toBitrixError(new AxiosError('timeout', 'ECONNABORTED'), 'x').kind,
    ).toBe('TIMEOUT');
    expect(toBitrixError(new Error('lạ'), 'x').kind).toBe('INVALID_RESPONSE');
  });
});
