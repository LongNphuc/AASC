import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Một lần cài ứng dụng trên một portal Bitrix24, kèm bộ token hiện hành.
 *
 * Khóa chính là `member_id`, mã duy nhất của portal. Cài lại trên cùng portal
 * sẽ cập nhật bản ghi cũ (upsert) thay vì tạo bản ghi mới.
 */
@Entity('bitrix_installations')
export class BitrixInstallation {
  @PrimaryColumn({ name: 'member_id', type: 'varchar' })
  memberId: string;

  /** Tên miền portal, ví dụ b24-4totiv.bitrix24.vn */
  @Column({ type: 'varchar' })
  domain: string;

  /** ID người dùng đã cài ứng dụng (lấy từ user.current). */
  @Column({ name: 'user_id', type: 'integer', nullable: true })
  userId: number | null;

  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  userName: string | null;

  @Column({ name: 'access_token', type: 'varchar' })
  accessToken: string;

  @Column({ name: 'refresh_token', type: 'varchar' })
  refreshToken: string;

  /** Thời điểm access_token hết hạn. */
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  scope: string | null;

  /** Dùng để xác minh các sự kiện Bitrix24 gửi về sau này. */
  @Column({ name: 'application_token', type: 'varchar', nullable: true })
  applicationToken: string | null;

  @CreateDateColumn({ name: 'installed_at' })
  installedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
