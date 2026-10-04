import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BitrixWebhookClient } from '../../bitrix/clients/bitrix-webhook.client';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { appConfig } from '../../config/app-config';
import { JotformApiClient } from '../clients/jotform-api.client';
import { FormSubmissionDetail } from '../entities/form-submission-detail.entity';
import { JotformService } from './jotform.service';
import { FormSubmissionRepository } from '../repositories/form-submission.repository';
import { JotformSubmission } from '../types/jotform.types';

const FORM_ID = '262753749396070';

function makeSubmission(
  overrides: Partial<JotformSubmission> = {},
): JotformSubmission {
  return {
    id: '600',
    form_id: FORM_ID,
    created_at: '2026-10-03 10:00:00',
    answers: {
      '3': {
        text: 'Họ và tên',
        type: 'control_textbox',
        answer: 'Nguyễn Văn An',
      },
      '4': {
        text: 'Số điện thoại',
        type: 'control_phone',
        answer: { full: '0912345678' },
      },
      '5': { text: 'Email', type: 'control_email', answer: 'an@example.com' },
    },
    ...overrides,
  };
}

function makeDetail(contactId: number | null = null): FormSubmissionDetail {
  return Object.assign(new FormSubmissionDetail(), {
    uuid: 'detail-uuid',
    jotformId: '600',
    formContent: null,
    contactId,
  });
}

describe('JotformService.processSubmission', () => {
  let service: JotformService;
  let jotform: { getSubmission: jest.Mock };
  let bitrix: { call: jest.Mock };
  let repository: {
    findOrCreateDetail: jest.Mock;
    createSubmission: jest.Mock;
    finishSubmission: jest.Mock;
    saveContent: jest.Mock;
    saveContactId: jest.Mock;
  };

  beforeEach(async () => {
    jotform = { getSubmission: jest.fn() };
    bitrix = { call: jest.fn() };
    repository = {
      findOrCreateDetail: jest.fn().mockResolvedValue(makeDetail()),
      createSubmission: jest.fn((_detail: unknown, statusKbn: StatusKbn) =>
        Promise.resolve({ uuid: 'submission-uuid', statusKbn }),
      ),
      finishSubmission: jest.fn(),
      saveContent: jest.fn(),
      saveContactId: jest.fn((detail: FormSubmissionDetail, id: number) => {
        detail.contactId = id;
        return Promise.resolve();
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        JotformService,
        { provide: JotformApiClient, useValue: jotform },
        { provide: BitrixWebhookClient, useValue: bitrix },
        { provide: FormSubmissionRepository, useValue: repository },
        { provide: appConfig.KEY, useValue: { jotform: { formId: FORM_ID } } },
      ],
    }).compile();
    service = moduleRef.get(JotformService);
  });

  it('lấy submission qua Jotform API, lưu nội dung form và tạo contact NAME/PHONE/EMAIL', async () => {
    jotform.getSubmission.mockResolvedValue(makeSubmission());
    bitrix.call.mockResolvedValue(77);

    const result = await service.processSubmission('600');

    expect(jotform.getSubmission).toHaveBeenCalledWith('600');
    expect(repository.saveContent).toHaveBeenCalledWith(expect.anything(), {
      formId: FORM_ID,
      submittedAt: '2026-10-03 10:00:00',
      answers: {
        'Họ và tên': 'Nguyễn Văn An',
        'Số điện thoại': '0912345678',
        Email: 'an@example.com',
      },
    });
    expect(bitrix.call).toHaveBeenCalledWith('crm.contact.add', {
      fields: expect.objectContaining({
        NAME: 'Nguyễn Văn An',
        PHONE: [{ VALUE: '0912345678', VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: 'an@example.com', VALUE_TYPE: 'WORK' }],
      }) as unknown,
    });
    expect(repository.finishSubmission).toHaveBeenCalledWith(
      expect.anything(),
      StatusKbn.SUCCESS,
    );
    expect(result).toMatchObject({
      statusKbn: StatusKbn.SUCCESS,
      status: 'SUCCESS',
      contactId: 77,
    });
  });

  it('submission đã có contact: trả SKIPPED_DUPLICATE, không ghi DB, không gọi Jotform/Bitrix24', async () => {
    repository.findOrCreateDetail.mockResolvedValue(makeDetail(77));

    const result = await service.processSubmission('600');

    expect(result).toEqual({
      submissionUuid: null,
      jotformId: '600',
      statusKbn: StatusKbn.SKIPPED_DUPLICATE,
      status: 'SKIPPED_DUPLICATE',
      contactId: 77,
    });
    expect(repository.createSubmission).not.toHaveBeenCalled();
    expect(repository.finishSubmission).not.toHaveBeenCalled();
    expect(jotform.getSubmission).not.toHaveBeenCalled();
    expect(bitrix.call).not.toHaveBeenCalled();
  });

  it('hai request cùng submission đến đồng thời: chỉ một request tạo contact', async () => {
    jotform.getSubmission.mockResolvedValue(makeSubmission());
    bitrix.call.mockResolvedValue(77);

    const results = await Promise.all([
      service.processSubmission('600'),
      service.processSubmission('600'),
    ]);

    expect(bitrix.call).toHaveBeenCalledTimes(1);
    expect(repository.createSubmission).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.statusKbn).sort()).toEqual([
      StatusKbn.SUCCESS,
      StatusKbn.SKIPPED_DUPLICATE,
    ]);
  });

  it('submission của form khác: FAILED với error_kbn FORM_MISMATCH, trả 422', async () => {
    jotform.getSubmission.mockResolvedValue(makeSubmission({ form_id: '999' }));

    await expect(service.processSubmission('600')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(repository.finishSubmission).toHaveBeenCalledWith(
      expect.anything(),
      StatusKbn.FAILED,
      ErrorKbn.FORM_MISMATCH,
    );
    expect(bitrix.call).not.toHaveBeenCalled();
  });

  it('Bitrix24 từ chối xác thực: FAILED với error_kbn 40003 và ném lỗi ra', async () => {
    jotform.getSubmission.mockResolvedValue(makeSubmission());
    bitrix.call.mockRejectedValue(
      new ExternalApiError('bitrix24', 'AUTH', 'INVALID_CREDENTIALS'),
    );

    await expect(service.processSubmission('600')).rejects.toMatchObject({
      kind: 'AUTH',
    });
    expect(repository.finishSubmission).toHaveBeenCalledWith(
      expect.anything(),
      StatusKbn.FAILED,
      40003,
    );
  });
});
