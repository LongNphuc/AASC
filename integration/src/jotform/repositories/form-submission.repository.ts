import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { FormSubmissionDetail } from '../entities/form-submission-detail.entity';
import { FormSubmission } from '../entities/form-submission.entity';
import { FormContent } from '../types/jotform.types';

/**
 * Đọc/ghi hai bảng form_submissions (mỗi lần xử lý) và form_submission_details
 * (nội dung, mỗi submission Jotform một dòng).
 */
@Injectable()
export class FormSubmissionRepository {
  constructor(
    @InjectRepository(FormSubmission)
    private readonly submissions: Repository<FormSubmission>,
    @InjectRepository(FormSubmissionDetail)
    private readonly details: Repository<FormSubmissionDetail>,
  ) {}

  /**
   * Lấy chi tiết theo jotform_id, chưa có thì tạo. Nếu hai request cùng tạo,
   * ràng buộc duy nhất trên jotform_id chặn request thứ hai; request đó đọc
   * lại dòng vừa được tạo.
   */
  async findOrCreateDetail(jotformId: string): Promise<FormSubmissionDetail> {
    const existing = await this.details.findOneBy({ jotformId });
    if (existing) {
      return existing;
    }
    try {
      return await this.details.save(this.details.create({ jotformId }));
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      return this.details.findOneByOrFail({ jotformId });
    }
  }

  /** Ghi một lần xử lý submission. */
  createSubmission(
    detail: FormSubmissionDetail,
    statusKbn: StatusKbn,
  ): Promise<FormSubmission> {
    return this.submissions.save(
      this.submissions.create({
        formSubmissionDetailUuid: detail.uuid,
        statusKbn,
        errorKbn: null,
      }),
    );
  }

  async finishSubmission(
    submission: FormSubmission,
    statusKbn: StatusKbn,
    errorKbn: number | null = null,
  ): Promise<void> {
    await this.submissions.update(
      { uuid: submission.uuid },
      { statusKbn, errorKbn },
    );
  }

  async saveContent(
    detail: FormSubmissionDetail,
    content: FormContent,
  ): Promise<void> {
    detail.formContent = content;
    await this.details.save(detail);
  }

  async saveContactId(
    detail: FormSubmissionDetail,
    contactId: number,
  ): Promise<void> {
    detail.contactId = contactId;
    await this.details.save(detail);
  }

  /** Các lần xử lý gần đây (mới nhất trước), kèm chi tiết. */
  recent(limit: number): Promise<FormSubmission[]> {
    return this.submissions.find({
      relations: { detail: true },
      order: { receivedAt: 'DESC' },
      take: limit,
    });
  }

  findOne(uuid: string): Promise<FormSubmission | null> {
    return this.submissions.findOne({
      where: { uuid },
      relations: { detail: true },
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string } | undefined;
  return (
    driverError?.code?.startsWith('SQLITE_CONSTRAINT') === true ||
    /UNIQUE constraint failed/i.test(error.message)
  );
}
