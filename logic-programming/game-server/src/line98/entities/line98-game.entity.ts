import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Line98StatusKbn } from '../../common/kbn/status.kbn';
import type { Board } from '../engines/line98.engine';

/**
 * Bảng line98_games: mỗi ván một dòng, lưu lại sau mỗi nước đi, nên tải lại
 * trang hoặc khởi động lại server vẫn chơi tiếp được. Mỗi người chỉ có tối đa
 * một ván đang chơi (status_kbn = 11000).
 */
@Entity('line98_games')
@Index(['userUuid', 'statusKbn'])
export class Line98Game {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'user_uuid', type: 'varchar' })
  userUuid: string;

  /** Bàn 9x9 dạng JSON: 0 là trống, 1..5 là màu bóng. */
  @Column({ type: 'json' })
  board: Board;

  @Column({ name: 'next_colors', type: 'json' })
  nextColors: number[];

  @Column({ type: 'integer', default: 0 })
  score: number;

  @Column({ name: 'status_kbn', type: 'integer' })
  statusKbn: Line98StatusKbn;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
