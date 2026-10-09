import { ErrorKbn } from '../../common/kbn/error.kbn';
import { TaskUuidPipe } from './task-uuid.pipe';

describe('TaskUuidPipe', () => {
  const pipe = new TaskUuidPipe();
  const meta = { type: 'param' as const, data: 'uuid' };

  it('uuid hợp lệ thì cho qua', async () => {
    const uuid = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
    await expect(pipe.transform(uuid, meta)).resolves.toBe(uuid);
  });

  it('uuid sai thì lỗi validate 400, lỗi ghi ở trường uuid', async () => {
    await expect(pipe.transform('abc', meta)).rejects.toMatchObject({
      errorKbn: ErrorKbn.VALIDATION,
      status: 400,
      fields: { uuid: ['Mã task (uuid) không hợp lệ'] },
    });
  });
});
