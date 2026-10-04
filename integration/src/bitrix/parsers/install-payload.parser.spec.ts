import { parseInstallPayload } from './install-payload.parser';

describe('parseInstallPayload', () => {
  it('nhận dạng sự kiện ONAPPINSTALL (ứng dụng chỉ script)', () => {
    const parsed = parseInstallPayload(
      {},
      {
        event: 'ONAPPINSTALL',
        auth: {
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: '3600',
          domain: 'B24-Demo.bitrix24.vn',
          member_id: 'm1',
          application_token: 'app',
        },
      },
    );

    expect(parsed).toMatchObject({
      kind: 'event',
      tokens: {
        memberId: 'm1',
        domain: 'b24-demo.bitrix24.vn',
        accessToken: 'at',
        refreshToken: 'rt',
        applicationToken: 'app',
      },
    });
  });

  it('nhận dạng form AUTH_ID/REFRESH_ID (ứng dụng có giao diện), DOMAIN lấy từ query', () => {
    const before = Date.now();
    const parsed = parseInstallPayload(
      { DOMAIN: 'b24-demo.bitrix24.vn', PROTOCOL: '1' },
      {
        AUTH_ID: 'at',
        REFRESH_ID: 'rt',
        AUTH_EXPIRES: '3600',
        member_id: 'm1',
      },
    );

    expect(parsed?.kind).toBe('iframe');
    if (parsed?.kind !== 'iframe') return;
    expect(parsed.tokens.domain).toBe('b24-demo.bitrix24.vn');
    expect(parsed.tokens.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 3600_000,
    );
  });

  it('nhận dạng ?code=... (luồng OAuth chuẩn)', () => {
    expect(parseInstallPayload({ code: 'abc' }, {})).toEqual({
      kind: 'code',
      code: 'abc',
    });
  });

  it('trả về null khi thiếu trường bắt buộc hoặc không khớp dạng nào', () => {
    expect(
      parseInstallPayload({}, { event: 'ONAPPINSTALL', auth: {} }),
    ).toBeNull();
    expect(
      parseInstallPayload({}, { AUTH_ID: 'a', REFRESH_ID: 'r' }),
    ).toBeNull();
    expect(parseInstallPayload({}, { foo: 'bar' })).toBeNull();
  });
});
