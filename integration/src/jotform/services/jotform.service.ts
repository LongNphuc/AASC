import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BitrixWebhookClient } from '../../bitrix/clients/bitrix-webhook.client';
import { ExternalApiError } from '../../common/errors/external-api.error';
import {
  describeErrorKbn,
  ErrorKbn,
  errorKbnOf,
} from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { appConfig, type AppConfig } from '../../config/app-config';
import { JotformApiClient } from '../clients/jotform-api.client';
import { FormSubmissionDetail } from '../entities/form-submission-detail.entity';
import { FormSubmission } from '../entities/form-submission.entity';
import {
  InvalidSubmissionError,
  mapSubmissionToContact,
  SubmissionContact,
  toFormContent,
} from '../mappers/submission.mapper';
import { FormSubmissionRepository } from '../repositories/form-submission.repository';
import { JotformSubmission } from '../types/jotform.types';
import { ERROR, LOG, MESSAGE } from '../../common/constants/messages.constant';

/** Kết quả xử lý một lần nhận submission, trả về cho Jotform/client. */
export interface ProcessResult {
  /** Dòng form_submissions vừa ghi; null khi bỏ qua do trùng (không ghi DB). */
  submissionUuid: string | null;
  jotformId: string;
  statusKbn: StatusKbn;
  /** Tên của statusKbn, cho dễ đọc. */
  status: string;
  contactId: number | null;
}

export interface SyncSummary {
  checked: number;
  success: number;
  skipped: number;
  failed: number;
  results: Array<ProcessResult | { jotformId: string; error: string }>;
}

/**
 * File 1: mỗi submission Jotform mới tạo một contact trên Bitrix24.
 *
 * Luồng xử lý một lần nhận:
 * 1. Lấy (hoặc tạo) dòng chi tiết theo jotform_id. Đã có contact, hoặc đang có
 *    request khác xử lý cùng submission, thì trả về "bỏ qua do trùng" (10003):
 *    không tạo contact, không ghi DB, chỉ ghi log service.
 * 2. Ghi lần xử lý vào form_submissions với trạng thái "đang xử lý" (10002).
 * 3. Lấy dữ liệu qua Jotform API theo submissionID. Không tin dữ liệu trong body
 *    webhook vì ai cũng POST được vào URL công khai. Lưu nội dung vào form_content.
 * 4. Kiểm tra đúng form, ánh xạ và validate họ tên, điện thoại, email.
 * 5. Gọi crm.contact.add qua webhook vào của Bitrix24, lưu contact_id.
 * 6. Cập nhật status_kbn (và error_kbn nếu lỗi), ghi log service.
 *
 * Không có cơ chế tự thử lại. Nhưng nếu submission chưa tạo được contact mà
 * được nhận lại (Jotform gửi lại, hoặc gọi đồng bộ) thì sẽ được xử lý như mới.
 */
@Injectable()
export class JotformService {
  private readonly logger = new ServiceLogger(
    LogService.JOTFORM,
    JotformService.name,
  );

