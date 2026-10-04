import type { ExternalErrorKind } from '../errors/external-api.error';

/**
 * Toàn bộ câu chữ của ứng dụng: nội dung log, thông báo lỗi, thông báo
 * validate, nội dung trả về và tài liệu Swagger. Code chỉ gọi tên hằng:
 *
 *   throw new NotFoundException(ERROR.CONTACT.NOT_FOUND(id));
 *   this.logger.log(LOG.JOTFORM.RECEIVED(jotformId));
 *
 * Gom một chỗ để code không bị câu chữ chen ngang, sửa câu chữ không phải tìm
 * khắp nơi, và sau này dịch sang ngôn ngữ khác (i18n) chỉ cần thay tệp này.
 * Câu có giá trị thay đổi được viết thành hàm nhận tham số.
 *
 * Không gom vào đây các chuỗi định danh kỹ thuật (tên phương thức Bitrix24 như
 * crm.contact.add, tên trường NAME, tên header, mẫu regex nhận dạng trường):
 * đó là logic của code, không phải câu chữ hiển thị.
 */

// ---------------------------------------------------------------------------
// LOG: sự kiện bình thường (logger.log)
// ---------------------------------------------------------------------------
export const LOG = {
  BOOTSTRAP: {
    LISTENING: (port: number) => `Đang chạy tại http://localhost:${port}`,
    SWAGGER: (port: number) => `Swagger: http://localhost:${port}/docs`,
    INSTALL_URL: (publicUrl: string) =>
      `Đường dẫn cài đặt Bitrix24: ${publicUrl}/install`,
    JOTFORM_WEBHOOK_URL: (publicUrl: string) =>
      `Webhook Jotform: ${publicUrl}/webhook/jotform`,
  },
  AUTH: {
    TOKEN_EXPIRING: (domain: string) =>
      `access_token của ${domain} sắp hết hạn, làm mới trước khi gọi API`,
    TOKEN_REFRESHED: (domain: string, expiresAt: string) =>
      `Đã làm mới token cho ${domain}, hết hạn lúc ${expiresAt}`,
    REFRESH_BATCH: (total: number, refreshed: number, failed: number) =>
      `Batch làm mới token: ${total} cần làm mới, ${refreshed} thành công, ${failed} lỗi`,
  },
  INSTALL: {
    REQUEST_RECEIVED: (request: string) => `Nhận request cài đặt: ${request}`,
    PAYLOAD_KIND: (kind: string) => `Dạng dữ liệu cài đặt: ${kind}`,
    SAVED: (
      isNew: boolean,
      domain: string,
      memberId: string,
      expiresAt: string,
    ) =>
      `${isNew ? 'Cài mới' : 'Cài lại/cập nhật'} ứng dụng trên ${domain} (member_id=${memberId}), access_token hết hạn lúc ${expiresAt}`,
    INSTALLER: (name: string, userId: string) =>
      `Người cài đặt: ${name} (user_id=${userId})`,
  },
  CONTACT: {
    CREATED: (id: number) => `Đã tạo contact ${id}`,
    UPDATED: (id: number) => `Đã cập nhật contact ${id}`,
    DELETED: (id: number, requisiteCount: number) =>
      `Đã xóa contact ${id} cùng ${requisiteCount} requisite`,
    PRESET_SELECTED: (name: string, id: string) =>
      `Dùng mẫu requisite "${name}" (ID ${id})`,
  },
  JOTFORM: {
    WEBHOOK_RECEIVED: (summary: string) => `Nhận webhook Jotform: ${summary}`,
    RECEIVED: (jotformId: string) => `[${jotformId}] Nhận submission`,
    SKIPPED: (jotformId: string, reason: string) =>
      `[${jotformId}] Bỏ qua: ${reason}`,
    CONTACT_CREATED: (jotformId: string, contactId: number) =>
      `[${jotformId}] Gửi Bitrix24 thành công: tạo contact ${contactId}`,
    SYNC_SUMMARY: (
      checked: number,
      success: number,
      skipped: number,
      failed: number,
    ) =>
      `Đồng bộ Jotform: ${checked} submission, ${success} tạo mới, ${skipped} bỏ qua, ${failed} lỗi`,
    WEBHOOK_REGISTERED: (formId: string, url: string) =>
      `Đã đăng ký webhook Jotform cho form ${formId}: ${url}`,
  },
} as const;

