import { describe, expect, it } from 'vitest';
import type { Department, Position } from '@/types';
import { buildPositionOptions, NO_POSITION_VALUE } from './positionSelect';

const departments: Department[] = [
  { id: 'sales', name: 'Продажи', parentId: null, order: 0 },
  { id: 'development', name: 'Разработка', parentId: null, order: 1 },
];

const position = (id: string, name: string, departmentId: string): Position => ({
  id,
  name,
  departmentId,
  level: 0,
  articleIds: [],
  requiredCourseIds: [],
});

describe('buildPositionOptions', () => {
  it('сначала показывает пустой вариант, затем группирует должности по отделам', () => {
    const options = buildPositionOptions(
      [
        position('developer', 'Разработчик', 'development'),
        position('sales-lead', 'Руководитель', 'sales'),
        position('sales-manager', 'Менеджер', 'sales'),
      ],
      departments,
    );

    expect(options).toEqual([
      { value: NO_POSITION_VALUE, label: 'Не назначена' },
      { value: 'sales-manager', label: 'Менеджер', group: 'Продажи' },
      { value: 'sales-lead', label: 'Руководитель', group: 'Продажи' },
      { value: 'developer', label: 'Разработчик', group: 'Разработка' },
    ]);
  });
});
