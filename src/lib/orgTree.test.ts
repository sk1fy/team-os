import { describe, expect, it } from 'vitest';
import type { Department } from '@/types';
import { buildDepartmentTree, canMoveDepartment, getDescendantIds } from './orgTree';

/**
 * Структура для тестов:
 * root
 * ├── sales
 * ├── marketing
 * │   └── content
 * └── dev
 */
const departments: Department[] = [
  { id: 'root', name: 'Компания', parentId: null, order: 0 },
  { id: 'sales', name: 'Продажи', parentId: 'root', order: 0 },
  { id: 'marketing', name: 'Маркетинг', parentId: 'root', order: 1 },
  { id: 'dev', name: 'Разработка', parentId: 'root', order: 2 },
  { id: 'content', name: 'Контент', parentId: 'marketing', order: 0 },
];

describe('buildDepartmentTree', () => {
  it('строит дерево с корнем и вложенными ветками', () => {
    const tree = buildDepartmentTree(departments);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children.map((c) => c.id)).toEqual(['sales', 'marketing', 'dev']);
    expect(tree[0].children[1].children.map((c) => c.id)).toEqual(['content']);
  });

  it('сортирует ветки по order', () => {
    const shuffled = [...departments].reverse();
    const tree = buildDepartmentTree(shuffled);
    expect(tree[0].children.map((c) => c.id)).toEqual(['sales', 'marketing', 'dev']);
  });

  it('отдел с несуществующим родителем становится корнем, а не теряется', () => {
    const orphan: Department = { id: 'orphan', name: 'Сирота', parentId: 'ghost', order: 0 };
    const tree = buildDepartmentTree([...departments, orphan]);
    expect(tree.map((n) => n.id)).toContain('orphan');
  });
});

describe('getDescendantIds', () => {
  it('возвращает всех потомков, включая внуков', () => {
    expect(getDescendantIds(departments, 'root')).toEqual(
      new Set(['sales', 'marketing', 'dev', 'content']),
    );
  });

  it('возвращает пустое множество для листа', () => {
    expect(getDescendantIds(departments, 'content').size).toBe(0);
  });
});

describe('canMoveDepartment', () => {
  it('разрешает обычное перемещение', () => {
    expect(canMoveDepartment(departments, 'content', 'dev').allowed).toBe(true);
  });

  it('разрешает перемещение в корень', () => {
    expect(canMoveDepartment(departments, 'content', null).allowed).toBe(true);
  });

  it('запрещает перемещение отдела в самого себя', () => {
    const result = canMoveDepartment(departments, 'marketing', 'marketing');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('запрещает перемещение внутрь собственного потомка', () => {
    const result = canMoveDepartment(departments, 'marketing', 'content');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('запрещает перемещение root внутрь внука', () => {
    const result = canMoveDepartment(departments, 'root', 'content');
    expect(result.allowed).toBe(false);
  });

  it('считает перемещение к текущему родителю no-op без причины', () => {
    const result = canMoveDepartment(departments, 'sales', 'root');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeUndefined();
  });

  it('возвращает ошибку для несуществующего отдела', () => {
    expect(canMoveDepartment(departments, 'ghost', 'root').allowed).toBe(false);
  });
});
