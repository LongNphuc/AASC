/** Phản hồi chuẩn của Bitrix24 REST API. */
export interface BitrixResponse<T> {
  result: T;
  /** Tổng số bản ghi (với phương thức *.list). */
  total?: number;
  /** Vị trí bắt đầu của trang kế tiếp; không có nghĩa là đã hết dữ liệu. */
  next?: number;
  time?: Record<string, unknown>;
}

/** Phản hồi lỗi của Bitrix24 (REST và máy chủ OAuth). */
export interface BitrixErrorBody {
  error?: string;
  error_description?: string;
}

/** Phản hồi của https://oauth.bitrix.info/oauth/token/ */
export interface BitrixOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  /** Thời điểm hết hạn, tính bằng giây Unix. */
  expires?: number;
  /** Tuổi thọ access_token, tính bằng giây (thường 3600). */
  expires_in: number;
  scope?: string;
  /** Tên miền máy chủ OAuth (oauth.bitrix.info), không phải portal. */
  domain?: string;
  /** Địa chỉ REST của portal, ví dụ https://xxx.bitrix24.vn/rest/ */
  client_endpoint: string;
  server_endpoint?: string;
  member_id: string;
  user_id?: number;
  status?: string;
}

/** Bộ token đã chuẩn hóa, dùng chung cho cả ba cách cài đặt. */
export interface BitrixTokenSet {
  memberId: string;
  /** Tên miền portal, ví dụ b24-4totiv.bitrix24.vn */
  domain: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope?: string;
  userId?: number;
  applicationToken?: string;
}

/** Trường nhiều giá trị của CRM (PHONE, EMAIL, WEB). */
export interface BitrixMultiField {
  ID?: string;
  VALUE: string;
  VALUE_TYPE?: string;
  TYPE_ID?: string;
  /** Gửi 'Y' kèm ID để xóa giá trị đó khi update. */
  DELETE?: 'Y';
}

/**
 * Tuổi thọ access_token suy ra từ dữ liệu Bitrix24 gửi về: ưu tiên mốc hết
 * hạn tuyệt đối, nếu không có thì cộng số giây còn sống vào thời điểm hiện tại.
 */
export function computeExpiresAt(
  expiresUnixSeconds: number | string | undefined,
  expiresInSeconds: number | string | undefined,
  now = Date.now(),
): Date {
  const absolute = Number(expiresUnixSeconds);
  if (Number.isFinite(absolute) && absolute > 1_000_000_000) {
    return new Date(absolute * 1000);
  }
  const lifetime = Number(expiresInSeconds);
  return new Date(now + (Number.isFinite(lifetime) ? lifetime : 3600) * 1000);
}

/** REST endpoint của portal, dựng từ tên miền đã kiểm tra. */
export function restEndpointFor(domain: string): string {
  return `https://${domain}/rest/`;
}
