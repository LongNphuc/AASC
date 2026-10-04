import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContactDto } from './create-contact.dto';
import { UpdateContactDto } from './update-contact.dto';

/** Validate giống ValidationPipe toàn cục (stopAtFirstError, whitelist). */
async function messagesFor(
  dtoClass: typeof CreateContactDto | typeof UpdateContactDto,
  body: object,
): Promise<string[]> {
  const errors = await validate(plainToInstance(dtoClass, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
    stopAtFirstError: true,
  });
  const collect = (list: typeof errors): string[] =>
    list.flatMap((e) => [
      ...Object.values(e.constraints ?? {}),
      ...collect(e.children ?? []),
    ]);
  return collect(errors);
}

describe('CreateContactDto, UpdateContactDto: thông báo validate', () => {
  it('dữ liệu hợp lệ đầy đủ thì không có lỗi', async () => {
    expect(
      await messagesFor(CreateContactDto, {
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        email: 'an@example.com',
        website: 'https://example.com',
        address: { street: '12 Nguyễn Huệ', ward: 'Phường Bến Nghé' },
        bank: { bankName: 'Vietcombank', accountNumber: '0071 000 123456' },
      }),
    ).toEqual([]);
  });

  it('thiếu tên → "là bắt buộc"; tên là số → "phải là chuỗi"; tên toàn khoảng trắng → "là bắt buộc"', async () => {
    expect(await messagesFor(CreateContactDto, {})).toEqual([
      'Tên là bắt buộc',
    ]);
    expect(await messagesFor(CreateContactDto, { name: 123 })).toEqual([
      'Tên phải là chuỗi',
    ]);
    expect(await messagesFor(CreateContactDto, { name: '   ' })).toEqual([
      'Tên là bắt buộc',
    ]);
  });

  it('bank thiếu trường → "là bắt buộc"', async () => {
    expect(
      await messagesFor(CreateContactDto, { name: 'A', bank: {} }),
    ).toEqual(['Tên ngân hàng là bắt buộc', 'Số tài khoản là bắt buộc']);
  });

  it('PUT (UpdateContactDto) không gửi tên thì không báo lỗi', async () => {
    expect(
      await messagesFor(UpdateContactDto, { phone: '0987654321' }),
    ).toEqual([]);
  });
});