// ---------------------------------------------------------------------------
// WARN: bất thường nhưng ứng dụng vẫn chạy tiếp (logger.warn)
// ---------------------------------------------------------------------------

/** Ảnh hưởng khi thiếu từng biến môi trường, in ra lúc khởi động. */
const MISSING_SETTING_IMPACT: Record<string, string> = {
  API_KEY: 'mọi endpoint có bảo vệ sẽ trả 503',
  CLIENT_ID: 'không làm mới được token OAuth',
  CLIENT_SECRET: 'không làm mới được token OAuth',
  BITRIX24_WEBHOOK_URL: 'File 1 không tạo được contact',
  JOTFORM_API_KEY: 'File 1 không đọc được submission',
  JOTFORM_FORM_ID: 'File 1 không biết form nào hợp lệ',
  PUBLIC_URL: 'không đăng ký được webhook Jotform qua API',
};

export const WARN = {
  BOOTSTRAP: {
    MISSING_SETTING: (name: string) =>
      `Chưa cấu hình ${name} (${MISSING_SETTING_IMPACT[name] ?? 'một số tính năng không chạy'})`,
  },
  EXTERNAL: {
    CALL_FAILED: (call: string, kind: string, message: string) =>
      `${call} lỗi ${kind}: ${message}`,
  },
  BITRIX: {
    RATE_LIMITED: (operation: string, delayMs: number) =>
      `${operation}: bị giới hạn tần suất, thử lại sau ${delayMs}ms`,
    TOKEN_REJECTED_RETRY: (method: string, code: string | undefined) =>
      `${method}: Bitrix24 từ chối access_token (${code}), làm mới rồi gọi lại một lần`,
  },
  INSTALL: {
    INSTALLER_UNAVAILABLE: (reason: string) =>
      `Không lấy được thông tin người cài qua user.current (có thể ứng dụng thiếu quyền "user"): ${reason}`,
  },
  CONTACT: {
    ROLLED_BACK: (id: number) =>
      `Đã hủy contact ${id} do tạo requisite thất bại`,
  },
} as const;

// ---------------------------------------------------------------------------
// ERROR: thông báo lỗi trả về client và log lỗi (logger.error)
// ---------------------------------------------------------------------------

const BITRIX_ERROR_BY_KIND: Partial<Record<ExternalErrorKind, string>> = {
  TOKEN_EXPIRED: 'access_token đã hết hạn hoặc không còn hợp lệ',
  AUTH: 'Bitrix24 từ chối xác thực hoặc thiếu quyền',
  RATE_LIMIT: 'Vượt giới hạn số lệnh gọi Bitrix24, thử lại sau',
  NOT_FOUND: 'Không tìm thấy bản ghi trên Bitrix24',
  SERVER: 'Máy chủ Bitrix24 gặp lỗi',
  BAD_REQUEST: 'Bitrix24 từ chối dữ liệu gửi lên',
};

