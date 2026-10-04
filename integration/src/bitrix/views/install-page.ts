import { InstallOutcome } from '../services/bitrix-install.service';
import { MESSAGE } from '../../common/constants/messages.constant';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * Trang HTML hiển thị trong khung ứng dụng trên Bitrix24 (dạng iframe/code).
 *
 * Khi ứng dụng có giao diện đang ở bước cài, Bitrix24 chỉ coi là cài xong sau
 * khi trang gọi BX24.installFinish(). Chỉ gọi hàm này lúc app.info báo
 * INSTALLED=false; gọi khi đã cài sẽ khiến khung tải lại /install liên tục,
 * vì đường dẫn xử lý và đường dẫn cài đặt cùng là /install.
 */
export function renderInstallPage(outcome: InstallOutcome): string {
  const title = outcome.isNew
    ? MESSAGE.INSTALL_PAGE.TITLE_NEW
    : MESSAGE.INSTALL_PAGE.TITLE_UPDATED;
  const finishScript = outcome.needsInstallFinish
    ? `<script src="https://api.bitrix24.com/api/v1/"></script>
  <script>BX24.init(function () { BX24.installFinish(); });</script>`
    : '';

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>AASC Integration</title>
  ${finishScript}
</head>
<body style="font-family: sans-serif; padding: 24px">
  <h2>${title}</h2>
  <p>${MESSAGE.INSTALL_PAGE.PORTAL}: <b>${escapeHtml(outcome.domain)}</b></p>
  <p>${MESSAGE.INSTALL_PAGE.TOKEN_SAVED}</p>
</body>
</html>`;
}
