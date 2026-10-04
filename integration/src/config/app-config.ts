import { registerAs } from '@nestjs/config';
import { validateEnv } from './env.validation';

/**
 * Cấu hình đã validate, gom theo nhóm để các service chỉ đọc phần mình cần.
 * Dùng: `@Inject(appConfig.KEY) private readonly config: AppConfig`.
 */
export const appConfig = registerAs('app', () => {
  const env = validateEnv(process.env);
  return {
    port: env.PORT,
    publicUrl: env.PUBLIC_URL?.replace(/\/+$/, ''),
    apiKey: env.API_KEY,
    httpTimeoutMs: env.HTTP_TIMEOUT_MS,
    databasePath: env.DATABASE_PATH,
    logDir: env.LOG_DIR,
    bitrix: {
      // Viết thường để khớp với tên miền lưu trong DB.
      domain: env.BITRIX24_DOMAIN?.trim().toLowerCase(),
      clientId: env.CLIENT_ID,
      clientSecret: env.CLIENT_SECRET,
      oauthTokenUrl: 'https://oauth.bitrix.info/oauth/token/',
      requisitePresetId: env.BITRIX24_REQUISITE_PRESET_ID,
      webhookUrl: env.BITRIX24_WEBHOOK_URL,
    },
    jotform: {
      apiKey: env.JOTFORM_API_KEY,
      formId: env.JOTFORM_FORM_ID,
      apiBaseUrl: env.JOTFORM_API_BASE_URL.replace(/\/+$/, ''),
    },
  };
});

export type AppConfig = ReturnType<typeof appConfig>;

/**
 * Tên các biến môi trường còn trống, để cảnh báo lúc khởi động. Câu cảnh báo
 * và ảnh hưởng của từng biến nằm ở WARN.BOOTSTRAP.MISSING_SETTING.
 */
export function findMissingSettings(config: AppConfig): string[] {
  const settings: Record<string, unknown> = {
    API_KEY: config.apiKey,
    CLIENT_ID: config.bitrix.clientId,
    CLIENT_SECRET: config.bitrix.clientSecret,
    BITRIX24_WEBHOOK_URL: config.bitrix.webhookUrl,
    JOTFORM_API_KEY: config.jotform.apiKey,
    JOTFORM_FORM_ID: config.jotform.formId,
    PUBLIC_URL: config.publicUrl,
  };
  return Object.keys(settings).filter((name) => !settings[name]);
}