export const ERROR = {
  /** Giá trị trường `error` trong body lỗi. */
  LABEL: {
    VALIDATION_FAILED: 'Validation Failed',
    INVALID_SUBMISSION: 'Invalid Submission',
    INTERNAL_SERVER_ERROR: 'Internal Server Error',
  },
  SYSTEM: {
    INTERNAL: 'Lỗi máy chủ nội bộ',
    STARTUP_FAILED: (reason: string) =>
      `Khởi động thất bại, dừng ứng dụng: ${reason}`,
    INVALID_ENV: (details: string) =>
      `Biến môi trường không hợp lệ: ${details}`,
    REQUEST_FAILED: (
      method: string,
      path: string,
      status: number,
      errorKbn: number,
      reason: string,
    ) => `${method} ${path} -> ${status} (error_kbn=${errorKbn}): ${reason}`,
  },
  AUTH: {
    API_KEY_NOT_CONFIGURED:
      'Máy chủ chưa cấu hình API_KEY nên chưa mở các endpoint có bảo vệ',
    API_KEY_INVALID: (header: string) =>
      `Thiếu hoặc sai API key (header ${header})`,
    REFRESH_TOKEN_INVALID: (domain: string) =>
      `refresh_token của ${domain} không còn hợp lệ. Cần cài đặt lại ứng dụng trên Bitrix24`,
    REFRESH_FAILED: (domain: string, reason: string) =>
      `Làm mới token cho ${domain} thất bại: ${reason}`,
    REFRESH_BATCH_PARTIAL: (failed: number, total: number) =>
      `${failed}/${total} portal làm mới thất bại`,
    REFRESH_BATCH_FAILED: (reason: string) =>
      `Batch làm mới token lỗi: ${reason}`,
  },
  /** Lỗi chung khi gọi dịch vụ bên ngoài (Bitrix24, Jotform). */
  EXTERNAL: {
    TIMEOUT: (service: string, operation: string) =>
      `Hết thời gian chờ khi gọi ${service} (${operation})`,
    NETWORK: (service: string, operation: string, code?: string) =>
      `Không kết nối được tới ${service} (${operation}): ${code ?? 'lỗi mạng'}`,
    UNKNOWN: (service: string, operation: string, detail: string) =>
      `Lỗi không xác định khi gọi ${service} (${operation}): ${detail}`,
  },
  OAUTH: {
    CLIENT_NOT_CONFIGURED:
      'Chưa cấu hình CLIENT_ID/CLIENT_SECRET nên không gọi được máy chủ OAuth',
    INCOMPLETE_RESPONSE:
      'Máy chủ OAuth trả về dữ liệu thiếu access_token/refresh_token/client_endpoint',
    INVALID_CLIENT: 'CLIENT_ID hoặc CLIENT_SECRET không đúng',
    REINSTALL_REQUIRED:
      'refresh_token không còn hợp lệ. Hãy cài đặt lại ứng dụng trên Bitrix24 để cấp token mới',
    CODE_INVALID:
      'Mã code không hợp lệ hoặc đã hết hạn (code chỉ sống khoảng 30 giây)',
    REJECTED: (reason: string) => `Máy chủ OAuth từ chối yêu cầu: ${reason}`,
  },
  BITRIX: {
    REQUEST_FAILED: (
      kind: ExternalErrorKind,
      operation: string,
      reason: string,
    ) =>
      `${BITRIX_ERROR_BY_KIND[kind] ?? 'Lỗi Bitrix24'} (${operation}): ${reason}`,
    NOT_INSTALLED: (portal?: string) =>
      `Chưa có token cho portal ${portal ?? 'nào'}. Hãy cài đặt ứng dụng cục bộ trên Bitrix24 (đường dẫn cài đặt trỏ tới /install)`,
    WEBHOOK_NOT_CONFIGURED: 'Chưa cấu hình BITRIX24_WEBHOOK_URL',
    WEBHOOK_AUTH_HINT: (message: string) =>
      `${message}. Kiểm tra BITRIX24_WEBHOOK_URL còn hiệu lực và webhook có quyền CRM`,
  },
  INSTALL: {
    UNRECOGNIZED_PAYLOAD:
      'Không nhận dạng được dữ liệu cài đặt từ Bitrix24 (cần sự kiện ONAPPINSTALL, AUTH_ID/REFRESH_ID hoặc code)',
    DOMAIN_NOT_CONFIGURED:
      'Chưa cấu hình BITRIX24_DOMAIN nên chưa nhận cài đặt',
    DOMAIN_NOT_ALLOWED: (domain: string) =>
      `Portal ${domain} không được phép cài ứng dụng này`,
  },
  CONTACT: {
    NOT_FOUND: (id: number) => `Contact không tồn tại (ID ${id})`,
    NOTHING_TO_UPDATE: 'Không có trường nào để cập nhật',
    REQUISITE_FAILED: (reason: string) =>
      `Không lưu được địa chỉ/ngân hàng nên đã hủy contact vừa tạo. ${reason}`,
    ROLLBACK_FAILED: (id: number, reason: string) =>
      `Không hủy được contact ${id}, cần xóa thủ công: ${reason}`,
    NO_REQUISITE_PRESET:
      'Portal chưa có mẫu requisite nào đang bật. Tạo mẫu trong CRM > Cài đặt > Chi tiết, hoặc đặt BITRIX24_REQUISITE_PRESET_ID',
  },
  JOTFORM: {
    API_KEY_NOT_CONFIGURED: 'Chưa cấu hình JOTFORM_API_KEY',
    FORM_ID_NOT_CONFIGURED: 'Chưa cấu hình JOTFORM_FORM_ID',
    PUBLIC_URL_NOT_CONFIGURED: 'Chưa cấu hình PUBLIC_URL',
    /** Lỗi theo mã HTTP Jotform trả về; `path` là API đã gọi. */
    HTTP: {
      // Jotform trả 401 cho cả key sai lẫn submission không tồn tại hoặc không
      // thuộc tài khoản, nên thông báo nêu cả hai khả năng.
      AUTH: (path: string) =>
        `Jotform từ chối truy cập (${path}): submission không tồn tại hoặc không thuộc tài khoản, hoặc JOTFORM_API_KEY sai/thiếu quyền`,
      NOT_FOUND: (path: string) =>
        `Không tìm thấy dữ liệu trên Jotform (${path})`,
      RATE_LIMIT: (path: string) =>
        `Vượt giới hạn số lệnh gọi Jotform API trong ngày (${path})`,
      SERVER: (path: string) => `Máy chủ Jotform gặp lỗi (${path})`,
      BAD_REQUEST: (path: string, status: number) =>
        `Jotform từ chối yêu cầu (HTTP ${status}) (${path})`,
    },
    MISSING_SUBMISSION_ID: 'Thiếu hoặc sai submissionID',
    FORM_NOT_SUPPORTED: (formId: string) => `Form ${formId} không được hỗ trợ`,
    FORM_MISMATCH: (actual: string, expected: string) =>
      `Submission thuộc form ${actual}, không phải form ${expected}`,
    SUBMISSION_NOT_FOUND: (uuid: string) => `Không tìm thấy submission ${uuid}`,
    PROCESSING_FAILED: (
      jotformId: string,
      errorKbn: number,
      errorName: string,
      reason: string,
    ) =>
      `[${jotformId}] Xử lý thất bại (error_kbn=${errorKbn} ${errorName}): ${reason}`,
  },
} as const;

