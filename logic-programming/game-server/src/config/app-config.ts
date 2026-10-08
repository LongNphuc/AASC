import { registerAs } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { validateEnv } from './env.validation';

/**
 * Cấu hình đã validate. Dùng: `@Inject(appConfig.KEY) config: AppConfig`.
 * ConfigModule chạy hàm này một lần (cache), nên khóa JWT sinh ngẫu nhiên
 * (khi thiếu JWT_SECRET) giữ nguyên trong suốt lần chạy.
 */
export const appConfig = registerAs('app', () => {
  const env = validateEnv(process.env);
  return {
    port: env.PORT,
    databasePath: env.DATABASE_PATH,
    logDir: env.LOG_DIR,
    bcryptRounds: env.BCRYPT_ROUNDS,
    jwt: {
      secret: env.JWT_SECRET ?? randomBytes(32).toString('hex'),
      secretGenerated: !env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
    },
  };
});

export type AppConfig = ReturnType<typeof appConfig>;
