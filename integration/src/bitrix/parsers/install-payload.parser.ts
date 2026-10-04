import { BitrixTokenSet, computeExpiresAt } from '../types/bitrix.types';

type Dict = Record<string, unknown>;

/**
 * Kết quả nhận dạng request cài đặt. Bitrix24 gửi một trong ba dạng, tùy cấu
 * hình ứng dụng cục bộ:
 * - `event`: ứng dụng "chỉ script, không giao diện". Máy chủ Bitrix24 POST sự
 *   kiện ONAPPINSTALL với auth[access_token], auth[refresh_token]...
 * - `iframe`: ứng dụng có giao diện. Trình duyệt POST form vào khung ứng dụng
 *   với AUTH_ID, REFRESH_ID, AUTH_EXPIRES, member_id; DOMAIN nằm trên query.
 * - `code`: luồng OAuth chuẩn. Bitrix24 chuyển hướng về với ?code=...,
 *   backend tự đổi code lấy token.
 */
export type ParsedInstall =
  | { kind: 'event'; tokens: BitrixTokenSet }
  | { kind: 'iframe'; tokens: BitrixTokenSet }
  | { kind: 'code'; code: string };

/** Trả về null nếu request không khớp dạng nào hoặc thiếu trường bắt buộc. */
export function parseInstallPayload(
  query: Dict,
  body: Dict,
): ParsedInstall | null {
  if (text(body.event)?.toUpperCase() === 'ONAPPINSTALL') {
    return parseEvent(body);
  }
  if (text(body.AUTH_ID) && text(body.REFRESH_ID)) {
    return parseIframe(query, body);
  }
  const code = text(query.code) ?? text(body.code);
  return code ? { kind: 'code', code } : null;
}

function parseEvent(body: Dict): ParsedInstall | null {
  const auth = isDict(body.auth) ? body.auth : undefined;
  if (!auth) {
    return null;
  }
  const accessToken = text(auth.access_token);
  const refreshToken = text(auth.refresh_token);
  const memberId = text(auth.member_id);
  const domain = normalizeDomain(text(auth.domain));
  if (!accessToken || !refreshToken || !memberId || !domain) {
    return null;
  }
  return {
    kind: 'event',
    tokens: {
      memberId,
      domain,
      accessToken,
      refreshToken,
      expiresAt: computeExpiresAt(text(auth.expires), text(auth.expires_in)),
      scope: text(auth.scope),
      userId: toNumber(auth.user_id),
      applicationToken: text(auth.application_token),
    },
  };
}

function parseIframe(query: Dict, body: Dict): ParsedInstall | null {
  const memberId = text(body.member_id);
  const domain = normalizeDomain(text(query.DOMAIN) ?? text(body.DOMAIN));
  if (!memberId || !domain) {
    return null;
  }
  return {
    kind: 'iframe',
    tokens: {
      memberId,
      domain,
      accessToken: text(body.AUTH_ID)!,
      refreshToken: text(body.REFRESH_ID)!,
      // AUTH_EXPIRES là số giây còn sống (thường 3600), không phải mốc thời gian.
      expiresAt: computeExpiresAt(undefined, text(body.AUTH_EXPIRES)),
    },
  };
}

function isDict(value: unknown): value is Dict {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number') {
    return String(value);
  }
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}

/** Chỉ giữ phần host, viết thường: "B24-x.bitrix24.vn:443" -> "b24-x.bitrix24.vn". */
function normalizeDomain(value: string | undefined): string | undefined {
  return (
    value
      ?.toLowerCase()
      .replace(/^https?:\/\//, '')
      .split(/[/:]/)[0] || undefined
  );
}
