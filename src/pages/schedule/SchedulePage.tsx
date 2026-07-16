import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Maximize2,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  Send,
  Share2,
} from 'lucide-react';
import { orgApi, scheduleApi } from '@/api';
import { scheduleQueryKeys } from '@/api/queryKeys';
import type { ID, ShiftException, ShiftType, User, UserSchedule } from '@/types';
import {
  MONTH_LABELS,
  MONTH_LABELS_GENITIVE,
  WEEKDAY_SHORT,
  baseState,
  dayState,
  daysInMonth,
  formatHours,
  isWeekend,
  isoDate,
  monthKey,
  shiftHours,
  weekdayIndex,
  type DayState,
} from '@/lib/schedule';
import { fullName, pluralRu } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { Avatar, Button, Drawer, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/layout/ErrorState';
import { EmployeeDrawer } from '@/pages/employees/EmployeeDrawer';
import { cn } from '@/lib/cn';
import { filterScheduleUsers } from './scheduleUsers';

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

const scheduleTabs = [
  { value: 'schedule', label: 'График' },
  { value: 'stats', label: 'Статистика' },
  { value: 'distribution', label: 'Распределение' },
  { value: 'reference', label: 'Справочник' },
  { value: 'access', label: 'Доступ' },
] as const;

type ScheduleTab = (typeof scheduleTabs)[number]['value'];

const employeeColumnWidth = 270;
const dayColumnWidth = 44;
const totalColumnWidth = 186;

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
          'inline-flex size-7 items-center justify-center overflow-hidden rounded-md text-[13px] font-bold',
          badge.className,
        )}
        title={badge.label}
      >
        {badge.label.split(' ')[0]}
      </span>
    );
  }

  // Рабочий день: смена по норме — спокойная пилюля без текста, отклонение — время столбиком.
  if (!state.start || !state.end) {
    return <span className="font-mono text-[12px] text-slate-400">—</span>;
  }
  const planIsWork = plan.type === 'work' && plan.start && plan.end;
  const deviation = !planIsWork || state.start !== plan.start || state.end !== plan.end;

  if (!deviation) {
    return (
      <span
        className={cn(
          'inline-block rounded-[5px] bg-primary-200 opacity-90',
          compact ? 'size-3' : 'size-4',
        )}
      />
    );
  }

  // Цвет обеих строк: переработка (или выход в выходной) — зелёный, недоработка — красный,
  // другое время при той же норме часов — нейтральный.
  const factHours = shiftHours(state.start, state.end);
  const planHours = planIsWork ? shiftHours(plan.start!, plan.end!) : 0;
  const tone =
    !planIsWork || factHours > planHours
      ? 'text-success-600'
      : factHours < planHours
        ? 'text-danger-600'
        : '';

  return (
    <span className="inline-flex flex-col items-center font-mono text-[12px] leading-[1.25] font-semibold">
      <span className={tone || 'text-ink'}>{state.start}</span>
      <span className={tone || 'text-slate-400'}>{state.end}</span>
    </span>
  );
}

function shiftCellTitle(state: DayState | undefined, plan: DayState) {
  if (!state) return undefined;

  const lines: string[] = [];
  const planIsWork = plan.type === 'work' && plan.start && plan.end;
  const stateIsWork = state.type === 'work' && state.start && state.end;

  if (stateIsWork) {
    const factHours = shiftHours(state.start!, state.end!);
    if (!planIsWork) {
      lines.push(
        `Работа в выходной по графику: вся смена ${formatHours(factHours)} ч идёт в переработку.`,
      );
    } else {
      const planHours = shiftHours(plan.start!, plan.end!);
      const sameTime = state.start === plan.start && state.end === plan.end;
      if (sameTime) {
        lines.push(
          `Рабочий день по графику: ${state.start}–${state.end} (${formatHours(factHours)} ч), факт = план.`,
        );
      } else if (factHours > planHours) {
        lines.push(`Переработка: ${formatHours(factHours)} ч вместо нормы ${formatHours(planHours)} ч.`);
      } else if (factHours === planHours) {
        lines.push(`Другое время: ${state.start}–${state.end} (${formatHours(factHours)} ч) — по норме часов.`);
      } else {
        lines.push(`Недоработка: ${formatHours(factHours)} ч из нормы ${formatHours(planHours)} ч.`);
      }
    }
  } else if (state.type === 'off') {
    lines.push('Выходной по графику.');
  } else {
    lines.push(shiftTypeLabels[state.type]);
  }

  if (state.note) lines.push(`Заметка: ${state.note}`);
  return lines.join('\n');
}

/** День отображаемого месяца, на который выпадает «месяц-день» даты (ДР, годовщина). */
function monthDayOf(iso: string | undefined, month: number) {
  if (!iso || Number(iso.slice(5, 7)) !== month) return undefined;
  return Number(iso.slice(8, 10));
}

type UserMonthStats = {
  user: User;
  departmentId: ID | 'none';
  departmentName: string;
  positionName?: string;
  workDays: number;
  workHours: number;
  planHours: number;
  overtime: number;
  underHours: number;
  vacationDays: number;
  sickDays: number;
  tripDays: number;
  offDays: number;
  absentDays: number;
  utilization: number;
};

type SalesDashboardRow = UserMonthStats & {
  planRub: number;
  factRub: number;
  deals: number;
  inWork: number;
  calls: number;
  meetings: number;
  leads: number;
  won: number;
  avgCheck: number;
  conversion: number;
  attainment: number;
  perHour: number;
  trend: [number, number, number];
  ropNote?: string;
};

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function roundedHours(value: number) {
  return Math.round(value);
}

function formatRub(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(value));
}

