import { describe, expect, it } from 'vitest';
import type { Task, TaskColumn } from '@/types';
import {
  boardStats,
  buildBoardColumns,
  isDueTodayOrOverdue,
  isOverdue,
  isStuck,
  TODAY_COLUMN_ID,
  workColumnIds,
} from './taskBoard';

const now = new Date('2026-07-06T15:30:00');

const columns: TaskColumn[] = [
  { id: 'column-1', boardId: 'board-1', name: 'Бэклог', order: 0 },
  { id: 'column-2', boardId: 'board-1', name: 'В работе', order: 1 },
  { id: 'column-3', boardId: 'board-1', name: 'Готово', order: 2 },
];

function makeTask(input: Partial<Task> & Pick<Task, 'id' | 'columnId'>): Task {
  return {
    id: input.id,
    boardId: 'board-1',
    columnId: input.columnId,
    order: input.order ?? 0,
    title: input.title ?? input.id,
    authorId: 'user-1',
    assigneeIds: [],
    watcherIds: [],
    dueDate: input.dueDate,
    priority: input.priority ?? 'medium',
    labelIds: [],
    checklist: [],
    attachments: [],
    linkedArticleIds: [],
    completedAt: input.completedAt,
    createdAt: input.createdAt ?? '2026-07-01T12:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-07-05T12:00:00.000Z',
  };
}

describe('isDueTodayOrOverdue', () => {
  it('считает дедлайн до локального конца дня сегодняшним', () => {
    expect(isDueTodayOrOverdue('2026-07-06T00:00:00', now)).toBe(true);
    expect(isDueTodayOrOverdue('2026-07-06T23:59:59', now)).toBe(true);
  });

  it('считает прошлые дедлайны просроченными, а будущие не включает', () => {
    expect(isDueTodayOrOverdue('2026-07-05T23:59:59', now)).toBe(true);
    expect(isDueTodayOrOverdue('2026-07-07T00:00:00', now)).toBe(false);
  });

  it('не срабатывает без даты', () => {
    expect(isDueTodayOrOverdue(undefined, now)).toBe(false);
  });
});

describe('isOverdue', () => {
  it('считает незавершённую задачу с дедлайном вчера просроченной', () => {
    expect(
      isOverdue(
        makeTask({ id: 'overdue', columnId: 'column-1', dueDate: '2026-07-05T12:00:00' }),
        now,
      ),
    ).toBe(true);
  });

  it('не считает будущий дедлайн просроченным', () => {
    expect(
      isOverdue(
        makeTask({ id: 'future', columnId: 'column-1', dueDate: '2026-07-07T12:00:00' }),
        now,
      ),
    ).toBe(false);
  });

  it('не считает завершённую задачу просроченной', () => {
    expect(
      isOverdue(
        makeTask({
          id: 'done',
          columnId: 'column-1',
          dueDate: '2026-07-05T12:00:00',
          completedAt: '2026-07-06T10:00:00',
        }),
        now,
      ),
    ).toBe(false);
  });

  it('не срабатывает без срока', () => {
    expect(isOverdue(makeTask({ id: 'without-date', columnId: 'column-1' }), now)).toBe(false);
  });
});

describe('workColumnIds', () => {
  it('возвращает среднюю колонку из трёх', () => {
    expect([...workColumnIds(columns)]).toEqual(['column-2']);
  });

  it('возвращает пустой набор для двух колонок', () => {
    expect([...workColumnIds(columns.slice(0, 2))]).toEqual([]);
  });

  it('учитывает сортировку по order', () => {
    const unordered = [
      { id: 'done', boardId: 'board-1', name: 'Готово', order: 30 },
      { id: 'work', boardId: 'board-1', name: 'В работе', order: 20 },
      { id: 'backlog', boardId: 'board-1', name: 'Бэклог', order: 10 },
    ];
    expect([...workColumnIds(unordered)]).toEqual(['work']);
  });
});

