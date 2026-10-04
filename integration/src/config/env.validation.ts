import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { ERROR } from '../common/constants/messages.constant';

/** Thư mục log mặc định; main.ts cũng dùng để mở tệp log trước khi đọc cấu hình. */
export const DEFAULT_LOG_DIR = 'logs';

/**
 * Khai báo các biến môi trường mà ứng dụng đọc.
 *
 * Phần lớn biến để tùy chọn: ứng dụng vẫn khởi động khi mới điền một phần
 * (ví dụ chỉ làm File 1), và tính năng thiếu cấu hình sẽ báo lỗi rõ ràng lúc
 * được gọi. Danh sách biến còn thiếu được in ra khi khởi động (xem main.ts).
 */
export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsOptional()
  @IsUrl({ require_tld: false })
  PUBLIC_URL?: string;

  @IsOptional()
  @IsString()
  BITRIX24_DOMAIN?: string;

  @IsOptional()
  @IsString()
  CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  CLIENT_SECRET?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  BITRIX24_REQUISITE_PRESET_ID?: number;

  @IsOptional()
  @IsString()
  API_KEY?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  BITRIX24_WEBHOOK_URL?: string;

  @IsOptional()
  @IsString()
  JOTFORM_API_KEY?: string;

  @IsOptional()
  @IsString()
  JOTFORM_FORM_ID?: string;

  @IsUrl({ require_tld: false })
  JOTFORM_API_BASE_URL: string = 'https://api.jotform.com';

  @IsString()
  DATABASE_PATH: string = 'data/app.sqlite';

  @IsString()
  LOG_DIR: string = DEFAULT_LOG_DIR;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  HTTP_TIMEOUT_MS: number = 10000;
}

/**
 * Hàm validate cho ConfigModule. Dòng `KEY=` trong .env cho ra chuỗi rỗng,
 * nên đổi chuỗi rỗng thành undefined trước để giá trị mặc định và
 * @IsOptional() hoạt động đúng.
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
