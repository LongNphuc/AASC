import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { ERROR, LOG, WARN } from './common/constants/messages.constant';
import { AppLogger } from './common/logging/app-logger.service';
import { logFiles } from './common/logging/log-files';
import { appConfig, AppConfig } from './config/app-config';
import { DEFAULT_LOG_DIR } from './config/env.validation';
import { loadEnvFileIfPresent } from './config/load-env-file';

// Mở tệp log trước khi Nest khởi tạo, để lỗi khởi động cũng vào app.log.
loadEnvFileIfPresent();
logFiles.configure(process.env.LOG_DIR || DEFAULT_LOG_DIR);
const logger = new AppLogger('Bootstrap');

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    abortOnError: false,
  });
  const config = app.get<AppConfig>(appConfig.KEY);

  // Client (HTML, CSS, JS) nằm trong public/; chỉ phục vụ tệp có thật, đường
  // dẫn khác vẫn đi tới controller. Socket.IO tự phục vụ /socket.io/socket.io.js.
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableShutdownHooks();
  await app.listen(config.port);

  logger.log(LOG.BOOTSTRAP.LISTENING(config.port));
  logger.log(LOG.BOOTSTRAP.CLIENT(config.port));
  if (config.jwt.secretGenerated) {
    logger.warn(WARN.BOOTSTRAP.JWT_SECRET_GENERATED);
  }
}

/** Khởi động thất bại: ghi lý do vào app.log, chờ ghi xong rồi thoát mã 1. */
bootstrap().catch(async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(ERROR.SYSTEM.STARTUP_FAILED(message));
  await logFiles.close();
  process.exit(1);
});
