import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BitrixService } from '../../bitrix/services/bitrix.service';
import { ExternalApiError } from '../../common/errors/external-api.error';
import {
  ADDRESS_TYPE_ACTUAL,
  BitrixAddress,
  BitrixBankDetail,
  BitrixContact,
  BitrixRequisite,
  ContactDetails,
  ENTITY_TYPE,
} from '../types/bitrix-crm.types';
import {
  addressKey,
  displayName,
  toAddressFields,
  toBankFields,
  toContactAddFields,
  toContactResponse,
  toContactUpdateFields,
} from '../mappers/contact.mapper';
import { AddressDto } from '../dto/address.dto';
import { BankDto } from '../dto/bank.dto';
import {
  ContactListResponseDto,
  ContactResponseDto,
} from '../dto/contact-response.dto';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { RequisitePresetService } from './requisite-preset.service';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { ERROR, LOG, WARN } from '../../common/constants/messages.constant';

const CONTACT_SELECT = [
  'ID',
  'NAME',
  'SECOND_NAME',
  'LAST_NAME',
  'PHONE',
  'EMAIL',
  'WEB',
];

/**
 * Quản lý contact trên Bitrix24 qua OAuth (callBitrixAPI).
 *
 * Cấu trúc dữ liệu trên Bitrix24:
 *   contact
 *     └─ requisite (bản "chi tiết", ENTITY_TYPE_ID=3)
 *          ├─ bank detail (tên ngân hàng, số tài khoản)
 *          └─ address (ENTITY_TYPE_ID=8, phường/xã, quận/huyện, tỉnh/thành)
 * Vì vậy tạo đi từ trên xuống, xóa đi từ dưới lên.
 *
 * Bitrix24 REST không có transaction:
 * - Tạo: nếu bước requisite/ngân hàng/địa chỉ lỗi thì xóa contact vừa tạo,
 *   để không để lại contact dở dang.
 * - Sửa: không hoàn tác được (không giữ giá trị cũ), nhưng mỗi bước là ghi
 *   đè nên gửi lại cùng request PUT là an toàn.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new ServiceLogger(
    LogService.CONTACTS,
    ContactsService.name,
  );

  constructor(
    private readonly bitrix: BitrixService,
    private readonly presets: RequisitePresetService,
  ) {}

  async list(start = 0): Promise<ContactListResponseDto> {
    const page = await this.bitrix.callBitrixAPI<BitrixContact[]>(
      'crm.contact.list',
      { select: CONTACT_SELECT, order: { ID: 'ASC' }, start },
    );
    const details = await this.loadDetails(
      page.result.map((c) => Number(c.ID)),
    );
    return {
      items: page.result.map((contact) =>
        toContactResponse(contact, details.get(Number(contact.ID))),
      ),
      total: page.total ?? page.result.length,
      next: page.next ?? null,
    };
  }

  async findOne(id: number): Promise<ContactResponseDto> {
    const contact = await this.getContactOrThrow(id);
    const details = await this.loadDetails([id]);
    return toContactResponse(contact, details.get(id));
  }

  async create(dto: CreateContactDto): Promise<ContactResponseDto> {
    const contactId = Number(
      await this.bitrix.call<number>('crm.contact.add', {
        fields: toContactAddFields(dto),
      }),
    );

    if (hasAddress(dto.address) || dto.bank) {
      try {
        await this.createRequisite(contactId, dto.name, dto.address, dto.bank);
      } catch (error) {
        await this.rollbackContact(contactId);
        throw withContext(error, ERROR.CONTACT.REQUISITE_FAILED);
      }
    }

    this.logger.log(LOG.CONTACT.CREATED(contactId));
    return this.findOne(contactId);
  }

  async update(id: number, dto: UpdateContactDto): Promise<ContactResponseDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException(ERROR.CONTACT.NOTHING_TO_UPDATE);
    }
    const contact = await this.getContactOrThrow(id);

    const fields = toContactUpdateFields(dto, contact);
    if (Object.keys(fields).length > 0) {
      await this.bitrix.call('crm.contact.update', { id, fields });
    }
    if (dto.name !== undefined || hasAddress(dto.address) || dto.bank) {
      await this.syncRequisite(id, dto.name ?? displayName(contact), dto);
    }

    this.logger.log(LOG.CONTACT.UPDATED(id));
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.getContactOrThrow(id);

    const requisites = await this.findRequisites([id]);
    for (const requisite of requisites) {
      const requisiteId = Number(requisite.ID);
      const bankDetails = await this.bitrix.listAll<BitrixBankDetail>(
        'crm.requisite.bankdetail.list',
        { filter: { ENTITY_ID: requisiteId }, select: ['ID'] },
      );
      for (const bankDetail of bankDetails) {
        await this.bitrix.call('crm.requisite.bankdetail.delete', {
          id: Number(bankDetail.ID),
        });
      }
      const addresses = await this.findAddresses([requisiteId]);
      for (const address of addresses) {
        await this.bitrix.call('crm.address.delete', {
          fields: {
            TYPE_ID: Number(address.TYPE_ID),
            ENTITY_TYPE_ID: ENTITY_TYPE.REQUISITE,
            ENTITY_ID: requisiteId,
          },
        });
      }
      await this.bitrix.call('crm.requisite.delete', { id: requisiteId });
    }

    await this.bitrix.call('crm.contact.delete', { id });
    this.logger.log(LOG.CONTACT.DELETED(id, requisites.length));
  }

  // ---------- Đọc ----------

  private async getContactOrThrow(id: number): Promise<BitrixContact> {
    try {
      return await this.bitrix.call<BitrixContact>('crm.contact.get', { id });
    } catch (error) {
      if (error instanceof ExternalApiError && error.kind === 'NOT_FOUND') {
        throw new NotFoundException(ERROR.CONTACT.NOT_FOUND(id));
      }
      throw error;
    }
  }

  /**
   * Đọc requisite, ngân hàng và địa chỉ cho nhiều contact cùng lúc: 3 lệnh gọi
   * cho cả trang (lọc theo danh sách ID), thay vì 3 lệnh gọi cho MỖI contact.
   * Contact có nhiều requisite thì lấy cái tạo sớm nhất.
   */
  private async loadDetails(
    contactIds: number[],
  ): Promise<Map<number, ContactDetails>> {
    const result = new Map<number, ContactDetails>();
    if (contactIds.length === 0) {
      return result;
    }

    for (const requisite of await this.findRequisites(contactIds)) {
      const contactId = Number(requisite.ENTITY_ID);
      if (!result.has(contactId)) {
        result.set(contactId, { requisite });
      }
    }
    const byRequisiteId = new Map(
      [...result.values()].map((d) => [Number(d.requisite.ID), d]),
    );
    if (byRequisiteId.size === 0) {
      return result;
    }

    const requisiteIds = [...byRequisiteId.keys()];
    const [bankDetails, addresses] = await Promise.all([
      this.bitrix.listAll<BitrixBankDetail>('crm.requisite.bankdetail.list', {
        filter: { ENTITY_ID: requisiteIds },
        order: { ID: 'ASC' },
      }),
      this.findAddresses(requisiteIds),
    ]);

    for (const bankDetail of bankDetails) {
      const details = byRequisiteId.get(Number(bankDetail.ENTITY_ID));
      if (details && !details.bankDetail) {
        details.bankDetail = bankDetail;
      }
    }
    for (const address of addresses) {
      const details = byRequisiteId.get(Number(address.ENTITY_ID));
      // Ưu tiên địa chỉ thực tế (TYPE_ID=1), không có thì lấy địa chỉ bất kỳ.
      if (
        details &&
        (!details.address || Number(address.TYPE_ID) === ADDRESS_TYPE_ACTUAL)
      ) {
        details.address = address;
      }
    }
    return result;
  }

  private findRequisites(contactIds: number[]): Promise<BitrixRequisite[]> {
    return this.bitrix.listAll<BitrixRequisite>('crm.requisite.list', {
      filter: { ENTITY_TYPE_ID: ENTITY_TYPE.CONTACT, ENTITY_ID: contactIds },
      select: ['ID', 'ENTITY_TYPE_ID', 'ENTITY_ID', 'NAME', 'PRESET_ID'],
      order: { ID: 'ASC' },
    });
  }

  private findAddresses(requisiteIds: number[]): Promise<BitrixAddress[]> {
    return this.bitrix.listAll<BitrixAddress>('crm.address.list', {
      filter: {
        ENTITY_TYPE_ID: ENTITY_TYPE.REQUISITE,
        ENTITY_ID: requisiteIds,
      },
    });
  }

  // ---------- Ghi ----------

  /** Tạo requisite gắn vào contact, rồi tạo địa chỉ và ngân hàng gắn vào requisite. */
  private async createRequisite(
    contactId: number,
    name: string,
    address?: AddressDto,
    bank?: BankDto,
  ): Promise<void> {
    const requisiteId = Number(
      await this.bitrix.call<number>('crm.requisite.add', {
        fields: {
          ENTITY_TYPE_ID: ENTITY_TYPE.CONTACT,
          ENTITY_ID: contactId,
          PRESET_ID: await this.presets.getPresetId(),
          NAME: name,
          ACTIVE: 'Y',
        },
      }),
    );
    if (hasAddress(address)) {
      await this.bitrix.call('crm.address.add', {
        fields: { ...addressKey(requisiteId), ...toAddressFields(address) },
      });
    }
    if (bank) {
      await this.bitrix.call('crm.requisite.bankdetail.add', {
        fields: { ENTITY_ID: requisiteId, ...toBankFields(bank) },
      });
    }
  }

  /** Cập nhật requisite sẵn có (tên, địa chỉ, ngân hàng); chưa có thì tạo mới. */
  private async syncRequisite(
    contactId: number,
    name: string,
    dto: UpdateContactDto,
  ): Promise<void> {
    const [requisite] = await this.findRequisites([contactId]);
    if (!requisite) {
      if (hasAddress(dto.address) || dto.bank) {
        await this.createRequisite(contactId, name, dto.address, dto.bank);
      }
      return;
    }

    const requisiteId = Number(requisite.ID);
    if (dto.name !== undefined) {
      // Giữ tên requisite khớp với tên contact.
      await this.bitrix.call('crm.requisite.update', {
        id: requisiteId,
        fields: { NAME: dto.name },
      });
    }
    if (hasAddress(dto.address)) {
      await this.upsertAddress(requisiteId, dto.address);
    }
    if (dto.bank) {
      await this.upsertBankDetail(requisiteId, dto.bank);
    }
  }

  private async upsertAddress(
    requisiteId: number,
    address: AddressDto,
  ): Promise<void> {
    const existing = await this.findAddresses([requisiteId]);
    const hasActual = existing.some(
      (a) => Number(a.TYPE_ID) === ADDRESS_TYPE_ACTUAL,
    );
    await this.bitrix.call(
      hasActual ? 'crm.address.update' : 'crm.address.add',
      {
        fields: { ...addressKey(requisiteId), ...toAddressFields(address) },
      },
    );
  }

  private async upsertBankDetail(
    requisiteId: number,
    bank: BankDto,
  ): Promise<void> {
    const [existing] = await this.bitrix.listAll<BitrixBankDetail>(
      'crm.requisite.bankdetail.list',
      { filter: { ENTITY_ID: requisiteId }, order: { ID: 'ASC' } },
    );
    if (existing) {
      await this.bitrix.call('crm.requisite.bankdetail.update', {
        id: Number(existing.ID),
        fields: toBankFields(bank),
      });
    } else {
      await this.bitrix.call('crm.requisite.bankdetail.add', {
        fields: { ENTITY_ID: requisiteId, ...toBankFields(bank) },
      });
    }
  }

  /** Xóa contact vừa tạo khi các bước sau thất bại. Lỗi khi xóa chỉ ghi log. */
  private async rollbackContact(contactId: number): Promise<void> {
    try {
      await this.bitrix.call('crm.contact.delete', { id: contactId });
      this.logger.warn(WARN.CONTACT.ROLLED_BACK(contactId));
    } catch (error) {
      this.logger.error(
        ERROR.CONTACT.ROLLBACK_FAILED(contactId, (error as Error).message),
      );
    }
  }
}

/** Có ít nhất một phần địa chỉ được gửi lên (bỏ qua `address: {}`). */
function hasAddress(address?: AddressDto): address is AddressDto {
  return !!address && Object.keys(toAddressFields(address)).length > 0;
}

/** Thêm ngữ cảnh vào thông báo lỗi nhưng giữ nguyên loại lỗi. */
function withContext(
  error: unknown,
  describe: (reason: string) => string,
): unknown {
  if (error instanceof ExternalApiError) {
    return new ExternalApiError(
      error.service,
      error.kind,
      describe(error.message),
      error.details,
    );
  }
  return error;
}
