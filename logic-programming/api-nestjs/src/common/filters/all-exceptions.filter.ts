import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR, ERROR_KBNS } from '../constants/messages.constant';
import { AppException } from '../errors/app.exception';
import { ValidationFailedException } from '../errors/validation-failed.exception';
import { ErrorKbn, errorKbnOf } from '../kbn/error.kbn';
import type { ResponseErrorLog } from '../logging/request-logging.middleware';
import { serviceForPath } from '../logging/route-services';
import { ServiceLogger } from '../logging/service-logger';
import type { ErrorResponse } from '../response/api-response';

/**
 * Bắt mọi lỗi và trả body { r, m, f?, d? } (xem api-response.ts):
 * - r: mã lỗi; m: câu thông báo của mã đó (ERROR_KBNS);
 * - f: lỗi theo từng trường, chỉ khi lỗi validate;
 * - d: thông tin phụ của lỗi, ví dụ uuid không tìm thấy.
 *
 * Mã HTTP vẫn đúng loại lỗi (400, 404, 500). Lỗi 5xx ghi kèm stack vào
 * app.log nhưng không trả chi tiết cho client. Mã lỗi và lý do được để lại
 * trong res.locals để RequestLoggingMiddleware ghi vào log service.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = toErrorResponse(exception, request.path);

    const detail = detailForLog(exception, body);
    const errorLog: ResponseErrorLog = {
      errorKbn: body.r,
      errorDetail: detail,
    };
    response.locals.errorLog = errorLog;

    if (status >= 500) {
      const service = serviceForPath(request.path);
      const logger = service
        ? new ServiceLogger(service, AllExceptionsFilter.name)
        : new Logger(AllExceptionsFilter.name);
      const stack = exception instanceof Error ? exception.stack : undefined;
      logger.error(
        ERROR.SYSTEM.REQUEST_FAILED(
          request.method,
          request.path,
          status,
          body.r,
          detail,
        ),
        stack,
      );
    }
    response.status(status).json(body);
  }
}

export function toErrorResponse(
  exception: unknown,
  path: string,
): ErrorResponse {
  const r = errorKbnOf(exception);
  const body: ErrorResponse = {
    r,
    m: ERROR_KBNS[r] ?? ERROR_KBNS[ErrorKbn.UNKNOWN],
  };
  if (exception instanceof ValidationFailedException) {
    body.f = exception.fields;
  } else if (exception instanceof AppException && exception.data) {
    body.d = exception.data;
  } else if (r === ErrorKbn.NOT_FOUND) {
    body.d = { path };
  }
  return body;
}

/** Lý do lỗi ghi vào log (đầy đủ hơn m, kể cả lỗi lạ của hệ thống). */
function detailForLog(exception: unknown, body: ErrorResponse): string {
  if (body.f) {
    return Object.entries(body.f)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ');
  }
  const reason = exception instanceof Error ? exception.message : body.m;
  return body.d ? `${reason} ${JSON.stringify(body.d)}` : reason;
}
