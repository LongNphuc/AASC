import { Transform } from 'class-transformer';
import { ValidateIf } from 'class-validator';

/** Bỏ khoảng trắng hai đầu chuỗi trước khi validate ("   " thành ""). */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/**
 * Trường không bắt buộc: không gửi thì bỏ qua, nhưng đã gửi thì phải hợp lệ,
 * kể cả gửi null (khác @IsOptional của class-validator, vốn bỏ qua cả null).
 * Nhờ vậy PATCH { "title": null } bị từ chối thay vì xóa mất tiêu đề.
 */
export const SkipIfUndefined = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
