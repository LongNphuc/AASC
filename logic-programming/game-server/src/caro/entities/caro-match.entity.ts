import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CaroResultKbn } from '../../common/kbn/status.kbn';
import { User } from '../../users/entities/user.entity';
import type { CaroMove } from '../types/caro.types';

/**
 * Bảng caro_matches: lịch sử trận đấu. Tạo dòng khi ghép cặp xong
 * (result_kbn = 12000 PLAYING), cập nhật nước đi và kết quả khi trận kết thúc.
 */
@Entity('caro_matches')
export class CaroMatch {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Index()
  @Column({ name: 'player_x_uuid', type: 'varchar' })
  playerXUuid: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player_x_uuid' })
  playerX: User;

  @Index()
  @Column({ name: 'player_o_uuid', type: 'varchar' })
  playerOUuid: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'player_o_uuid' })
  playerO: User;

  /** Toàn bộ nước đi theo thứ tự: [{ row, col, symbol }]. */
  @Column({ type: 'json' })
  moves: CaroMove[];

  @Column({ name: 'result_kbn', type: 'integer' })
  resultKbn: CaroResultKbn;

  /** Người thắng; null khi hòa hoặc chưa kết thúc. */
  @Column({ name: 'winner_uuid', type: 'varchar', nullable: true })
  winnerUuid: string | null;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt: Date | null;
}
