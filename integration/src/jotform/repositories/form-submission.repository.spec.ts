import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { StatusKbn } from '../../common/kbn/status.kbn';
import { FormSubmissionDetail } from '../entities/form-submission-detail.entity';
import { FormSubmission } from '../entities/form-submission.entity';
import { FormSubmissionRepository } from './form-submission.repository';

/** Chạy với SQLite in-memory thật để kiểm tra đúng ràng buộc và kiểu cột. */
describe('FormSubmissionRepository (SQLite in-memory)', () => {
  let moduleRef: TestingModule;
  let repository: FormSubmissionRepository;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [FormSubmission, FormSubmissionDetail],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([FormSubmission, FormSubmissionDetail]),
      ],
      providers: [FormSubmissionRepository],
    }).compile();
    repository = moduleRef.get(FormSubmissionRepository);
  });

  afterEach(() => moduleRef.close());

  it('cùng jotform_id được tạo đồng thời: chỉ có một dòng chi tiết, khóa chính là uuid', async () => {
    const details = await Promise.all([
      repository.findOrCreateDetail('600'),
      repository.findOrCreateDetail('600'),
      repository.findOrCreateDetail('600'),
    ]);

    expect(new Set(details.map((d) => d.uuid)).size).toBe(1);
    expect(details[0].uuid).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('mỗi lần xử lý là một dòng form_submissions trỏ về cùng chi tiết (lỗi rồi gửi lại thành công)', async () => {
    const detail = await repository.findOrCreateDetail('600');
    const failed = await repository.createSubmission(
      detail,
      StatusKbn.PROCESSING,
    );
    await repository.finishSubmission(
      failed,
      StatusKbn.FAILED,
      ErrorKbn.VALIDATION,
    );
    const retried = await repository.createSubmission(
      detail,
      StatusKbn.PROCESSING,
    );
    await repository.finishSubmission(retried, StatusKbn.SUCCESS);

    const recent = await repository.recent(10);
    expect(recent).toHaveLength(2);
    expect(recent.every((s) => s.detail.uuid === detail.uuid)).toBe(true);
    expect(recent.map((s) => [s.statusKbn, s.errorKbn]).sort()).toEqual([
      [StatusKbn.SUCCESS, null],
      [StatusKbn.FAILED, ErrorKbn.VALIDATION],
    ]);
  });

  it('form_content lưu và đọc lại đúng dạng JSON', async () => {
    const detail = await repository.findOrCreateDetail('600');
    const content = {
      formId: '262753749396070',
      submittedAt: '2026-10-03 10:00:00',
      answers: { 'Họ và tên': 'Nguyễn Văn An' },
    };
    await repository.saveContent(detail, content);
    await repository.saveContactId(detail, 77);

    const submission = await repository.createSubmission(
      detail,
      StatusKbn.SUCCESS,
    );
    const loaded = await repository.findOne(submission.uuid);
    expect(loaded?.detail).toMatchObject({
      formContent: content,
      contactId: 77,
    });
  });
});
