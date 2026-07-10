import { useLayoutEffect, useRef } from 'react';
import { Briefcase, ChevronDown, Users } from 'lucide-react';
import type { ID, Position, User } from '@/types';
import type { DepartmentTreeNode } from '@/lib/orgTree';
import { fullName } from '@/lib/labels';
import { plural } from '@/lib/format';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

interface OrgChartProps {
  tree: DepartmentTreeNode[];
  zoom: number;
  positionsByDepartment: Map<ID, Position[]>;
  usersByPosition: Map<ID, User[]>;
  usersById: Map<ID, User>;
  collapsed: Set<ID>;
  onToggleCollapse: (id: ID) => void;
  onOpenPosition: (id: ID) => void;
  onOpenUser: (id: ID) => void;
}

type OrgChartNodeProps = Omit<OrgChartProps, 'tree' | 'zoom'> & {
  node: DepartmentTreeNode;
};

function PositionItem({
  position,
  users,
  onOpenPosition,
  onOpenUser,
}: {
  position: Position;
  users: User[];
  onOpenPosition: (id: ID) => void;
  onOpenUser: (id: ID) => void;
}) {
  return (
    <div className="border-t border-slate-100 px-3 py-2.5 first:border-t-0">
      <div className="flex items-start gap-2">
        <Briefcase className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        <button
          type="button"
          onClick={() => onOpenPosition(position.id)}
          className="min-w-0 flex-1 text-left text-xs font-medium text-slate-700 hover:text-primary-700 hover:underline"
        >
          {position.name}
        </button>
        <span className="shrink-0 text-[10px] font-semibold text-slate-400">
          Ур. {position.level ?? 0}
        </span>
      </div>

      {users.length === 0 ? (
        <Badge variant="warning" className="mt-2 ml-5.5">
          Вакантно
        </Badge>
      ) : (
        <div className="mt-2 ml-5.5 flex flex-wrap gap-1.5">
          {users.map((user) => (
            <button
              type="button"
              key={user.id}
              onClick={() => onOpenUser(user.id)}
              className="flex min-w-0 items-center gap-1.5 rounded-full bg-slate-50 py-1 pr-2 pl-1 text-left hover:bg-primary-50"
              title={fullName(user)}
            >
              <Avatar name={fullName(user)} src={user.avatarUrl} size="xs" />
              <span className="max-w-32 truncate text-[11px] text-slate-600">{fullName(user)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrgChartNode({
  node,
  positionsByDepartment,
  usersByPosition,
  usersById,
  collapsed,
  onToggleCollapse,
  onOpenPosition,
  onOpenUser,
}: OrgChartNodeProps) {
  const positions = positionsByDepartment.get(node.id) ?? [];
  const head = node.headUserId ? usersById.get(node.headUserId) : undefined;
  const isCollapsed = collapsed.has(node.id);
  const employeeIds = new Set(
    positions.flatMap((position) =>
      (usersByPosition.get(position.id) ?? []).map((user) => user.id),
    ),
  );

  return (
    <div className="org-chart-node">
      <article className="w-72 overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-card">
        <div className="border-b border-slate-100 bg-primary-50/70 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900" title={node.name}>
              {node.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <Users className="size-3" />
              {employeeIds.size}{' '}
              {plural(employeeIds.size, ['сотрудник', 'сотрудника', 'сотрудников'])}
              <span aria-hidden="true">·</span>
              {positions.length}{' '}
              {plural(positions.length, ['должность', 'должности', 'должностей'])}
            </div>
          </div>

          {head && (
            <button
              type="button"
              onClick={() => onOpenUser(head.id)}
              className="mt-3 flex w-full items-center gap-2 rounded-md border border-primary-100 bg-surface px-2.5 py-2 text-left hover:border-primary-200 hover:bg-primary-50"
            >
              <Avatar name={fullName(head)} src={head.avatarUrl} size="sm" />
              <span className="min-w-0">
                <span className="block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                  Руководитель
                </span>
                <span className="block truncate text-xs font-medium text-slate-700">
                  {fullName(head)}
                </span>
              </span>
            </button>
          )}
        </div>

        {positions.length > 0 ? (
          <div>
            {positions.map((position) => (
              <PositionItem
                key={position.id}
                position={position}
                users={usersByPosition.get(position.id) ?? []}
                onOpenPosition={onOpenPosition}
                onOpenUser={onOpenUser}
              />
            ))}
          </div>
        ) : (
          <p className="px-4 py-3 text-xs text-slate-400">Должности пока не добавлены</p>
        )}

        {node.children.length > 0 && (
          <button
            type="button"
            onClick={() => onToggleCollapse(node.id)}
            className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-primary-700"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform', isCollapsed && '-rotate-90')}
            />
            {isCollapsed
              ? `Показать подразделения (${node.children.length})`
              : 'Скрыть подразделения'}
          </button>
        )}
      </article>

      {!isCollapsed && node.children.length > 0 && (
        <div className="org-chart-children">
          {node.children.map((child) => (
            <OrgChartNode
              key={child.id}
              node={child}
              positionsByDepartment={positionsByDepartment}
              usersByPosition={usersByPosition}
              usersById={usersById}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onOpenPosition={onOpenPosition}
              onOpenUser={onOpenUser}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrgChart({ tree, zoom, ...props }: OrgChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;

    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
  }, [tree, zoom]);

  if (tree.length === 0) {
    return <p className="py-14 text-center text-sm text-slate-400">Отделы пока не добавлены.</p>;
  }

  return (
    <div ref={scrollContainerRef} className="overflow-x-auto px-6 py-8">
      <div
        className="org-chart mx-auto w-max min-w-full justify-center"
        style={{ zoom: zoom / 100 }}
      >
        {tree.map((node) => (
          <OrgChartNode key={node.id} node={node} {...props} />
        ))}
      </div>
    </div>
  );
}
