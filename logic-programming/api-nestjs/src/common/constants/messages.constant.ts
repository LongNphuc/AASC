/**
 * Toàn bộ câu chữ của ứng dụng: log, thông báo lỗi theo mã, thông báo
 * validate, chữ hiển thị của mã trạng thái, tài liệu Swagger. Code chỉ gọi tên
 * hằng, ví dụ: ERROR_KBNS[ErrorKbn.TASK_NOT_FOUND], LOG.TASK.CREATED(uuid).
 *
 * Câu có giá trị thay đổi được viết thành hàm nhận tham số.
 */
import { ErrorKbn } from '../kbn/error.kbn';
import { SubtaskStatusKbn, TaskStatusKbn } from '../kbn/status.kbn';

// ---------------------------------------------------------------------------
// LOG: sự kiện bình thường (logger.log)
// ---------------------------------------------------------------------------
export const LOG = {
  BOOTSTRAP: {
    LISTENING: (port: number) => `Đang chạy tại http://localhost:${port}`,
    SWAGGER: (port: number) => `Swagger: http://localhost:${port}/docs`,
  },
  TASK: {
    CREATED: (uuid: string) => `Tạo task ${uuid}`,
    UPDATED: (uuid: string) => `Cập nhật task ${uuid}`,
    DELETED: (uuid: string) => `Xóa task ${uuid}`,
  },
} as const;

// ---------------------------------------------------------------------------
// ERROR_KBNS: câu thông báo của từng mã lỗi, trả về ở `m` trong body lỗi
// (vai trò như bảng dịch i18n error_kbns.<code>)
// ---------------------------------------------------------------------------
export const ERROR_KBNS: Record<ErrorKbn, string> = {
  [ErrorKbn.VALIDATION]: 'Dữ liệu không hợp lệ',
  [ErrorKbn.NOT_FOUND]: 'Đường dẫn không tồn tại',
  [ErrorKbn.NOTHING_TO_UPDATE]:
    'Không có trường nào để cập nhật (title, description, statusKbn, subtasks)',
  [ErrorKbn.TASK_NOT_FOUND]: 'Task không tồn tại hoặc đã bị xóa',
  [ErrorKbn.UNKNOWN]: 'Lỗi máy chủ nội bộ',
};

// ---------------------------------------------------------------------------
// ERROR: log lỗi của hệ thống (logger.error)
// ---------------------------------------------------------------------------
export const ERROR = {
  SYSTEM: {
    INVALID_ENV: (details: string) =>
      `Biến môi trường không hợp lệ: ${details}`,
    STARTUP_FAILED: (reason: string) =>
      `Khởi động thất bại, dừng ứng dụng: ${reason}`,
    REQUEST_FAILED: (
      method: string,
      path: string,
      status: number,
      errorKbn: number,
      reason: string,
    ) => `${method} ${path} -> ${status} (error_kbn=${errorKbn}): ${reason}`,
  },
} as const;

// ---------------------------------------------------------------------------
// VALIDATION: thông báo lỗi của từng trường, trả về ở `f` trong body lỗi
// ---------------------------------------------------------------------------

/** Tên trường hiển thị trong thông báo validate. */
export const FIELD = {
  TITLE: 'Tiêu đề',
  DESCRIPTION: 'Mô tả',
  STATUS: 'Trạng thái',
  SUBTASKS: 'Danh sách task con',
  TASK_NAME: 'Tên task con',
  TIME_ESTIMATE: 'Thời gian ước tính',
  TIME_SPENT: 'Thời gian đã làm',
} as const;

const REQUIRED = (field: string) => `${field} là bắt buộc`;
const MUST_BE_STRING = (field: string) => `${field} phải là chuỗi`;

export const VALIDATION = {
  REQUIRED,
  MUST_BE_STRING,
  /** Thiếu trường thì "là bắt buộc", có nhưng sai kiểu thì "phải là chuỗi". */
  REQUIRED_STRING:
    (field: string) =>
    ({ value }: { value: unknown }) =>
      value === undefined || value === null
        ? REQUIRED(field)
        : MUST_BE_STRING(field),
  MAX_LENGTH: (field: string, max: number) =>
    `${field} dài tối đa ${max} ký tự`,
  MUST_BE_NUMBER: (field: string) => `${field} phải là số`,
  HOURS_RANGE: (field: string, min: number, max: number) =>
    `${field} phải từ ${min} tới ${max} giờ`,
  /** labels: mã → chữ hiển thị, ví dụ LABEL.TASK_STATUS. */
  ONE_OF: (field: string, labels: Record<number, string>) =>
    `${field} phải là một trong: ${Object.entries(labels)
      .map(([kbn, label]) => `${kbn} (${label})`)
      .join(', ')}`,
  MUST_BE_ARRAY: (field: string) => `${field} phải là mảng`,
  MAX_ITEMS: (field: string, max: number) =>
    `${field} có tối đa ${max} phần tử`,
  SUBTASK_MUST_BE_OBJECT: 'Mỗi task con phải là một object',
  FIELD_NOT_ALLOWED: 'Trường này không được hỗ trợ',
  UUID_INVALID: 'Mã task (uuid) không hợp lệ',
} as const;

