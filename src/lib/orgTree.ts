/**
 * Чистая логика дерева оргструктуры: построение, обход и валидация
 * перемещений. Не зависит от React и API — покрыта тестами (orgTree.test.ts).
 */

import type { Department, ID } from '@/types';

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

/** Собирает плоский список отделов в дерево, сортируя ветки по order. */
export function buildDepartmentTree(departments: Department[]): DepartmentTreeNode[] {
  const nodes = new Map<ID, DepartmentTreeNode>();
  departments.forEach((d) => nodes.set(d.id, { ...d, children: [] }));

  const roots: DepartmentTreeNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortBranch = (list: DepartmentTreeNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((n) => sortBranch(n.children));
  };
  sortBranch(roots);

  return roots;
}

/** Все потомки отдела (дети, внуки и т.д.). */
export function getDescendantIds(departments: Department[], id: ID): Set<ID> {
  const childrenByParent = new Map<ID, ID[]>();
  for (const d of departments) {
    if (d.parentId === null) continue;
    const list = childrenByParent.get(d.parentId) ?? [];
    list.push(d.id);
    childrenByParent.set(d.parentId, list);
  }

  const result = new Set<ID>();
  const queue = [...(childrenByParent.get(id) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (result.has(current)) continue;
    result.add(current);
    queue.push(...(childrenByParent.get(current) ?? []));
  }
  return result;
}

export interface MoveValidation {
  allowed: boolean;
  /** Человекочитаемая причина запрета (для тоста). */
  reason?: string;
}

/**
 * Можно ли переместить отдел sourceId внутрь targetParentId
 * (null — в корень). Запрещены: перемещение в самого себя, в собственного
 * потомка и no-op в текущего родителя.
 */
export function canMoveDepartment(
  departments: Department[],
  sourceId: ID,
  targetParentId: ID | null,
): MoveValidation {
  const source = departments.find((d) => d.id === sourceId);
  if (!source) return { allowed: false, reason: 'Отдел не найден' };

  if (targetParentId === sourceId) {
    return { allowed: false, reason: 'Нельзя переместить отдел в самого себя' };
  }

  if (targetParentId !== null && !departments.some((d) => d.id === targetParentId)) {
    return { allowed: false, reason: 'Целевой отдел не найден' };
  }

  if (source.parentId === targetParentId) {
    return { allowed: false }; // no-op, без тоста
  }

  if (targetParentId !== null && getDescendantIds(departments, sourceId).has(targetParentId)) {
    return { allowed: false, reason: 'Нельзя переместить отдел внутрь его собственного подотдела' };
  }

  return { allowed: true };
}
