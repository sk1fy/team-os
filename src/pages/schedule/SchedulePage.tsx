import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  Pencil,
  RotateCcw,
  Search,
  Send,
} from 'lucide-react';
import { orgApi, scheduleApi } from '@/api';
import type { ID, ShiftException, ShiftType, User, UserSchedule } from '@/types';
import {
  MONTH_LABELS,
  MONTH_LABELS_GENITIVE,
  WEEKDAY_SHORT,
  baseState,
  dayState,
  daysInMonth,
  formatHours,
  formatShiftRange,
  isWeekend,
  isoDate,
  monthKey,
  shiftHours,
  weekdayIndex,
  type DayState,
} from '@/lib/schedule';
import { fullName } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Avatar, Button, Drawer, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { EmployeeDrawer } from '@/pages/employees/EmployeeDrawer';
import { cn } from '@/lib/cn';

/** Черновик правки одной ячейки (до публикации). */
type Draft = { type: ShiftType; start?: string; end?: string; note?: string };

const draftKey = (userId: ID, date: string) => `${userId}|${date}`;

const shiftTypeLabels: Record<ShiftType, string> = {
  work: 'Рабочий',
  off: 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
  trip: 'Командировка',
};

const brushSwatches: Record<ShiftType, string> = {
  work: 'bg-primary-200',
  off: 'bg-[#F3C6C6]',
  vacation: 'bg-[#93B8F2]',
  sick: 'bg-[#F5C77E]',
  trip: 'bg-[#C4B5FD]',
};

const blockBadges: Partial<Record<ShiftType, { label: string; className: string }>> = {
  vacation: { label: '🌴 Отпуск', className: 'bg-[#EEF6FF] text-[#2563EB]' },
  sick: { label: '🤒 Больн.', className: 'bg-warning-50 text-warning-700' },
  trip: { label: '✈️ Коман.', className: 'bg-[#EDE9FE] text-[#6D28D9]' },
};

/** Диагональная штриховка выходного дня (как в дизайн-системе «Ракурс»). */
const offStripes =
  'bg-[repeating-linear-gradient(45deg,#FBEBEB,#FBEBEB_4px,#FDF3F3_4px,#FDF3F3_8px)]';
/** Теал-штриховка неопубликованного черновика. */
const draftStripes =
  'bg-[repeating-linear-gradient(45deg,rgba(47,126,120,0.16),rgba(47,126,120,0.16)_3px,transparent_3px,transparent_7px)]';

/** Содержимое ячейки дня. */
function ShiftCellContent({
  state,
  plan,
  compact,
}: {
  state: DayState;
  plan: DayState;
  compact: boolean;
}) {
  if (state.type === 'off') return null;

  const badge = blockBadges[state.type];
  if (badge) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-sm px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap',
          badge.className,
        )}
      >
        {compact ? badge.label.slice(0, 2) : badge.label}
      </span>
    );
  }

  // Рабочий день: если факт отличается от плана — факт крупно (цвет по знаку), план мелко.
  const fact = state.start && state.end ? formatShiftRange(state.start, state.end) : '—';
  const planIsWork = plan.type === 'work' && plan.start && plan.end;
  const deviation =
    !planIsWork || (planIsWork && (state.start !== plan.start || state.end !== plan.end));

  if (!deviation) {
    return <span className="font-mono text-[11.5px] font-semibold text-slate-600">{fact}</span>;
  }

  const factHours = state.start && state.end ? shiftHours(state.start, state.end) : 0;
  const planHours = planIsWork ? shiftHours(plan.start!, plan.end!) : 0;
  const factClass = factHours > planHours ? 'text-success-600' : 'text-danger-600';

  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span className={cn('font-mono text-[11.5px] font-bold', factClass)}>{fact}</span>
      {!compact && (
        <span className="font-mono text-[10px] font-medium text-slate-400">
          {planIsWork ? formatShiftRange(plan.start!, plan.end!) : 'выходной'}
        </span>
      )}
    </span>
  );
}