// ---------------------------------------------------------------------------
// LABEL: chữ hiển thị cho người dùng của các mã kbn
// ---------------------------------------------------------------------------
export const LABEL: {
  TASK_STATUS: Record<TaskStatusKbn, string>;
  SUBTASK_STATUS: Record<SubtaskStatusKbn, string>;
} = {
  TASK_STATUS: {
    [TaskStatusKbn.TO_DO]: 'To Do',
    [TaskStatusKbn.IN_PROGRESS]: 'In Progress',
    [TaskStatusKbn.DONE]: 'Done',
  },
  SUBTASK_STATUS: {
    [SubtaskStatusKbn.IN_PROGRESS]: 'In Progress',
    [SubtaskStatusKbn.DONE]: 'Done',
    [SubtaskStatusKbn.BLOCKED]: 'Blocked',
  },
};

// ---------------------------------------------------------------------------
// API_DOC: nội dung tài liệu Swagger (/docs)
// ---------------------------------------------------------------------------
export const API_DOC = {
  TITLE: 'AASC Task API',
  DESCRIPTION:
    'API RESTful quản lý Task (File 3, bài 1). Trạng thái gửi lên và lưu bằng mã số ' +
    '(statusKbn); phản hồi trả thêm chữ để hiển thị (status). Mọi phản hồi có dạng ' +
    '{ r, d | l, m, f }: r là mã kết quả (10000 = thành công), d là một object, ' +
    'l là danh sách, m là thông báo lỗi, f là lỗi theo từng trường.',
  /** Mô tả các khóa của body phản hồi. */
  RESPONSE: {
    R_SUCCESS: 'Mã kết quả: 10000 = thành công',
    R_ERROR: 'Mã lỗi (error_kbn)',
    M: 'Thông báo lỗi theo mã r',
    F: 'Lỗi theo từng trường: { tên trường: [thông báo, ...] } (chỉ khi lỗi validate)',
    D_ERROR: 'Thông tin phụ của lỗi, ví dụ uuid không tìm thấy',
  },
  TASK: {
    LIST: 'Lấy danh sách task (mới nhất trước, không kèm task con)',
    GET: 'Lấy một task theo uuid, kèm danh sách task con',
    CREATE: 'Tạo task, có thể kèm danh sách task con',
    UPDATE:
      'Cập nhật task; chỉ trường được gửi mới thay đổi. Gửi subtasks thì thay toàn bộ danh sách cũ',
    DELETE:
      'Xóa task (xóa mềm: ghi deleted_at, task không còn hiện ở các API GET)',
    UUID: 'uuid của task',
  },
  /** Mô tả trường trong DTO. */
  FIELD: {
    TITLE: 'Bắt buộc, không được rỗng, tối đa 200 ký tự',
    DESCRIPTION: 'Tối đa 2000 ký tự',
    TASK_STATUS:
      'Mã trạng thái: 11000 = To Do, 11001 = In Progress, 11002 = Done. Tạo mới không gửi thì là 11000',
    TASK_STATUS_LABEL: 'Chữ hiển thị của statusKbn',
    SUBTASKS:
      'Danh sách task con (tối đa 100). Tạo mới không gửi thì rỗng; PATCH gửi thì thay toàn bộ danh sách cũ',
    TASK_NAME: 'Tên task con, bắt buộc, tối đa 200 ký tự',
    TIME_ESTIMATE: 'Thời gian ước tính (giờ), làm tròn 2 chữ số thập phân',
    TIME_SPENT:
      'Thời gian đã làm (giờ), làm tròn 2 chữ số thập phân. Không gửi thì là 0',
    SUBTASK_STATUS:
      'Mã trạng thái: 12000 = In Progress, 12001 = Done, 12002 = Blocked. Không gửi thì là 12000',
    SUBTASK_STATUS_LABEL: 'Chữ hiển thị của statusKbn',
  },
  EXAMPLE: {
    TITLE: 'Làm API quản lý task',
    DESCRIPTION: 'CRUD task bằng NestJS, TypeORM, SQLite',
    TASK_NAME: 'create',
  },
} as const;
