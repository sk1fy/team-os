import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  Briefcase,
  Building2,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Department, ID, Position, User } from '@/types';
import type { DepartmentTreeNode } from '@/lib/orgTree';
import { canMoveDepartment } from '@/lib/orgTree';
import { plural } from '@/lib/format';
import { fullName } from '@/lib/labels';
import { Avatar, Badge, Dropdown } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { DragItem, StructureDialog } from './types';

interface NodeContext {
  departments: Department[];
  positionsByDepartment: Map<ID, Position[]>;
  usersByPosition: Map<ID, User[]>;
  collapsed: Set<ID>;
  onToggleCollapse: (id: ID) => void;
  onDialog: (dialog: StructureDialog) => void;
  onOpenPosition: (id: ID) => void;
  onOpenUser: (id: ID) => void;
  activeDrag: DragItem | null;
}

function PositionRow({ position, ctx }: { position: Position; ctx: NodeContext }) {
  const occupants = ctx.usersByPosition.get(position.id) ?? [];
  const level = position.level ?? 0;

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `drag-position-${position.id}`,
    data: {
      kind: 'position',
      id: position.id,
      name: position.name,
      departmentId: position.departmentId,
    } satisfies DragItem,
  });

  return (
    <div ref={setNodeRef} className={cn(isDragging && 'opacity-40')}>
      <div className="group flex h-9 items-center gap-2 rounded-md px-2 hover:bg-slate-50">
        <Briefcase className="size-4 shrink-0 text-slate-400" />
        <button
          onClick={() => ctx.onOpenPosition(position.id)}
          className="truncate text-sm text-slate-700 hover:text-primary-700 hover:underline"
        >
          {position.name}
        </button>
        <Badge variant={level === 4 ? 'primary' : level === 0 ? 'warning' : 'neutral'}>
          Уровень {level}
        </Badge>
        {occupants.length === 0 && <Badge variant="warning">Вакантно</Badge>}
        <Dropdown
          trigger={
            <button
              className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              aria-label={`Действия с должностью «${position.name}»`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          }
          items={[
            {
              key: 'edit',
              label: 'Редактировать',
              icon: Pencil,
              onSelect: () => ctx.onDialog({ type: 'editPosition', position }),
            },
            'separator',
            {
              key: 'delete',
              label: 'Удалить',
              icon: Trash2,
              danger: true,
              onSelect: () => ctx.onDialog({ type: 'deletePosition', position }),
            },
          ]}
        />
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab rounded p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-200 hover:text-slate-500 active:cursor-grabbing"
          aria-label={`Переместить должность «${position.name}»`}
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      {occupants.length > 0 && (
        <div className="mb-1 ml-4 space-y-0.5 border-l border-slate-200 pl-4">
          {occupants.map((user) => (
            <button
              key={user.id}
              onClick={() => ctx.onOpenUser(user.id)}
              className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-slate-50"
            >
              <Avatar name={fullName(user)} src={user.avatarUrl} size="xs" />
              <span className="truncate text-sm text-slate-600">{fullName(user)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DepartmentNode({ node, ctx }: { node: DepartmentTreeNode; ctx: NodeContext }) {
  const positions = ctx.positionsByDepartment.get(node.id) ?? [];
  const isRoot = node.parentId === null;
  const isCollapsed = ctx.collapsed.has(node.id);
  const hasContent = node.children.length > 0 || positions.length > 0;

  const employeeCount = positions.reduce(
    (sum, p) => sum + (ctx.usersByPosition.get(p.id)?.length ?? 0),
    0,
  );

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-department-${node.id}`,
    data: { departmentId: node.id },
  });

  const {
    setNodeRef: setDragRef,
    listeners,
    attributes,
    isDragging,
  } = useDraggable({
    id: `drag-department-${node.id}`,
    data: { kind: 'department', id: node.id, name: node.name } satisfies DragItem,
    disabled: isRoot,
  });

  // Подсветка при перетаскивании: зелёная рамка — можно бросить, красная — нельзя.
  const dropAllowed =
    ctx.activeDrag !== null &&
    (ctx.activeDrag.kind === 'position'
      ? ctx.activeDrag.departmentId !== node.id
      : canMoveDepartment(ctx.departments, ctx.activeDrag.id, node.id).allowed);

  const setRefs = (el: HTMLElement | null) => {
    setDropRef(el);
    setDragRef(el);
  };

  return (
    <div className={cn(isDragging && 'opacity-40')}>
      <div
        ref={setRefs}
        className={cn(
          'group flex h-10 items-center gap-1 rounded-md px-1 transition-colors hover:bg-slate-50',
          isOver && dropAllowed && 'bg-primary-50 ring-2 ring-primary-400',
          isOver && !dropAllowed && 'ring-2 ring-danger-300',
        )}
      >
        <button
          onClick={() => ctx.onToggleCollapse(node.id)}
          className={cn(
            'rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600',
            !hasContent && 'invisible',
          )}
          aria-label={isCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          <ChevronRight
            className={cn('size-4 transition-transform', !isCollapsed && 'rotate-90')}
          />
        </button>
        <Building2 className="size-4 shrink-0 text-primary-500" />
        <span className="truncate text-sm font-medium text-slate-800">{node.name}</span>
        {(positions.length > 0 || employeeCount > 0) && (
          <span className="ml-1 hidden text-xs text-slate-400 sm:inline">
            {positions.length > 0 &&
              `${positions.length} ${plural(positions.length, ['должность', 'должности', 'должностей'])}`}
            {positions.length > 0 && employeeCount > 0 && ' · '}
            {employeeCount > 0 &&
              `${employeeCount} ${plural(employeeCount, ['сотрудник', 'сотрудника', 'сотрудников'])}`}
          </span>
        )}

        <button
          type="button"
          onClick={() => ctx.onDialog({ type: 'createPosition', departmentId: node.id })}
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary-100 bg-primary-50 px-2 text-xs font-semibold text-primary-700 hover:border-primary-200 hover:bg-primary-100"
          aria-label={`Добавить должность в отдел «${node.name}»`}
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Должность</span>
        </button>

        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => ctx.onDialog({ type: 'createDepartment', parentId: node.id })}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
            aria-label={`Добавить подотдел в «${node.name}»`}
            title="Добавить подотдел"
          >
            <Building2 className="size-4" />
          </button>
          <Dropdown
            trigger={
              <button
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                aria-label={`Действия с отделом «${node.name}»`}
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
            items={[
              {
                key: 'edit',
                label: 'Настройки отдела',
                icon: Pencil,
                onSelect: () => ctx.onDialog({ type: 'editDepartment', department: node }),
              },
              ...(isRoot
                ? []
                : [
                    'separator' as const,
                    {
                      key: 'delete',
                      label: 'Удалить',
                      icon: Trash2,
                      danger: true,
                      onSelect: () => ctx.onDialog({ type: 'deleteDepartment', department: node }),
                    },
                  ]),
            ]}
          />
          {!isRoot && (
            <button
              {...listeners}
              {...attributes}
              className="cursor-grab rounded p-1 text-slate-300 hover:bg-slate-200 hover:text-slate-500 active:cursor-grabbing"
              aria-label={`Переместить отдел «${node.name}»`}
            >
              <GripVertical className="size-4" />
            </button>
          )}
        </span>
      </div>

      {!isCollapsed && hasContent && (
        <div className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-slate-200 pl-3">
          {positions.map((position) => (
            <PositionRow key={position.id} position={position} ctx={ctx} />
          ))}
          {node.children.map((child) => (
            <DepartmentNode key={child.id} node={child} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}
