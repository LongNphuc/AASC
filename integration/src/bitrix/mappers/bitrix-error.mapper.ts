import { isAxiosError } from 'axios';
import {
  classifyTransportError,
  ExternalApiError,
  ExternalErrorKind,
  ExternalService,
} from '../../common/errors/external-api.error';
import { BitrixErrorBody } from '../types/bitrix.types';
import { ERROR } from '../../common/constants/messages.constant';

// Token hết hạn hoặc bị thu hồi: làm mới token rồi gọi lại là đủ.
const TOKEN_EXPIRED_CODES = new Set(['expired_token', 'invalid_token']);

// Sai thông tin xác thực hoặc thiếu quyền: làm mới token không giúp được.
const AUTH_CODES = new Set([
  'NO_AUTH_FOUND',
  'INVALID_CREDENTIALS',
  'WRONG_AUTH_TYPE',
  'insufficient_scope',
  'ACCESS_DENIED',
  'authorization_error',
  'user_access_error',
]);

const RATE_LIMIT_CODES = new Set([
  'QUERY_LIMIT_EXCEEDED',
  'OPERATION_TIME_LIMIT',
]);

/**
 * Xếp lỗi Bitrix24 vào một loại dựa trên mã lỗi trong body và mã HTTP.
 * Mã lỗi trong body được xét trước vì cụ thể hơn mã HTTP.
 */
export function classifyBitrixError(
  httpStatus: number | undefined,
  body: BitrixErrorBody,
): ExternalErrorKind {
  const code = body.error ?? '';
  const description = body.error_description ?? '';

  if (TOKEN_EXPIRED_CODES.has(code)) return 'TOKEN_EXPIRED';
  if (AUTH_CODES.has(code)) return 'AUTH';
  if (RATE_LIMIT_CODES.has(code) || httpStatus === 429) return 'RATE_LIMIT';
  // crm.contact.get/update/delete với ID không tồn tại trả 400 "Not found".
  if (/not found/i.test(description) && code !== 'ERROR_METHOD_NOT_FOUND') {
    return 'NOT_FOUND';
  }
  if (httpStatus === 401 || httpStatus === 403) return 'AUTH';
  if (httpStatus !== undefined && httpStatus >= 500) return 'SERVER';
  return 'BAD_REQUEST';
}

/**
 * Chuyển mọi lỗi phát sinh khi gọi Bitrix24 thành ExternalApiError:
 * lỗi mạng/timeout, lỗi HTTP 4xx/5xx, hoặc phản hồi 200 mà có trường `error`.
 */
export function toBitrixError(
  error: unknown,
  operation: string,
  service: ExternalService = 'bitrix24',
): ExternalApiError {
  if (error instanceof ExternalApiError) {
    return error;
  }
  const transport = classifyTransportError(error, service, operation);
  if (transport) {
    return transport;
  }
  if (isAxiosError(error) && error.response) {
    return fromErrorBody(
      error.response.status,
      error.response.data,
      operation,
      service,
    );
  }
  return new ExternalApiError(
    service,
    'INVALID_RESPONSE',
    ERROR.EXTERNAL.UNKNOWN(service, operation, String(error)),
    { operation },
  );
}

export function fromErrorBody(
  httpStatus: number | undefined,
  data: unknown,
  operation: string,
  service: ExternalService = 'bitrix24',
): ExternalApiError {
  // Proxy hoặc trang lỗi có thể trả HTML thay vì JSON.
  const body: BitrixErrorBody = data && typeof data === 'object' ? data : {};
  const kind = classifyBitrixError(httpStatus, body);
  const reason = body.error_description || body.error || `HTTP ${httpStatus}`;
  return new ExternalApiError(
    service,
    kind,
    ERROR.BITRIX.REQUEST_FAILED(kind, operation, reason),
    {
      operation,
      upstreamStatus: httpStatus,
      upstreamCode: body.error || undefined,
      upstreamMessage: body.error_description || undefined,
    },
  );
}
