import {
  FieldErrors,
  ValidationFailedException,
} from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation.pipe';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';

/** Chạy đúng ValidationPipe của ứng dụng, trả về lỗi theo từng trường (`f`). */
async function errorsOf(
  metatype: typeof CreateTaskDto | typeof UpdateTaskDto,
  body: unknown,
): Promise<FieldErrors> {
  try {
    await createValidationPipe().transform(body, { type: 'body', metatype });
    return {};
  } catch (error) {
    return (error as ValidationFailedException).fields;
  }
}

const STATUS_ERROR =
  'Trạng thái phải là một trong: 11000 (To Do), 11001 (In Progress), 11002 (Done)';

describe('CreateTaskDto: validate bằng ValidationPipe', () => {
  it('dữ liệu hợp lệ đầy đủ thì không có lỗi; tiêu đề được bỏ khoảng trắng hai đầu', async () => {
    const body = {
      title: '  CRUD  ',
      description: 'Làm API',
      statusKbn: 11001,
      subtasks: [
        {
          taskName: 'create',
          timeEstimate: 1.5,
          timeSpent: 0.5,
          statusKbn: 12002,
        },
      ],
    };
    expect(await errorsOf(CreateTaskDto, body)).toEqual({});
    const dto = (await createValidationPipe().transform(body, {
      type: 'body',
      metatype: CreateTaskDto,
    })) as CreateTaskDto;
    expect(dto.title).toBe('CRUD');
  });

  it.each([
    ['thiếu', 'Tiêu đề là bắt buộc', {}],
    ['rỗng', 'Tiêu đề là bắt buộc', { title: '' }],
    ['toàn khoảng trắng', 'Tiêu đề là bắt buộc', { title: '   ' }],
    ['là số', 'Tiêu đề phải là chuỗi', { title: 123 }],
    ['quá dài', 'Tiêu đề dài tối đa 200 ký tự', { title: 'a'.repeat(201) }],
  ])('tiêu đề %s → "%s"', async (_case, message, body) => {
    expect(await errorsOf(CreateTaskDto, body)).toEqual({ title: [message] });
  });

  it('statusKbn phải là đúng mã số (chuỗi "11000" hay mã lạ đều bị từ chối)', async () => {
    for (const statusKbn of ['11000', 99, null]) {
      expect(await errorsOf(CreateTaskDto, { title: 'A', statusKbn })).toEqual({
        statusKbn: [STATUS_ERROR],
      });
    }
  });

  it('subtasks: không phải mảng, quá 100 phần tử', async () => {
    expect(
      await errorsOf(CreateTaskDto, { title: 'A', subtasks: 'x' }),
    ).toEqual({ subtasks: ['Danh sách task con phải là mảng'] });
    const many = Array.from({ length: 101 }, () => ({
      taskName: 'x',
      timeEstimate: 1,
    }));
    expect(
      await errorsOf(CreateTaskDto, { title: 'A', subtasks: many }),
    ).toEqual({ subtasks: ['Danh sách task con có tối đa 100 phần tử'] });
  });

  it('lỗi bên trong task con: tên trường kèm vị trí subtasks[i]', async () => {
    const subtasks = [
      {},
      { taskName: 'x', timeEstimate: '1' },
      { taskName: 'x', timeEstimate: -1, timeSpent: 10001 },
      { taskName: 'x', timeEstimate: 1, statusKbn: 11000 },
      5,
    ];
    expect(await errorsOf(CreateTaskDto, { title: 'A', subtasks })).toEqual({
      'subtasks[0].taskName': ['Tên task con là bắt buộc'],
      'subtasks[0].timeEstimate': ['Thời gian ước tính là bắt buộc'],
      'subtasks[1].timeEstimate': ['Thời gian ước tính phải là số'],
      'subtasks[2].timeEstimate': [
        'Thời gian ước tính phải từ 0 tới 10000 giờ',
      ],
      'subtasks[2].timeSpent': ['Thời gian đã làm phải từ 0 tới 10000 giờ'],
      'subtasks[3].statusKbn': [
        'Trạng thái phải là một trong: 12000 (In Progress), 12001 (Done), 12002 (Blocked)',
      ],
      'subtasks[4]': ['Mỗi task con phải là một object'],
    });
  });

  it('trường không có trong DTO bị từ chối, kể cả bên trong task con', async () => {
    const body = {
      title: 'A',
      owner: 'long',
      subtasks: [{ taskName: 'x', timeEstimate: 1, note: 'y' }],
    };
    expect(await errorsOf(CreateTaskDto, body)).toEqual({
      owner: ['Trường này không được hỗ trợ'],
      'subtasks[0].note': ['Trường này không được hỗ trợ'],
    });
  });
});

describe('UpdateTaskDto: mọi trường không bắt buộc, nhưng gửi thì phải hợp lệ', () => {
  it('chỉ gửi một trường, hoặc subtasks rỗng, đều hợp lệ', async () => {
    expect(await errorsOf(UpdateTaskDto, { statusKbn: 11002 })).toEqual({});
    expect(await errorsOf(UpdateTaskDto, { subtasks: [] })).toEqual({});
  });

  it('gửi null hoặc chuỗi rỗng bị từ chối, không lọt qua để xóa mất dữ liệu', async () => {
    expect(
      await errorsOf(UpdateTaskDto, {
        title: null,
        description: null,
        subtasks: null,
      }),
    ).toEqual({
      title: ['Tiêu đề là bắt buộc'],
      description: ['Mô tả phải là chuỗi'],
      subtasks: ['Danh sách task con phải là mảng'],
    });
    expect(await errorsOf(UpdateTaskDto, { title: '  ' })).toEqual({
      title: ['Tiêu đề là bắt buộc'],
    });
  });
});
