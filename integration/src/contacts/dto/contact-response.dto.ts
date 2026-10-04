import { ApiProperty } from '@nestjs/swagger';
import { API_DOC } from '../../common/constants/messages.constant';
import { AddressDto } from './address.dto';
import { BankDto } from './bank.dto';

export class ContactResponseDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: API_DOC.EXAMPLE.NAME })
  name: string;

  @ApiProperty({ example: API_DOC.EXAMPLE.PHONE, nullable: true, type: String })
  phone: string | null;

  @ApiProperty({ example: API_DOC.EXAMPLE.EMAIL, nullable: true, type: String })
  email: string | null;

  @ApiProperty({
    example: API_DOC.EXAMPLE.WEBSITE,
    nullable: true,
    type: String,
  })
  website: string | null;

  @ApiProperty({ type: AddressDto, nullable: true })
  address: AddressDto | null;

  @ApiProperty({ type: BankDto, nullable: true })
  bank: BankDto | null;
}

export class ContactListResponseDto {
  @ApiProperty({ type: [ContactResponseDto] })
  items: ContactResponseDto[];

  @ApiProperty({ example: 3, description: API_DOC.FIELD.TOTAL })
  total: number;

  @ApiProperty({
    example: null,
    nullable: true,
    type: Number,
    description: API_DOC.FIELD.NEXT,
  })
  next: number | null;
}
