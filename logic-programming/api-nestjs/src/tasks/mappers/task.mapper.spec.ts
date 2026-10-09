import { SubtaskStatusKbn, TaskStatusKbn } from '../../common/kbn/status.kbn';
import { Task } from '../entities/task.entity';
import {
  roundHours,
  toSubtaskJson,
  toSubtaskResponse,
  toTaskResponse,
} from './task.mapper';

describe('task.mapper', () => {
  it.each([
    [1.005, 1.01],
    [2.499, 2.5],
    [0.1 + 0.2, 0.3],
    [0.004, 0],
    [3, 3],
  ])('roundHours(%p) = %p', (hours, expected) => {
    expect(roundHours(hours)).toBe(expected);
  });

  it('task con gửi lên → data_json: khóa snake_case; thiếu timeSpent thì 0, thiếu statusKbn thì In Progress', () => {
    expect(toSubtaskJson({ taskName: 'create', timeEstimate: 1.234 })).toEqual({
      task_name: 'create',
      time_estimate: 1.23,
      time_spent: 0,
      status_kbn: SubtaskStatusKbn.IN_PROGRESS,
    });
  });

  it.each([
    [SubtaskStatusKbn.IN_PROGRESS, 'In Progress'],
    [SubtaskStatusKbn.DONE, 'Done'],
    [SubtaskStatusKbn.BLOCKED, 'Blocked'],
  ])('task con có statusKbn %p thì hiển thị "%s"', (statusKbn, label) => {
    const json = {
      task_name: 'x',
      time_estimate: 1,
      time_spent: 0,
      status_kbn: statusKbn,
    };
    expect(toSubtaskResponse(json)).toMatchObject({ statusKbn, status: label });
  });

  it.each([
    [TaskStatusKbn.TO_DO, 'To Do'],
    [TaskStatusKbn.IN_PROGRESS, 'In Progress'],
    [TaskStatusKbn.DONE, 'Done'],
  ])('task có statusKbn %p thì hiển thị "%s"', (statusKbn, label) => {
    const task = Object.assign(new Task(), { statusKbn });
    expect(toTaskResponse(task)).toMatchObject({ statusKbn, status: label });
  });
});
