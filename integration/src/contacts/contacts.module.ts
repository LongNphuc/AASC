import { Module } from '@nestjs/common';
import { BitrixModule } from '../bitrix/bitrix.module';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';
import { RequisitePresetService } from './services/requisite-preset.service';

@Module({
  imports: [BitrixModule],
  controllers: [ContactsController],
  providers: [ContactsService, RequisitePresetService],
})
export class ContactsModule {}
