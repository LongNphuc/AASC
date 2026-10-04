import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ExternalApiError } from '../../common/errors/external-api.error';
import { appConfig, type AppConfig } from '../../config/app-config';
import { BitrixOAuthClient } from '../clients/bitrix-oauth.client';
import { BitrixTokenSet } from '../types/bitrix.types';
import { BitrixInstallation } from '../entities/bitrix-installation.entity';
import { LogService, ServiceLogger } from '../../common/logging/service-logger';
import { ERROR, LOG } from '../../common/constants/messages.constant';

/** Làm mới sớm hơn mốc hết hạn một chút để token không chết giữa chừng. */
export const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface RefreshBatchResult {
  total: number;
  refreshed: number;
  failed: number;
}

/**
 * Quản lý vòng đời token OAuth của Bitrix24:
 * - lưu token khi cài/cài lại (upsert theo member_id);
 * - lấy token còn hạn, tự làm mới khi đã hoặc sắp hết hạn;
 * - bảo đảm mỗi portal chỉ có MỘT lần làm mới tại một thời điểm.
 */
@Injectable()
export class BitrixTokenService {
  private readonly logger = new ServiceLogger(
    LogService.AUTH,
    BitrixTokenService.name,
  );

  /**
   * Khóa chống làm mới trùng, theo member_id. refresh_token chỉ dùng được một
   * lần: nếu hai request cùng làm mới song song, request thứ hai sẽ gửi
   * refresh_token đã bị vô hiệu và thất bại. Vì vậy request đến sau chờ chung
   * kết quả của lần làm mới đang chạy.
   *
   * Khóa nằm trong bộ nhớ nên chỉ đúng khi chạy một tiến trình. Chạy nhiều
   * tiến trình thì cần khóa phân tán (ví dụ Redis).
   */
  private readonly refreshInFlight = new Map<
    string,
    Promise<BitrixInstallation>
  >();

  constructor(
    @InjectRepository(BitrixInstallation)
    private readonly installations: Repository<BitrixInstallation>,
    private readonly oauth: BitrixOAuthClient,
    @Inject(appConfig.KEY) private readonly config: AppConfig,
  ) {}

  /** Lưu token sau khi cài đặt. Đã có member_id thì cập nhật, chưa có thì thêm mới. */
  async saveTokens(
    tokens: BitrixTokenSet,
  ): Promise<{ installation: BitrixInstallation; isNew: boolean }> {
    const existing = await this.installations.findOneBy({
      memberId: tokens.memberId,
    });
    const installation = existing ?? this.installations.create();
    installation.memberId = tokens.memberId;
    installation.domain = tokens.domain;
    installation.accessToken = tokens.accessToken;
    installation.refreshToken = tokens.refreshToken;
    installation.expiresAt = tokens.expiresAt;
    installation.scope = tokens.scope ?? installation.scope ?? null;
    installation.userId = tokens.userId ?? installation.userId ?? null;
    installation.applicationToken =
      tokens.applicationToken ?? installation.applicationToken ?? null;

    return {
      installation: await this.installations.save(installation),
      isNew: !existing,
    };
  }

  async updateInstaller(
    memberId: string,
    userId: number,
    userName: string,
  ): Promise<void> {
    await this.installations.update({ memberId }, { userId, userName });
  }

  /**
   * Lấy bản cài đặt theo member_id. Không truyền thì lấy bản cài của portal
   * khai báo trong BITRIX24_DOMAIN (ứng dụng này phục vụ một portal).
   */
  async getInstallation(memberId?: string): Promise<BitrixInstallation> {
    const domain = this.config.bitrix.domain;
    const installation = memberId
      ? await this.installations.findOneBy({ memberId })
      : domain
        ? await this.installations.findOneBy({ domain })
        : await this.installations.findOne({
            where: {},
            order: { updatedAt: 'DESC' },
          });

    if (!installation) {
      throw new ExternalApiError(
        'bitrix24',
        'NOT_INSTALLED',
        ERROR.BITRIX.NOT_INSTALLED(memberId ?? domain),
      );
    }
    return installation;
  }

  /** Lấy bản cài đặt với access_token còn dùng được, làm mới nếu cần. */
  async getValidInstallation(memberId?: string): Promise<BitrixInstallation> {
    const installation = await this.getInstallation(memberId);
    if (this.isExpiringSoon(installation, TOKEN_EXPIRY_MARGIN_MS)) {
      this.logger.log(LOG.AUTH.TOKEN_EXPIRING(installation.domain));
      return this.refresh(installation.memberId);
    }
    return installation;
  }

  /** Làm mới token, dùng chung một lần làm mới nếu đang có lần khác chạy. */
  refresh(memberId: string): Promise<BitrixInstallation> {
    const pending = this.refreshInFlight.get(memberId);
    if (pending) {
      return pending;
    }
    const task = this.performRefresh(memberId).finally(() =>
      this.refreshInFlight.delete(memberId),
    );
    this.refreshInFlight.set(memberId, task);
    return task;
  }

  /**
   * Batch làm mới: làm mới mọi token sẽ hết hạn trong `withinMs` tới.
   * Lỗi ở một portal không chặn các portal khác.
   */
  async refreshExpiring(withinMs: number): Promise<RefreshBatchResult> {
    const threshold = new Date(Date.now() + withinMs);
    const expiring = await this.installations.findBy({
      expiresAt: LessThan(threshold),
    });

    const results = await Promise.allSettled(
      expiring.map((installation) => this.refresh(installation.memberId)),
    );
    return {
      total: expiring.length,
      refreshed: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    };
  }

  isExpiringSoon(installation: BitrixInstallation, marginMs: number): boolean {
    return installation.expiresAt.getTime() - Date.now() <= marginMs;
  }

  private async performRefresh(memberId: string): Promise<BitrixInstallation> {
    // Đọc lại từ DB để chắc chắn dùng refresh_token mới nhất.
    const installation = await this.getInstallation(memberId);
    try {
      const tokens = await this.oauth.refreshToken(installation.refreshToken);
      installation.accessToken = tokens.accessToken;
      installation.refreshToken = tokens.refreshToken;
      installation.expiresAt = tokens.expiresAt;
      installation.scope = tokens.scope ?? installation.scope;
      const saved = await this.installations.save(installation);
      this.logger.log(
        LOG.AUTH.TOKEN_REFRESHED(saved.domain, saved.expiresAt.toISOString()),
      );
      return saved;
    } catch (error) {
      if (
        error instanceof ExternalApiError &&
        error.kind === 'REINSTALL_REQUIRED'
      ) {
        this.logger.error(
          ERROR.AUTH.REFRESH_TOKEN_INVALID(installation.domain),
        );
      } else {
        this.logger.error(
          ERROR.AUTH.REFRESH_FAILED(
            installation.domain,
            (error as Error).message,
          ),
        );
      }
      throw error;
    }
  }
}
