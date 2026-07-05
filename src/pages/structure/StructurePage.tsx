import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTitle } from '@reactuses/core';
import { Briefcase, Building2, Plus } from 'lucide-react';
import { orgApi } from '@/api';
import type { Department, ID, Position, User } from '@/types';
import { buildDepartmentTree, canMoveDepartment } from '@/lib/orgTree';
import { toast } from '@/stores/toast';
import { Button } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { DepartmentNode } from './DepartmentNode';
import { StructureDialogs } from './StructureDialogs';
import { PositionDrawer } from './PositionDrawer';
import { EmployeeDrawer } from '@/pages/employees/EmployeeDrawer';
import type { DragItem, StructureDialog } from './types';

export function StructurePage({ embedded = false }: { embedded?: boolean }) {
  useTitle(embedded ? 'Сотрудники — TeamOS' : 'Оргструктура — TeamOS');
  const queryClient = useQueryClient();

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });

  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [dialog, setDialog] = useState<StructureDialog | null>(null);
  const [openPositionId, setOpenPositionId] = useState<ID | null>(null);
  const [openUserId, setOpenUserId] = useState<ID | null>(null);
  const [activeDrag, setActiveDrag] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const departments = useMemo(() => departmentsQuery.data ?? [], [departmentsQuery.data]);
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);

  const positionsByDepartment = useMemo(() => {
    const map = new Map<ID, Position[]>();
    for (const position of positionsQuery.data ?? []) {
      const list = map.get(position.departmentId) ?? [];
      list.push(position);
      map.set(position.departmentId, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => (b.level ?? 0) - (a.level ?? 0) || a.name.localeCompare(b.name, 'ru'),
      );
    }
    return map;
  }, [positionsQuery.data]);

  const usersByPosition = useMemo(() => {
    const map = new Map<ID, User[]>();
    for (const user of usersQuery.data ?? []) {
      for (const positionId of user.positionIds) {
        const list = map.get(positionId) ?? [];
        list.push(user);
        map.set(positionId, list);
      }
    }
    return map;
  }, [usersQuery.data]);

  // Перемещения — с optimistic-обновлением: дерево меняется мгновенно,
  // при ошибке мок-API состояние откатывается.
  const moveDepartment = useMutation({
    mutationFn: orgApi.moveDepartment,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['departments'] });
      const previous = queryClient.getQueryData<Department[]>(['departments']);
      queryClient.setQueryData<Department[]>(['departments'], (old) =>
        old?.map((d) => (d.id === input.id ? { ...d, parentId: input.parentId } : d)),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(['departments'], context?.previous);
      toast.error(error instanceof Error ? error.message : 'Не удалось переместить отдел');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const movePosition = useMutation({
    mutationFn: orgApi.movePosition,
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['positions'] });
      const previous = queryClient.getQueryData<Position[]>(['positions']);
      queryClient.setQueryData<Position[]>(['positions'], (old) =>
        old?.map((p) => (p.id === input.id ? { ...p, departmentId: input.departmentId } : p)),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      queryClient.setQueryData(['positions'], context?.previous);
      toast.error(error instanceof Error ? error.message : 'Не удалось переместить должность');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragItem) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const item = event.active.data.current as DragItem | undefined;
    const target = event.over?.data.current as { departmentId: ID } | undefined;
    if (!item || !target) return;

    if (item.kind === 'department') {
      const validation = canMoveDepartment(departments, item.id, target.departmentId);
      if (!validation.allowed) {
        if (validation.reason) toast.error(validation.reason);
        return;
      }
      moveDepartment.mutate({ id: item.id, parentId: target.departmentId });
    } else {
      if (item.departmentId === target.departmentId) return;
      movePosition.mutate({ id: item.id, departmentId: target.departmentId });
    }
  };

  const toggleCollapse = (id: ID) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLoading = departmentsQuery.isPending || positionsQuery.isPending || usersQuery.isPending;
  const isError = departmentsQuery.isError;

  return (
    <div className={embedded ? '' : 'mx-auto max-w-4xl p-6'}>
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-slate-500">
            Отделы, должности и сотрудники компании. Уровни задаются у должностей: 4 — выше всех,
            0 — нижний уровень.
          </p>
          <Button onClick={() => setDialog({ type: 'createDepartment', parentId: tree[0]?.id ?? null })}>
            <Plus className="size-4" />
            Добавить отдел
          </Button>
        </div>
      ) : (
        <PageHeader
          title="Оргструктура"
          description="Отделы, должности и сотрудники компании. Уровни задаются у должностей: 4 — выше всех, 0 — нижний уровень."
          actions={
            <Button onClick={() => setDialog({ type: 'createDepartment', parentId: tree[0]?.id ?? null })}>
              <Plus className="size-4" />
              Добавить отдел
            </Button>
          }
        />
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-surface p-3 shadow-card">
        {isLoading && (
          <div className="space-y-2 p-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded bg-slate-200/60"
                style={{ marginLeft: `${(i % 3) * 24}px` }}
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="p-8 text-center">
            <p className="text-sm text-danger-700">Не удалось загрузить структуру.</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => departmentsQuery.refetch()}
            >
              Повторить
            </Button>
          </div>
        )}

        {!isLoading && !isError && (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDrag(null)}
          >
            {tree.map((node) => (
              <DepartmentNode
                key={node.id}
                node={node}
                ctx={{
                  departments,
                  positionsByDepartment,
                  usersByPosition,
                  collapsed,
                  onToggleCollapse: toggleCollapse,
                  onDialog: setDialog,
                  onOpenPosition: setOpenPositionId,
                  onOpenUser: setOpenUserId,
                  activeDrag,
                }}
              />
            ))}

            <DragOverlay>
              {activeDrag && (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-surface px-3 py-2 shadow-popover">
                  {activeDrag.kind === 'department' ? (
                    <Building2 className="size-4 text-primary-500" />
                  ) : (
                    <Briefcase className="size-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-800">{activeDrag.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <StructureDialogs dialog={dialog} onClose={() => setDialog(null)} />

      <PositionDrawer
        positionId={openPositionId}
        onClose={() => setOpenPositionId(null)}
        onEdit={(position) => {
          setOpenPositionId(null);
          setDialog({ type: 'editPosition', position });
        }}
        onDelete={(position) => {
          setOpenPositionId(null);
          setDialog({ type: 'deletePosition', position });
        }}
        onOpenUser={(id) => {
          setOpenPositionId(null);
          setOpenUserId(id);
        }}
      />
      <EmployeeDrawer userId={openUserId} onClose={() => setOpenUserId(null)} />
    </div>
  );
}
