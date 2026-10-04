import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BitrixService } from '../../bitrix/services/bitrix.service';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { ContactsService } from './contacts.service';
import { RequisitePresetService } from './requisite-preset.service';

type Params = Record<string, unknown>;

describe('ContactsService', () => {
  let service: ContactsService;
  let bitrix: {
    call: jest.Mock<Promise<unknown>, [string, Params?]>;
    callBitrixAPI: jest.Mock<Promise<unknown>, [string, Params?]>;
    listAll: jest.Mock<Promise<unknown[]>, [string, Params]>;
  };

  /** Các phương thức Bitrix24 đã được gọi, theo thứ tự. */
  const calledMethods = () => bitrix.call.mock.calls.map(([method]) => method);
  const paramsOf = (method: string) =>
    bitrix.call.mock.calls.find(([m]) => m === method)?.[1];

  beforeEach(async () => {
    bitrix = {
      call: jest.fn<Promise<unknown>, [string, Params?]>(),
      callBitrixAPI: jest.fn<Promise<unknown>, [string, Params?]>(),
      listAll: jest.fn<Promise<unknown[]>, [string, Params]>(() =>
        Promise.resolve([]),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: BitrixService, useValue: bitrix },
        {
          provide: RequisitePresetService,
          useValue: { getPresetId: () => Promise.resolve(5) },
        },
      ],
    }).compile();
    service = moduleRef.get(ContactsService);
  });

  it('tạo contact theo thứ tự contact -> requisite -> địa chỉ -> ngân hàng', async () => {
    bitrix.call.mockImplementation((method) => {
      const results: Record<string, unknown> = {
        'crm.contact.add': 101,
        'crm.requisite.add': 201,
        'crm.address.add': true,
        'crm.requisite.bankdetail.add': 301,
        'crm.contact.get': { ID: '101', NAME: 'Nguyễn Văn An' },
      };
      return Promise.resolve(results[method]);
    });

    const contact = await service.create({
      name: 'Nguyễn Văn An',
      phone: '0912345678',
      address: { ward: 'Phường Bến Nghé', province: 'TP. Hồ Chí Minh' },
      bank: { bankName: 'Vietcombank', accountNumber: '0071000123456' },
    });

    expect(calledMethods()).toEqual([
      'crm.contact.add',
      'crm.requisite.add',
      'crm.address.add',
      'crm.requisite.bankdetail.add',
      'crm.contact.get',
    ]);
    expect(paramsOf('crm.contact.add')).toEqual({
      fields: {
        NAME: 'Nguyễn Văn An',
        OPENED: 'Y',
        PHONE: [{ VALUE: '0912345678', VALUE_TYPE: 'WORK' }],
      },
    });
    expect(paramsOf('crm.requisite.add')).toMatchObject({
      fields: { ENTITY_TYPE_ID: 3, ENTITY_ID: 101, PRESET_ID: 5 },
    });
    expect(paramsOf('crm.address.add')).toEqual({
      fields: {
        TYPE_ID: 1,
        ENTITY_TYPE_ID: 8,
        ENTITY_ID: 201,
        ADDRESS_2: 'Phường Bến Nghé',
        PROVINCE: 'TP. Hồ Chí Minh',
      },
    });
    expect(paramsOf('crm.requisite.bankdetail.add')).toEqual({
      fields: {
        ENTITY_ID: 201,
        NAME: 'Vietcombank',
        RQ_BANK_NAME: 'Vietcombank',
        RQ_ACC_NUM: '0071000123456',
      },
    });
    expect(contact.id).toBe(101);
  });

  it('bước ngân hàng lỗi: xóa contact vừa tạo rồi báo lỗi', async () => {
    bitrix.call.mockImplementation((method) => {
      if (method === 'crm.requisite.bankdetail.add') {
        return Promise.reject(
          new ExternalApiError('bitrix24', 'BAD_REQUEST', 'RQ_ACC_NUM sai'),
        );
      }
      return Promise.resolve(method === 'crm.contact.add' ? 101 : 201);
    });

    await expect(
      service.create({
        name: 'An',
        bank: { bankName: 'VCB', accountNumber: '123456' },
      }),
    ).rejects.toMatchObject({
      kind: 'BAD_REQUEST',
      message: expect.stringContaining('đã hủy contact vừa tạo') as string,
    });
    expect(bitrix.call).toHaveBeenCalledWith('crm.contact.delete', { id: 101 });
  });

  it('contact không tồn tại: trả 404 "Contact không tồn tại"', async () => {
    bitrix.call.mockRejectedValue(
      new ExternalApiError('bitrix24', 'NOT_FOUND', 'Not found'),
    );

    const promise = service.findOne(999);
    await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    await expect(promise).rejects.toThrow('Contact không tồn tại');
  });

  it('cập nhật số điện thoại: sửa giá trị cũ theo ID chứ không thêm số mới', async () => {
    bitrix.call.mockImplementation((method) =>
      Promise.resolve(
        method === 'crm.contact.get'
          ? {
              ID: '7',
              NAME: 'An',
              PHONE: [{ ID: '55', VALUE: '0900000000', VALUE_TYPE: 'MOBILE' }],
            }
          : true,
      ),
    );

    await service.update(7, { phone: '0912345678' });

    expect(paramsOf('crm.contact.update')).toEqual({
      id: 7,
      fields: {
        PHONE: [{ ID: '55', VALUE: '0912345678', VALUE_TYPE: 'MOBILE' }],
      },
    });
  });

  it('danh sách: gộp ngân hàng và địa chỉ của requisite vào từng contact', async () => {
    bitrix.callBitrixAPI.mockResolvedValue({
      result: [
        { ID: '1', NAME: 'An', LAST_NAME: 'Nguyễn' },
        { ID: '2', NAME: 'Bình' },
      ],
      total: 2,
    });
    bitrix.listAll.mockImplementation((method) => {
      const data: Record<string, unknown[]> = {
        'crm.requisite.list': [{ ID: '10', ENTITY_ID: '1' }],
        'crm.requisite.bankdetail.list': [
          {
            ID: '20',
            ENTITY_ID: '10',
            RQ_BANK_NAME: 'ACB',
            RQ_ACC_NUM: '999999',
          },
        ],
        'crm.address.list': [
          { TYPE_ID: '1', ENTITY_ID: '10', REGION: 'Quận 1' },
        ],
      };
      return Promise.resolve(data[method] ?? []);
    });

    const page = await service.list();

    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({
      id: 1,
      name: 'Nguyễn An',
      bank: { bankName: 'ACB', accountNumber: '999999' },
      address: { district: 'Quận 1' },
    });
    expect(page.items[1]).toMatchObject({ id: 2, bank: null, address: null });
  });
});
