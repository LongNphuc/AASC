import { registerAs } from '@nestjs/config';
import { validateEnv } from './env.validation';

/** Cấu hình đã validate. Dùng: `@Inject(appConfig.KEY) config: AppConfig`. */
export const appConfig = registerAs('app', () => {
  const env = validateEnv(process.env);
  return {
    port: env.PORT,
    databasePath: env.DATABASE_PATH,
    logDir: env.LOG_DIR,
  };
});

export type AppConfig = ReturnType<typeof appConfig>;