// ---------------------------------------------------------------------------
// VALIDATION: thông báo khi dữ liệu gửi vào không hợp lệ
// ---------------------------------------------------------------------------

/** Tên trường hiển thị trong thông báo validate. */
export const FIELD = {
  NAME: 'Tên',
  STREET: 'Số nhà, tên đường',
  WARD: 'Phường/xã',
  DISTRICT: 'Quận/huyện',
  PROVINCE: 'Tỉnh/thành phố',
  BANK_NAME: 'Tên ngân hàng',
  ACCOUNT_NUMBER: 'Số tài khoản',
  START: 'start',
} as const;

const REQUIRED = (field: string) => `${field} là bắt buộc`;
const MUST_BE_STRING = (field: string) => `${field} phải là chuỗi`;

export const VALIDATION = {
  REQUIRED,
  MUST_BE_STRING,
  /**
   * Cho trường chuỗi bắt buộc: thiếu trường thì "là bắt buộc", có nhưng sai
   * kiểu (ví dụ số) thì "phải là chuỗi". class-validator gọi hàm này với giá
   * trị đang kiểm tra.
   */
  REQUIRED_STRING:
    (field: string) =>
    ({ value }: { value: unknown }) =>
      value === undefined || value === null
        ? REQUIRED(field)
        : MUST_BE_STRING(field),
  MUST_BE_INTEGER: (field: string) => `${field} phải là số nguyên`,
  NOT_NEGATIVE: (field: string) => `${field} không được âm`,
  MAX_LENGTH: (field: string, max: number) => `${field} tối đa ${max} ký tự`,
  FIELD_NOT_ALLOWED: (path: string) => `Trường "${path}" không được hỗ trợ`,
  PHONE_INVALID: 'Số điện thoại không hợp lệ',
  EMAIL_INVALID: 'Email không hợp lệ',
  WEBSITE_INVALID: 'Website không hợp lệ',
  ACCOUNT_NUMBER_INVALID: 'Số tài khoản không hợp lệ (chỉ gồm 6-20 chữ số)',
  CONTACT_ID_INVALID: 'ID contact phải là số nguyên dương',
  /** Lỗi dữ liệu của một submission Jotform. */
  SUBMISSION: {
    NAME_MISSING: 'Thiếu họ và tên',
    PHONE_MISSING: 'Thiếu số điện thoại',
    EMAIL_MISSING: 'Thiếu email',
  },
} as const;

