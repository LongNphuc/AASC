import {
  displayName,
  toAddressFields,
  toContactAddFields,
  toContactUpdateFields,
} from './contact.mapper';

describe('contact.mapper', () => {
  it('toContactAddFields: cả họ tên vào NAME, điện thoại/email/website dạng mảng', () => {
    expect(
      toContactAddFields({
        name: 'Nguyễn Văn An',
        email: 'an@example.com',
        website: 'example.com',
      }),
    ).toEqual({
      NAME: 'Nguyễn Văn An',
      OPENED: 'Y',
      EMAIL: [{ VALUE: 'an@example.com', VALUE_TYPE: 'WORK' }],
      WEB: [{ VALUE: 'example.com', VALUE_TYPE: 'WORK' }],
    });
  });

  it('toContactUpdateFields: chỉ gồm trường được gửi; đổi tên thì xóa họ/tên đệm cũ', () => {
    const fields = toContactUpdateFields(
      { name: 'Trần Bình', email: 'binh@example.com' },
      {
        ID: '1',
        EMAIL: [{ ID: '9', VALUE: 'cu@example.com', VALUE_TYPE: 'HOME' }],
      },
    );

    expect(fields).toEqual({
      NAME: 'Trần Bình',
      SECOND_NAME: '',
      LAST_NAME: '',
      EMAIL: [{ ID: '9', VALUE: 'binh@example.com', VALUE_TYPE: 'HOME' }],
    });
  });

  it('toAddressFields: ánh xạ địa chỉ Việt Nam, bỏ phần không gửi', () => {
    expect(
      toAddressFields({ street: '12 Nguyễn Huệ', district: 'Quận 1' }),
    ).toEqual({ ADDRESS_1: '12 Nguyễn Huệ', REGION: 'Quận 1' });
  });

  it('displayName ghép theo thứ tự Việt Nam: họ, tên đệm, tên', () => {
    expect(
      displayName({
        ID: '1',
        LAST_NAME: 'Nguyễn',
        SECOND_NAME: 'Văn',
        NAME: 'An',
      }),
    ).toBe('Nguyễn Văn An');
  });
});
