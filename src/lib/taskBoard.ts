import type { ID, ISODate, Task, TaskColumn } from '@/types';

export const TODAY_COLUMN_ID = 'virtual-today';
export const TODAY_COLUMN_NAME = 'На сегодня';
export const STUCK_THRESHOLD_DAYS = 3;
export const DONE_WINDOW_DAYS = 7;

export interface BoardColumnView {
  column: TaskColumn;
  tasks: Task[];
  virtual: boolean;
}

export interface BoardStats {
  inWork: number;
  today: number;
  overdue: number;
  doneLast7Days: number;
}

export function isDueTodayOrOverdue(dueDate?: ISODate, now = new Date()): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return false;
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  ).getTime();
  return due <= endOfToday;
}

export function isOverdue(task: Pick<Task, 'dueDate' | 'completedAt'>, now = new Date()): boolean {
  if (!task.dueDate || task.completedAt) return false;
  const due = new Date(task.dueDate).getTime();
  if (Number.isNaN(due)) return false;
  return due < now.getTime();
}

export function workColumnIds(columns: TaskColumn[]): Set<ID> {
  const orderedColumns = [...columns].sort((a, b) => a.order - b.order);
  if (orderedColumns.length <= 2) return new Set();
  return new Set(orderedColumns.slice(1, -1).map((column) => column.id));
}

export function isStuck(
  task: Task,
  workIds: ReadonlySet<ID>,
  now = new Date(),
  thresholdDays = STUCK_THRESHOLD_DAYS,
): boolean {
  if (task.completedAt || !workIds.has(task.columnId)) return false;
  const updatedAt = new Date(task.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return false;
  return updatedAt <= now.getTime() - thresholdDays * 86_400_000;
}

export function boardStats(tasks: Task[], columns: TaskColumn[], now = new Date()): BoardStats {
  const workIds = workColumnIds(columns);
  const doneWindowStartedAt = now.getTime() - DONE_WINDOW_DAYS * 86_400_000;

  return tasks.reduce<BoardStats>(
    (stats, task) => {
      if (!task.completedAt && workIds.has(task.columnId)) stats.inWork += 1;
      if (!task.completedAt && isDueTodayOrOverdue(task.dueDate, now)) stats.today += 1;
      if (isOverdue(task, now)) stats.overdue += 1;

      if (task.completedAt) {
        const completedAt = new Date(task.completedAt).getTime();
        if (!Number.isNaN(completedAt) && completedAt >= doneWindowStartedAt && completedAt <= now.getTime()) {
          stats.doneLast7Days += 1;
        }
      }

      return stats;
    },
    { inWork: 0, today: 0, overdue: 0, doneLast7Days: 0 },
  );
}

export function buildBoardColumns(
  columns: TaskColumn[],
  tasks: Task[],
  now = new Date(),
): BoardColumnView[] {
  if (columns.length === 0) return [];

  const orderedColumns = [...columns].sort((a, b) => a.order - b.order);
  const backlog = orderedColumns[0]!;
  const todayTasks = tasks
    .filter(
      (task) =>
        task.columnId === backlog.id &&
        !task.completedAt &&
        isDueTodayOrOverdue(task.dueDate, now),
    )
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  const todayTaskIds = new Set(todayTasks.map((task) => task.id));

  const tasksByColumn = new Map<string, Task[]>();
  for (const column of orderedColumns) tasksByColumn.set(column.id, []);
  for (const task of tasks) {
    if (todayTaskIds.has(task.id)) continue;
    const list = tasksByColumn.get(task.columnId);
    if (list) list.push(task);
  }
  for (const list of tasksByColumn.values()) list.sort((a, b) => a.order - b.order);

  const virtualColumn: TaskColumn = {
    id: TODAY_COLUMN_ID,
    boardId: backlog.boardId,
    name: TODAY_COLUMN_NAME,
    order: backlog.order + 0.5,
    color: 'amber',
  };

  return orderedColumns.flatMap((column, index) => {
    const view: BoardColumnView = {
      column,
      tasks: tasksByColumn.get(column.id) ?? [],
      virtual: false,
    };
    if (index !== 0) return [view];
    return [
      view,
      {
        column: virtualColumn,
        tasks: todayTasks,
        virtual: true,
      },
    ];
  });
}