// ---------------------------------------------------------------------------
// MESSAGE: nội dung trả về hoặc ghi ra ngoài (không phải lỗi)
// ---------------------------------------------------------------------------
export const MESSAGE = {
  CONTACT: {
    DELETED: (id: number) => `Đã xóa contact ${id}`,
  },
  JOTFORM: {
    /** Ghi vào trường SOURCE_DESCRIPTION của contact trên Bitrix24. */
    CONTACT_SOURCE: (formId: string, submissionId: string) =>
      `Jotform form ${formId}, submission ${submissionId}`,
    SKIP_ALREADY_CREATED: (contactId: number) =>
      `đã tạo contact ${contactId} trước đó`,
    SKIP_IN_PROGRESS: 'đang được xử lý bởi request khác',
    RAW_REQUEST_NOT_JSON: '(rawRequest không phải JSON)',
  },
  INSTALL_PAGE: {
    TITLE_NEW: 'Đã cài đặt ứng dụng AASC Integration',
    TITLE_UPDATED: 'Đã cập nhật token cho ứng dụng AASC Integration',
    PORTAL: 'Portal',
    TOKEN_SAVED: 'Token đã được lưu ở backend. Có thể đóng trang này.',
  },
} as const;

// ---------------------------------------------------------------------------
// API_DOC: tài liệu Swagger (/docs): tóm tắt endpoint, mô tả và ví dụ trường
// ---------------------------------------------------------------------------
export const API_DOC = {
  TITLE: 'AASC Integration API',
  DESCRIPTION: (apiKeyHeader: string) =>
    'Tích hợp Bitrix24 (OAuth 2.0, quản lý contact) và Jotform. ' +
    `Endpoint có biểu tượng ổ khóa cần header ${apiKeyHeader}.`,
  HEALTH: {
    CHECK: 'Kiểm tra ứng dụng đang chạy (dùng để thử đường hầm ngrok)',
  },
  BITRIX: {
    INSTALLATION: 'Xem trạng thái cài đặt và hạn của token (không lộ token)',
    REFRESH: 'Làm mới token ngay (dùng để kiểm tra luồng refresh)',
    TEST_CALL: 'Gọi thử callBitrixAPI("crm.contact.list") và trả phản hồi gốc',
  },
  CONTACT: {
    LIST: 'Lấy danh sách contact (50 contact mỗi trang)',
    GET: 'Lấy một contact theo ID',
    CREATE: 'Thêm contact (kèm địa chỉ và ngân hàng nếu có)',
    UPDATE: 'Cập nhật contact; chỉ trường được gửi lên mới thay đổi',
    DELETE: 'Xóa contact cùng requisite, ngân hàng và địa chỉ của nó',
    UNAUTHORIZED: 'Thiếu hoặc sai x-api-key',
    NOT_FOUND: 'Contact không tồn tại',
    BAD_REQUEST: 'Dữ liệu không hợp lệ',
  },
  JOTFORM: {
    WEBHOOK: 'Nhận webhook submission mới từ Jotform',
    SYNC: 'Đồng bộ bù: lấy submission mới nhất qua Jotform API, tạo contact cho cái chưa có',
    LIST_WEBHOOKS: 'Xem các webhook đang gắn với form',
    REGISTER_WEBHOOK:
      'Gắn webhook <PUBLIC_URL>/webhook/jotform vào form qua Jotform API',
    LIST_SUBMISSIONS:
      'Các lần xử lý submission gần đây (thành công hoặc thất bại): status_kbn, error_kbn, contact (mới nhất trước)',
    GET_SUBMISSION: 'Một lần xử lý submission, kèm nội dung form',
  },
  /** Mô tả trường trong DTO. */
  FIELD: {
    NAME: 'Họ và tên (bắt buộc)',
    PHONE: 'Số Việt Nam (0912345678, +84912345678) hoặc số quốc tế có dấu +',
    WARD: 'Phường/xã',
    DISTRICT: 'Quận/huyện',
    PROVINCE: 'Tỉnh/thành phố',
    ACCOUNT_NUMBER: 'Chỉ gồm chữ số; khoảng trắng và dấu gạch được bỏ đi',
    TOTAL: 'Tổng số contact trên Bitrix24',
    NEXT: 'Giá trị `start` cho trang kế tiếp; null là đã hết',
    START:
      'Vị trí bắt đầu (Bitrix24 trả 50 contact mỗi trang). Lấy từ `next` của trang trước.',
  },
  /** Giá trị ví dụ hiển thị trong Swagger. */
  EXAMPLE: {
    NAME: 'Nguyễn Văn An',
    PHONE: '0912345678',
    EMAIL: 'an.nguyen@example.com',
    WEBSITE: 'https://example.com',
    STREET: '12 Nguyễn Huệ',
    WARD: 'Phường Bến Nghé',
    DISTRICT: 'Quận 1',
    PROVINCE: 'TP. Hồ Chí Minh',
    BANK_NAME: 'Vietcombank',
    ACCOUNT_NUMBER: '0071000123456',
  },
} as const;