describe('isStuck', () => {
  const workIds = workColumnIds(columns);

  it('считает задачу в рабочей колонке без обновлений 4 дня застрявшей', () => {
    expect(
      isStuck(
        makeTask({ id: 'stuck', columnId: 'column-2', updatedAt: '2026-07-02T15:30:00' }),
        workIds,
        now,
      ),
    ).toBe(true);
  });

  it('не считает задачу с обновлением день назад застрявшей', () => {
    expect(
      isStuck(
        makeTask({ id: 'fresh', columnId: 'column-2', updatedAt: '2026-07-05T15:30:00' }),
        workIds,
        now,
      ),
    ).toBe(false);
  });

  it('включает границу ровно 3 дня', () => {
    expect(
      isStuck(
        makeTask({ id: 'edge', columnId: 'column-2', updatedAt: '2026-07-03T15:30:00' }),
        workIds,
        now,
      ),
    ).toBe(true);
  });

  it('не срабатывает в бэклоге', () => {
    expect(
      isStuck(
        makeTask({ id: 'backlog', columnId: 'column-1', updatedAt: '2026-07-02T15:30:00' }),
        workIds,
        now,
      ),
    ).toBe(false);
  });

  it('не срабатывает для завершённой задачи', () => {
    expect(
      isStuck(
        makeTask({
          id: 'done',
          columnId: 'column-2',
          updatedAt: '2026-07-02T15:30:00',
          completedAt: '2026-07-05T12:00:00',
        }),
        workIds,
        now,
      ),
    ).toBe(false);
  });
});

describe('boardStats', () => {
  it('считает сводку по задачам доски', () => {
    const tasks = [
      makeTask({ id: 'work', columnId: 'column-2', dueDate: '2026-07-08T12:00:00' }),
      makeTask({ id: 'today', columnId: 'column-1', dueDate: '2026-07-06T20:00:00' }),
      makeTask({ id: 'overdue', columnId: 'column-2', dueDate: '2026-07-05T12:00:00' }),
      makeTask({
        id: 'done-6-days',
        columnId: 'column-3',
        completedAt: '2026-06-30T15:30:00',
      }),
      makeTask({
        id: 'done-8-days',
        columnId: 'column-3',
        completedAt: '2026-06-28T15:30:00',
      }),
      makeTask({
        id: 'done-with-overdue-date',
        columnId: 'column-3',
        dueDate: '2026-07-01T12:00:00',
        completedAt: '2026-07-04T12:00:00',
      }),
    ];

    expect(boardStats(tasks, columns, now)).toEqual({
      inWork: 2,
      today: 2,
      overdue: 1,
      doneLast7Days: 2,
    });
  });
});

describe('buildBoardColumns', () => {
  it('вставляет виртуальную колонку после бэклога', () => {
    const result = buildBoardColumns(columns, [], now);
    expect(result.map((view) => view.column.id)).toEqual([
      'column-1',
      TODAY_COLUMN_ID,
      'column-2',
      'column-3',
    ]);
    expect(result[1]?.virtual).toBe(true);
  });

  it('переносит в "На сегодня" только незавершённые задачи бэклога с дедлайном сегодня или раньше', () => {
    const tasks = [
      makeTask({ id: 'overdue', columnId: 'column-1', dueDate: '2026-07-03T12:00:00' }),
      makeTask({ id: 'today', columnId: 'column-1', dueDate: '2026-07-06T20:00:00' }),
      makeTask({
        id: 'done',
        columnId: 'column-1',
        dueDate: '2026-07-06T12:00:00',
        completedAt: '2026-07-06T13:00:00',
      }),
      makeTask({ id: 'work', columnId: 'column-2', dueDate: '2026-07-06T12:00:00' }),
      makeTask({ id: 'without-date', columnId: 'column-1' }),
      makeTask({ id: 'future', columnId: 'column-1', dueDate: '2026-07-08T12:00:00' }),
    ];

    const result = buildBoardColumns(columns, tasks, now);
    expect(
      result.find((view) => view.column.id === TODAY_COLUMN_ID)?.tasks.map((task) => task.id),
    ).toEqual(['overdue', 'today']);
    expect(
      result.find((view) => view.column.id === 'column-1')?.tasks.map((task) => task.id),
    ).toEqual(['done', 'without-date', 'future']);
    expect(
      result.find((view) => view.column.id === 'column-2')?.tasks.map((task) => task.id),
    ).toEqual(['work']);
  });

  it('сортирует виртуальную колонку по дедлайну', () => {
    const tasks = [
      makeTask({ id: 'second', columnId: 'column-1', dueDate: '2026-07-06T12:00:00' }),
      makeTask({ id: 'first', columnId: 'column-1', dueDate: '2026-07-04T12:00:00' }),
    ];

    const result = buildBoardColumns(columns, tasks, now);
    expect(
      result.find((view) => view.column.id === TODAY_COLUMN_ID)?.tasks.map((task) => task.id),
    ).toEqual(['first', 'second']);
  });

  it('возвращает пустой список для пустых колонок', () => {
    expect(buildBoardColumns([], [makeTask({ id: 'task', columnId: 'column-1' })], now)).toEqual(
      [],
    );
  });
});
