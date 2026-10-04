import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { FormContent } from '../types/jotform.types';

/**
 * Nội dung của một submission, mỗi submission Jotform một dòng.
 *
 * jotform_id là duy nhất: Jotform gửi lại cùng một submission bao nhiêu lần
 * thì vẫn chỉ có một dòng chi tiết; mỗi lần xử lý (thành công hoặc thất bại)
 * là một dòng trong form_submissions. Ứng dụng tự lưu nội dung, không phụ thuộc vào việc Jotform
 * có giữ lại lịch sử webhook hay không.
 */
@Entity('form_submission_details')
export class FormSubmissionDetail {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  /** submissionID của Jotform (nếu có). */
  @Index({ unique: true })
  @Column({ name: 'jotform_id', type: 'varchar', nullable: true })
  jotformId: string | null;

  /**
   * Nội dung form dạng JSON. SQLite không có kiểu jsonb nên lưu dạng TEXT, đọc
   * được bằng json_extract(); chuyển sang PostgreSQL thì đổi kiểu thành jsonb.
   */
  @Column({ name: 'form_content', type: 'json', nullable: true })
  formContent: FormContent | null;

  /** ID contact đã tạo trên Bitrix24; null là chưa tạo được. */
  @Column({ name: 'contact_id', type: 'integer', nullable: true })
  contactId: number | null;
}
