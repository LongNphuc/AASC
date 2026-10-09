/**
 * Mã trạng thái (kbn), dùng chung cho DB, code và dữ liệu API. Chữ hiển thị
 * cho người dùng ("To Do"...) nằm ở LABEL trong messages.constant.ts.
 * Mã bắt đầu bằng 1 để không trùng với mã lỗi (error_kbn bắt đầu từ 2).
 */

/** Kết quả một request, ghi trong log service. */
export enum StatusKbn {
  SUCCESS = 10000,
  FAILED = 10001,
}

/** Trạng thái task (cột tasks.status_kbn). */
export enum TaskStatusKbn {
  TO_DO = 11000,
  IN_PROGRESS = 11001,
  DONE = 11002,
}

/** Trạng thái task con (khóa status_kbn trong task_details.data_json). */
export enum SubtaskStatusKbn {
  IN_PROGRESS = 12000,
  DONE = 12001,
  BLOCKED = 12002,
}

/** Các giá trị số của một enum kbn, ví dụ [11000, 11001, 11002]. */
export function kbnValues(kbn: Record<string, string | number>): number[] {
  return Object.values(kbn).filter((v): v is number => typeof v === 'number');
}
