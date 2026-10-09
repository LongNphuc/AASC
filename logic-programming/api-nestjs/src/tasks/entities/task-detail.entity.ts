import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { SubtaskJson } from '../types/task.types';

/**
 * Bảng task_details: phần chi tiết của task, mỗi task đúng một dòng
 * (tasks.task_detail_uuid trỏ tới đây).
 *
 * Danh sách task con lưu chung trong data_json. Sửa task con thì ghi đè cả
 * danh sách, không sửa từng phần tử. Tách khỏi bảng tasks để API danh sách
 * chỉ đọc bảng tasks, không phải đọc JSON.
 */
@Entity('task_details')
export class TaskDetail {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  /**
   * Mảng task con dạng JSON; không có task con thì là []. SQLite không có kiểu
   * jsonb nên lưu dạng TEXT, đọc được bằng json_extract().
   */
  @Column({ name: 'data_json', type: 'json' })
  dataJson: SubtaskJson[];

  /** Ghi tới mili giây, cùng cách với bảng tasks (xem Task). */
  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: Date;

  @BeforeInsert()
  protected stampInsert(): void {
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  @BeforeUpdate()
  protected stampUpdate(): void {
    this.updatedAt = new Date();
  }
}
