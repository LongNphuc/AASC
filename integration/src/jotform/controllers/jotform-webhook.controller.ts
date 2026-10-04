import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { NoFilesInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { ErrorKbn } from '../../common/kbn/error.kbn';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { appConfig, type AppConfig } from '../../config/app-config';
import { JotformService, ProcessResult } from '../services/jotform.service';
import { InvalidSubmissionError } from '../mappers/submission.mapper';
import type { JotformWebhookBody } from '../types/jotform.types';
import {
  API_DOC,
  ERROR,
  LOG,
  MESSAGE,
} from '../../common/constants/messages.constant';

/**
 * Jotform gọi endpoint này mỗi khi có submission mới. Không cần API key vì
 * Jotform không gửi được header tùy chỉnh; dữ liệu thật được lấy lại qua
 * Jotform API (xem JotformService).
 */
@ApiTags('Jotform')
@Public()
@Controller('webhook/jotform')
export class JotformWebhookController {
  private readonly logger = new ServiceLogger(
    LogService.JOTFORM,
    JotformWebhookController.name,
  );

  constructor(
    private readonly jotform: JotformService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  @Post()
  @HttpCode(200)
  // Jotform gửi multipart/form-data; interceptor này đọc các trường chữ.
  @UseInterceptors(NoFilesInterceptor())
  @ApiConsumes('multipart/form-data', 'application/x-www-form-urlencoded')
  @ApiOperation({ summary: API_DOC.JOTFORM.WEBHOOK })
  receive(@Body() body: JotformWebhookBody): Promise<ProcessResult> {
    this.logger.log(LOG.JOTFORM.WEBHOOK_RECEIVED(describeBody(body)));

    const submissionId = String(body.submissionID ?? '').trim();
    if (!/^\d+$/.test(submissionId)) {
      throw new BadRequestException(ERROR.JOTFORM.MISSING_SUBMISSION_ID);
    }
    const expectedForm = this.config.jotform.formId;
    if (expectedForm && body.formID && String(body.formID) !== expectedForm) {
      throw new InvalidSubmissionError(
        [ERROR.JOTFORM.FORM_NOT_SUPPORTED(String(body.formID))],
        ErrorKbn.FORM_MISMATCH,
      );
    }

    return this.jotform.processSubmission(submissionId);
  }
}

/**
 * Mô tả body để ghi log: chỉ ghi ID và TÊN các trường, không ghi giá trị,
 * vì câu trả lời là dữ liệu cá nhân (họ tên, điện thoại, email).
 */
function describeBody(body: JotformWebhookBody): string {
  let answerKeys: string[] = [];
  try {
    answerKeys = Object.keys(JSON.parse(body.rawRequest ?? '{}') as object);
  } catch {
    answerKeys = [MESSAGE.JOTFORM.RAW_REQUEST_NOT_JSON];
  }
  return JSON.stringify({
    formID: body.formID,
    submissionID: body.submissionID,
    fields: Object.keys(body),
    answerKeys,
  });
}
