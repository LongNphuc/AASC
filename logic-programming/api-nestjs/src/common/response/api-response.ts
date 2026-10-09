import { StatusKbn } from '../kbn/status.kbn';
import type { FieldErrors } from '../errors/validation-failed.exception';

/**
 * Body phản hồi của mọi API. Chỉ có các khóa dưới đây, khóa nào không dùng
 * thì không xuất hiện:
 *
 * | Khóa | Nghĩa                                                  | Khi nào có                       |
 * |------|--------------------------------------------------------|----------------------------------|
 * | r    | Mã kết quả: 10000 thành công, còn lại là mã lỗi         | Luôn có                          |
 * | d    | Một object: kết quả khi thành công, thông tin phụ khi lỗi | Thành công trả một object; một số lỗi |
 * | l    | Danh sách bản ghi                                      | Thành công, API trả danh sách    |
 * | c    | Tổng số bản ghi để phân trang (không phải l.length)    | Đi kèm l khi có phân trang       |
 * | m    | Thông báo lỗi theo mã r (ERROR_KBNS)                   | Chỉ khi lỗi                      |
 * | f    | Lỗi theo từng trường { field: [msg, ...] }              | Chỉ khi lỗi validate             |
 */
export interface DataResponse<T> {
  r: number;
  d: T;
}

export interface ListResponse<T> {
  r: number;
  l: T[];
  c?: number;
}

export interface EmptyResponse {
  r: number;
}

/** Dựng ở AllExceptionsFilter. */
export interface ErrorResponse {
  r: number;
  m: string;
  f?: FieldErrors;
  d?: Record<string, unknown>;
}

/** Thành công, trả một object. */
export function ok<T>(d: T): DataResponse<T> {
  return { r: StatusKbn.SUCCESS, d };
}

/** Thành công, trả danh sách; có phân trang thì truyền thêm tổng số bản ghi. */
export function okList<T>(l: T[], c?: number): ListResponse<T> {
  return c === undefined
    ? { r: StatusKbn.SUCCESS, l }
    : { r: StatusKbn.SUCCESS, l, c };
}

/** Thành công, không có dữ liệu trả về (ví dụ xóa). */
export function okEmpty(): EmptyResponse {
  return { r: StatusKbn.SUCCESS };
}