function formatShortRub(value: number) {
  if (value >= 1_000_000) return `${String(Math.round((value / 1_000_000) * 10) / 10).replace('.', ',')} млн`;
  return `${Math.round(value / 1000)} тыс`;
}

function salesStatus(row: SalesDashboardRow) {
  if (row.attainment >= 1) return { label: 'план закрыт', className: 'bg-success-50 text-success-700' };
  if (row.attainment >= 0.6) return { label: 'опережает план', className: 'bg-success-50 text-success-700' };
  if (row.attainment >= 0.5) return { label: 'в графике', className: 'bg-primary-50 text-primary-700' };
  return { label: 'нужно внимание', className: 'bg-warning-50 text-warning-700' };
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
  /** Текущий «штрих» кисти: клик без движения открывает карточку, движение — закрашивает. */
  const stroke = useRef<{ userId: ID; day: number; active: boolean; painted: boolean } | null>(
    null,
  );

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [activeTab, setActiveTab] = useState<ScheduleTab>('schedule');
  const [mode, setMode] = useState<'plan' | 'edit'>('plan');
  const [brush, setBrush] = useState<ShiftType>('work');
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [search, setSearch] = useState('');
  const [chip, setChip] = useState<'all' | 'working' | 'absent'>('all');
  const [staff, setStaff] = useState<'active' | 'fired'>('active');
  const [compact, setCompact] = useState(false);
  const [panelCell, setPanelCell] = useState<{ userId: ID; date: string; day: number } | null>(null);
  const [employeePanelId, setEmployeePanelId] = useState<ID | null>(null);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const departmentsQuery = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const positionsQuery = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const schedulesQuery = useQuery({
    queryKey: scheduleQueryKeys.templates,
    queryFn: scheduleApi.getSchedules,
  });
  const key = monthKey(year, month);
  const exceptionsQuery = useQuery({
    queryKey: scheduleQueryKeys.exceptionsForMonth(key),
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
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.all });
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

  // Активные (включая приглашённых) или уволенные — как в справочнике сотрудников
  const firedCount = users.filter((user) => user.status === 'deactivated').length;
  const staffUsers = users.filter((user) =>
    staff === 'fired' ? user.status === 'deactivated' : user.status !== 'deactivated',
  );

  const workingToday = staffUsers.filter((user) => ['work', 'trip'].includes(stateToday(user.id)?.type ?? '')).length;
  const absentToday = staffUsers.filter((user) => ['vacation', 'sick'].includes(stateToday(user.id)?.type ?? '')).length;

  // Поиск + чипы
  const visibleUsers = filterScheduleUsers(staffUsers, {
    search,
    chip,
    positionById,
    stateToday,
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

  // Завершение «рисования» кистью при отпускании мыши где угодно.
  // Штрих не обнуляем — клик по ячейке приходит после mouseup и должен знать, красили ли мы.
  useEffect(() => {
    const stop = () => {
      if (stroke.current) stroke.current.active = false;
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

  /** Копирует смены прошлой календарной недели на неделю с сегодняшним днём (в черновик). */
  const copyPreviousWeek = () => {
    const monday = todayDay - weekdayIndex(year, month, todayDay);
    const next = new Map(drafts);
    let copied = 0;
    for (const user of visibleUsers) {
      for (let offset = 0; offset < 7; offset++) {
        const target = monday + offset;
        const source = target - 7;
        if (target < 1 || target > totalDays || source < 1) continue;
        const state = resolve(user.id, source);
        if (!state) continue;
        next.set(
          draftKey(user.id, isoDate(year, month, target)),
          state.type === 'work'
            ? { type: 'work', start: state.start, end: state.end }
            : { type: state.type },
        );
        copied += 1;
      }
    }
    if (!copied) {
      toast.info('Нечего копировать', 'Прошлая неделя за пределами этого месяца.');
      return;
    }
    setDrafts(next);
    toast.success('Неделя скопирована', `${copied} смен в черновике — опубликуйте, когда закончите.`);
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

  const coverageNorm = Math.max(1, Math.round(staffUsers.length * 0.5));
  const coverage = days.map((day) =>
    staffUsers.reduce((count, user) => {
      const state = resolve(user.id, day);
      return count + (state && ['work', 'trip'].includes(state.type) ? 1 : 0);
    }, 0),
  );
  const statsUsers = useMemo(() => {
    const departmentById = new Map((departmentsQuery.data ?? []).map((department) => [department.id, department]));
    return staffUsers
      .filter((user) => scheduleByUser.has(user.id))
      .map((user): UserMonthStats => {
        const schedule = scheduleByUser.get(user.id)!;
        const position = user.positionIds[0] ? positionById.get(user.positionIds[0]) : undefined;
        const departmentId = position?.departmentId ?? 'none';
        let workDays = 0;
        let workHours = 0;
        let planHours = 0;
        let overtime = 0;
        let underHours = 0;
        let vacationDays = 0;
        let sickDays = 0;
        let tripDays = 0;
        let offDays = 0;

        for (const day of days) {
          const state = resolve(user.id, day);
          if (!state) continue;
          const plan = baseState(schedule.template, year, month, day);
          const planDayHours = plan.type === 'work' && plan.start && plan.end ? shiftHours(plan.start, plan.end) : 0;
          planHours += planDayHours;

          if (state.type === 'work' && state.start && state.end) {
            workDays += 1;
            const hours = shiftHours(state.start, state.end);
            workHours += hours;
            if (hours > planDayHours) overtime += hours - planDayHours;
            if (hours < planDayHours) underHours += planDayHours - hours;
          } else if (state.type === 'trip') {
            workDays += 1;
            tripDays += 1;
            workHours += planDayHours;
          } else if (state.type === 'vacation') {
            vacationDays += 1;
          } else if (state.type === 'sick') {
            sickDays += 1;
          } else {
            offDays += 1;
          }
        }

        return {
          user,
          departmentId,
          departmentName: departmentById.get(departmentId)?.name ?? 'Без отдела',
          positionName: position?.name,
          workDays,
          workHours,
          planHours,
          overtime,
          underHours,
          vacationDays,
          sickDays,
          tripDays,
          offDays,
          absentDays: vacationDays + sickDays,
          utilization: planHours ? Math.min(140, Math.round((workHours / planHours) * 100)) : 0,
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    staffUsers.map((user) => user.id).join(','),
    days.join(','),
    year,
    month,
    scheduleByUser,
    positionById,
    departmentsQuery.data,
    drafts,
    exceptionByCell,
  ]);

  const panelUser = panelCell ? users.find((user) => user.id === panelCell.userId) : undefined;
  const hasError = usersQuery.isError || schedulesQuery.isError || exceptionsQuery.isError;
  const rowHeight = compact ? 'h-11' : 'h-16';
  const tableWidth = employeeColumnWidth + days.length * dayColumnWidth + totalColumnWidth;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ===== Шапка: заголовок + toolbar как в макете ===== */}
      <div className="border-b border-slate-200 bg-surface px-6 pt-5 pb-4">
        <PageHeader
          title="График работы"
          description="Смены, отпуска и покрытие по дням. Правки публикуются одним действием."
        />

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-2.5">
            <div className="flex flex-wrap gap-1 rounded-md bg-surface-sunken p-1">
              {scheduleTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    'cursor-pointer rounded-[9px] px-2.5 py-1.5 text-[14px] font-semibold transition-colors',
                    activeTab === tab.value
                      ? 'bg-surface text-primary-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => shiftMonth(-1)}
                className="flex size-8.5 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="flex h-8.5 min-w-28 items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-sm font-semibold text-ink capitalize">
                <CalendarDays className="size-4 text-primary-600" />
                {MONTH_LABELS[month - 1]} {year}
              </div>
              <button
                onClick={() => shiftMonth(1)}
                className="flex size-8.5 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-600"
                aria-label="Следующий месяц"
              >
                <ChevronRight className="size-4" />
              </button>

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
                      'flex cursor-pointer items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-[13px] font-semibold transition-colors',
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

              {drafts.size > 0 ? (
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
                    Сбросить правки
                  </Button>
                  <Button onClick={() => publish.mutate()} loading={publish.isPending}>
                    <Send className="size-4" />
                    Опубликовать
                    <span className="rounded-full bg-white/25 px-1.5 font-mono text-xs">
                      {drafts.size}
                    </span>
                  </Button>
                </>
              ) : (
                <div className="flex">
                  <Button
                    size="sm"
                    onClick={() => toast.info('Ссылка на график', 'Демо-действие: окно публикации появится на следующем этапе.')}
                    className="rounded-r-none"
                  >
                    <Share2 className="size-4" />
                    Поделиться
                  </Button>
                  <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-r-md bg-primary-700 text-white transition-colors hover:bg-primary-800"
                    aria-label="Быстрые сценарии публикации"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ===== Фильтры ===== */}
          {activeTab === 'schedule' && (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3.5">
              <div className="relative w-52">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Поиск сотрудника…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9.5 w-full rounded-md border border-slate-200 bg-surface pl-9 pr-3 text-[15px] transition-colors focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                />
              </div>
              {(
                [
                  { value: 'all', label: 'Все', count: staffUsers.length },
                  { value: 'working', label: 'Работают сегодня', count: workingToday },
                  { value: 'absent', label: 'Отсутствуют', count: absentToday },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  onClick={() => setChip(item.value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm font-semibold transition-colors',
                    chip === item.value
                      ? 'border-primary-200 bg-primary-50 text-primary-600'
                      : 'border-slate-200 bg-surface text-slate-500 hover:border-primary-200',
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[13px] font-bold',
                      chip === item.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
              <div className="flex-1" />
              <div className="inline-flex gap-1 rounded-md bg-surface-sunken p-1">
                {(
                  [
                    { value: 'active', label: 'Активные', count: users.length - firedCount },
                    { value: 'fired', label: 'Уволенные', count: firedCount },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStaff(option.value)}
                    className={cn(
                      'flex cursor-pointer items-center gap-1 rounded-[9px] px-2 py-1.5 text-[13px] font-semibold transition-colors',
                      staff === option.value
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    {option.label}
                    <span className="font-mono text-[13px] font-bold text-slate-400">{option.count}</span>
                  </button>
                ))}
              </div>
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
          )}

          {/* ===== Панель кистей (режим правки) ===== */}
          {activeTab === 'schedule' && mode === 'edit' && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 bg-primary-50 px-5 py-3">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-primary-700">
                <Pencil className="size-3.5" />
                Кисть:
              </span>
              {(Object.keys(shiftTypeLabels) as ShiftType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setBrush(type)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-sm border bg-surface px-2.5 py-1.5 text-[13px] font-semibold text-slate-700 transition-all',
                    brush === type
                      ? 'border-transparent outline-2 -outline-offset-1 outline-primary-600'
                      : 'border-slate-200 hover:border-primary-200',
                  )}
                >
                  <span className={cn('size-2.5 rounded-[3px]', brushSwatches[type])} />
                  {type === 'work' ? 'Смена по норме' : shiftTypeLabels[type]}
                </button>
              ))}
              <span className="h-6 w-px bg-slate-200" />
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPreviousWeek}
                disabled={!isCurrentMonth}
                title={isCurrentMonth ? undefined : 'Доступно в текущем месяце'}
              >
                <Copy className="size-3.5" />
                Скопировать прошлую неделю
              </Button>
              <span className="text-[13px] text-slate-500 italic">
                зажми и веди по дням, чтобы закрасить смену • клик — открыть карточку смены
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Сетка ===== */}
      <div className="min-h-0 flex-1 p-6">
        {activeTab === 'stats' ? (
          <ScheduleStatsPanel
            stats={statsUsers}
            monthLabel={`${MONTH_LABELS[month - 1]} ${year}`}
            daysCount={totalDays}
            todayDay={isCurrentMonth ? todayDay : totalDays}
            lowCoverageDays={coverage.filter((count, index) => !isWeekend(year, month, index + 1) && count < coverageNorm).length}
          />
        ) : activeTab !== 'schedule' ? (
          <div className="flex h-full min-h-80 items-center justify-center rounded-lg border border-slate-200 bg-surface text-center shadow-card">
            <div>
              <p className="font-semibold text-ink">
                {scheduleTabs.find((tab) => tab.value === activeTab)?.label}
              </p>
              <p className="mt-1 text-sm text-slate-500">Раздел подготовлен для следующего этапа.</p>
            </div>
          </div>
        ) : hasError ? (
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
              <table
                className="w-full border-separate border-spacing-0 select-none"
                style={{ minWidth: tableWidth, tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: employeeColumnWidth }} />
                  {days.map((day) => (
                    <col key={day} style={{ width: dayColumnWidth }} />
                  ))}
                  <col style={{ width: totalColumnWidth }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky top-0 left-0 z-40 w-[270px] min-w-[270px] max-w-[270px] border-r border-b border-slate-200 bg-surface px-5 py-2.5 text-left text-[13px] font-semibold text-slate-500">
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
                            'sticky top-0 z-20 w-11 min-w-11 max-w-11 overflow-hidden border-b border-slate-200 bg-surface px-0 py-2 text-center',
                            weekdayIndex(year, month, day) === 0 && 'border-l-2 border-l-slate-200',
                            today && 'bg-primary-50',
                          )}
                        >
                          <div
                            className={cn(
                              'text-base leading-tight font-bold',
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
                              'mt-0.5 text-[11px] font-semibold tracking-wide uppercase',
                              weekend ? 'text-danger-600/70' : 'text-slate-400',
                            )}
                          >
                            {WEEKDAY_SHORT[weekdayIndex(year, month, day)]}
                          </div>
                        </th>
                      );
                    })}
                    <th className="sticky top-0 right-0 z-40 w-[186px] min-w-[186px] max-w-[186px] border-b border-l border-slate-200 bg-surface px-4 py-2.5 text-right text-[13px] font-semibold text-slate-500">
                      Статистика месяца
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
                        stroke.current = { userId, day, active: true, painted: false };
                      }}
                      onCellMouseEnter={(userId, day) => {
                        if (mode !== 'edit' || !stroke.current?.active) return;
                        if (!stroke.current.painted) {
                          stroke.current.painted = true;
                          applyBrush(stroke.current.userId, stroke.current.day);
                        }
                        applyBrush(userId, day);
                      }}
                      onCellClick={(userId, day) => {
                        // В режиме правки клик без движения тоже открывает карточку смены.
                        const painted = mode === 'edit' && stroke.current?.painted;
                        stroke.current = null;
                        if (painted) return;
                        setPanelCell({ userId, date: isoDate(year, month, day), day });
                      }}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky bottom-0 left-0 z-40 w-[270px] min-w-[270px] max-w-[270px] border-t border-slate-700 bg-ink px-5 py-2.5 text-[13px] font-semibold text-white">
                      Покрытие по дням
                      <span className="block text-[11px] font-normal text-slate-400">
                        сколько человек работает
                      </span>
                    </td>
                    {days.map((day, index) => {
                      const weekend = isWeekend(year, month, day);
                      const count = coverage[index] ?? 0;
                      return (
                        <td
                          key={day}
                          className={cn(
                            'sticky bottom-0 z-20 w-11 min-w-11 max-w-11 overflow-hidden border-t border-slate-700 bg-ink text-center font-mono text-sm font-bold',
                            !weekend && count < coverageNorm && 'bg-warning-500/25 text-warning-500',
                            !weekend && count >= coverageNorm && 'text-primary-400',
                            weekend && 'text-slate-500',
                          )}
                        >
                          {weekend ? '—' : count}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 bottom-0 z-40 w-[186px] min-w-[186px] max-w-[186px] border-t border-l border-slate-700 bg-ink" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Легенда */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-slate-100 px-5 py-2.5 text-[13px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="size-4 rounded-[5px] bg-primary-200 opacity-90" />
                Смена по норме
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-semibold text-ink">08:00</span>
                Другое время (по норме часов)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-success-600">10:00</span>
                Переработка
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-danger-600">10:00</span>
                Недоработка
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[4px] border border-[#93B8F2] bg-[#EEF6FF]" />
                Отпуск
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[4px] border border-[#F5C77E] bg-warning-50" />
                Больничный
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 rounded-[4px] border border-[#C4B5FD] bg-[#EDE9FE]" />
                Командировка
              </span>
              <span>🎂 День рождения</span>
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

function ScheduleStatsPanel({
  stats,
  monthLabel,
  daysCount,
  todayDay,
  lowCoverageDays,
}: {
  stats: UserMonthStats[];
  monthLabel: string;
  daysCount: number;
  todayDay: number;
  lowCoverageDays: number;
}) {
  const [sortBy, setSortBy] = useState<'attainment' | 'factRub' | 'deals' | 'avgCheck' | 'conversion' | 'calls' | 'perHour'>('attainment');
  const statsDay = Math.min(daysCount, Math.max(todayDay, Math.round(daysCount * 0.48)));
  const pace = statsDay / daysCount;

  const rows = useMemo(() => {
    const plans = [600_000, 750_000, 540_000, 780_000, 650_000, 700_000, 720_000, 640_000];
    const attainments = [0.74, 0.69, 0.66, 0.64, 0.62, 0.55, 0.51, 0.47];
    return stats.slice(0, 8).map((stat, index): SalesDashboardRow => {
      const planRub = plans[index % plans.length]!;
      const attainment = attainments[index % attainments.length]!;
      const factRub = Math.round(planRub * attainment);
      const deals = Math.max(4, Math.round(factRub / (70_000 + index * 2500)));
      const leads = 19 + index * 2;
      const won = deals;
      const calls = 96 + ((index * 13 + 38) % 58);
      const meetings = 5 + (index % 5);
      return {
        ...stat,
        planRub,
        factRub,
        deals,
        inWork: Math.max(12, leads - won + 10),
        calls,
        meetings,
        leads,
        won,
        avgCheck: deals ? factRub / deals : 0,
        conversion: leads ? (won / leads) * 100 : 0,
        attainment,
        perHour: stat.workHours ? factRub / stat.workHours : 0,
        trend: [Math.round(factRub * 0.82), Math.round(factRub * 0.94), factRub],
        ropNote:
          index === attainments.length - 1
            ? 'План под угрозой: есть просадка по активности и пропуски по графику.'
            : index < 2
              ? 'Опережает темп, можно ставить в пример по дисциплине и воронке.'
              : undefined,
      };
    });
  }, [stats]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b[sortBy] - a[sortBy]), [rows, sortBy]);
  const total = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.planRub += row.planRub;
          acc.factRub += row.factRub;
          acc.deals += row.deals;
          acc.inWork += row.inWork;
          acc.leads += row.leads;
          acc.won += row.won;
          acc.workHours += row.workHours;
          acc.calls += row.calls;
          acc.meetings += row.meetings;
          return acc;
        },
        { planRub: 0, factRub: 0, deals: 0, inWork: 0, leads: 0, won: 0, workHours: 0, calls: 0, meetings: 0 },
      ),
    [rows],
  );
  const groupAttainment = total.planRub ? total.factRub / total.planRub : 0;
  const groupConversion = total.leads ? (total.won / total.leads) * 100 : 0;
  const groupAvg = total.deals ? total.factRub / total.deals : 0;
  const groupPerHour = total.workHours ? total.factRub / total.workHours : 0;
  const topRows = sorted.slice(0, 3);
  const riskRow = [...rows].sort((a, b) => a.attainment - b.attainment || b.absentDays - a.absentDays)[0];
  const topByFact = [...rows].sort((a, b) => b.factRub - a.factRub);
  const topShare = total.factRub ? Math.round(((topByFact[0]?.factRub ?? 0) + (topByFact[1]?.factRub ?? 0)) / total.factRub * 100) : 0;

  if (!rows.length) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-lg border border-slate-200 bg-surface text-center shadow-card">
        <div>
          <p className="font-semibold text-ink">Нет данных для статистики</p>
          <p className="mt-1 text-sm text-slate-500">Добавьте сотрудников в график, чтобы увидеть отчёт.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Статистика · Отдел продаж</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
              Руководитель — <b className="font-semibold text-slate-700">{fullName(rows[1]?.user ?? rows[0]!.user)}</b>. {rows.length} чел. под контролем.
              Показатели каждого и общий план группы система считает сама: продажи — из CRM, дисциплина — из графика работы.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
              {monthLabel} · {statsDay} из {daysCount} дня
            </span>
            <Button variant="secondary" size="sm" onClick={() => toast.info('Группа контроля', 'Демо: здесь открывается настройка состава и планов.')}>
              <Pencil className="size-3.5" />
              Изменить группу
            </Button>
            <Button size="sm" onClick={() => toast.info('Отчёт подготовлен', 'Демо: выгрузка появится на следующем этапе.')}>
              <Send className="size-3.5" />
              Выгрузить отчёт
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Группа контроля:</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">
            Отдел продаж <span className="rounded-full bg-white/20 px-1.5 font-mono">{rows.length}</span>
          </span>
          <button
            type="button"
            onClick={() => toast.info('Новая группа', 'Демо: настройка групп появится после подключения CRM.')}
            className="cursor-pointer rounded-full border border-dashed border-primary-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700"
          >
            + Добавить группу
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <SalesKpiCard
          label="Выручка · факт / план"
          value={`${formatShortRub(total.factRub)} ₽`}
          hint={`план ${formatShortRub(total.planRub)} ₽ · выполнено ${pct(groupAttainment * 100)}`}
          accent={groupAttainment >= pace ? 'success' : 'warning'}
          progress={groupAttainment * 100}
          footer={groupAttainment >= pace ? '▲ опережает темп' : '▼ отстаёт от темпа'}
        />
        <SalesKpiCard
          label="Сделок закрыто"
          value={String(total.deals)}
          hint={`в работе ~${total.inWork} · средний чек ${formatShortRub(groupAvg)} ₽`}
          accent="neutral"
          spark={[(total.deals * 0.7), (total.deals * 0.85), total.deals]}
          footer="май–июль"
        />
        <SalesKpiCard
          label="Конверсия лид→сделка"
          value={`${Math.round(groupConversion)}%`}
          hint={`из ${total.leads} лидов — ${total.won} сделок`}
          accent="neutral"
          spark={[groupConversion - 6, groupConversion - 2, groupConversion]}
          footer="0% к июню"
        />
        <SalesKpiCard
          label="Средний чек"
          value={`${formatShortRub(groupAvg)} ₽`}
          hint="выручка ÷ число сделок"
          accent="neutral"
          spark={[groupAvg * 0.96, groupAvg * 1.05, groupAvg]}
          footer="0% к июню"
        />
        <SalesKpiCard
          label="Выручка на час"
          value={`${formatRub(groupPerHour)} ₽/ч`}
          hint={`на каждый отработанный час · ${roundedHours(total.workHours)} ч в июле`}
          accent="primary"
          badge="наша фишка"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
        <div className="flex items-baseline gap-2">
          <h3 className="font-bold text-ink">Кто тянет план</h3>
          <span className="text-xs text-slate-500">участники группы по выполнению плана · «сегодня» = {statsDay} июля</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {topRows.map((row, index) => (
            <LeaderCard key={row.user.id} row={row} place={index + 1} />
          ))}
          {riskRow && <LeaderCard row={riskRow} place="risk" />}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
        <div className="flex items-baseline gap-2">
          <h3 className="font-bold text-ink">Что важно знать собственнику</h3>
          <span className="text-xs text-slate-500">три вывода по группе за месяц</span>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <OwnerInsight
            icon="💰"
            title="Где деньги"
            text={`${fullName(topByFact[0]!.user)} и ${fullName(topByFact[1]!.user)} дают ${topShare}% выручки группы. Средний чек лидера — ${formatShortRub(topByFact[0]!.avgCheck)} ₽.`}
          />
          <OwnerInsight
            icon="📉"
            title="Где риск"
            text={`Группа закрыла ${pct(groupAttainment * 100)} плана при темпе ~${pct(pace * 100)} к ${statsDay}-му. Дней с низким покрытием в графике — ${lowCoverageDays}. Слабее всех — ${fullName(riskRow!.user)} (${pct(riskRow!.attainment * 100)} плана).`}
          />
          <OwnerInsight
            icon="🤝"
            title="Кому нужна помощь"
            text={`${fullName(riskRow!.user)} — ${riskRow!.sickDays ? `болел(а) ${riskRow!.sickDays} дн` : 'проседает по активности'}, план под угрозой. Подстрахуйте по горячим сделкам.`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="font-bold text-ink">Каждый сотрудник под контролем</h3>
            <p className="mt-1 text-xs text-slate-500">клик по заголовку — сортировка · продажи связаны с дисциплиной по графику</p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-md bg-surface-sunken p-1">
            {(
              [
                { value: 'attainment', label: 'Выполнение' },
                { value: 'factRub', label: 'Факт' },
                { value: 'deals', label: 'Сделки' },
                { value: 'perHour', label: '₽/час' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSortBy(option.value)}
                className={cn(
                  'cursor-pointer rounded-[9px] px-3 py-1.5 text-xs font-semibold transition-colors',
                  sortBy === option.value ? 'bg-surface text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Сотрудник</th>
                <th className="px-4 py-3 text-right">Факт / план</th>
                <th className="px-4 py-3 text-right">Выполнение</th>
                <th className="px-4 py-3 text-right">Сделки</th>
                <th className="px-4 py-3 text-right">Ср. чек</th>
                <th className="px-4 py-3 text-right">Конв.</th>
                <th className="px-4 py-3 text-right">Активность</th>
                <th className="px-4 py-3 text-right">Часы / загрузка</th>
                <th className="bg-primary-50 px-4 py-3 text-right text-primary-700">₽/час</th>
                <th className="px-4 py-3 text-center">Тренд</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, index) => {
                const status = salesStatus(row);
                return (
                  <tr key={row.user.id} className={cn(index === sorted.length - 1 && 'bg-danger-50/40')}>
                    <td className="border-t border-slate-100 px-4 py-3 font-mono text-xs font-bold text-slate-500">{index + 1}</td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={fullName(row.user)} src={row.user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{fullName(row.user)}</p>
                          <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', status.className)}>
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right">
                      <div className="font-mono font-bold text-ink">{formatShortRub(row.factRub)} ₽</div>
                      <div className="text-xs text-slate-500">план {formatShortRub(row.planRub)}</div>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right">
                      <SalesProgress value={row.attainment * 100} pace={pace * 100} />
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right font-mono">
                      <b>{row.deals}</b>
                      <div className="text-xs text-slate-500">в работе {row.inWork}</div>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right font-mono">{formatShortRub(row.avgCheck)} ₽</td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right font-mono">{Math.round(row.conversion)}%</td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right font-mono">
                      {row.calls}
                      <div className="text-xs text-slate-500">встреч {row.meetings}</div>
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3 text-right font-mono">
                      {roundedHours(row.workHours)} ч
                      <div className={cn('text-xs', row.utilization < 90 ? 'text-danger-600' : 'text-slate-500')}>
                        загрузка {row.utilization}%{row.absentDays ? ` · пропуск ${row.absentDays} дн` : ''}
                      </div>
                    </td>
                    <td className="border-t border-primary-100 bg-primary-50 px-4 py-3 text-right font-mono font-bold text-primary-700">
                      {formatRub(row.perHour)} ₽
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      <MiniTrend values={row.trend} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalesKpiCard({
  label,
  value,
  hint,
  accent,
  footer,
  progress,
  spark,
  badge,
}: {
  label: string;
  value: string;
  hint: string;
  accent: 'primary' | 'success' | 'warning' | 'neutral';
  footer?: string;
  progress?: number;
  spark?: number[];
  badge?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-surface p-4 shadow-card', accent === 'primary' && 'border-primary-200 bg-primary-50/30')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</p>
        {badge && <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-bold text-primary-700 uppercase">{badge}</span>}
      </div>
      <p className="mt-2 font-mono text-2xl font-black text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <span className={cn('block h-full rounded-full', accent === 'warning' ? 'bg-warning-500' : 'bg-primary-500')} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
      {spark && <div className="mt-3"><MiniTrend values={spark} /></div>}
      {footer && <p className={cn('mt-2 text-xs font-semibold', accent === 'success' ? 'text-success-700' : accent === 'warning' ? 'text-warning-700' : 'text-slate-500')}>{footer}</p>}
    </div>
  );
}

function LeaderCard({ row, place }: { row: SalesDashboardRow; place: number | 'risk' }) {
  const danger = place === 'risk';
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '⚠️';
  return (
    <div className={cn('rounded-md border p-4', danger ? 'border-danger-200 bg-danger-50' : 'border-slate-200 bg-surface')}>
      <div className="flex items-center gap-3">
        <span className="text-lg">{medal}</span>
        <Avatar name={fullName(row.user)} src={row.user.avatarUrl} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{fullName(row.user)}</p>
          <p className="truncate text-xs text-slate-500">{danger ? 'нужно внимание руководителя' : row.positionName ?? 'Менеджер по продажам'}</p>
        </div>
      </div>
      <div className="mt-4 font-mono text-2xl font-black text-ink">
        {pct(row.attainment * 100)}
        <span className="ml-1 text-xs font-semibold text-slate-500">плана · {formatShortRub(row.factRub)} ₽</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <span className={cn('block h-full rounded-full', danger ? 'bg-warning-500' : 'bg-success-600')} style={{ width: `${Math.min(100, row.attainment * 100)}%` }} />
      </div>
    </div>
  );
}

function OwnerInsight({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-md border border-slate-200 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-lg">{icon}</span>
      <div>
        <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p>
      </div>
    </div>
  );
}

function SalesProgress({ value, pace }: { value: number; pace: number }) {
  return (
    <div className="ml-auto flex min-w-32 items-center justify-end gap-2">
      <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
        <span className="absolute top-0 bottom-0 w-px bg-ink/60" style={{ left: `${Math.min(100, pace)}%` }} />
        <span className={cn('block h-full rounded-full', value < pace ? 'bg-warning-500' : 'bg-success-600')} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className={cn('font-mono text-xs font-bold', value < pace ? 'text-warning-700' : 'text-success-700')}>{Math.round(value)}%</span>
    </div>
  );
}

function MiniTrend({ values }: { values: number[] | [number, number, number] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = 4 + index * (44 / Math.max(1, values.length - 1));
      const y = 22 - ((value - min) / range) * 16;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 52 26" className="mx-auto h-6 w-14 text-primary-700" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="48" cy={points.split(' ').at(-1)?.split(',')[1] ?? 12} r="1.4" fill="#F59E0B" />
    </svg>
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
        <td className="sticky left-0 z-10 w-[270px] min-w-[270px] max-w-[270px] border-r border-b border-slate-100 bg-surface-muted px-5 py-2">
          <span className="flex items-center gap-1.5 text-xs font-bold tracking-[0.6px] text-primary-600 uppercase">
            <ChevronDown className={cn('size-3.5 text-slate-400 transition-transform', collapsed && '-rotate-90')} />
            {group.name}
            <span className="font-mono font-semibold text-slate-400">{group.users.length}</span>
          </span>
        </td>
        <td colSpan={days.length} className="border-b border-slate-100 bg-surface-muted" />
        <td className="sticky right-0 z-10 w-[186px] min-w-[186px] max-w-[186px] border-b border-l border-slate-100 bg-surface-muted" />
      </tr>

      {!collapsed &&
        group.users.map((user) => {
          const schedule = scheduleByUser.get(user.id);
          // Итоги месяца
          let workDays = 0;
          let workHours = 0;
          let planHours = 0;
          let overtime = 0;
          let offDays = 0;
          let vacationDays = 0;
          let sickDays = 0;
          let absentHours = 0;
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
            } else if (state.type === 'vacation') {
              vacationDays += 1;
              absentHours += planDayHours;
            } else if (state.type === 'sick') {
              sickDays += 1;
              absentHours += planDayHours;
            } else {
              offDays += 1;
            }
          }
          const absentDays = vacationDays + sickDays;

          // Отметки 🎂/🎉 — «месяц-день» даты рождения и годовщины найма в отображаемом месяце
          const birthdayDay = monthDayOf(user.birthDate, month);
          const hiredYear = user.hiredAt ? Number(user.hiredAt.slice(0, 4)) : undefined;
          const annivYears = hiredYear ? year - hiredYear : 0;
          const annivDay = annivYears > 0 ? monthDayOf(user.hiredAt, month) : undefined;

          return (
            <tr key={user.id} className="group/row">
              {/* Левая закреплённая колонка */}
              <td
                className={cn(
                  'sticky left-0 z-10 w-[270px] min-w-[270px] max-w-[270px] border-r border-b border-slate-100 bg-surface px-5',
                  rowHeight,
                )}
              >
                <div
                  onClick={() => onOpenUser(user.id)}
                  className="flex max-w-full cursor-pointer items-center gap-3 rounded-md text-left hover:text-primary-700"
                >
                  <Avatar name={fullName(user)} src={user.avatarUrl} size={compact ? 'sm' : 'md'} />
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold text-ink">{fullName(user)}</div>
                    {!compact && (
                      <>
                        {positionName(user) && (
                          <div className="truncate text-[12.5px] font-semibold text-primary-600">
                            {positionName(user)}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
                          {user.phone ? (
                            <a
                              href={`tel:${user.phone.replace(/[^+\d]/g, '')}`}
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex min-w-0 items-center gap-1 font-mono hover:text-primary-600"
                            >
                              <Phone className="size-3 shrink-0 text-primary-600/80" />
                              <span className="truncate">{user.phone}</span>
                            </a>
                          ) : (
                            <span className="font-mono">
                              {Math.round(workHours)} / {Math.round(planHours)} ч
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </td>

              {/* Дни */}
              {days.map((day) => {
                const state = resolve(user.id, day);
                const plan = schedule ? baseState(schedule.template, year, month, day) : { type: 'off' as const };
                const today = isCurrentMonth && day === todayDay;
                const isDraft = drafts.has(draftKey(user.id, isoDate(year, month, day)));
                const isExtraWork = state?.type === 'work' && plan.type !== 'work';
                // В ячейке видно время смены — отметки 🎂/🎉 сдвигаются в стороны, чтобы не перекрывать
                const hasShiftText =
                  state?.type === 'work' &&
                  !!state.start &&
                  !!state.end &&
                  (plan.type !== 'work' || state.start !== plan.start || state.end !== plan.end);
                return (
                  <td
                    key={day}
                    onMouseDown={(event) => schedule && onCellMouseDown(user.id, day, event)}
                    onMouseEnter={() => schedule && onCellMouseEnter(user.id, day)}
                    onClick={() =>
                      schedule ? onCellClick(user.id, day) : onOpenUser(user.id)
                    }
                    title={
                      schedule
                        ? shiftCellTitle(state, plan)
                        : 'График не задан — откройте карточку сотрудника'
                    }
                    className={cn(
                      'relative w-11 min-w-11 max-w-11 overflow-hidden border-b border-l border-slate-100 text-center align-middle transition-colors',
                      rowHeight,
                      weekdayIndex(year, month, day) === 0 && 'border-l-2 border-l-slate-200',
                      state?.type === 'off' && offStripes,
                      today && 'bg-primary-50/70',
                      schedule && mode === 'edit' ? 'cursor-cell' : 'cursor-pointer',
                      'hover:bg-primary-50',
                    )}
                  >
                    {state && <ShiftCellContent state={state} plan={plan} compact={compact} />}
                    {day === birthdayDay && (
                      <span
                        className={cn(
                          'absolute top-1 left-1/2 z-[1] text-[12px] leading-none',
                          hasShiftText ? '-translate-x-[115%]' : '-translate-x-1/2',
                        )}
                        title={`День рождения: ${user.firstName}`}
                      >
                        🎂
                      </span>
                    )}
                    {day === annivDay && (
                      <span
                        className={cn(
                          'absolute top-1 left-1/2 z-[1] text-[12px] leading-none',
                          hasShiftText ? 'translate-x-[15%]' : '-translate-x-1/2',
                        )}
                        title={`Годовщина: ${annivYears} ${pluralRu(annivYears, 'год', 'года', 'лет')} в компании`}
                      >
                        🎉
                      </span>
                    )}
                    {isExtraWork && (
                      <span
                        className="absolute top-1 left-1 text-[13px] leading-none font-black text-danger-600"
                        title="Сотрудник вышел вне своего графика работы — это время засчитано как переработка"
                      >
                        i
                      </span>
                    )}
                    {state?.note && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 font-serif text-[11px] leading-none font-bold text-primary-600 italic">
                        i
                      </span>
                    )}
                    {isDraft && mode === 'edit' && (
                      <span className={cn('pointer-events-none absolute inset-0', draftStripes)} />
                    )}
                  </td>
                );
              })}

              {/* Правая закреплённая колонка: итоги */}
              <td
                className={cn(
                  'sticky right-0 z-10 w-[186px] min-w-[186px] max-w-[186px] border-b border-l border-slate-100 bg-surface px-4 text-right',
                  rowHeight,
                )}
              >
                {!schedule ? (
                  <button
                    type="button"
                    onClick={() => onOpenUser(user.id)}
                    className="ml-auto flex flex-col items-end text-warning-700 hover:text-warning-800"
                  >
                    <span className="text-[12px] font-semibold">График не задан</span>
                    {!compact && <span className="text-[11px] underline">Настроить</span>}
                  </button>
                ) : (
                  <div className={cn('flex w-full flex-col', compact ? 'gap-px' : 'gap-0.5')}>
                  <span className="flex items-center justify-between gap-2 text-[12px] leading-tight text-slate-500">
                    {!compact && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="size-1.5 rounded-full bg-primary-500" />
                        Отработано
                      </span>
                    )}
                    <span className="ml-auto font-mono font-semibold whitespace-nowrap text-ink">
                      {workDays} дн · {Math.round(workHours)} ч
                    </span>
                  </span>
                  <span
                    className="flex items-center justify-between gap-2 text-[12px] leading-tight text-slate-400"
                    title={`отпуск ${vacationDays} дн, больничный ${sickDays} дн`}
                  >
                    {!compact && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="size-1.5 rounded-full bg-slate-400" />
                        Не отработано
                      </span>
                    )}
                    <span className="ml-auto font-mono font-semibold whitespace-nowrap text-slate-500">
                      {absentDays ? `${absentDays} дн · ${Math.round(absentHours)} ч` : '0 дн'}
                    </span>
                  </span>
                  <span className="flex items-center justify-between gap-2 text-[12px] leading-tight text-slate-400">
                    {!compact && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            overtime > 0 ? 'bg-success-500' : 'bg-slate-300',
                          )}
                        />
                        {overtime > 0 ? 'Переработка' : 'Выходных'}
                      </span>
                    )}
                    <span
                      className={cn(
                        'ml-auto font-mono font-semibold whitespace-nowrap',
                        overtime > 0 ? 'text-success-600' : 'text-slate-500',
                      )}
                    >
                      {overtime > 0 ? `+${formatHours(overtime)} ч` : `${offDays} дн`}
                    </span>
                  </span>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
    </>
  );
}
