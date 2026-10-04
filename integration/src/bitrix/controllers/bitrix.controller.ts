import { Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { BitrixTokenService } from '../services/bitrix-token.service';
import { BitrixService } from '../services/bitrix.service';
import { BitrixInstallation } from '../entities/bitrix-installation.entity';
import { API_DOC } from '../../common/constants/messages.constant';

/** Thông tin bản cài đặt, không bao giờ kèm token. */
function toStatus(installation: BitrixInstallation) {
  return {
    memberId: installation.memberId,
    domain: installation.domain,
    userId: installation.userId,
    userName: installation.userName,
    scope: installation.scope,
    expiresAt: installation.expiresAt,
    expiresInSeconds: Math.round(
      (installation.expiresAt.getTime() - Date.now()) / 1000,
    ),
    installedAt: installation.installedAt,
    updatedAt: installation.updatedAt,
  };
}

/** Endpoint hỗ trợ kiểm tra và demo cơ chế OAuth (cần API key). */
@ApiTags('Bitrix24 OAuth')
@ApiSecurity('api-key')
@Controller('bitrix')
export class BitrixController {
  constructor(
    private readonly tokens: BitrixTokenService,
    private readonly bitrix: BitrixService,
  ) {}

  @Get('installation')
  @ApiOperation({
    summary: API_DOC.BITRIX.INSTALLATION,
  })
  async installation() {
    return toStatus(await this.tokens.getInstallation());
  }

  @Post('token/refresh')
  @ApiOperation({
    summary: API_DOC.BITRIX.REFRESH,
  })
  async refresh() {
    const installation = await this.tokens.getInstallation();
    return toStatus(await this.tokens.refresh(installation.memberId));
  }

  @Get('test-call')
  @ApiOperation({
    summary: API_DOC.BITRIX.TEST_CALL,
  })
  testCall() {
    return this.bitrix.callBitrixAPI('crm.contact.list', {
      select: ['ID', 'NAME', 'LAST_NAME'],
      order: { ID: 'ASC' },
    });
  }
}
