import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, type AppConfig } from '../config/app-config';
import { BitrixHttpClient } from './clients/bitrix-http.client';
import { BitrixOAuthClient } from './clients/bitrix-oauth.client';
import { BitrixTokenService } from './services/bitrix-token.service';
import { BitrixWebhookClient } from './clients/bitrix-webhook.client';
import { BitrixController } from './controllers/bitrix.controller';
import { BitrixService } from './services/bitrix.service';
import { BitrixInstallation } from './entities/bitrix-installation.entity';
import { BitrixInstallService } from './services/bitrix-install.service';
import { InstallController } from './controllers/install.controller';
import { TokenRefreshScheduler } from './schedulers/token-refresh.scheduler';

/**
 * Tích hợp Bitrix24: OAuth (cài đặt, lưu và làm mới token, callBitrixAPI)
 * và webhook vào. Module khác dùng BitrixService (OAuth) hoặc
 * BitrixWebhookClient (webhook).
 */
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => ({ timeout: config.httpTimeoutMs }),
    }),
    TypeOrmModule.forFeature([BitrixInstallation]),
  ],
  controllers: [InstallController, BitrixController],
  providers: [
    BitrixHttpClient,
    BitrixOAuthClient,
    BitrixTokenService,
    BitrixService,
    BitrixInstallService,
    BitrixWebhookClient,
    TokenRefreshScheduler,
  ],
  exports: [BitrixService, BitrixWebhookClient],
})
export class BitrixModule {}
