import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsString, Max, Min, validateSync } from 'class-validator';
import { ERROR } from '../common/constants/messages.constant';

/** Thư mục log mặc định; main.ts cũng dùng để mở tệp log trước khi đọc cấu hình. */
export const DEFAULT_LOG_DIR = 'logs';

/**
 * Khai báo các biến môi trường. Mọi biến đều có giá trị mặc định, nên ứng
 * dụng chạy được ngay cả khi chưa tạo .env.
 */
export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3002;

  @IsString()
  DATABASE_PATH: string = 'data/tasks.sqlite';

  @IsString()
  LOG_DIR: string = DEFAULT_LOG_DIR;
}

/**
 * Hàm validate cấu hình. Dòng `KEY=` trong .env cho ra chuỗi rỗng, nên đổi
 * chuỗi rỗng thành undefined trước để giá trị mặc định hoạt động.
 */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const cleaned = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== ''),
  );
  const env = plainToInstance(EnvironmentVariables, cleaned);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(ERROR.SYSTEM.INVALID_ENV(details));
  }
  return env;
}
