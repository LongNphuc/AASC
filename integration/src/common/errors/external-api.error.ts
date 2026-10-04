import { HttpStatus } from '@nestjs/common';
import { isAxiosError } from 'axios';
import { ERROR } from '../constants/messages.constant';

/** Dịch vụ bên ngoài mà ứng dụng gọi tới. */
export type ExternalService = 'bitrix24' | 'bitrix24-oauth' | 'jotform';

/**
 * Phân loại lỗi khi gọi API bên ngoài. Mỗi loại ứng với một cách xử lý
 * (thử lại, làm mới token, báo người dùng cài lại...) và một mã HTTP trả về.
 */
export type ExternalErrorKind =
  | 'TIMEOUT' // quá thời gian chờ
  | 'NETWORK' // không kết nối được (DNS, từ chối kết nối, mất mạng)
  | 'TOKEN_EXPIRED' // access_token hết hạn hoặc không còn hợp lệ: làm mới được
  | 'AUTH' // sai thông tin xác thực (API key, webhook URL, thiếu quyền)
  | 'REINSTALL_REQUIRED' // refresh_token hỏng: phải cài lại ứng dụng
  | 'NOT_INSTALLED' // chưa có token nào được lưu
  | 'NOT_FOUND' // bản ghi không tồn tại
  | 'BAD_REQUEST' // dữ liệu gửi đi bị từ chối (4xx khác)
  | 'RATE_LIMIT' // vượt giới hạn số lệnh gọi
  | 'SERVER' // lỗi 5xx từ phía dịch vụ
  | 'INVALID_RESPONSE' // phản hồi sai định dạng
  | 'CONFIG'; // ứng dụng thiếu cấu hình

const HTTP_STATUS_BY_KIND: Record<ExternalErrorKind, HttpStatus> = {
  TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  NETWORK: HttpStatus.BAD_GATEWAY,
  TOKEN_EXPIRED: HttpStatus.BAD_GATEWAY,
  AUTH: HttpStatus.BAD_GATEWAY,
  REINSTALL_REQUIRED: HttpStatus.SERVICE_UNAVAILABLE,
  NOT_INSTALLED: HttpStatus.SERVICE_UNAVAILABLE,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  RATE_LIMIT: HttpStatus.SERVICE_UNAVAILABLE,
  SERVER: HttpStatus.BAD_GATEWAY,
  INVALID_RESPONSE: HttpStatus.BAD_GATEWAY,
  CONFIG: HttpStatus.INTERNAL_SERVER_ERROR,
};

export interface ExternalErrorDetails {
  /** Phương thức hoặc đường dẫn đã gọi, ví dụ `crm.contact.add`. */
  operation?: string;
  /** Mã HTTP mà dịch vụ bên ngoài trả về (nếu có). */
  upstreamStatus?: number;
  /** Mã lỗi của dịch vụ, ví dụ `expired_token`. */
  upstreamCode?: string;
  /** Mô tả lỗi gốc của dịch vụ. */
  upstreamMessage?: string;
}

/**
 * Lỗi chuẩn hóa khi gọi Bitrix24 hoặc Jotform. Không chứa URL hay token,
 * nên ghi log và trả về client an toàn.
 */
export class ExternalApiError extends Error {
  constructor(
    readonly service: ExternalService,
    readonly kind: ExternalErrorKind,
    message: string,
    readonly details: ExternalErrorDetails = {},
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }

  get httpStatus(): HttpStatus {
    return HTTP_STATUS_BY_KIND[this.kind];
  }
}

/**
 * Phân loại lỗi tầng mạng của axios (chưa nhận được phản hồi HTTP).
 * Trả về null nếu đã có phản hồi, để bên gọi tự đọc mã lỗi của dịch vụ.
 */
export function classifyTransportError(
  error: unknown,
  service: ExternalService,
  operation: string,
): ExternalApiError | null {
  if (!isAxiosError(error)) {
    return null;
  }
  if (error.response) {
    return null;
  }
  // axios báo timeout bằng ECONNABORTED (hoặc ETIMEDOUT tùy cấu hình).
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return new ExternalApiError(
      service,
      'TIMEOUT',
      ERROR.EXTERNAL.TIMEOUT(service, operation),
      { operation },
    );
  }
  return new ExternalApiError(
    service,
    'NETWORK',
    ERROR.EXTERNAL.NETWORK(service, operation, error.code),
    { operation },
  );
}
