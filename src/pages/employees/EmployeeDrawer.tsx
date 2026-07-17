import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  PanelRight,
  Plus,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi, scheduleApi } from '@/api';
import { scheduleQueryKeys } from '@/api/queryKeys';
import type { ID, ScheduleTemplate, ShiftException } from '@/types';
import {
  fullName,
  pluralRu,
  roleLabels,
  roleVariants,
  userStatusLabels,
  userStatusVariants,
} from '@/lib/labels';
import { cn } from '@/lib/cn';
import { MONTH_LABELS, MONTH_LABELS_GENITIVE } from '@/lib/schedule';
import { toast } from '@/stores/toast';
import { Avatar, Badge, Button, Drawer, Modal, Select } from '@/components/ui';
import { EmployeeEditModal } from './EmployeeEditModal';
import { buildPositionOptions, NO_POSITION_VALUE } from './positionSelect';
import { splitEmployeeName } from './employeeName';
import { PHONE_ERROR, isValidPhone } from '@/lib/formValidation';

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthShortNames = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

export function EmployeeDrawer({ userId, onClose }: { userId: ID | null; onClose: () => void }) {
  const open = Boolean(userId);
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [view, setView] = useState<'side' | 'center'>('side');
  const [profileDraft, setProfileDraft] = useState({
    fullName: '',
    positionId: NO_POSITION_VALUE,
    phone: '',
    hire: '',
    birth: '',
  });
  const [scheduleType, setScheduleType] = useState<'week' | 'cycle'>('week');
  const [weekDraft, setWeekDraft] = useState({
    uniform: true,
    days: [0, 1, 2, 3, 4],
    start: '09:00',
    end: '18:00',
  });
  const [cycleDraft, setCycleDraft] = useState({
    on: 2,
    off: 2,
    cycleStart: '',
    start: '09:00',
    end: '18:00',
    manual: {} as Record<string, 'work' | 'off'>,
  });
  const [cycleYm, setCycleYm] = useState(() => ({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  }));
  const [vacationYear, setVacationYear] = useState(() => new Date().getFullYear());
  const [vacationNorm, setVacationNorm] = useState(28);
  const [vacationDraft, setVacationDraft] = useState({ from: '', to: '' });
  const [phoneError, setPhoneError] = useState<string>();
  const now = useMemo(() => new Date(), []);
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const userQuery = useQuery({
    queryKey: ['users', userId],
    queryFn: () => orgApi.getUser(userId!),
    enabled: open,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ['positions'],
    queryFn: orgApi.getPositions,
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });
  const { data: schedules = [] } = useQuery({
    queryKey: scheduleQueryKeys.templates,
    queryFn: scheduleApi.getSchedules,
    enabled: open,
  });
  const { data: monthExceptions = [] } = useQuery({
    queryKey: scheduleQueryKeys.exceptionsForMonth(currentMonth),
    queryFn: () => scheduleApi.getExceptions(currentMonth),
    enabled: open,
  });

  const user = userQuery.data;
  const userPositions = useMemo(
    () => positions.filter((position) => user?.positionIds.includes(position.id)),
    [positions, user],
  );
  const primaryPosition = userPositions[0];
  const primaryDepartment = primaryPosition
    ? departments.find((department) => department.id === primaryPosition.departmentId)
    : undefined;
  const positionOptions = useMemo(
    () => buildPositionOptions(positions, departments),
    [positions, departments],
  );
  const schedule = schedules.find((item) => item.userId === userId);
  const userMonthExceptions = useMemo(
    () => monthExceptions.filter((item) => item.userId === userId),
    [monthExceptions, userId],
  );
  const vacations = userMonthExceptions.filter((item) => item.type === 'vacation');
  const sickDays = userMonthExceptions.filter((item) => item.type === 'sick');
  const trips = userMonthExceptions.filter((item) => item.type === 'trip');
  const vacationLedgerRows = useMemo(
    () => buildVacationLedger(now.getFullYear(), vacationNorm, vacations),
    [now, vacationNorm, vacations],
  );
  const selectedVacationRow = vacationLedgerRows.find((row) => row.year === vacationYear) ?? {
    year: vacationYear,
    norm: vacationNorm,
    carry: 0,
    used: 0,
    available: vacationNorm,
    remaining: vacationNorm,
  };
  const vacationRanges = useMemo(
    () =>
      groupVacationRanges(vacations).filter(
        (range) => daysInYear(range.from, range.to, vacationYear) > 0,
      ),
    [vacations, vacationYear],
  );
  const hiredYears = profileDraft.hire ? fullYearsSince(profileDraft.hire) : undefined;
  const age = profileDraft.birth ? fullYearsSince(profileDraft.birth) : undefined;

  useEffect(() => {
    if (!open || !user) return;
    setProfileDraft({
      fullName: fullName(user),
      positionId: primaryPosition?.id ?? NO_POSITION_VALUE,
      phone: user.phone ?? '',
      hire: user.hiredAt ?? '',
      birth: user.birthDate ?? '',
    });
    setVacationNorm(user.vacationAllowance ?? 28);
  }, [open, user, primaryPosition?.id]);

  useEffect(() => {
    if (!open) return;
    const template = schedule?.template;
    if (!template || template.type === 'week') {
      setScheduleType('week');
      setWeekDraft({
        uniform: true,
        days: template?.type === 'week' ? template.days : [0, 1, 2, 3, 4],
        start: template?.type === 'week' ? template.start : '09:00',
        end: template?.type === 'week' ? template.end : '18:00',
      });
      return;
    }

    setScheduleType('cycle');
    setCycleDraft({
      on: template.on,
      off: template.off,
      cycleStart: template.cycleStart,
      start: template.start,
      end: template.end,
      manual: {},
    });
    setCycleYm({ year: now.getFullYear(), month: now.getMonth() + 1 });
  }, [open, schedule?.userId, schedule?.template, now]);

  const savePanel = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Сотрудник не выбран');
      const name = splitEmployeeName(profileDraft.fullName, user);
      const template: ScheduleTemplate =
        scheduleType === 'week'
          ? {
              type: 'week',
              days: weekDraft.days,
              start: weekDraft.start,
              end: weekDraft.end,
            }
          : {
              type: 'cycle',
              on: cycleDraft.on,
              off: cycleDraft.off,
              start: cycleDraft.start,
              end: cycleDraft.end,
              cycleStart: cycleDraft.cycleStart || isoDateLocal(cycleYm.year, cycleYm.month, 1),
            };

      const [updated] = await Promise.all([
        orgApi.updateUser({
          id: user.id,
          firstName: name.firstName,
          lastName: name.lastName,
          phone: profileDraft.phone,
          birthDate: profileDraft.birth,
          hiredAt: profileDraft.hire,
          vacationAllowance: vacationNorm,
          role: user.role,
          status: user.status,
          positionIds:
            profileDraft.positionId === NO_POSITION_VALUE ? [] : [profileDraft.positionId],
        }),
        scheduleApi.saveSchedule({ userId: user.id, template }),
      ]);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users', updated.id] });
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.templates });
      toast.success('Панель сотрудника сохранена');
      onClose();
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : 'Не удалось сохранить панель сотрудника',
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Сотрудник не выбран');
      return orgApi.deleteUser(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Сотрудник удалён');
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось удалить сотрудника'),
  });

  const addVacation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error('Сотрудник не выбран');
      if (!vacationDraft.from || !vacationDraft.to) {
        throw new Error('Укажите даты начала и окончания отпуска');
      }
      const dates = dateRange(vacationDraft.from, vacationDraft.to);
      if (!dates.length) throw new Error('Дата окончания должна быть не раньше даты начала');
      return scheduleApi.saveExceptions(
        dates.map((date) => ({
          userId: user.id,
          date,
          type: 'vacation' as const,
        })),
      );
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKeys.exceptions });
      setVacationDraft({ from: '', to: '' });
      toast.success(
        'Отпуск добавлен в график',
        `${saved.length} ${pluralRu(saved.length, 'день', 'дня', 'дней')}`,
      );
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось добавить отпуск'),
  });

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={user ? fullName(user) : 'Сотрудник'}
        description={user ? user.email : undefined}
        size={view === 'center' ? 'employeeCenter' : 'employee'}
        placement={view === 'center' ? 'center' : 'side'}
        bodyClassName={cn('px-5 py-5', view === 'center' && 'grid gap-5 md:grid-cols-2 md:gap-x-8')}
        footerClassName="items-center justify-between"
        header={
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={user ? fullName(user) : 'Сотрудник'} src={user?.avatarUrl} size="md" />
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-bold text-ink">
                  {user ? fullName(user) : 'Сотрудник'}
                </h3>
                <div className="mt-0.5 truncate font-mono text-[13px] text-slate-500">
                  {user?.phone ?? user?.email ?? 'Загрузка данных'}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden rounded-md bg-surface-sunken p-1 sm:flex">
                <button
                  type="button"
                  title="Показать справа"
                  onClick={() => setView('side')}
                  className={cn(
                    'flex size-8 cursor-pointer items-center justify-center rounded-[7px] transition-colors',
                    view === 'side'
                      ? 'bg-surface text-primary-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-700',
                  )}
                >
                  <PanelRight className="size-4" />
                </button>
                <button
                  type="button"
                  title="Показать по центру"
                  onClick={() => setView('center')}
                  className={cn(
                    'flex size-8 cursor-pointer items-center justify-center rounded-[7px] transition-colors',
                    view === 'center'
                      ? 'bg-surface text-primary-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-700',
                  )}
                >
                  <Square className="size-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Закрыть"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        }
        footer={
          user && (
            <>
              <div className="mr-auto flex items-center gap-2">
                <Button
                  variant={user.status === 'deactivated' ? 'secondary' : 'danger'}
                  onClick={() => setEditOpen(true)}
                >
                  {user.status === 'deactivated' ? 'Восстановить' : 'Уволить'}
                </Button>
                {user.source !== 'amo' && (
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (
                        confirm(`Удалить сотрудника ${fullName(user)}? Это действие необратимо.`)
                      ) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-4" />
                    {deleteMutation.isPending ? 'Удаляю' : 'Удалить'}
                  </Button>
                )}
              </div>
              <Button
                onClick={() => {
                  if (!isValidPhone(profileDraft.phone)) {
                    setPhoneError(PHONE_ERROR);
                    return;
                  }
                  setPhoneError(undefined);
                  savePanel.mutate();
                }}
                disabled={savePanel.isPending}
              >
                {savePanel.isPending ? 'Сохраняю' : 'Сохранить'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Отмена
              </Button>
            </>
          )
        }
      >
        {userQuery.isPending && <EmployeePanelSkeleton />}

        {(userQuery.isError || (!userQuery.isPending && !user)) && (
          <p className="py-10 text-center text-sm text-slate-500">
            Сотрудник не найден или произошла ошибка.
          </p>
        )}

        {user && (
          <>
            <div className="flex flex-col gap-5">
              {user.status === 'deactivated' && (
                <div className="rounded-md border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
                  Сотрудник деактивирован. Чтобы вернуть доступ, откройте редактирование и смените
                  статус.
                </div>
              )}

              <PanelSection title="Профиль сотрудника">
                <PanelInput
                  label="Имя"
                  value={profileDraft.fullName}
                  onChange={(value) => setProfileDraft((draft) => ({ ...draft, fullName: value }))}
                />
                <Select
                  label="Должность"
                  options={positionOptions}
                  value={profileDraft.positionId}
                  onValueChange={(positionId) =>
                    setProfileDraft((draft) => ({ ...draft, positionId }))
                  }
                />
                <PanelInput
                  label="Телефон"
                  value={profileDraft.phone}
                  placeholder="+7 900 000-00-00"
                  error={phoneError}
                  onChange={(value) => {
                    setProfileDraft((draft) => ({ ...draft, phone: value }));
                    setPhoneError(undefined);
                  }}
                />
                <div className="flex gap-2 text-[12px] leading-relaxed text-slate-500">
                  <ImageIcon className="mt-0.5 size-3.5 shrink-0 text-primary-600" />
                  <span>Фото подтягивается автоматически из amoCRM</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
                  <Badge variant={userStatusVariants[user.status]}>
                    {userStatusLabels[user.status]}
                  </Badge>
                  {user.source === 'amo' && <Badge variant="warning">amoCRM</Badge>}
                  {primaryDepartment && <Badge variant="neutral">{primaryDepartment.name}</Badge>}
                </div>
              </PanelSection>

              <PanelSection title="Рабочий шаблон">
                <p className="text-[13px] leading-relaxed text-slate-500">
                  Выберите базовый режим, который будет применён к календарю сотрудника.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ScheduleModeCard
                    active={scheduleType === 'week'}
                    onClick={() => setScheduleType('week')}
                    badge="5/2"
                    title="Рабочая неделя"
                    description="Настройка дней недели вручную"
                  />
                  <ScheduleModeCard
                    active={scheduleType === 'cycle'}
                    onClick={() => setScheduleType('cycle')}
                    badge={scheduleType === 'cycle' ? `${cycleDraft.on}/${cycleDraft.off}` : '2/2'}
                    title="Сменный график"
                    description="Цикл рабочих и выходных дней"
                  />
                </div>
                {scheduleType === 'week' ? (
                  <WeekTemplateEditor draft={weekDraft} onChange={setWeekDraft} />
                ) : (
                  <CycleTemplateEditor
                    draft={cycleDraft}
                    onChange={setCycleDraft}
                    ym={cycleYm}
                    onYmChange={setCycleYm}
                    todayYear={now.getFullYear()}
                    todayMonth={now.getMonth() + 1}
                  />
                )}
              </PanelSection>
            </div>

            <div className="flex flex-col gap-5">
              <PanelSection title="Важные даты">
                <PanelInput
                  label="Дата найма"
                  value={profileDraft.hire}
                  type="date"
                  placeholder="дд.мм.гггг"
                  icon={<Calendar className="size-4" />}
                  onChange={(value) => setProfileDraft((draft) => ({ ...draft, hire: value }))}
                />
                <InfoRow
                  icon={<span className="text-lg leading-none">🎉</span>}
                  text={
                    profileDraft.hire && hiredYears !== undefined
                      ? `Стаж: ${hiredYears} ${pluralRu(hiredYears, 'год', 'года', 'лет')}. Годовщина — ${formatHumanDate(profileDraft.hire)}.`
                      : 'Дата найма пока не указана.'
                  }
                />
                <PanelInput
                  label="Дата рождения"
                  value={profileDraft.birth}
                  type="date"
                  placeholder="дд.мм.гггг"
                  icon={<Calendar className="size-4" />}
                  onChange={(value) => setProfileDraft((draft) => ({ ...draft, birth: value }))}
                />
                <InfoRow
                  icon={<span className="text-lg leading-none">🎂</span>}
                  text={
                    profileDraft.birth && age !== undefined
                      ? `День рождения — ${formatHumanDate(profileDraft.birth)}. Исполнится ${age + 1}.`
                      : 'Дата рождения пока не указана.'
                  }
                />
              </PanelSection>

              <PanelSection title="Отпуска">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">Базовая норма:</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    value={vacationNorm}
                    onChange={(event) => setVacationNorm(clampVacationNorm(event.target.value))}
                    className="h-10 w-16 rounded-md border border-slate-200 bg-surface px-3 text-center font-mono text-sm font-semibold text-ink focus:outline-2 focus:-outline-offset-1 focus:outline-primary-600"
                  />
                  <span className="text-sm text-slate-500">дней в год</span>
                </div>
                <VacationLedger rows={vacationLedgerRows} currentYear={now.getFullYear()} />
                <div className="flex gap-2">
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((year) => (
                    <button
                      type="button"
                      onClick={() => setVacationYear(year)}
                      key={year}
                      className={cn(
                        'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold',
                        year === vacationYear
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-slate-200 bg-surface text-slate-500',
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <span>
                    🌴 {vacationYear}: использовано{' '}
                    <b className="font-mono text-ink">{selectedVacationRow.used}</b> из{' '}
                    {selectedVacationRow.available} дн
                    {selectedVacationRow.carry ? (
                      <span className="text-slate-500">
                        {' '}
                        (норма {selectedVacationRow.norm} + перенос {selectedVacationRow.carry})
                      </span>
                    ) : null}
                  </span>
                  <span className="h-1.5 w-10 rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-primary-600"
                      style={{
                        width: `${Math.min(100, selectedVacationRow.available ? (selectedVacationRow.used / selectedVacationRow.available) * 100 : 0)}%`,
                      }}
                    />
                  </span>
                </div>
                {vacationRanges.length ? (
                  <VacationRangeList ranges={vacationRanges} year={vacationYear} />
                ) : (
                  <div className="py-3 text-center text-sm text-slate-500">
                    За {vacationYear} год отпусков нет
                  </div>
                )}
                <div className="text-sm font-semibold text-slate-700">
                  Запланировать новый отпуск
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PanelInput
                    value={vacationDraft.from}
                    type="date"
                    placeholder="дд.мм.гггг"
                    icon={<Calendar className="size-4" />}
                    onChange={(value) => setVacationDraft((draft) => ({ ...draft, from: value }))}
                  />
                  <PanelInput
                    value={vacationDraft.to}
                    type="date"
                    placeholder="дд.мм.гггг"
                    icon={<Calendar className="size-4" />}
                    onChange={(value) => setVacationDraft((draft) => ({ ...draft, to: value }))}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addVacation.mutate()}
                  disabled={addVacation.isPending}
                  className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-semibold text-slate-700 transition-colors hover:border-primary-200 hover:text-primary-600"
                >
                  <Plus className="size-4" />
                  {addVacation.isPending ? 'Добавляю' : 'Добавить в график'}
                </button>
              </PanelSection>

              <PanelSection title="Больничные и командировки">
                <button
                  type="button"
                  onClick={() => setAbsenceOpen(true)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface px-3 py-3 text-left transition-colors hover:border-primary-200 hover:bg-primary-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-lg">😉</span>
                    <span className="text-lg">✈️</span>
                    <span className="block text-sm font-semibold text-ink">
                      Открыть сводку по годам
                    </span>
                  </span>
                  <span className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                    <span>
                      😉 <span className="font-mono">{sickDays.length}</span>
                    </span>
                    <span>
                      ✈️ <span className="font-mono">{trips.length}</span>
                    </span>
                    <span className="text-xs text-slate-400">за {now.getFullYear()}</span>
                    <ChevronRight className="size-4 text-slate-400" />
                  </span>
                </button>
              </PanelSection>
            </div>
          </>
        )}
      </Drawer>

      {user && (
        <AbsenceSummaryModal
          open={absenceOpen}
          onOpenChange={setAbsenceOpen}
          userName={fullName(user)}
          year={now.getFullYear()}
          sickDays={sickDays}
          trips={trips}
        />
      )}

      <EmployeeEditModal user={user ?? null} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}

function AbsenceSummaryModal({
  open,
  onOpenChange,
  userName,
  year,
  sickDays,
  trips,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  year: number;
  sickDays: ShiftException[];
  trips: ShiftException[];
}) {
  const [selectedYear, setSelectedYear] = useState(year);

  useEffect(() => {
    if (open) setSelectedYear(year);
  }, [open, year]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Больничные и командировки"
      description={userName}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[year, year - 1, year - 2, year - 3, year - 4].map((item) => (
            <button
              type="button"
              onClick={() => setSelectedYear(item)}
              key={item}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                item === selectedYear
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-slate-200 bg-surface text-slate-500 hover:border-primary-200 hover:text-primary-600',
              )}
            >
              {item}
              {item === year ? ' · тек.' : ''}
            </button>
          ))}
        </div>
        <AbsenceYearCard
          icon="😉"
          title="Больничный"
          year={selectedYear}
          items={selectedYear === year ? sickDays : []}
        />
        <AbsenceYearCard
          icon="✈️"
          title="Командировка"
          year={selectedYear}
          items={selectedYear === year ? trips : []}
        />
      </div>
    </Modal>
  );
}

function AbsenceYearCard({
  icon,
  title,
  year,
  items,
}: {
  icon: string;
  title: string;
  year: number;
  items: ShiftException[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="font-semibold text-ink">{title}</span>
        </div>
        <span className="text-sm text-slate-500">
          <b className="font-mono text-slate-700">{items.length}</b> раз ·{' '}
          <b className="font-mono text-slate-700">{items.length}</b> дней за {year}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {monthShortNames.map((month, index) => (
          <span
            key={month}
            className={cn(
              'flex h-9 items-center justify-center rounded-md text-[11px] font-bold',
              items.some((item) => Number(item.date.slice(5, 7)) === index + 1)
                ? 'bg-primary-50 text-primary-700'
                : 'bg-slate-50 text-slate-500',
            )}
          >
            {month}
          </span>
        ))}
      </div>
      <div className="mt-3 text-sm text-slate-500">
        {items.length ? items.map((item) => formatHumanDate(item.date)).join(', ') : 'ещё не было'}
      </div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <div className="text-[11px] font-bold tracking-[1.4px] text-slate-500 uppercase">{title}</div>
      {children}
    </section>
  );
}

function PanelInput({
  label,
  value,
  placeholder,
  icon,
  type = 'text',
  error,
  onChange,
}: {
  label?: string;
  value: string;
  placeholder?: string;
  icon?: ReactNode;
  type?: 'text' | 'date' | 'time' | 'number';
  error?: string;
  onChange?: (value: string) => void;
}) {
  const showIcon = Boolean(icon && type !== 'date');

  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-semibold text-slate-700">{label}</span>}
      <span className="relative block">
        <input
          readOnly={!onChange}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          className={cn(
            'h-9.5 w-full rounded-md border bg-surface px-3 text-sm font-medium text-slate-700 placeholder:text-slate-400',
            error ? 'border-danger-500' : 'border-slate-200',
            showIcon && 'pr-9',
          )}
          aria-invalid={error ? true : undefined}
        />
        {showIcon && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-ink">{icon}</span>
        )}
      </span>
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </label>
  );
}

