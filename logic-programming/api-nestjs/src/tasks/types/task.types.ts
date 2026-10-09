import { SubtaskStatusKbn } from '../../common/kbn/status.kbn';

/**
 * Một task con, lưu trong task_details.data_json. Tên khóa viết snake_case
 * giống tên cột DB; API dùng camelCase (xem task.mapper.ts).
 */
export interface SubtaskJson {
  task_name: string;
  /** Giờ, làm tròn 2 chữ số thập phân. */
  time_estimate: number;
  /** Giờ, làm tròn 2 chữ số thập phân. */
  time_spent: number;
  status_kbn: SubtaskStatusKbn;
}
