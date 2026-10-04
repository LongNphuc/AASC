/**
 * Che bí mật trước khi ghi log. Giữ nguyên cấu trúc và tên khóa để vẫn đọc
 * được dữ liệu có dạng thế nào, chỉ thay giá trị nhạy cảm.
 */

// Khóa có giá trị là bí mật: token, secret, mã OAuth, API key...
const SECRET_KEY_PATTERN =
  /token|secret|password|apikey|api_key|auth_id|refresh_id|^code$|authorization/i;

// Phần mã bí mật trong URL webhook Bitrix24: /rest/<user_id>/<mã>/
const WEBHOOK_SECRET_PATTERN = /(\/rest\/\d+\/)[^/\s]+/g;

function maskValue(value: unknown): string {
  const length = typeof value === 'string' ? value.length : 0;
  return `[REDACTED${length ? ` len=${length}` : ''}]`;
}

export function maskWebhookUrl(text: string): string {
  return text.replace(WEBHOOK_SECRET_PATTERN, '$1***');
}

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[...]';
  }
  if (typeof value === 'string') {
    return maskWebhookUrl(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) && typeof item !== 'object'
          ? maskValue(item)
          : redactSecrets(item, depth + 1),
      ]),
    );
  }
  return value;
}