  /**
   * jotform_id đang được xử lý. Chặn hai request cùng tạo contact cho một
   * submission. Khóa nằm trong bộ nhớ nên chỉ đúng khi chạy một tiến trình.
   */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly jotform: JotformApiClient,
    private readonly bitrix: BitrixWebhookClient,
    private readonly repository: FormSubmissionRepository,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  /**
   * @param prefetched submission đã có sẵn (khi đồng bộ qua API), khỏi gọi lại
   */
  async processSubmission(
    jotformId: string,
    prefetched?: JotformSubmission,
  ): Promise<ProcessResult> {
    const startedAt = Date.now();
    this.logger.log(LOG.JOTFORM.RECEIVED(jotformId));
    const detail = await this.repository.findOrCreateDetail(jotformId);

    if (detail.contactId !== null || this.inFlight.has(jotformId)) {
      const reason = detail.contactId
        ? MESSAGE.JOTFORM.SKIP_ALREADY_CREATED(detail.contactId)
        : MESSAGE.JOTFORM.SKIP_IN_PROGRESS;
      this.logger.log(LOG.JOTFORM.SKIPPED(jotformId, reason));
      // Không ghi DB: lần xử lý trước đã có dòng trong form_submissions; lần
      // nhận lặp lại này chỉ để lại dấu vết trong services/service_jotform.log.
      return this.complete(
        StatusKbn.SKIPPED_DUPLICATE,
        null,
        detail,
        startedAt,
      );
    }

    this.inFlight.add(jotformId);
    const submission = await this.repository.createSubmission(
      detail,
      StatusKbn.PROCESSING,
    );
    try {
      const jotformSubmission =
        prefetched ?? (await this.jotform.getSubmission(jotformId));
      await this.repository.saveContent(
        detail,
        toFormContent(jotformSubmission),
      );
      this.assertExpectedForm(jotformSubmission);
      const contact = mapSubmissionToContact(jotformSubmission.answers);

      const contactId = Number(
        await this.bitrix.call<number>('crm.contact.add', {
          fields: this.toContactFields(contact, jotformSubmission),
        }),
      );
      await this.repository.saveContactId(detail, contactId);
      await this.repository.finishSubmission(submission, StatusKbn.SUCCESS);
      this.logger.log(LOG.JOTFORM.CONTACT_CREATED(jotformId, contactId));
      return this.complete(
        StatusKbn.SUCCESS,
        submission.uuid,
        detail,
        startedAt,
      );
    } catch (error) {
      const errorKbn = errorKbnOf(error);
      await this.repository.finishSubmission(
        submission,
        StatusKbn.FAILED,
        errorKbn,
      );
      this.logger.record({
        method: `process submission ${jotformId}`,
        statusKbn: StatusKbn.FAILED,
        errorKbn,
        durationMs: Date.now() - startedAt,
        errorDetail: (error as Error).message,
      });
      const level = error instanceof InvalidSubmissionError ? 'warn' : 'error';
      this.logger[level](
        ERROR.JOTFORM.PROCESSING_FAILED(
          jotformId,
          errorKbn,
          describeErrorKbn(errorKbn),
          (error as Error).message,
        ),
      );
      throw error;
    } finally {
      this.inFlight.delete(jotformId);
    }
  }

  /**
   * Đồng bộ bù: đọc các submission mới nhất qua Jotform API và xử lý những cái
   * chưa tạo contact (ví dụ webhook bị lỡ khi server hoặc ngrok tắt).
   */
  async syncRecent(limit: number): Promise<SyncSummary> {
    const formId = this.requireFormId();
    const submissions = await this.jotform.listSubmissions(formId, limit);
    const summary: SyncSummary = {
      checked: 0,
      success: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };

    // Chạy tuần tự cho nhẹ nhàng với giới hạn tần suất của Bitrix24.
    for (const submission of submissions) {
      if (submission.status && submission.status !== 'ACTIVE') {
        continue; // bỏ qua submission đã xóa/lưu trữ
      }
      summary.checked++;
      try {
        const result = await this.processSubmission(submission.id, submission);
        summary.results.push(result);
        if (result.statusKbn === StatusKbn.SUCCESS) summary.success++;
        else summary.skipped++;
      } catch (error) {
        summary.failed++;
        summary.results.push({
          jotformId: submission.id,
          error: (error as Error).message,
        });
      }
    }
    this.logger.log(
      LOG.JOTFORM.SYNC_SUMMARY(
        summary.checked,
        summary.success,
        summary.skipped,
        summary.failed,
      ),
    );
    return summary;
  }

