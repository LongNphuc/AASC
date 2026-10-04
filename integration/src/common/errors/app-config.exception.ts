import { ServiceUnavailableException } from '@nestjs/common';
import { ErrorKbn, WithErrorKbn } from '../kbn/error.kbn';

/** Ứng dụng thiếu cấu hình nên chưa phục vụ được (error_kbn 90002). */
export class AppConfigException
  extends ServiceUnavailableException
  implements WithErrorKbn
{
  readonly errorKbn = ErrorKbn.CONFIG;
}
