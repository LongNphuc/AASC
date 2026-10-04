import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ExternalApiError } from '../errors/external-api.error';
import { describeErrorKbn, ErrorKbn, errorKbnOf } from './error.kbn';

describe('error.kbn', () => {
  it('lỗi dịch vụ ngoài: chữ số đầu là nguồn, 4 số cuối là loại lỗi', () => {
    expect(errorKbnOf(new ExternalApiError('bitrix24', 'AUTH', 'x'))).toBe(
      40003,
    );
    expect(errorKbnOf(new ExternalApiError('jotform', 'TIMEOUT', 'x'))).toBe(
      30001,
    );
    expect(
      errorKbnOf(
        new ExternalApiError('bitrix24-oauth', 'REINSTALL_REQUIRED', 'x'),
      ),
    ).toBe(50005);
  });

  it('lỗi HTTP của request gửi vào', () => {
    expect(errorKbnOf(new BadRequestException())).toBe(ErrorKbn.VALIDATION);
    expect(errorKbnOf(new UnauthorizedException())).toBe(ErrorKbn.UNAUTHORIZED);
    expect(errorKbnOf(new NotFoundException())).toBe(ErrorKbn.NOT_FOUND);
  });

  it('lỗi tự mang mã kbn thì dùng mã đó; lỗi lạ là UNKNOWN', () => {
    const formMismatch = Object.assign(new Error('x'), {
      errorKbn: ErrorKbn.FORM_MISMATCH,
    });
    expect(errorKbnOf(formMismatch)).toBe(20004);
    expect(errorKbnOf(new Error('boom'))).toBe(ErrorKbn.UNKNOWN);
  });

  it('describeErrorKbn trả tên dễ đọc', () => {
    expect(describeErrorKbn(40003)).toBe('BITRIX24.AUTH');
    expect(describeErrorKbn(30001)).toBe('JOTFORM.TIMEOUT');
    expect(describeErrorKbn(20001)).toBe('REQUEST.VALIDATION');
    expect(describeErrorKbn(90001)).toBe('SYSTEM.UNKNOWN');
  });
});