function ToggleRow({
  label,
  active,
  onToggle,
  children,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-slate-100 py-2 last:border-b-0',
        !active && 'text-slate-500',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'relative h-5.5 w-10 shrink-0 cursor-pointer rounded-full transition-colors',
          active ? 'bg-primary-600' : 'bg-slate-200',
        )}
        aria-pressed={active}
      >
        <span
          className={cn(
            'absolute top-1/2 left-0.5 size-4.5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform',
            active && 'translate-x-[18px]',
          )}
        />
      </button>
      <span
        className={cn('min-w-0 flex-1 text-sm', active ? 'font-medium text-ink' : 'text-slate-500')}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <span className="relative block">
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-[104px] rounded-md border border-slate-200 bg-surface px-3 font-mono text-sm text-slate-700"
      />
    </span>
  );
}

function TimeBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{label}</span>
      {onChange ? (
        <TimeInput value={value} onChange={onChange} />
      ) : (
        <span className="flex h-10 min-w-25 items-center justify-between gap-3 rounded-md border border-slate-200 bg-surface px-3 font-mono text-sm text-slate-700">
          {value}
          <Clock className="size-4 text-ink" />
        </span>
      )}
    </div>
  );
}

function ScheduleModeCard({
  active,
  onClick,
  badge,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex cursor-pointer gap-3 rounded-md border p-3 text-left transition-colors',
        active ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-surface',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md font-mono text-sm font-bold',
          active ? 'bg-primary-600 text-white' : 'bg-slate-50 text-slate-500',
        )}
      >
        {badge}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function WeekTemplateEditor({
  draft,
  onChange,
}: {
  draft: { uniform: boolean; days: number[]; start: string; end: string };
  onChange: Dispatch<
    SetStateAction<{ uniform: boolean; days: number[]; start: string; end: string }>
  >;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleRow
          label="Применить ко всем"
          active={draft.uniform}
          onToggle={() => onChange((prev) => ({ ...prev, uniform: !prev.uniform }))}
        />
        <div className="flex flex-wrap gap-2">
          <TimeBox
            label="С"
            value={draft.start}
            onChange={(value) => onChange((prev) => ({ ...prev, start: value }))}
          />
          <TimeBox
            label="До"
            value={draft.end}
            onChange={(value) => onChange((prev) => ({ ...prev, end: value }))}
          />
        </div>
      </div>
      <div>
        {dayNames.map((day, index) => {
          const active = draft.days.includes(index);
          return (
            <ToggleRow
              key={day}
              label={weekdayFullName(index)}
              active={active}
              onToggle={() =>
                onChange((prev) => ({
                  ...prev,
                  days: active
                    ? prev.days.filter((item) => item !== index)
                    : [...prev.days, index].sort(),
                }))
              }
            >
              {!draft.uniform && active && (
                <div className="hidden gap-1.5 sm:flex">
                  <TimeInput
                    value={draft.start}
                    onChange={(value) => onChange((prev) => ({ ...prev, start: value }))}
                  />
                  <TimeInput
                    value={draft.end}
                    onChange={(value) => onChange((prev) => ({ ...prev, end: value }))}
                  />
                </div>
              )}
            </ToggleRow>
          );
        })}
      </div>
    </div>
  );
}

