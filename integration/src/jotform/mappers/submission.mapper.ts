import { UnprocessableEntityException } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { ErrorKbn, WithErrorKbn } from '../../common/kbn/error.kbn';
import {
  FormContent,
  JotformAnswer,
  JotformSubmission,
} from '../types/jotform.types';
import { ERROR, VALIDATION } from '../../common/constants/messages.constant';

/** Dữ liệu contact rút ra từ một submission. */
export interface SubmissionContact {
  name: string;
  phone: string;
  email: string;
}

/**
 * Submission thiếu trường, sai định dạng, hoặc không thuộc form đã cấu hình.
 * Trả về client mã 422 và mang sẵn error_kbn để lưu DB và ghi log.
 */
export class InvalidSubmissionError
  extends UnprocessableEntityException
  implements WithErrorKbn
{
  constructor(
    readonly problems: string[],
    readonly errorKbn: ErrorKbn = ErrorKbn.VALIDATION,
  ) {
    super({ error: ERROR.LABEL.INVALID_SUBMISSION, message: problems });
    this.message = problems.join('; ');
  }
}

const NAME_HINT = /name|tên|ho_?ten|hova/i;
const PHONE_HINT = /phone|điện thoại|dien_?thoai|sđt|sdt|mobile/i;
const EMAIL_HINT = /e-?mail/i;

/**
 * Rút họ tên, số điện thoại, email từ câu trả lời của Jotform.
 *
 * Tìm trường theo loại (control_email, control_phone, control_fullname) trước,
 * rồi mới đến ô văn bản có tên/nhãn gợi ý. Nhờ vậy không phụ thuộc vào qid,
 * vốn đổi khi sửa form.
 */
export function mapSubmissionToContact(
  answers: Record<string, JotformAnswer>,
): SubmissionContact {
  const fields = Object.values(answers);
  const name = extractName(fields);
  const phone = extractPhone(fields);
  const email = extractEmail(fields);

  const problems: string[] = [];
  if (!name) problems.push(VALIDATION.SUBMISSION.NAME_MISSING);
  if (!phone) problems.push(VALIDATION.SUBMISSION.PHONE_MISSING);
  else if (!isValidPhone(phone)) problems.push(VALIDATION.PHONE_INVALID);
  if (!email) problems.push(VALIDATION.SUBMISSION.EMAIL_MISSING);
  else if (!isEmail(email)) problems.push(VALIDATION.EMAIL_INVALID);
  if (problems.length > 0) {
    throw new InvalidSubmissionError(problems);
  }

  return {
    name: name!,
    phone: normalizePhone(phone!),
    email: email!.toLowerCase(),
  };
}

/**
 * Chuyển submission thành nội dung lưu vào form_content: câu trả lời theo nhãn
 * câu hỏi, bỏ các trường không có giá trị (tiêu đề, nút gửi...).
 */
export function toFormContent(submission: JotformSubmission): FormContent {
  const answers: Record<string, string> = {};
  for (const [qid, field] of Object.entries(submission.answers)) {
    const value = answerAsText(field);
    if (value) {
      answers[field.text || field.name || qid] = value;
    }
  }
  return {
    formId: submission.form_id,
    submittedAt: submission.created_at,
    answers,
  };
}

function answerAsText(field: JotformAnswer): string | undefined {
  const parts = Object.values(asRecord(field.answer)).map(textOf);
  return (
    textOf(field.prettyFormat) ??
    textOf(field.answer) ??
    (parts.filter(Boolean).join(' ') || undefined)
  );
}

function extractName(fields: JotformAnswer[]): string | undefined {
  const fullName = fields.find((f) => f.type === 'control_fullname');
  if (fullName) {
    const parts = asRecord(fullName.answer);
    const joined = ['prefix', 'first', 'middle', 'last']
      .map((key) => textOf(parts[key]))
      .filter(Boolean)
      .join(' ');
    return joined || textOf(fullName.prettyFormat);
  }
  // Không lấy nhầm ô văn bản dùng cho điện thoại/email làm họ tên.
  const textboxes = fields.filter(
    (f) =>
      f.type === 'control_textbox' &&
      !matches(f, PHONE_HINT) &&
      !matches(f, EMAIL_HINT),
  );
  const named = textboxes.find((f) => matches(f, NAME_HINT)) ?? textboxes[0];
  return textOf(named?.answer);
}

function extractPhone(fields: JotformAnswer[]): string | undefined {
  const phone =
    fields.find((f) => f.type === 'control_phone') ??
    fields.find((f) => f.type !== 'control_email' && matches(f, PHONE_HINT));
  if (!phone) {
    return undefined;
  }
  // control_phone trả { full } hoặc { area, phone } tùy cấu hình mặt nạ.
  const parts = asRecord(phone.answer);
  const areaAndNumber = [textOf(parts.area), textOf(parts.phone)]
    .filter(Boolean)
    .join('');
  return (
    textOf(parts.full) ??
    (areaAndNumber || undefined) ??
    textOf(phone.answer) ??
    textOf(phone.prettyFormat)
  );
}

function extractEmail(fields: JotformAnswer[]): string | undefined {
  const email =
    fields.find((f) => f.type === 'control_email') ??
    fields.find((f) => matches(f, EMAIL_HINT));
  return textOf(email?.answer);
}

/** Số điện thoại có 8-15 chữ số (chuẩn E.164 tối đa 15), cho phép dấu + ở đầu. */
function isValidPhone(phone: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(phone));
}

/** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc: "(091) 234-5678" -> "0912345678". */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s().-]/g, '');
}

function matches(field: JotformAnswer, pattern: RegExp): boolean {
  return pattern.test(field.name ?? '') || pattern.test(field.text ?? '');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
