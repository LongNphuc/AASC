/** Mọi phản hồi của Jotform API đều bọc trong cấu trúc này. */
export interface JotformApiResponse<T> {
  responseCode: number;
  message: string;
  content: T;
}

/** Một câu trả lời trong submission, khóa theo qid (ID câu hỏi). */
export interface JotformAnswer {
  /** Tên kỹ thuật của trường, ví dụ "fullName". */
  name?: string;
  /** Nhãn hiển thị, ví dụ "Họ và tên". */
  text?: string;
  /** Loại trường, ví dụ control_textbox, control_phone, control_email. */
  type?: string;
  /** Giá trị: chuỗi, hoặc object với trường phức hợp (họ tên, điện thoại). */
  answer?: unknown;
  /** Giá trị đã định dạng sẵn thành chuỗi. */
  prettyFormat?: string;
}

export interface JotformSubmission {
  id: string;
  form_id: string;
  created_at: string;
  status?: string;
  answers: Record<string, JotformAnswer>;
}

/** Nội dung form lưu vào cột form_content. */
export interface FormContent {
  formId: string;
  /** Thời điểm người dùng gửi form, theo Jotform. */
  submittedAt: string;
  /** Câu trả lời theo nhãn câu hỏi, ví dụ { "Họ và tên": "Nguyễn Văn An" }. */
  answers: Record<string, string>;
}

/** Các trường Jotform gửi kèm webhook (multipart/form-data). */
export interface JotformWebhookBody {
  formID?: string;
  submissionID?: string;
  /** Chuỗi JSON chứa câu trả lời, khóa dạng q3_fullName. */
  rawRequest?: string;
  [key: string]: unknown;
}
