import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ContactIdPipe } from '../pipes/contact-id.pipe';
import { ContactsService } from '../services/contacts.service';
import {
  ContactListResponseDto,
  ContactResponseDto,
} from '../dto/contact-response.dto';
import { CreateContactDto } from '../dto/create-contact.dto';
import { ListContactsQuery } from '../dto/list-contacts.query';
import { UpdateContactDto } from '../dto/update-contact.dto';
import { API_DOC, MESSAGE } from '../../common/constants/messages.constant';

/** API quản lý contact trên Bitrix24 (File 2 bài 2). Cần header x-api-key. */
@ApiTags('Contacts')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({ description: API_DOC.CONTACT.UNAUTHORIZED })
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  @ApiOperation({ summary: API_DOC.CONTACT.LIST })
  @ApiOkResponse({ type: ContactListResponseDto })
  list(@Query() query: ListContactsQuery): Promise<ContactListResponseDto> {
    return this.contacts.list(query.start);
  }

  @Get(':id')
  @ApiOperation({ summary: API_DOC.CONTACT.GET })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: API_DOC.CONTACT.NOT_FOUND })
  findOne(@Param('id', ContactIdPipe) id: number): Promise<ContactResponseDto> {
    return this.contacts.findOne(id);
  }

  @Post()
  @ApiOperation({
    summary: API_DOC.CONTACT.CREATE,
  })
  @ApiCreatedResponse({ type: ContactResponseDto })
  @ApiBadRequestResponse({ description: API_DOC.CONTACT.BAD_REQUEST })
  create(@Body() dto: CreateContactDto): Promise<ContactResponseDto> {
    return this.contacts.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: API_DOC.CONTACT.UPDATE,
  })
  @ApiOkResponse({ type: ContactResponseDto })
  @ApiNotFoundResponse({ description: API_DOC.CONTACT.NOT_FOUND })
  update(
    @Param('id', ContactIdPipe) id: number,
    @Body() dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    return this.contacts.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: API_DOC.CONTACT.DELETE,
  })
  @ApiOkResponse({
    schema: { example: { message: MESSAGE.CONTACT.DELETED(42) } },
  })
  @ApiNotFoundResponse({ description: API_DOC.CONTACT.NOT_FOUND })
  async remove(
    @Param('id', ContactIdPipe) id: number,
  ): Promise<{ message: string }> {
    await this.contacts.remove(id);
    return { message: MESSAGE.CONTACT.DELETED(id) };
  }
}
