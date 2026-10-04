import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { JotformService } from '../services/jotform.service';
import { API_DOC } from '../../common/constants/messages.constant';

/** Endpoint quản trị phần Jotform (cần API key). */
@ApiTags('Jotform')
@ApiSecurity('api-key')
@Controller('jotform')
export class JotformController {
  constructor(private readonly jotform: JotformService) {}

  @Post('sync')
  @ApiOperation({
    summary: API_DOC.JOTFORM.SYNC,
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  sync(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.jotform.syncRecent(Math.min(Math.max(limit, 1), 100));
  }

  @Get('webhooks')
  @ApiOperation({ summary: API_DOC.JOTFORM.LIST_WEBHOOKS })
  webhooks() {
    return this.jotform.listWebhooks();
  }

  @Post('webhooks')
  @ApiOperation({
    summary: API_DOC.JOTFORM.REGISTER_WEBHOOK,
  })
  registerWebhook() {
    return this.jotform.ensureWebhook();
  }

  @Get('submissions')
  @ApiOperation({
    summary: API_DOC.JOTFORM.LIST_SUBMISSIONS,
  })
  submissions() {
    return this.jotform.recentSubmissions(50);
  }

  @Get('submissions/:uuid')
  @ApiOperation({ summary: API_DOC.JOTFORM.GET_SUBMISSION })
  submission(@Param('uuid', ParseUUIDPipe) uuid: string) {
    return this.jotform.findSubmission(uuid);
  }
}
