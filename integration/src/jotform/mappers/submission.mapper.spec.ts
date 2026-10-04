import {
  InvalidSubmissionError,
  mapSubmissionToContact,
} from './submission.mapper';

describe('mapSubmissionToContact', () => {
  it('ánh xạ ô văn bản họ tên, ô điện thoại và ô email', () => {
    const contact = mapSubmissionToContact({
      '3': {
        name: 'hoVa',
        text: 'Họ và tên',
        type: 'control_textbox',
        answer: ' Nguyễn Văn An ',
      },
      '4': {
        name: 'soDien',
        text: 'Số điện thoại',
        type: 'control_phone',
        answer: { full: '(091) 234-5678' },
      },
      '5': {
        name: 'email',
        text: 'Email',
        type: 'control_email',
        answer: 'An@Example.com',
      },
      '1': { name: 'heading', type: 'control_head' },
    });

    expect(contact).toEqual({
      name: 'Nguyễn Văn An',
      phone: '0912345678',
      email: 'an@example.com',
    });
  });

  it('hỗ trợ trường họ tên phức hợp (control_fullname) và điện thoại dạng area/phone', () => {
    const contact = mapSubmissionToContact({
      '3': {
        type: 'control_fullname',
        answer: { first: 'An', last: 'Nguyễn' },
      },
      '4': {
        type: 'control_phone',
        answer: { area: '+84', phone: '912345678' },
      },
      '5': { type: 'control_email', answer: 'an@example.com' },
    });

    expect(contact.name).toBe('An Nguyễn');
    expect(contact.phone).toBe('+84912345678');
  });

  it('báo đủ mọi lỗi khi thiếu hoặc sai định dạng', () => {
    const act = () =>
      mapSubmissionToContact({
        '4': { type: 'control_phone', answer: { full: '12' } },
        '5': { type: 'control_email', answer: 'khong-phai-email' },
      });

    expect(act).toThrow(InvalidSubmissionError);
    try {
      act();
    } catch (error) {
      expect((error as InvalidSubmissionError).problems).toEqual([
        'Thiếu họ và tên',
        'Số điện thoại không hợp lệ',
        'Email không hợp lệ',
      ]);
    }
  });
});
