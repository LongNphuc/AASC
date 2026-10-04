import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BitrixModule } from '../bitrix/bitrix.module';
import { appConfig, type AppConfig } from '../config/app-config';
import { JotformApiClient } from './clients/jotform-api.client';
import { FormSubmissionDetail } from './entities/form-submission-detail.entity';
import { FormSubmission } from './entities/form-submission.entity';
import { JotformWebhookController } from './controllers/jotform-webhook.controller';
import { JotformController } from './controllers/jotform.controller';
import { JotformService } from './services/jotform.service';
import { FormSubmissionRepository } from './repositories/form-submission.repository';

/** File 1: Jotform -> Bitrix24 qua webhook vào. */
@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [appConfig.KEY],
      useFactory: (config: AppConfig) => ({ timeout: config.httpTimeoutMs }),
    }),
    TypeOrmModule.forFeature([FormSubmission, FormSubmissionDetail]),
    BitrixModule,
  ],
  controllers: [JotformWebhookController, JotformController],
  providers: [JotformApiClient, JotformService, FormSubmissionRepository],
})
export class JotformModule {}
