import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Đánh dấu endpoint không cần API key. Dùng cho các endpoint mà dịch vụ bên
 * ngoài gọi vào (Bitrix24 gọi /install, Jotform gọi /webhook/jotform), vì
 * chúng không gửi được header x-api-key.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
