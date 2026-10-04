import { BitrixMultiField } from '../../bitrix/types/bitrix.types';

/** ENTITY_TYPE_ID của CRM: requisite gắn vào contact (3), địa chỉ gắn vào requisite (8). */
export const ENTITY_TYPE = {
  CONTACT: 3,
  REQUISITE: 8,
} as const;

/** TYPE_ID của địa chỉ: 1 là địa chỉ thực tế (actual address). */
export const ADDRESS_TYPE_ACTUAL = 1;

export interface BitrixContact {
  ID: string;
  NAME?: string | null;
  SECOND_NAME?: string | null;
  LAST_NAME?: string | null;
  PHONE?: BitrixMultiField[];
  EMAIL?: BitrixMultiField[];
  WEB?: BitrixMultiField[];
}

/** Bản "chi tiết" (requisite) gắn với contact; thông tin ngân hàng và địa chỉ là con của nó. */
export interface BitrixRequisite {
  ID: string;
  ENTITY_TYPE_ID: string;
  ENTITY_ID: string;
  PRESET_ID?: string;
  NAME?: string;
}

export interface BitrixBankDetail {
  ID: string;
  /** ID của requisite chứa thông tin ngân hàng này. */
  ENTITY_ID: string;
  NAME?: string;
  RQ_BANK_NAME?: string | null;
  RQ_ACC_NUM?: string | null;
}

export interface BitrixAddress {
  TYPE_ID: string;
  ENTITY_TYPE_ID: string;
  ENTITY_ID: string;
  ADDRESS_1?: string | null;
  ADDRESS_2?: string | null;
  CITY?: string | null;
  REGION?: string | null;
  PROVINCE?: string | null;
  COUNTRY?: string | null;
}

export interface BitrixRequisitePreset {
  ID: string;
  NAME: string;
  XML_ID?: string | null;
  ACTIVE?: string;
}

/** Requisite chính của một contact cùng ngân hàng và địa chỉ của nó. */
export interface ContactDetails {
  requisite: BitrixRequisite;
  bankDetail?: BitrixBankDetail;
  address?: BitrixAddress;
}
