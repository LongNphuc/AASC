import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

// Cấu hình chỉ được đọc khi module khởi tạo (trong beforeAll), nên đặt ở đây
// là kịp. Biến có sẵn trong process.env được ưu tiên hơn giá trị trong .env.
process.env.DATABASE_PATH = ':memory:';
process.env.API_KEY = 'e2e-test-key';
process.env.BITRIX24_DOMAIN = 'demo.bitrix24.vn';

describe('Ứng dụng (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health không cần API key', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ status: 'ok' }));
  });

  it('endpoint có bảo vệ trả 401 khi thiếu hoặc sai x-api-key', async () => {
    await request(app.getHttpServer()).get('/bitrix/installation').expect(401);
    await request(app.getHttpServer())
      .get('/bitrix/installation')
      .set('x-api-key', 'sai')
      .expect(401);
  });

  it('đúng API key nhưng chưa cài ứng dụng thì báo NOT_INSTALLED', () => {
    return request(app.getHttpServer())
      .get('/bitrix/installation')
      .set('x-api-key', 'e2e-test-key')
      .expect(503)
      .expect(({ body }) =>
        expect(body).toMatchObject({ error: 'BITRIX24_NOT_INSTALLED' }),
      );
  });

  it('POST /install với dữ liệu lạ trả 400', () => {
    return request(app.getHttpServer())
      .post('/install')
      .type('form')
      .send({ foo: 'bar' })
      .expect(400);
  });
});
