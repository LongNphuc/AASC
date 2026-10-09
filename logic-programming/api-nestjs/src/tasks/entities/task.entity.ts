import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TaskStatusKbn } from '../../common/kbn/status.kbn';
import { TaskDetail } from './task-detail.entity';

/**
 * Bảng tasks (Model của MVC). Mỗi task trỏ tới đúng một dòng task_details
 * chứa danh sách task con.
 *
 * Xóa là xóa mềm: ghi deleted_at. TypeORM tự bỏ qua dòng đã xóa mềm trong mọi
 * truy vấn find, nên task đã xóa không còn hiện ở các API GET.
 */
@Entity('tasks')
// Khớp truy vấn danh sách: WHERE deleted_at IS NULL ORDER BY created_at DESC.
@Index(['deletedAt', 'createdAt'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ name: 'status_kbn', type: 'integer' })
  statusKbn: TaskStatusKbn;

  @Column({ name: 'task_detail_uuid', type: 'varchar' })
  taskDetailUuid: string;

  /** Chỉ được nạp khi truy vấn có relations: { detail: true }. */
  @OneToOne(() => TaskDetail)
  @JoinColumn({ name: 'task_detail_uuid' })
  detail?: TaskDetail;

  /**
   * created_at, updated_at do ứng dụng ghi (hai hook bên dưới), chính xác tới
   * mili giây. Không dùng @CreateDateColumn / @UpdateDateColumn vì với SQLite,
   * TypeORM ghi bằng datetime('now') chỉ tới giây: task tạo trong cùng một giây
   * bị xếp lộn xộn, và updated_at có thể sớm hơn created_at.
   */
  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  /** null là chưa xóa. */
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @BeforeInsert()
  protected stampInsert(): void {
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  /** TypeORM chỉ gọi khi save() thấy dòng có thay đổi. */
  @BeforeUpdate()
  protected stampUpdate(): void {
    this.updatedAt = new Date();
  }
}
