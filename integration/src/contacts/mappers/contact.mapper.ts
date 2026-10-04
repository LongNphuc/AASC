import { BitrixMultiField } from '../../bitrix/types/bitrix.types';
import {
  ADDRESS_TYPE_ACTUAL,
  BitrixAddress,
  BitrixContact,
  ContactDetails,
  ENTITY_TYPE,
} from '../types/bitrix-crm.types';
import { AddressDto } from '../dto/address.dto';
import { BankDto } from '../dto/bank.dto';
import { ContactResponseDto } from '../dto/contact-response.dto';
import { CreateContactDto } from '../dto/create-contact.dto';
import { UpdateContactDto } from '../dto/update-contact.dto';

/**
 * Ánh xạ địa chỉ Việt Nam sang trường địa chỉ của Bitrix24 (crm.address).
 * Chọn sao cho chuỗi địa chỉ Bitrix24 ghép ra đúng thứ tự quen thuộc:
 * "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh".
 */
export const ADDRESS_FIELD_MAP = {
  street: 'ADDRESS_1',
  ward: 'ADDRESS_2',
  district: 'REGION',
  province: 'PROVINCE',
} as const satisfies Record<keyof AddressDto, keyof BitrixAddress>;

const DEFAULT_VALUE_TYPE = 'WORK';

// ---------- Từ DTO sang trường Bitrix24 ----------

/** Trường của crm.contact.add. Toàn bộ họ tên vào NAME, theo đề bài. */
export function toContactAddFields(dto: CreateContactDto) {
  return {
    NAME: dto.name,
    OPENED: 'Y',
    ...(dto.phone && { PHONE: [newMultiValue(dto.phone)] }),
    ...(dto.email && { EMAIL: [newMultiValue(dto.email)] }),
    ...(dto.website && { WEB: [newMultiValue(dto.website)] }),
  };
}

/**
 * Trường của crm.contact.update, chỉ gồm trường client gửi lên.
 *
 * Với PHONE/EMAIL/WEB, gửi `{ VALUE }` sẽ THÊM một giá trị mới chứ không
 * thay thế. Muốn sửa thì phải kèm ID của giá trị cũ, nên cần dữ liệu hiện tại.
 */
export function toContactUpdateFields(
  dto: UpdateContactDto,
  current: BitrixContact,
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (dto.name !== undefined) {
    // Contact tạo trên giao diện có thể tách họ/tên đệm; xóa đi để tên không bị lặp.
    Object.assign(fields, { NAME: dto.name, SECOND_NAME: '', LAST_NAME: '' });
  }
  if (dto.phone !== undefined) {
    fields.PHONE = replacePrimaryValue(current.PHONE, dto.phone);
  }
  if (dto.email !== undefined) {
    fields.EMAIL = replacePrimaryValue(current.EMAIL, dto.email);
  }
  if (dto.website !== undefined) {
    fields.WEB = replacePrimaryValue(current.WEB, dto.website);
  }
  return fields;
}

/** Trường địa chỉ, chỉ gồm phần client gửi lên (cho phép sửa từng phần). */
export function toAddressFields(address: AddressDto): Partial<BitrixAddress> {
  const fields: Partial<BitrixAddress> = {};
  for (const [key, bitrixField] of Object.entries(ADDRESS_FIELD_MAP)) {
    const value = address[key as keyof AddressDto];
    if (value !== undefined) {
      fields[bitrixField] = value;
    }
  }
  return fields;
}

/** Khóa nhận dạng địa chỉ thực tế của một requisite. */
export function addressKey(requisiteId: number) {
  return {
    TYPE_ID: ADDRESS_TYPE_ACTUAL,
    ENTITY_TYPE_ID: ENTITY_TYPE.REQUISITE,
    ENTITY_ID: requisiteId,
  };
}

/** Trường của crm.requisite.bankdetail.add/update. NAME là bắt buộc. */
export function toBankFields(bank: BankDto) {
  return {
    NAME: bank.bankName,
    RQ_BANK_NAME: bank.bankName,
    RQ_ACC_NUM: bank.accountNumber,
  };
}

function newMultiValue(value: string): BitrixMultiField {
  return { VALUE: value, VALUE_TYPE: DEFAULT_VALUE_TYPE };
}

/** Sửa giá trị đầu tiên (theo ID) nếu đã có, nếu chưa có thì thêm mới. */
function replacePrimaryValue(
  current: BitrixMultiField[] | undefined,
  value: string,
): BitrixMultiField[] {
  const primary = current?.[0];
  if (!primary?.ID) {
    return [newMultiValue(value)];
  }
  return [
    {
      ID: primary.ID,
      VALUE: value,
      VALUE_TYPE: primary.VALUE_TYPE ?? DEFAULT_VALUE_TYPE,
    },
  ];
}

// ---------- Từ Bitrix24 sang response ----------

/** Họ tên theo thứ tự Việt Nam: họ, tên đệm, tên. */
export function displayName(contact: BitrixContact): string {
  return [contact.LAST_NAME, contact.SECOND_NAME, contact.NAME]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
}

export function toContactResponse(
  contact: BitrixContact,
  details?: ContactDetails,
): ContactResponseDto {
  return {
    id: Number(contact.ID),
    name: displayName(contact),
    phone: contact.PHONE?.[0]?.VALUE ?? null,
    email: contact.EMAIL?.[0]?.VALUE ?? null,
    website: contact.WEB?.[0]?.VALUE ?? null,
    address: details?.address ? toAddressDto(details.address) : null,
    bank: details?.bankDetail
      ? {
          bankName:
            details.bankDetail.RQ_BANK_NAME ?? details.bankDetail.NAME ?? '',
          accountNumber: details.bankDetail.RQ_ACC_NUM ?? '',
        }
      : null,
  };
}

function toAddressDto(address: BitrixAddress): AddressDto {
  return {
    street: address.ADDRESS_1 ?? undefined,
    ward: address.ADDRESS_2 ?? undefined,
    district: address.REGION ?? undefined,
    // Địa chỉ nhập trên giao diện có thể để tỉnh/thành ở ô "Thành phố".
    province: address.PROVINCE ?? address.CITY ?? undefined,
  };
}
