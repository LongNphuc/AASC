import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  getSchemaPath,
  type ReferenceObject,
  type SchemaObject,
} from '@nestjs/swagger';
import {
  API_DOC,
  ERROR_KBNS,
  FIELD,
  VALIDATION,
} from '../constants/messages.constant';
import { ErrorKbn } from '../kbn/error.kbn';
import { StatusKbn } from '../kbn/status.kbn';

/**
 * Decorator Swagger mô tả body phản hồi { r, d | l } (xem api-response.ts),
 * để trang /docs hiện đúng dạng dữ liệu thật.
 */

const R_SUCCESS: SchemaObject = {
  type: 'integer',
  example: StatusKbn.SUCCESS,
  description: API_DOC.RESPONSE.R_SUCCESS,
};

function successResponse(
  status: HttpStatus,
  properties: Record<string, SchemaObject | ReferenceObject>,
) {
  return ApiResponse({
    status,
    schema: {
      type: 'object',
      required: Object.keys(properties),
      properties,
    },
  });
}

/** Thành công: { r: 10000, d: <model> }. */
export function ApiDataResponse(
  model: Type<unknown>,
  status: HttpStatus = HttpStatus.OK,
) {
  return applyDecorators(
    ApiExtraModels(model),
    successResponse(status, {
      r: R_SUCCESS,
      d: { $ref: getSchemaPath(model) },
    }),
  );
}

/** Thành công: { r: 10000, l: [<model>] }. */
export function ApiListResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(model),
    successResponse(HttpStatus.OK, {
      r: R_SUCCESS,
      l: { type: 'array', items: { $ref: getSchemaPath(model) } },
    }),
  );
}

/** Thành công, không có dữ liệu: { r: 10000 }. */
export function ApiEmptyResponse() {
  return successResponse(HttpStatus.OK, { r: R_SUCCESS });
}

/** Body lỗi: { r, m, f?, d? }. */
export class ErrorResponseDto {
  @ApiProperty({
    example: ErrorKbn.VALIDATION,
    description: API_DOC.RESPONSE.R_ERROR,
  })
  r: number;

  @ApiProperty({
    example: ERROR_KBNS[ErrorKbn.VALIDATION],
    description: API_DOC.RESPONSE.M,
  })
  m: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: { title: [VALIDATION.REQUIRED(FIELD.TITLE)] },
    description: API_DOC.RESPONSE.F,
  })
  f?: Record<string, string[]>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: API_DOC.RESPONSE.D_ERROR,
  })
  d?: Record<string, unknown>;
}

/** Một trường hợp lỗi của API: mã HTTP và các mã r có thể gặp. */
export function ApiErrorResponse(status: HttpStatus, kbns: ErrorKbn[]) {
  return ApiResponse({
    status,
    type: ErrorResponseDto,
    description: kbns.map((kbn) => `${kbn}: ${ERROR_KBNS[kbn]}`).join('; '),
  });
}
