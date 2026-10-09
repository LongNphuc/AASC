import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { SubtaskStatusKbn, TaskStatusKbn } from '../../common/kbn/status.kbn';
import { TaskDetail } from '../entities/task-detail.entity';
import { Task } from '../entities/task.entity';
import { TasksService } from './tasks.service';

const NOT_FOUND = { errorKbn: ErrorKbn.TASK_NOT_FOUND, status: 404 };
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/** Test với SQLite thật trong bộ nhớ, mỗi test một DB mới. */
describe('TasksService', () => {
  let moduleRef: TestingModule;
  let service: TasksService;
  let tasks: Repository<Task>;
  let details: Repository<TaskDetail>;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Task, TaskDetail],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Task, TaskDetail]),
      ],
      providers: [TasksService],
    }).compile();
    service = moduleRef.get(TasksService);
    tasks = moduleRef.get(getRepositoryToken(Task));
    details = moduleRef.get(getRepositoryToken(TaskDetail));
  });

  afterEach(() => moduleRef.close());

  /** Dòng task_details của một task (đọc thẳng DB). */
  async function detailOf(uuid: string): Promise<TaskDetail> {
    const task = await tasks.findOneByOrFail({ uuid });
    return details.findOneByOrFail({ uuid: task.taskDetailUuid });
  }

  it('tạo task chỉ có tiêu đề: mặc định To Do, mô tả rỗng; task_details có data_json = []', async () => {
    const created = await service.create({ title: 'CRUD' });

    expect(created).toMatchObject({
      title: 'CRUD',
      description: '',
      statusKbn: TaskStatusKbn.TO_DO,
      status: 'To Do',
      subtasks: [],
    });
    expect((await detailOf(created.uuid)).dataJson).toEqual([]);
  });

  it('tạo task kèm task con: data_json lưu khóa snake_case, giờ làm tròn 2 số, điền giá trị mặc định', async () => {
    const created = await service.create({
      title: 'CRUD',
      statusKbn: TaskStatusKbn.IN_PROGRESS,
      subtasks: [
        { taskName: 'create', timeEstimate: 1.005, timeSpent: 0.333 },
        {
          taskName: 'read',
          timeEstimate: 2,
          statusKbn: SubtaskStatusKbn.BLOCKED,
        },
      ],
    });

    expect(created.status).toBe('In Progress');
    expect(created.subtasks).toEqual([
      {
        taskName: 'create',
        timeEstimate: 1.01,
        timeSpent: 0.33,
        statusKbn: SubtaskStatusKbn.IN_PROGRESS,
        status: 'In Progress',
      },
      {
        taskName: 'read',
        timeEstimate: 2,
        timeSpent: 0,
        statusKbn: SubtaskStatusKbn.BLOCKED,
        status: 'Blocked',
      },
    ]);
    expect((await detailOf(created.uuid)).dataJson).toEqual([
      {
        task_name: 'create',
        time_estimate: 1.01,
        time_spent: 0.33,
        status_kbn: 12000,
      },
      { task_name: 'read', time_estimate: 2, time_spent: 0, status_kbn: 12002 },
    ]);
  });

  it('danh sách: mới nhất trước, không kèm task con, không có task đã xóa', async () => {
    const a = await service.create({ title: 'A' });
    const b = await service.create({ title: 'B' });
    const c = await service.create({ title: 'C' });
    await service.remove(b.uuid);

    const list = await service.findAll();

    expect(list.map((t) => t.uuid)).toEqual([c.uuid, a.uuid]);
    expect(list[0]).not.toHaveProperty('subtasks');
  });

  it('xem một task: kèm task con; uuid không tồn tại thì 404 TASK_NOT_FOUND', async () => {
    const created = await service.create({
      title: 'CRUD',
      subtasks: [{ taskName: 'create', timeEstimate: 1 }],
    });

    expect(await service.findOne(created.uuid)).toEqual(created);
    await expect(service.findOne(MISSING_UUID)).rejects.toMatchObject(
      NOT_FOUND,
    );
  });

  it('sửa: chỉ trường được gửi thay đổi; không gửi subtasks thì task con giữ nguyên', async () => {
    const created = await service.create({
      title: 'Cũ',
      description: 'Mô tả',
      subtasks: [{ taskName: 'create', timeEstimate: 1 }],
    });
    await tick();

    const updated = await service.update(created.uuid, { title: 'Mới' });

    expect(updated).toMatchObject({
      title: 'Mới',
      description: 'Mô tả',
      statusKbn: TaskStatusKbn.TO_DO,
      subtasks: created.subtasks,
      createdAt: created.createdAt,
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );
  });

  it('sửa task con: ghi đè toàn bộ data_json bằng danh sách mới; task vẫn tính là vừa cập nhật', async () => {
    const created = await service.create({
      title: 'CRUD',
      subtasks: [
        { taskName: 'create', timeEstimate: 1 },
        { taskName: 'read', timeEstimate: 2 },
      ],
    });
    await tick();

    const updated = await service.update(created.uuid, {
      subtasks: [
        {
          taskName: 'update',
          timeEstimate: 3,
          statusKbn: SubtaskStatusKbn.DONE,
        },
      ],
    });

    expect(updated.subtasks).toEqual([
      {
        taskName: 'update',
        timeEstimate: 3,
        timeSpent: 0,
        statusKbn: SubtaskStatusKbn.DONE,
        status: 'Done',
      },
    ]);
    expect((await detailOf(created.uuid)).dataJson).toHaveLength(1);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );

    const emptied = await service.update(created.uuid, { subtasks: [] });
    expect(emptied.subtasks).toEqual([]);
  });

  it('sửa mà không gửi trường nào thì 400; sửa task không tồn tại thì 404', async () => {
    const created = await service.create({ title: 'CRUD' });

    await expect(service.update(created.uuid, {})).rejects.toMatchObject({
      errorKbn: ErrorKbn.NOTHING_TO_UPDATE,
      status: 400,
    });
    await expect(
      service.update(MISSING_UUID, { title: 'X' }),
    ).rejects.toMatchObject(NOT_FOUND);
  });

  it('xóa mềm: dòng vẫn còn trong DB kèm deleted_at; xem lại, sửa, xóa lần nữa đều 404', async () => {
    const created = await service.create({ title: 'CRUD' });

    await service.remove(created.uuid);

    const row = await tasks.findOneOrFail({
      where: { uuid: created.uuid },
      withDeleted: true,
    });
    expect(row.deletedAt).toBeInstanceOf(Date);
    await expect(service.findOne(created.uuid)).rejects.toMatchObject(
      NOT_FOUND,
    );
    await expect(
      service.update(created.uuid, { title: 'X' }),
    ).rejects.toMatchObject(NOT_FOUND);
    await expect(service.remove(created.uuid)).rejects.toMatchObject(NOT_FOUND);
  });
});