function CycleTemplateEditor({
  draft,
  onChange,
  ym,
  onYmChange,
  todayYear,
  todayMonth,
}: {
  draft: {
    on: number;
    off: number;
    cycleStart: string;
    start: string;
    end: string;
    manual: Record<string, 'work' | 'off'>;
  };
  onChange: Dispatch<
    SetStateAction<{
      on: number;
      off: number;
      cycleStart: string;
      start: string;
      end: string;
      manual: Record<string, 'work' | 'off'>;
    }>
  >;
  ym: { year: number; month: number };
  onYmChange: Dispatch<SetStateAction<{ year: number; month: number }>>;
  todayYear: number;
  todayMonth: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <PanelInput
          label="Рабочих дней:"
          type="number"
          value={String(draft.on)}
          onChange={(value) =>
            onChange((prev) => ({ ...prev, on: Math.max(1, Number(value) || 1) }))
          }
        />
        <PanelInput
          label="Выходных дней:"
          type="number"
          value={String(draft.off)}
          onChange={(value) =>
            onChange((prev) => ({ ...prev, off: Math.max(0, Number(value) || 0) }))
          }
        />
      </div>
      <div className="grid grid-cols-[1fr_1.35fr] gap-3">
        <PanelInput
          label="Дата старта цикла:"
          type="date"
          value={draft.cycleStart}
          placeholder="дд.мм.гггг"
          icon={<Calendar className="size-4" />}
          onChange={(value) => onChange((prev) => ({ ...prev, cycleStart: value }))}
        />
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Рабочее время:</span>
          <div className="flex gap-2">
            <TimeBox
              label="С"
              value={draft.start}
              onChange={(value) => onChange((prev) => ({ ...prev, start: value }))}
            />
            <TimeBox
              label="До"
              value={draft.end}
              onChange={(value) => onChange((prev) => ({ ...prev, end: value }))}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600"
          type="button"
          onClick={() =>
            onYmChange((prev) =>
              prev.month === 1
                ? { year: prev.year - 1, month: 12 }
                : { ...prev, month: prev.month - 1 },
            )
          }
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="font-semibold text-ink capitalize">
          {MONTH_LABELS[ym.month - 1]} {ym.year}
        </span>
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-600"
          type="button"
          onClick={() =>
            onYmChange((prev) =>
              prev.month === 12
                ? { year: prev.year + 1, month: 1 }
                : { ...prev, month: prev.month + 1 },
            )
          }
        >
          <ChevronRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => onYmChange({ year: todayYear, month: todayMonth })}
          className="ml-auto cursor-pointer text-sm font-semibold text-primary-600"
        >
          Сегодня
        </button>
      </div>
      <CycleCalendar
        draft={draft}
        year={ym.year}
        month={ym.month}
        onToggleDay={(iso) =>
          onChange((prev) => {
            const [year, month, day] = iso.split('-').map(Number);
            const cycle = isCycleWorkday(prev, year!, month!, day!);
            const current = prev.manual[iso] ?? (cycle ? 'work' : 'off');
            const next = current === 'work' ? 'off' : 'work';
            const manual = { ...prev.manual };
            if ((next === 'work') === cycle) delete manual[iso];
            else manual[iso] = next;
            return { ...prev, manual };
          })
        }
      />
    </div>
  );
}

