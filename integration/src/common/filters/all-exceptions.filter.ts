import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ExternalApiError } from '../errors/external-api.error';
import { errorKbnOf } from '../kbn/error.kbn';
import type { ResponseErrorLog } from '../logging/request-logging.middleware';
import { serviceForPath } from '../logging/route-services';
import { ServiceLogger } from '../logging/service-logger';
import { ERROR } from '../constants/messages.constant';

/** Định dạng lỗi thống nhất mà mọi endpoint trả về. */
export interface ErrorResponseBody {
  statusCode: number;
  error: string;
  /** Mã lỗi, cùng bộ mã với cột error_kbn trong DB và log. */
  errorKbn: number;
  message: string | string[];
  path: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

/**
 * Bắt mọi lỗi chưa được xử lý và chuyển thành JSON thống nhất:
 * - HttpException (lỗi validate, 404, 401...): giữ mã và thông báo.
 * - ExternalApiError (lỗi gọi Bitrix24/Jotform): đổi sang mã HTTP phù hợp,
 *   kèm mã lỗi gốc để dễ debug.
 * - Lỗi khác: 500, ghi đầy đủ stack vào log nhưng không trả stack cho client.
 *
 * Mã lỗi và lý do được để lại trong res.locals, để RequestLoggingMiddleware
 * ghi vào log của service.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
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

    this.logToApp(exception, request, body, reason);
    response.status(body.statusCode).json(body);
  }

  /** Ghi sự kiện vào app.log: lỗi dịch vụ ngoài và lỗi 5xx. */
  private logToApp(
    exception: unknown,
    request: Request,
    body: ErrorResponseBody,
    reason: string,
  ): void {
    const service = serviceForPath(request.path);
    const logger = service
      ? new ServiceLogger(service, AllExceptionsFilter.name)
      : new Logger(AllExceptionsFilter.name);
    const summary = ERROR.SYSTEM.REQUEST_FAILED(
      request.method,
      request.path,
      body.statusCode,
      body.errorKbn,
      reason,
    );

    if (exception instanceof ExternalApiError) {
      // Lỗi từ dịch vụ bên ngoài: stack không giúp gì, ghi mã lỗi gốc là đủ.
      logger[body.statusCode >= 500 ? 'error' : 'warn'](summary);
    } else if (body.statusCode >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      logger.error(summary, stack);
    }
  }

  private toBody(
    exception: unknown,
  ): Pick<ErrorResponseBody, 'statusCode' | 'error' | 'message' | 'details'> {
    if (exception instanceof ExternalApiError) {
      const service = exception.service.toUpperCase().replace(/-/g, '_');
      return {
        statusCode: exception.httpStatus,
        error: `${service}_${exception.kind}`,
        message: exception.message,
        details: { ...exception.details },
      };
    }

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
