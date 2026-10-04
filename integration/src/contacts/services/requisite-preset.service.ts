import { Inject, Injectable } from '@nestjs/common';
import { BitrixService } from '../../bitrix/services/bitrix.service';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { appConfig, type AppConfig } from '../../config/app-config';
import { BitrixRequisitePreset } from '../types/bitrix-crm.types';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { ERROR, LOG } from '../../common/constants/messages.constant';

/**
 * Tìm PRESET_ID (mẫu requisite) để tạo requisite cho contact.
 *
 * Ưu tiên BITRIX24_REQUISITE_PRESET_ID nếu có cấu hình. Không có thì gọi
 * crm.requisite.preset.list và chọn mẫu dành cho cá nhân (Person/Individual),
 * không thấy thì lấy mẫu đang bật đầu tiên. Kết quả được nhớ lại sau lần đầu.
 */
@Injectable()
export class RequisitePresetService {
  private readonly logger = new ServiceLogger(
    LogService.CONTACTS,
    RequisitePresetService.name,
  );
  private detected?: Promise<number>;

  constructor(
    private readonly bitrix: BitrixService,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  getPresetId(): Promise<number> {
    const configured = this.config.bitrix.requisitePresetId;
    if (configured) {
      return Promise.resolve(configured);
    }
    // Lỗi thì xóa cache để lần sau dò lại.
    this.detected ??= this.detect().catch((error: unknown) => {
      this.detected = undefined;
      throw error;
    });
    return this.detected;
  }

  private async detect(): Promise<number> {
    const presets = await this.bitrix.listAll<BitrixRequisitePreset>(
      'crm.requisite.preset.list',
      { select: ['ID', 'NAME', 'XML_ID', 'ACTIVE'], order: { SORT: 'ASC' } },
    );
    const active = presets.filter((preset) => preset.ACTIVE !== 'N');
    const chosen =
      active.find(
        (preset) =>
          /PERSON|INDIVIDUAL/i.test(preset.XML_ID ?? '') ||
          /cá nhân|person|individual/i.test(preset.NAME),
      ) ?? active[0];

    if (!chosen) {
      throw new ExternalApiError(
        'bitrix24',
        'CONFIG',
        ERROR.CONTACT.NO_REQUISITE_PRESET,
      );
    }
    this.logger.log(LOG.CONTACT.PRESET_SELECTED(chosen.NAME, chosen.ID));
    return Number(chosen.ID);
  }
}