function CycleCalendar({
  draft,
  year,
  month,
  onToggleDay,
}: {
  draft: {
    on: number;
    off: number;
    cycleStart: string;
    manual: Record<string, 'work' | 'off'>;
  };
  year: number;
  month: number;
  onToggleDay: (iso: string) => void;
}) {
  const totalDays = new Date(year, month, 0).getDate();
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: firstWeekday + totalDays }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day > 0 ? day : null;
  });
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="font-semibold text-ink">Расписание</div>
      <div className="mt-1 text-xs text-slate-500">
        Нажмите на день, чтобы сделать его рабочим (норма) или выходным.
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-center">
        {dayNames.map((day) => (
          <div key={day} className="py-1 text-xs font-semibold text-slate-500">
            {day}
          </div>
        ))}
        {cells.map((day, index) =>
          day ? (
            (() => {
              const iso = isoDateLocal(year, month, day);
              const baseWork = isCycleWorkday(draft, year, month, day);
              const work = draft.manual[iso] ? draft.manual[iso] === 'work' : baseWork;
              const manual = Boolean(draft.manual[iso]);
              return (
                <button
                  type="button"
                  key={day}
                  onClick={() => onToggleDay(iso)}
                  className={cn(
                    'flex h-9 cursor-pointer items-center justify-center rounded-md border text-sm font-medium transition-colors',
                    work
                      ? 'border-primary-200 bg-primary-50 text-primary-700'
                      : 'border-slate-200 bg-surface text-slate-500',
                    manual && 'ring-2 ring-primary-600 ring-offset-1',
                  )}
                >
                  {day}
                </button>
              );
            })()
          ) : (
            <span key={`empty-${index}`} />
          ),
        )}
      </div>
    </div>
  );
}

