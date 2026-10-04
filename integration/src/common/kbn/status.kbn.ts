/**
 * Mã trạng thái (status_kbn), dùng chung cho DB và log.
 * Mã bắt đầu bằng 1 để không trùng với mã lỗi (error_kbn bắt đầu từ 2).
 */
export enum StatusKbn {
  /** Xử lý xong, ví dụ đã tạo contact. */
  SUCCESS = 10000,
  /** Thất bại; lý do nằm ở error_kbn. */
  FAILED = 10001,
  /** Đang xử lý. Còn ở trạng thái này lâu nghĩa là tiến trình dừng giữa chừng. */
  PROCESSING = 10002,
  /**
   * Bỏ qua vì trùng: submission đã tạo contact trước đó hoặc đang được xử lý.
   * Chỉ có trong response và log, không ghi vào DB.
   */
  SKIPPED_DUPLICATE = 10003,
}
