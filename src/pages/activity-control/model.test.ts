import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import type { ActivityDirectory, ActivityTaskPanel } from '@/api/activityControl';
import {
  emptyPanel,
  employeesLabel,
  groupEmployees,
  isRejected,
  movePriority,
  priorityInfo,
  samePanelInput,
  sameTaskPanel,
  setDepartment,
  setOperator,
  thresholdGroups,
  toggleEmployee,
  toggleGroup,
  withEmployees,
} from './model';

const directory: ActivityDirectory = {
  users: [
    { id: 7, name: 'Анна', groupId: 1, groupName: 'Продажи' },
    { id: 8, name: 'Борис', groupId: 2, groupName: '' },
    { id: 9, name: 'Вера', groupId: 1, groupName: 'Продажи' },
  ],
  pipelines: [],
  timezone: 'Europe/Moscow',
};

describe('Activity control model', () => {
  it('groups employees by department in directory order', () => {
    expect(groupEmployees(directory.users).map((g) => [g.name, g.users.map((u) => u.id)])).toEqual([
      ['Продажи', [7, 9]],
      ['Без отдела', [8]],
    ]);
  });

  it('toggles a department as a whole', () => {
    expect(toggleGroup([8], [7, 9])).toEqual([8, 7, 9]);
    expect(toggleGroup([7, 8], [7, 9])).toEqual([7, 8, 9]);
    expect(toggleGroup([7, 8, 9], [7, 9])).toEqual([8]);
    expect(toggleEmployee([7], 7, true)).toEqual([7]);
    expect(toggleEmployee([7, 8], 7, false)).toEqual([8]);
  });

  it('keeps call plans only for selected employees', () => {
    const draft = { ...emptyPanel(), employeeIds: [7, 9] };
    draft.options = setOperator(draft.options, 7, { enabled: true });
    draft.options = setOperator(draft.options, 9, { enabled: true, plan: 50 });
    expect(draft.options.operators[0]).toMatchObject({ employeeId: 7, enabled: true, plan: 100 });
    const next = withEmployees(draft, [9]);
    expect(next.options.operators.map((o) => o.employeeId)).toEqual([9]);
    expect(next.employeeIds).toEqual([9]);
  });

  it('updates an operator in place without reordering', () => {
    let options = emptyPanel().options;
    options = setOperator(options, 7, { enabled: true });
    options = setOperator(options, 9, { enabled: true });
    options = setOperator(options, 7, { plan: 120 });
    expect(options.operators.map((o) => [o.employeeId, o.plan])).toEqual([
      [7, 120],
      [9, 100],
    ]);
  });

  it('adds, edits and removes department thresholds', () => {
    const t = { dialingSeconds: 5, conversationSeconds: 20, exceedingSeconds: 60 };
    let options = setDepartment(emptyPanel().options, 1, t);
    options = setDepartment(options, 1, { ...t, dialingSeconds: 7 });
    expect(options.departments).toEqual([{ groupId: 1, thresholds: { ...t, dialingSeconds: 7 } }]);
    expect(setDepartment(options, 1, null).departments).toEqual([]);
  });

  it('shows thresholds for departments of selected employees and existing records', () => {
    const draft = { ...emptyPanel(), employeeIds: [9] };
    expect(thresholdGroups(directory, draft).map((g) => [g.id, g.selected])).toEqual([[1, 1]]);
    draft.options = setDepartment(draft.options, 2, {
      dialingSeconds: 1,
      conversationSeconds: 2,
      exceedingSeconds: 3,
    });
    expect(thresholdGroups(directory, draft).map((g) => [g.id, g.selected])).toEqual([
      [1, 1],
      [2, 0],
    ]);
  });

  it('compares drafts regardless of selection order', () => {
    const a = { ...emptyPanel(), employeeIds: [7, 9] };
    const b = { ...emptyPanel(), employeeIds: [9, 7] };
    expect(samePanelInput(a, b)).toBe(true);
    expect(samePanelInput(a, { ...b, name: 'x' })).toBe(false);
    expect(samePanelInput(a, { ...b, displayWindow: { from: '10:00', to: '18:00' } })).toBe(false);
    const task: ActivityTaskPanel = {
      enabled: true,
      employeeIds: [7, 9],
      considerFutureTasks: false,
      includeRelatedDeals: false,
      priorityKeys: ['urgent', 'overdue'],
      revision: 1,
    };
    expect(sameTaskPanel(task, { ...task, employeeIds: [9, 7] })).toBe(true);
    expect(sameTaskPanel(task, { ...task, priorityKeys: ['overdue', 'urgent'] })).toBe(false);
    expect(sameTaskPanel(task, { ...task, considerFutureTasks: true })).toBe(false);
  });

  it('moves priorities within bounds', () => {
    expect(movePriority(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(movePriority(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(movePriority(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(movePriority(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(priorityInfo('urgent').label).toBe('Срочные');
    expect(priorityInfo('custom')).toEqual({ label: 'custom', description: '' });
  });

  it('unlocks the draft only after a definite rejection', () => {
    expect(isRejected(new ApiError('conflict', 409))).toBe(true);
    expect(isRejected(new ApiError('slow down', 429))).toBe(false);
    expect(isRejected(new ApiError('down', 503))).toBe(false);
    expect(isRejected(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('pluralizes employees', () => {
    expect(employeesLabel(1)).toBe('1 сотрудник');
    expect(employeesLabel(3)).toBe('3 сотрудника');
    expect(employeesLabel(11)).toBe('11 сотрудников');
  });
});
