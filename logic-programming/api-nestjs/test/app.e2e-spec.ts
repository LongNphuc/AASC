import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/config/swagger';

// Cấu hình chỉ được đọc khi module khởi tạo (beforeAll), nên đặt ở đây là kịp.
process.env.DATABASE_PATH = ':memory:';

interface TaskBody {
  uuid: string;
  title: string;
  statusKbn: number;
  status: string;
  subtasks?: { taskName: string; status: string }[];
}

/** Body phản hồi { r, d | l, m, f }. */
interface ResponseBody<T = TaskBody> {
  r: number;
  d?: T;
  l?: TaskBody[];
  m?: string;
  f?: Record<string, string[]>;
}

const SUCCESS = 10000;

describe('Task API (e2e: app thật, SQLite trong bộ nhớ)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());
  const body = <T = TaskBody>(res: request.Response) =>
    res.body as ResponseBody<T>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('CRUD đủ vòng: tạo → danh sách → xem → sửa → xóa mềm → không còn thấy', async () => {
    const created = body(
      await http()
        .post('/tasks')
        .send({
          title: 'CRUD',
          subtasks: [
            { taskName: 'create', timeEstimate: 1.5 },
            { taskName: 'read', timeEstimate: 1, statusKbn: 12002 },
          ],
        })
        .expect(201),
    );
    expect(created.r).toBe(SUCCESS);
    const task = created.d!;
    expect(task).toMatchObject({ statusKbn: 11000, status: 'To Do' });
    expect(task.subtasks?.map((s) => s.status)).toEqual([
      'In Progress',
      'Blocked',
    ]);

    const list = body(await http().get('/tasks').expect(200));
    expect(list).not.toHaveProperty('d');
    expect(list.l?.map((t) => t.uuid)).toContain(task.uuid);

    const one = body(await http().get(`/tasks/${task.uuid}`).expect(200));
    expect(one.d?.subtasks).toHaveLength(2);

    const updated = body(
      await http()
        .patch(`/tasks/${task.uuid}`)
        .send({
          statusKbn: 11002,
          subtasks: [{ taskName: 'update', timeEstimate: 2, statusKbn: 12001 }],
        })
        .expect(200),
    );
    expect(updated.d).toMatchObject({
      title: 'CRUD',
      statusKbn: 11002,
      status: 'Done',
      subtasks: [{ taskName: 'update', status: 'Done' }],
    });

    const deleted = await http().delete(`/tasks/${task.uuid}`).expect(200);
    expect(deleted.body).toEqual({ r: SUCCESS });
    const gone = await http().get(`/tasks/${task.uuid}`).expect(404);
    expect(gone.body).toEqual({
      r: 30001,
      m: 'Task không tồn tại hoặc đã bị xóa',
      d: { uuid: task.uuid },
    });
    const after = body(await http().get('/tasks').expect(200));
    expect(after.l?.map((t) => t.uuid)).not.toContain(task.uuid);
  });

  it('lỗi trả { r, m } kèm f (lỗi từng trường) hoặc d (thông tin phụ)', async () => {
    const bad = await http()
      .post('/tasks')
      .send({ title: '   ', statusKbn: 'Done' })
      .expect(400);
    expect(bad.body).toEqual({
      r: 20001,
      m: 'Dữ liệu không hợp lệ',
      f: {
        title: ['Tiêu đề là bắt buộc'],
        statusKbn: [
          'Trạng thái phải là một trong: 11000 (To Do), 11001 (In Progress), 11002 (Done)',
        ],
      },
    });

    const badUuid = await http().get('/tasks/abc').expect(400);
    expect(body(badUuid).f).toEqual({ uuid: ['Mã task (uuid) không hợp lệ'] });

    const created = body(
      await http().post('/tasks').send({ title: 'A' }).expect(201),
    );
    const nothing = await http()
      .patch(`/tasks/${created.d!.uuid}`)
      .send({})
      .expect(400);
    expect(body(nothing).r).toBe(20003);

    const missing = await http()
      .patch('/tasks/00000000-0000-4000-8000-000000000000')
      .send({ title: 'X' })
      .expect(404);
    expect(body(missing).r).toBe(30001);

    const noRoute = await http().get('/khong-co').expect(404);
    expect(noRoute.body).toEqual({
      r: 20002,
      m: 'Đường dẫn không tồn tại',
      d: { path: '/khong-co' },
    });
  });

  it('GET /tasks với 100 bản ghi phản hồi dưới 200 ms', async () => {
    for (let i = 0; i < 100; i++) {
      await http()
        .post('/tasks')
        .send({
          title: `Task ${i}`,
          subtasks: [
            { taskName: 'create', timeEstimate: 1 },
            { taskName: 'update', timeEstimate: 2 },
          ],
        })
        .expect(201);
    }

    const timings: number[] = [];
    for (let i = 0; i < 10; i++) {
      const startedAt = performance.now();
      const res = await http().get('/tasks').expect(200);
      timings.push(performance.now() - startedAt);
      expect(body(res).l!.length).toBeGreaterThanOrEqual(100);
    }
    expect(Math.max(...timings)).toBeLessThan(200);
  });

  it('Swagger có tại /docs, tài liệu JSON có đủ các endpoint /tasks', async () => {
    await http().get('/docs').expect(200);
    const doc = await http().get('/docs-json').expect(200);
    const paths = (doc.body as { paths: Record<string, object> }).paths;
    expect(Object.keys(paths['/tasks']).sort()).toEqual(['get', 'post']);
    expect(Object.keys(paths['/tasks/{uuid}']).sort()).toEqual([
      'delete',
      'get',
      'patch',
    ]);
  });
});
