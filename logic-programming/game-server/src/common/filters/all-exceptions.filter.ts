import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ERROR } from '../constants/messages.constant';
import { errorKbnOf } from '../kbn/error.kbn';
import type { ResponseErrorLog } from '../logging/request-logging.middleware';
import { serviceForPath } from '../logging/route-services';
import { ServiceLogger } from '../logging/service-logger';

/** Định dạng lỗi thống nhất mà mọi endpoint HTTP trả về. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  /** Mã lỗi, cùng bộ mã với cột error_kbn trong log. */
  errorKbn: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Bắt mọi lỗi của request HTTP và trả JSON thống nhất. Lỗi 5xx ghi kèm stack
 * vào app.log nhưng không trả stack cho client. Mã lỗi và lý do được để lại
 * trong res.locals để RequestLoggingMiddleware ghi vào log service.
 *
 * Lỗi của sự kiện WebSocket không đi qua đây mà qua handleWs (common/ws).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const body: ErrorResponseBody = {
      ...this.toBody(exception),
      errorKbn: errorKbnOf(exception),
      path: request.path,
      timestamp: new Date().toISOString(),
    };

    const reason = Array.isArray(body.message)
      ? body.message.join('; ')
      : body.message;
    const errorLog: ResponseErrorLog = {
      errorKbn: body.errorKbn,
      errorDetail: `${body.error}: ${reason}`,
    };
    response.locals.errorLog = errorLog;

    if (body.statusCode >= 500) {
      const service = serviceForPath(request.path);
      const logger = service
        ? new ServiceLogger(service, AllExceptionsFilter.name)
        : new Logger(AllExceptionsFilter.name);
      const stack = exception instanceof Error ? exception.stack : undefined;
      logger.error(
        ERROR.SYSTEM.REQUEST_FAILED(
          request.method,
          request.path,
          body.statusCode,
          body.errorKbn,
          reason,
        ),
        stack,
      );
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(
    exception: unknown,
  ): Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message'> {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const message =
        typeof res === 'string'
          ? res
          : ((res as { message?: string | string[] }).message ??
            exception.message);
      const error =
        typeof res === 'object' && 'error' in res
          ? String(res.error)
          : (HttpStatus[status] ?? 'Error');
      return { statusCode: status, error, message };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: ERROR.LABEL.INTERNAL_SERVER_ERROR,
      message: ERROR.SYSTEM.INTERNAL,
    };
  }
}