/** Карточка смены: план, тип дня, время, заметка. */
function ShiftDrawer({
  cell,
  user,
  schedule,
  state,
  onSave,
  onClose,
}: {
  cell: { date: string; year: number; month: number; day: number } | null;
  user?: User;
  schedule?: UserSchedule;
  state?: DayState;
  onSave: (draft: Draft) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<ShiftType>('work');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');
  const [note, setNote] = useState('');

  const plan =
    cell && schedule ? baseState(schedule.template, cell.year, cell.month, cell.day) : undefined;

  useEffect(() => {
    if (!cell || !state) return;
    setType(state.type === 'off' ? 'off' : state.type);
    setStart(state.start ?? plan?.start ?? '09:00');
    setEnd(state.end ?? plan?.end ?? '18:00');
    setNote(state.note ?? '');
    // plan вычисляется из тех же cell/schedule и не меняется отдельно от них
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell?.date, user?.id]);

  const hours = shiftHours(start, end);
  const planIsOff = plan?.type !== 'work';
  const warn =
    type !== 'work'
      ? ''
      : planIsOff
        ? `Это выходной по графику. Вся смена (${formatHours(hours)} ч) уйдёт в переработку.`
        : hours >= 11
          ? `Переработка: смена длится ${formatHours(hours)} ч.`
          : '';

  return (
    <Drawer
      open={Boolean(cell)}
      onOpenChange={(next) => !next && onClose()}
      title={user ? fullName(user) : 'Смена'}
      description={
        cell
          ? `${cell.day} ${MONTH_LABELS_GENITIVE[cell.month - 1]} ${cell.year}, ${WEEKDAY_SHORT[weekdayIndex(cell.year, cell.month, cell.day)]}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            className="flex-1"
            onClick={() =>
              onSave(
                type === 'work'
                  ? { type, start, end, note: note.trim() || undefined }
                  : { type, note: note.trim() || undefined },
              )
            }
          >
            Сохранить в черновик
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-700">План по графику</div>
          <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-primary-50 px-3 py-2.5 text-[13px] font-semibold text-slate-700">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                planIsOff ? 'bg-slate-400' : 'bg-primary-600',
              )}
            />
            {plan?.type === 'work' && plan.start && plan.end ? (
              <>
                Рабочий день ·{' '}
                <span className="font-mono text-primary-700">
                  {plan.start}–{plan.end}
                </span>
                <span className="font-normal text-slate-500">
                  ({formatHours(shiftHours(plan.start, plan.end))} ч)
                </span>
              </>
            ) : (
              'Выходной по графику'
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold text-slate-700">Тип дня</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(shiftTypeLabels) as ShiftType[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setType(option)}
                className={cn(
                  'cursor-pointer rounded-md border px-3 py-2 text-[13px] font-semibold transition-colors',
                  type === option
                    ? 'border-primary-200 bg-primary-50 text-primary-700'
                    : 'border-slate-200 text-slate-700 hover:border-primary-200',
                )}
              >
                {shiftTypeLabels[option]}
              </button>
            ))}
          </div>
        </div>

        {type === 'work' && (
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-700">Факт — время смены</div>
            <div className="flex gap-2.5">
              <input
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="h-9.5 w-full rounded-md border border-slate-200 px-3 font-mono text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
              />
              <input
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="h-9.5 w-full rounded-md border border-slate-200 px-3 font-mono text-sm focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Длительность: <b className="font-mono">{formatHours(hours)} ч</b>
            </p>
          </div>
        )}

        {warn && (
          <div className="flex gap-2.5 rounded-md border border-warning-100 bg-warning-50 px-3 py-2.5 text-[12.5px] leading-relaxed text-warning-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-500" />
            {warn}
          </div>
        )}

        <Textarea
          label="Заметка к смене"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="напр. работа на выезде"
          rows={3}
        />
      </div>
    </Drawer>
  );
}

export function SchedulePage() {
  useTitle('График работы — TeamOS');
  const queryClient = useQueryClient();
  const gridRef = useRef<HTMLDivElement>(null);
  const painting = useRef(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<'plan' | 'edit'>('plan');
  const [brush, setBrush] = useState<ShiftType>('work');
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<'all' | 'working' | 'absent'>('all');
  const [compact, setCompact] = useState(false);
  const [panelCell, setPanelCell] = useState<{ userId: ID; date: string; day: number } | null>(null);
  const [employeePanelId, setEmployeePanelId] = useState<ID | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const schedulesQuery = useQuery({
    queryKey: ['schedule', 'templates'],
    queryFn: scheduleApi.getSchedules,
  });
  const key = monthKey(year, month);
  const exceptionsQuery = useQuery({
    queryKey: ['schedule', 'exceptions', key],
    queryFn: () => scheduleApi.getExceptions(key),
  });

  const publish = useMutation({
    mutationFn: () =>
      scheduleApi.saveExceptions(
        [...drafts].map(([draftId, draft]) => {
          const [userId = '', date = ''] = draftId.split('|');
          return { userId, date, type: draft.type, start: draft.start, end: draft.end, note: draft.note };
        }),
      ),
    onSuccess: () => {
      setDrafts(new Map());
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success('График опубликован', 'Правки сохранены и видны команде.');
    },
    onError: () => toast.error('Не удалось опубликовать', 'Мок-API имитирует сбой — попробуйте ещё раз.'),
  });

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const positionById = useMemo(
    () => new Map((positionsQuery.data ?? []).map((position) => [position.id, position])),
    [positionsQuery.data],
  );
  const scheduleByUser = useMemo(
    () => new Map((schedulesQuery.data ?? []).map((schedule) => [schedule.userId, schedule])),
    [schedulesQuery.data],
  );
  const exceptionByCell = useMemo(() => {
    const map = new Map<string, ShiftException>();
    for (const exception of exceptionsQuery.data ?? []) {
      map.set(draftKey(exception.userId, exception.date), exception);
    }
    return map;
  }, [exceptionsQuery.data]);

  const totalDays = daysInMonth(year, month);
  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => i + 1), [totalDays]);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayDay = now.getDate();
  const todayIso = isoDate(now.getFullYear(), now.getMonth() + 1, todayDay);

  /** Итоговое состояние ячейки: черновик → правка → шаблон. */
  const resolve = (userId: ID, day: number): DayState | undefined => {
    const schedule = scheduleByUser.get(userId);
    if (!schedule) return undefined;
    const date = isoDate(year, month, day);
    const cellId = draftKey(userId, date);
    const draft = drafts.get(cellId);
    if (draft) return draft;
    return dayState(schedule.template, exceptionByCell.get(cellId), year, month, day);
  };

  /** Состояние сотрудника на реальное «сегодня» — для чипов-фильтров. */
  const stateToday = (userId: ID): DayState | undefined => {
    const schedule = scheduleByUser.get(userId);
    if (!schedule) return undefined;
    const draft = drafts.get(draftKey(userId, todayIso));
    if (draft) return draft;
    const exception = exceptionByCell.get(draftKey(userId, todayIso));
    return dayState(schedule.template, isCurrentMonth ? exception : undefined, now.getFullYear(), now.getMonth() + 1, todayDay);
  };

  const workingToday = users.filter((user) => ['work', 'trip'].includes(stateToday(user.id)?.type ?? '')).length;
  const absentToday = users.filter((user) => ['vacation', 'sick'].includes(stateToday(user.id)?.type ?? '')).length;

  // Поиск + чипы
  const visibleUsers = users.filter((user) => {
    if (!scheduleByUser.has(user.id)) return false;
    const position = user.positionIds[0] ? positionById.get(user.positionIds[0]) : undefined;
    const haystack = `${fullName(user)} ${user.email} ${position?.name ?? ''}`.toLowerCase();
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (chip === 'working') return ['work', 'trip'].includes(stateToday(user.id)?.type ?? '');
    if (chip === 'absent') return ['vacation', 'sick'].includes(stateToday(user.id)?.type ?? '');
    return true;
  });

  // Группировка по отделам в порядке дерева
  const groups = useMemo(() => {
    const departments = departmentsQuery.data ?? [];
    const byDepartment = new Map<ID | 'none', User[]>();
    for (const user of visibleUsers) {
      const position = user.positionIds[0] ? positionById.get(user.positionIds[0]) : undefined;
      const departmentId = position?.departmentId ?? 'none';
      if (!byDepartment.has(departmentId)) byDepartment.set(departmentId, []);
      byDepartment.get(departmentId)!.push(user);
    }
    const result: Array<{ id: ID; name: string; users: User[] }> = [];
    for (const department of departments) {
      const members = byDepartment.get(department.id);
      if (members?.length) result.push({ id: department.id, name: department.name, users: members });
    }
    const rest = byDepartment.get('none');
    if (rest?.length) result.push({ id: 'none', name: 'Без отдела', users: rest });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentsQuery.data, visibleUsers.map((u) => u.id).join(','), positionById]);

  // Автопрокрутка к сегодняшнему дню
  useEffect(() => {
    if (!isCurrentMonth || !gridRef.current) return;
    const cell = gridRef.current.querySelector<HTMLElement>('[data-today="true"]');
    if (!cell) return;
    const container = gridRef.current;
    container.scrollLeft = cell.offsetLeft - container.clientWidth / 2;
  }, [isCurrentMonth, schedulesQuery.data, exceptionsQuery.data]);

  // Завершение «рисования» кистью при отпускании мыши где угодно
  useEffect(() => {
    const stop = () => {
      painting.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const applyBrush = (userId: ID, day: number) => {
    const schedule = scheduleByUser.get(userId);
    if (!schedule) return;
    const date = isoDate(year, month, day);
    const draft: Draft =
      brush === 'work'
        ? { type: 'work', start: schedule.template.start, end: schedule.template.end }
        : { type: brush };
    setDrafts((prev) => new Map(prev).set(draftKey(userId, date), draft));
  };

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth() + 1);
  };

  const scrollToToday = () => {
    if (!isCurrentMonth) {
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
      return;
    }
    const cell = gridRef.current?.querySelector<HTMLElement>('[data-today="true"]');
    if (cell && gridRef.current) {
      gridRef.current.scrollTo({ left: cell.offsetLeft - gridRef.current.clientWidth / 2, behavior: 'smooth' });
    }
  };

  const coverageNorm = Math.max(1, Math.round(users.length * 0.5));
  const coverage = days.map((day) =>
    users.reduce((count, user) => {
      const state = resolve(user.id, day);
      return count + (state && ['work', 'trip'].includes(state.type) ? 1 : 0);
    }, 0),
  );

  const panelUser = panelCell ? users.find((user) => user.id === panelCell.userId) : undefined;
  const hasError = usersQuery.isError || schedulesQuery.isError || exceptionsQuery.isError;
  const rowHeight = compact ? 'h-11' : 'h-16';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ===== Шапка: заголовок, месяц, режим, публикация ===== */}
      <div className="border-b border-slate-200 bg-surface px-6 pt-5 pb-4">
        <PageHeader
          title="График работы"
          description="Смены, отпуска и покрытие по дням. Правки публикуются одним действием."
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="flex size-9.5 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex h-9.5 min-w-36 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-[15px] font-semibold text-ink capitalize">
                  <CalendarDays className="size-4 text-primary-600" />
                  {MONTH_LABELS[month - 1]} {year}
                </div>
                <button
                  onClick={() => shiftMonth(1)}
                  className="flex size-9.5 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="inline-flex gap-1 rounded-md bg-surface-sunken p-1">
                {(
                  [
                    { value: 'plan', label: 'План', icon: Eye },
                    { value: 'edit', label: 'Правка', icon: Pencil },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-[9px] px-4 py-1.5 text-sm font-semibold transition-colors',
                      mode === option.value
                        ? 'bg-primary-600 text-white shadow-[0_1px_3px_rgba(47,126,120,0.35)]'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    <option.icon className="size-3.5" />
                    {option.label}
                  </button>
                ))}
              </div>

              {drafts.size > 0 && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDrafts(new Map());
                      toast.info('Правки отменены');
                    }}
                    className="border-warning-100 bg-warning-50 text-warning-700 hover:border-warning-500 hover:text-warning-700"
                  >
                    <RotateCcw className="size-4" />
                    Сбросить
                  </Button>
                  <Button onClick={() => publish.mutate()} loading={publish.isPending}>
                    <Send className="size-4" />
                    Опубликовать
                    <span className="rounded-full bg-white/25 px-1.5 font-mono text-xs">
                      {drafts.size}
                    </span>
                  </Button>
                </>
              )}
            </div>
          }
        />

        {/* ===== Фильтры ===== */}
        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Поиск сотрудника…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-sm transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
            />
          </div>
          {(
            [
              { value: 'all', label: 'Все', count: users.length },
              { value: 'working', label: 'Работают сегодня', count: workingToday },
              { value: 'absent', label: 'Отсутствуют', count: absentToday },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              onClick={() => setChip(item.value)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-[13px] font-semibold transition-colors',
                chip === item.value
                  ? 'border-primary-200 bg-primary-50 text-primary-600'
                  : 'border-slate-200 bg-surface text-slate-500 hover:border-primary-200',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold',
                  chip === item.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                {item.count}
              </span>
            </button>
          ))}
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={scrollToToday}>
            Сегодня
          </Button>
          <button
            onClick={() => setCompact((prev) => !prev)}
            title="Плотность строк"
            className={cn(
              'flex size-9.5 cursor-pointer items-center justify-center rounded-md border transition-colors',
              compact
                ? 'border-primary-200 bg-primary-50 text-primary-600'
                : 'border-slate-200 text-slate-500 hover:border-primary-200 hover:text-primary-600',
            )}
          >
            <Maximize2 className="size-4" />
          </button>
        </div>

        {/* ===== Панель кистей (режим правки) ===== */}
        {mode === 'edit' && (
          <div className="mt-3.5 -mx-6 flex flex-wrap items-center gap-2.5 border-t border-slate-100 bg-primary-50 px-6 py-3">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-primary-700">
              <Pencil className="size-3.5" />
              Кисть:
            </span>
            {(Object.keys(shiftTypeLabels) as ShiftType[]).map((type) => (
              <button
                key={type}
                onClick={() => setBrush(type)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-sm border bg-surface px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-all',
                  brush === type
                    ? 'border-transparent outline-2 -outline-offset-1 outline-primary-600'
                    : 'border-slate-200 hover:border-primary-200',
                )}
              >
                <span className={cn('size-2.5 rounded-[3px]', brushSwatches[type])} />
                {type === 'work' ? 'Рабочий (по норме)' : shiftTypeLabels[type]}
              </button>
            ))}
            <span className="text-xs text-slate-500 italic">
              зажми и веди по дням, чтобы закрасить • в режиме «План» клик открывает карточку смены
            </span>
          </div>
        )}
      </div>

      {/* ===== Сетка ===== */}
      <div className="min-h-0 flex-1 p-6">
        {hasError ? (
          <ErrorState
            onRetry={() => {
              usersQuery.refetch();
              schedulesQuery.refetch();
              exceptionsQuery.refetch();
            }}
          />
        ) : (
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-card">
            <div ref={gridRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
              <table className="w-full min-w-max border-separate border-spacing-0 select-none">
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-40 min-w-60 border-r border-b border-slate-200 bg-surface px-5 py-2.5 text-left text-xs font-semibold text-slate-500">
                      Сотрудник
                    </th>
                    {days.map((day) => {
                      const weekend = isWeekend(year, month, day);
                      const today = isCurrentMonth && day === todayDay;
                      return (
                        <th
                          key={day}
                          data-today={today || undefined}
                          className={cn(
                            'sticky top-0 z-20 min-w-11 border-b border-slate-200 bg-surface px-0 py-2 text-center',
                            weekdayIndex(year, month, day) === 0 && 'border-l-2 border-l-slate-200',
                            today && 'bg-primary-50',
                          )}
                        >
                          <div
                            className={cn(
                              'text-[15px] leading-tight font-bold',
                              today
                                ? 'mx-auto flex size-6.5 items-center justify-center rounded-full bg-primary-600 text-white'
                                : weekend
                                  ? 'text-danger-600'
                                  : 'text-ink',
                            )}
                          >
                            {day}
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 text-[10px] font-semibold tracking-wide uppercase',
                              weekend ? 'text-danger-600/70' : 'text-slate-400',
                            )}
                          >
                            {WEEKDAY_SHORT[weekdayIndex(year, month, day)]}
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky top-0 right-0 z-40 min-w-40 border-b border-l border-slate-200 bg-surface px-4 py-2.5 text-right text-xs font-semibold text-slate-500">
                      Итог месяца
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <GroupRows
                      key={group.id}
                      group={group}
                      collapsed={collapsed.has(group.id)}
                      onToggle={() =>
                        setCollapsed((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                      days={days}
                      year={year}
                      month={month}
                      isCurrentMonth={isCurrentMonth}
                      todayDay={todayDay}
                      compact={compact}
                      rowHeight={rowHeight}
                      mode={mode}
                      drafts={drafts}
                      resolve={resolve}
                      scheduleByUser={scheduleByUser}
                      positionName={(user) =>
                        user.positionIds[0] ? positionById.get(user.positionIds[0])?.name : undefined
                      }
                      onOpenUser={setEmployeePanelId}
                      onCellMouseDown={(userId, day, event) => {
                        if (mode !== 'edit') return;
                        event.preventDefault();
                        painting.current = true;
                        applyBrush(userId, day);
                      }}
                      onCellMouseEnter={(userId, day) => {
                        if (mode === 'edit' && painting.current) applyBrush(userId, day);
                      }}
                      onCellClick={(userId, day) => {
                        if (mode === 'edit') return;
                        setPanelCell({ userId, date: isoDate(year, month, day), day });
                      }}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky bottom-0 left-0 z-40 border-t border-slate-700 bg-ink px-5 py-2.5 text-xs font-semibold text-white">
                      Покрытие по дням
                      <span className="block text-[10px] font-normal text-slate-400">
                        работает человек · норма {coverageNorm}
                      </span>
                    </td>
                    {days.map((day, index) => {
                      const weekend = isWeekend(year, month, day);
                      const count = coverage[index] ?? 0;
                      return (
                        <td
                          key={day}
                          className={cn(
                            'sticky bottom-0 z-20 border-t border-slate-700 bg-ink text-center font-mono text-[13px] font-bold',
                            !weekend && count < coverageNorm && 'bg-warning-500/25 text-warning-500',
                            !weekend && count >= coverageNorm && 'text-primary-400',
                            weekend && 'text-slate-500',
                          )}
                        >
                          {weekend ? '—' : count}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bottom-0 z-40 border-t border-l border-slate-700 bg-ink" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Легенда */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-slate-600">9–18</span>
                план = факт
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-success-600">10–20</span>
                переработка
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] font-bold text-danger-600">10–16</span>
                недоработка
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-[4px]', brushSwatches.vacation)} /> отпуск
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-[4px]', brushSwatches.sick)} /> больничный
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-[4px]', brushSwatches.trip)} /> командировка
              </span>
              <span className="flex items-center gap-1.5">
                <span className={cn('size-3 rounded-[4px] border border-primary-200', draftStripes)} />
                черновик — не опубликовано
              </span>
            </div>
          </div>
        )}
      </div>

      <ShiftDrawer
        cell={panelCell ? { ...panelCell, year, month } : null}
        user={panelUser}
        schedule={panelCell ? scheduleByUser.get(panelCell.userId) : undefined}
        state={panelCell ? resolve(panelCell.userId, panelCell.day) : undefined}
        onClose={() => setPanelCell(null)}
        onSave={(draft) => {
          if (!panelCell) return;
          setDrafts((prev) => new Map(prev).set(draftKey(panelCell.userId, panelCell.date), draft));
          setPanelCell(null);
          toast.success('Смена обновлена', 'Изменение в черновике — опубликуйте, когда закончите.');
        }}
      />
      <EmployeeDrawer userId={employeePanelId} onClose={() => setEmployeePanelId(null)} />
    </div>
  );
}

/** Строка отдела + строки его сотрудников. */
function GroupRows({
  group,
  collapsed,
  onToggle,
  days,
  year,
  month,
  isCurrentMonth,
  todayDay,
  compact,
  rowHeight,
  mode,
  drafts,
  resolve,
  scheduleByUser,
  positionName,
  onOpenUser,
  onCellMouseDown,
  onCellMouseEnter,
  onCellClick,
}: {
  group: { id: ID; name: string; users: User[] };
  collapsed: boolean;
  onToggle: () => void;
  days: number[];
  year: number;
  month: number;
  isCurrentMonth: boolean;
  todayDay: number;
  compact: boolean;
  rowHeight: string;
  mode: 'plan' | 'edit';
  drafts: Map<string, Draft>;
  resolve: (userId: ID, day: number) => DayState | undefined;
  scheduleByUser: Map<ID, UserSchedule>;
  positionName: (user: User) => string | undefined;
  onOpenUser: (userId: ID) => void;
  onCellMouseDown: (userId: ID, day: number, event: React.MouseEvent) => void;
  onCellMouseEnter: (userId: ID, day: number) => void;
  onCellClick: (userId: ID, day: number) => void;
}) {
  return (
    <>
      <tr className="cursor-pointer" onClick={onToggle}>
        <td className="sticky left-0 z-10 border-r border-b border-slate-100 bg-surface-muted px-5 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.6px] text-primary-600 uppercase">
            <ChevronDown className={cn('size-3.5 text-slate-400 transition-transform', collapsed && '-rotate-90')} />
            {group.name}
            <span className="font-mono font-semibold text-slate-400">{group.users.length}</span>
          </span>
        </td>
        <td colSpan={days.length} className="border-b border-slate-100 bg-surface-muted" />
        <td className="sticky right-0 z-10 border-b border-l border-slate-100 bg-surface-muted" />
      </tr>

      {!collapsed &&
        group.users.map((user) => {
          const schedule = scheduleByUser.get(user.id);
          // Итоги месяца
          let workDays = 0;
          let workHours = 0;
          let planHours = 0;
          let overtime = 0;
          let absentDays = 0;
          for (const day of days) {
            const state = resolve(user.id, day);
            if (!state || !schedule) continue;
            const plan = baseState(schedule.template, year, month, day);
            const planDayHours = plan.type === 'work' && plan.start && plan.end ? shiftHours(plan.start, plan.end) : 0;
            planHours += planDayHours;
            if (state.type === 'work' && state.start && state.end) {
              workDays += 1;
              const hours = shiftHours(state.start, state.end);
              workHours += hours;
              if (hours > planDayHours) overtime += hours - planDayHours;
            } else if (state.type === 'trip') {
              workDays += 1;
              workHours += planDayHours;
            } else if (state.type === 'vacation' || state.type === 'sick') {
              absentDays += 1;
            }
          }
          const utilization = planHours ? Math.min(100, Math.round((workHours / planHours) * 100)) : 0;

          return (
            <tr key={user.id} className="group/row">
              {/* Левая закреплённая колонка */}
              <td
                className={cn(
                  'sticky left-0 z-10 border-r border-b border-slate-100 bg-surface px-5',
                  rowHeight,
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpenUser(user.id)}
                  className="flex max-w-full items-center gap-3 rounded-md text-left hover:text-primary-700"
                >
                  <Avatar name={fullName(user)} src={user.avatarUrl} size={compact ? 'sm' : 'md'} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{fullName(user)}</div>
                    {!compact && (
                      <>
                        {positionName(user) && (
                          <div className="truncate text-[11.5px] font-semibold text-primary-600">
                            {positionName(user)}
                          </div>
                        )}
                        <div className="font-mono text-[11px] text-slate-400">
                          {Math.round(workHours)} / {Math.round(planHours)} ч
                        </div>
                      </>
                    )}
                  </div>
                </button>
              </td>

              {/* Дни */}
              {days.map((day) => {
                const state = resolve(user.id, day);
                const plan = schedule ? baseState(schedule.template, year, month, day) : { type: 'off' as const };
                const today = isCurrentMonth && day === todayDay;
                const isDraft = drafts.has(draftKey(user.id, isoDate(year, month, day)));
                return (
                  <td
                    key={day}
                    onMouseDown={(event) => onCellMouseDown(user.id, day, event)}
                    onMouseEnter={() => onCellMouseEnter(user.id, day)}
                    onClick={() => onCellClick(user.id, day)}
                    title={state?.note ? `📝 ${state.note}` : undefined}
                    className={cn(
                      'relative border-b border-l border-slate-100 text-center align-middle transition-colors',
                      rowHeight,
                      weekdayIndex(year, month, day) === 0 && 'border-l-2 border-l-slate-200',
                      state?.type === 'off' && offStripes,
                      today && 'bg-primary-50/70',
                      mode === 'edit' ? 'cursor-cell' : 'cursor-pointer',
                      'hover:bg-primary-50',
                    )}
                  >
                    {state && <ShiftCellContent state={state} plan={plan} compact={compact} />}
                    {state?.note && (
                      <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary-500" />
                    )}
                    {isDraft && (
                      <span className={cn('pointer-events-none absolute inset-0', draftStripes)} />
                    )}
                  </td>
                );
              })}

              {/* Правая закреплённая колонка: итоги */}
              <td
                className={cn(
                  'sticky right-0 z-10 border-b border-l border-slate-100 bg-surface px-4 text-right',
                  rowHeight,
                )}
              >
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[12px] leading-tight font-bold text-ink">
                    {workDays} дн · {Math.round(workHours)} ч
                  </span>
                  {!compact && (
                    <>
                      <span className="font-mono text-[11px] leading-tight text-slate-400">
                        {absentDays > 0 && `отсутствия ${absentDays} дн`}
                        {absentDays > 0 && overtime > 0 && ' · '}
                        {overtime > 0 && (
                          <span className="font-semibold text-success-600">+{formatHours(overtime)} ч</span>
                        )}
                        {absentDays === 0 && overtime === 0 && 'без отклонений'}
                      </span>
                      <span className="mt-0.5 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            utilization < 60 ? 'bg-warning-500' : 'bg-primary-500',
                          )}
                          style={{ width: `${utilization}%` }}
                        />
                      </span>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
    </>
  );
}
