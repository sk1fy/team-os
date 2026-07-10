import type { Department, Position } from '@/types';

export const NO_POSITION_VALUE = '__no_position__';

export function buildPositionOptions(positions: Position[], departments: Department[]) {
  const departmentsById = new Map(departments.map((department) => [department.id, department]));
  const departmentOrder = new Map(departments.map((department, index) => [department.id, index]));
  const sortedPositions = [...positions].sort(
    (a, b) =>
      (departmentOrder.get(a.departmentId) ?? Number.MAX_SAFE_INTEGER) -
        (departmentOrder.get(b.departmentId) ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name, 'ru'),
  );

  return [
    { value: NO_POSITION_VALUE, label: 'Не назначена' },
    ...sortedPositions.map((position) => {
      const department = departmentsById.get(position.departmentId);
      return {
        value: position.id,
        label: position.name,
        group: department?.name ?? 'Без отдела',
      };
    }),
  ];
}