type VacationLedgerRow = {
  year: number;
  norm: number;
  carry: number;
  used: number;
  available: number;
  remaining: number;
};

type VacationRange = {
  from: string;
  to: string;
  days: number;
};

function VacationLedger({ rows, currentYear }: { rows: VacationLedgerRow[]; currentYear: number }) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-3 py-2 font-bold tracking-wide uppercase">Год</th>
            <th className="px-3 py-2 text-right font-bold tracking-wide uppercase">Норма</th>
            <th className="px-3 py-2 text-right font-bold tracking-wide uppercase">Перенос</th>
            <th className="px-3 py-2 text-right font-bold tracking-wide uppercase">Исп.</th>
            <th className="px-3 py-2 text-right font-bold tracking-wide uppercase">Остаток</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            return (
              <tr
                key={row.year}
                className={cn('text-slate-700', row.year === currentYear && 'bg-primary-50')}
              >
                <td className="px-3 py-2 font-mono font-semibold">
                  {row.year}
                  {row.year === currentYear && (
                    <span className="font-sans text-slate-500"> · тек.</span>
                  )}
                  {row.year === currentYear + 1 && (
                    <span className="font-sans text-slate-500"> · план</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">{row.norm}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {row.carry ? `+${row.carry}` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono">{row.used}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-success-700">
                  +{row.remaining}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VacationRangeList({ ranges, year }: { ranges: VacationRange[]; year: number }) {
  return (
    <div className="flex flex-col gap-2">
      {ranges.map((range) => (
        <div
          key={`${range.from}-${range.to}`}
          className="flex items-center gap-3 rounded-md border border-slate-200 bg-surface px-3 py-3 text-sm"
        >
          <span className="size-2 shrink-0 rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-sm font-bold text-ink">
              {formatVacationRange(range.from, range.to, year)}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {range.days} {pluralRu(range.days, 'день', 'дня', 'дней')} ·{' '}
              {vacationRangeStatus(range.from, range.to)}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              toast.info(
                'Удаление отпуска',
                'Демо: удаление появится после подключения метода в API.',
              )
            }
            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
            aria-label="Удалить отпуск"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-md border border-primary-200 bg-primary-50 px-3 py-3 text-[13px] leading-relaxed text-primary-900">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function EmployeePanelSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-36 animate-pulse rounded-lg bg-slate-200/60" />
      <div className="h-56 animate-pulse rounded-lg bg-slate-200/60" />
      <div className="h-44 animate-pulse rounded-lg bg-slate-200/60" />
    </div>
  );
}

function fullYearsSince(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  const today = new Date();
  let years = today.getFullYear() - (year ?? today.getFullYear());
  const monthIndex = (month ?? 1) - 1;
  if (
    today.getMonth() < monthIndex ||
    (today.getMonth() === monthIndex && today.getDate() < (day ?? 1))
  ) {
    years -= 1;
  }
  return Math.max(0, years);
}

function formatHumanDate(iso: string) {
  const [, monthRaw, dayRaw] = iso.split('-').map(Number);
  const monthIndex = Math.max(0, (monthRaw ?? 1) - 1);
  return `${dayRaw ?? 1} ${MONTH_LABELS_GENITIVE[monthIndex]}`;
}

function weekdayFullName(index: number) {
  return (
    ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][index] ?? ''
  );
}

function isCycleWorkday(
  template: { on: number; off: number; cycleStart: string },
  year: number,
  month: number,
  day: number,
) {
  const cycleStart = template.cycleStart || isoDateLocal(year, month, 1);
  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(
    Number(cycleStart.slice(0, 4)),
    Number(cycleStart.slice(5, 7)) - 1,
    Number(cycleStart.slice(8, 10)),
  );
  const diff = Math.floor((current - start) / 86_400_000);
  const cycle = template.on + template.off;
  const position = ((diff % cycle) + cycle) % cycle;
  return position < template.on;
}

function isoDateLocal(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(isoDateLocal(current.getFullYear(), current.getMonth() + 1, current.getDate()));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function buildVacationLedger(
  currentYear: number,
  norm: number,
  vacations: ShiftException[],
): VacationLedgerRow[] {
  const years = [currentYear - 1, currentYear, currentYear + 1];
  let carry = 0;
  return years.map((year) => {
    const used = vacations.filter((item) => item.date.startsWith(`${year}-`)).length;
    const available = norm + carry;
    const remaining = Math.max(0, available - used);
    const row = { year, norm, carry, used, available, remaining };
    carry = remaining;
    return row;
  });
}

function clampVacationNorm(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(60, Math.max(0, Math.round(parsed)));
}

function groupVacationRanges(vacations: ShiftException[]): VacationRange[] {
  const dates = [...new Set(vacations.map((item) => item.date))].sort();
  const ranges: VacationRange[] = [];
  let start: string | null = null;
  let previous: string | null = null;

  dates.forEach((date) => {
    if (!start || !previous) {
      start = date;
      previous = date;
      return;
    }

    if (daysBetween(previous, date) === 1) {
      previous = date;
      return;
    }

    ranges.push({ from: start, to: previous, days: daysBetween(start, previous) + 1 });
    start = date;
    previous = date;
  });

  if (start && previous) {
    ranges.push({ from: start, to: previous, days: daysBetween(start, previous) + 1 });
  }

  return ranges;
}

function daysBetween(from: string, to: string) {
  return Math.round(
    (new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000,
  );
}

function daysInYear(from: string, to: string, year: number) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T00:00:00`).getTime();
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31).getTime();
  if (end < yearStart || start > yearEnd) return 0;
  return Math.round((Math.min(end, yearEnd) - Math.max(start, yearStart)) / 86_400_000) + 1;
}

function formatVacationRange(from: string, to: string, year: number) {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const month = MONTH_LABELS_GENITIVE[Math.max(0, start.month - 1)].slice(0, 3);

  if (from === to) return `${start.day} ${month} ${year}`;
  if (start.month === end.month && start.year === end.year)
    return `${start.day}–${end.day} ${month} ${year}`;

  const endMonth = MONTH_LABELS_GENITIVE[Math.max(0, end.month - 1)].slice(0, 3);
  return `${start.day} ${month} – ${end.day} ${endMonth} ${year}`;
}

function vacationRangeStatus(from: string, to: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (end < today) return 'Завершён';
  if (start <= today && end >= today) return 'Идёт сейчас';
  return 'Запланирован';
}

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  return {
    year: year ?? 0,
    month: month ?? 1,
    day: day ?? 1,
  };
}
