import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Bảng users: tài khoản người chơi. Mật khẩu chỉ lưu dạng băm bcrypt. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  /** Tên đăng nhập, lưu chữ thường, duy nhất. */
  @Column({ type: 'varchar', unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  /** Tên hiển thị trong game. */
  @Column({ type: 'varchar' })
  nickname: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