  /** Đăng ký webhook <PUBLIC_URL>/webhook/jotform cho form qua Jotform API (nếu chưa có). */
  async ensureWebhook(): Promise<{
    webhookUrl: string;
    created: boolean;
    webhooks: string[];
  }> {
    const formId = this.requireFormId();
    if (!this.config.publicUrl) {
      throw new ExternalApiError(
        'jotform',
        'CONFIG',
        ERROR.JOTFORM.PUBLIC_URL_NOT_CONFIGURED,
      );
    }
    const webhookUrl = `${this.config.publicUrl}/webhook/jotform`;
    const existing = Object.values(await this.jotform.listWebhooks(formId));
    if (existing.includes(webhookUrl)) {
      return { webhookUrl, created: false, webhooks: existing };
    }
    const updated = Object.values(
      await this.jotform.createWebhook(formId, webhookUrl),
    );
    this.logger.log(LOG.JOTFORM.WEBHOOK_REGISTERED(formId, webhookUrl));
    return { webhookUrl, created: true, webhooks: updated };
  }

  listWebhooks(): Promise<Record<string, string>> {
    return this.jotform.listWebhooks(this.requireFormId());
  }

  /** Các lần xử lý gần đây (bảng form_submissions), dạng gọn để xem nhanh. */
  async recentSubmissions(limit: number) {
    const submissions = await this.repository.recent(limit);
    return submissions.map((submission) => this.toView(submission));
  }

  /** Một lần xử lý, kèm nội dung form. */
  async findSubmission(uuid: string) {
    const submission = await this.repository.findOne(uuid);
    if (!submission) {
      throw new NotFoundException(ERROR.JOTFORM.SUBMISSION_NOT_FOUND(uuid));
    }
    return {
      ...this.toView(submission),
      formContent: submission.detail.formContent,
    };
  }

  /** Ghi log service cho lần nhận thành công/bỏ qua và dựng kết quả trả về. */
  private complete(
    statusKbn: StatusKbn,
    submissionUuid: string | null,
    detail: FormSubmissionDetail,
    startedAt: number,
  ): ProcessResult {
    this.logger.record({
      method: `process submission ${detail.jotformId}`,
      statusKbn,
      durationMs: Date.now() - startedAt,
    });
    return {
      submissionUuid,
      jotformId: detail.jotformId ?? '',
      statusKbn,
      status: StatusKbn[statusKbn],
      contactId: detail.contactId,
    };
  }

  private toView(submission: FormSubmission) {
    return {
      uuid: submission.uuid,
      jotformId: submission.detail.jotformId,
      statusKbn: submission.statusKbn,
      status: StatusKbn[submission.statusKbn],
      errorKbn: submission.errorKbn,
      error: submission.errorKbn ? describeErrorKbn(submission.errorKbn) : null,
      contactId: submission.detail.contactId,
      receivedAt: submission.receivedAt,
      updatedAt: submission.updatedAt,
    };
  }

  /** Họ và tên -> NAME, số điện thoại -> PHONE, email -> EMAIL (theo đề bài). */
  private toContactFields(
    contact: SubmissionContact,
    submission: JotformSubmission,
  ) {
    return {
      NAME: contact.name,
      PHONE: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
      OPENED: 'Y',
      SOURCE_DESCRIPTION: MESSAGE.JOTFORM.CONTACT_SOURCE(
        submission.form_id,
        submission.id,
      ),
    };
  }

  private assertExpectedForm(submission: JotformSubmission): void {
    const expected = this.requireFormId();
    if (submission.form_id !== expected) {
      throw new InvalidSubmissionError(
        [ERROR.JOTFORM.FORM_MISMATCH(submission.form_id, expected)],
        ErrorKbn.FORM_MISMATCH,
      );
    }
  }

  private requireFormId(): string {
    const formId = this.config.jotform.formId;
    if (!formId) {
      throw new ExternalApiError(
        'jotform',
        'CONFIG',
        ERROR.JOTFORM.FORM_ID_NOT_CONFIGURED,
      );
    }
    return formId;
  }
}
