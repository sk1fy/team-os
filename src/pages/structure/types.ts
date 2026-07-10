import type { Department, ID, Position } from '@/types';

/** Открытая модалка страницы оргструктуры. */
export type StructureDialog =
  | { type: 'createDepartment'; parentId: ID | null }
  | { type: 'editDepartment'; department: Department }
  | { type: 'deleteDepartment'; department: Department }
  | { type: 'createPosition'; departmentId: ID }
  | { type: 'editPosition'; position: Position }
  | { type: 'deletePosition'; position: Position };

/** Что сейчас перетаскивается (для подсветки допустимых целей и DragOverlay). */
export interface DragItem {
  kind: 'department' | 'position';
  id: ID;
  name: string;
  /** Для должности — её текущий отдел. */
  departmentId?: ID;
}
