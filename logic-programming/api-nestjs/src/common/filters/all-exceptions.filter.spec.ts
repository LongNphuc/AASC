import { HttpStatus, NotFoundException } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { ValidationFailedException } from '../errors/validation-failed.exception';
import { ErrorKbn } from '../kbn/error.kbn';
import { toErrorResponse } from './all-exceptions.filter';

describe('toErrorResponse: body lỗi { r, m, f?, d? }', () => {
  it('lỗi validate: r = 20001, m theo mã, lỗi từng trường ở f', () => {
    const error = new ValidationFailedException({
      title: ['Tiêu đề là bắt buộc'],
    });
    expect(toErrorResponse(error, '/tasks')).toEqual({
      r: 20001,
      m: 'Dữ liệu không hợp lệ',
      f: { title: ['Tiêu đề là bắt buộc'] },
    });
  });

  it('lỗi nghiệp vụ: thông tin phụ ở d', () => {
    const error = new AppException(
      ErrorKbn.TASK_NOT_FOUND,
      HttpStatus.NOT_FOUND,
      { uuid: 'abc' },
    );
    expect(toErrorResponse(error, '/tasks/abc')).toEqual({
      r: 30001,
      m: 'Task không tồn tại hoặc đã bị xóa',
      d: { uuid: 'abc' },
    });
  });

  it('đường dẫn không tồn tại: r = 20002, d có path', () => {
    expect(toErrorResponse(new NotFoundException(), '/khong-co')).toEqual({
      r: 20002,
      m: 'Đường dẫn không tồn tại',
      d: { path: '/khong-co' },
    });
  });

  it('lỗi lạ của hệ thống: r = 90001, không lộ chi tiết lỗi cho client', () => {
    const body = toErrorResponse(
      new Error('SQLITE_BUSY: database is locked'),
      '/tasks',
    );
    expect(body).toEqual({ r: 90001, m: 'Lỗi máy chủ nội bộ' });
  });
});
