import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { FormSubmissionDetail } from './form-submission-detail.entity';

/**
 * Mỗi lần ứng dụng xử lý một submission (qua webhook hoặc đồng bộ) là một dòng.
 * Lần nhận lặp lại của submission đã tạo contact thì không ghi (chỉ ghi log).
 * Kết quả ghi bằng mã: status_kbn (10000 thành công, 10001 thất bại, 10002 đang
 * xử lý) và error_kbn (lý do thất bại), xem common/kbn.
 */
@Entity('form_submissions')
export class FormSubmission {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'form_submission_detail_uuid', type: 'varchar' })
  formSubmissionDetailUuid: string;

  @ManyToOne(() => FormSubmissionDetail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_submission_detail_uuid' })
  detail: FormSubmissionDetail;

  @Column({ name: 'status_kbn', type: 'integer' })
  statusKbn: StatusKbn;

  /** null khi không có lỗi. */
  @Column({ name: 'error_kbn', type: 'integer', nullable: true })
  errorKbn: number | null;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
