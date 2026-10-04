import { HttpException } from '@nestjs/common';
import {
  ExternalApiError,
  ExternalErrorKind,
  ExternalService,
} from '../errors/external-api.error';

/**
 * Mã lỗi (error_kbn), dùng chung cho DB và log. Mã gồm 5 chữ số:
 *
 *   chữ số đầu  = lỗi xảy ra ở đâu (ErrorSource)
 *   4 số cuối   = loại lỗi
 *
 * Ví dụ 40003 = Bitrix24 REST, lỗi xác thực; 30001 = Jotform, timeout.
 * Nhìn chữ số đầu là biết cần kiểm tra hệ thống nào.
 */
export enum ErrorSource {
  /** Request hoặc dữ liệu gửi vào ứng dụng. */
  REQUEST = 2,
  JOTFORM = 3,
  BITRIX24 = 4,
  BITRIX24_OAUTH = 5,
  /** Lỗi bên trong ứng dụng. */
  SYSTEM = 9,
}

/** 4 số cuối của lỗi khi gọi dịch vụ bên ngoài (nguồn 3, 4, 5). */
export const EXTERNAL_KIND_CODE: Record<ExternalErrorKind, number> = {
  TIMEOUT: 1,
  NETWORK: 2,
  AUTH: 3,
  TOKEN_EXPIRED: 4,
  REINSTALL_REQUIRED: 5,
  NOT_INSTALLED: 6,
  NOT_FOUND: 7,
  BAD_REQUEST: 8,
  RATE_LIMIT: 9,
  SERVER: 10,
  INVALID_RESPONSE: 11,
  CONFIG: 12,
};

/** Mã lỗi của request gửi vào (nguồn 2) và lỗi hệ thống (nguồn 9). */
export enum ErrorKbn {
  /** Dữ liệu không hợp lệ (validate DTO, submission thiếu/sai trường). */
  VALIDATION = 20001,
  /** Thiếu hoặc sai API key. */
  UNAUTHORIZED = 20002,
  /** Bản ghi hoặc đường dẫn không tồn tại. */
  NOT_FOUND = 20003,
  /** Submission không thuộc form đã cấu hình. */
  FORM_MISMATCH = 20004,
  /** Ứng dụng thiếu cấu hình. */
  CONFIG = 90002,
  /** Lỗi không lường trước. */
  UNKNOWN = 90001,
}

const SOURCE_BY_SERVICE: Record<ExternalService, ErrorSource> = {
  jotform: ErrorSource.JOTFORM,
  bitrix24: ErrorSource.BITRIX24,
  'bitrix24-oauth': ErrorSource.BITRIX24_OAUTH,
};

/** Lỗi tự mang mã kbn của nó (ví dụ InvalidSubmissionError). */
export interface WithErrorKbn {
  errorKbn: number;
}

export function externalErrorKbn(
  service: ExternalService,
  kind: ExternalErrorKind,
): number {
  return SOURCE_BY_SERVICE[service] * 10000 + EXTERNAL_KIND_CODE[kind];
}

/** Suy ra error_kbn từ một lỗi bất kỳ. */
export function errorKbnOf(error: unknown): number {
  if (error instanceof ExternalApiError) {
    return externalErrorKbn(error.service, error.kind);
  }
  if (hasErrorKbn(error)) {
    return error.errorKbn;
  }
  if (error instanceof HttpException) {
    const status = error.getStatus();
    if (status === 401 || status === 403) return ErrorKbn.UNAUTHORIZED;
    if (status === 404) return ErrorKbn.NOT_FOUND;
    if (status < 500) return ErrorKbn.VALIDATION;
  }
  return ErrorKbn.UNKNOWN;
}

/** Tên dễ đọc của mã lỗi, dùng trong log: 40003 -> "BITRIX24.AUTH". */
export function describeErrorKbn(code: number): string {
  const source = ErrorSource[Math.floor(code / 10000)] ?? 'UNKNOWN_SOURCE';
  const name =
    ErrorKbn[code] ??
    Object.entries(EXTERNAL_KIND_CODE).find(
      ([, suffix]) => suffix === code % 10000,
    )?.[0] ??
    String(code);
  return `${source}.${name}`;
}

function hasErrorKbn(error: unknown): error is WithErrorKbn {
  return (
    !!error &&
    typeof error === 'object' &&
    typeof (error as Partial<WithErrorKbn>).errorKbn === 'number'
  );
}
