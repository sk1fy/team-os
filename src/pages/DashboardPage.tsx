import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Building2,
  Check,
  Clock3,
  GraduationCap,
  KanbanSquare,
  Library,
  Plus,
  ShieldAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { academyApi, authApi, kbApi, notificationsApi, orgApi, tasksApi } from '@/api';
import type { Task } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button } from '@/components/ui';
import { ErrorState } from '@/components/layout/ErrorState';
import { formatRelativeDate, plural } from '@/lib/format';
import { priorityLabels, priorityVariants } from '@/lib/labels';
import { cn } from '@/lib/cn';

function isOverdue(task: Task, now: number) {
  return Boolean(task.dueDate && !task.completedAt && new Date(task.dueDate).getTime() < now);
}

function isDueSoon(task: Task, now: number) {
  if (!task.dueDate || task.completedAt) return false;
  const due = new Date(task.dueDate).getTime();
  return due >= now && due <= now + 7 * 86_400_000;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  loading,
}: {
  title: string;
  value: number | string | undefined;
  detail: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'primary' | 'warning' | 'danger' | 'success';
  loading?: boolean;
}) {
  const toneClasses = {
    neutral: 'bg-slate-100 text-slate-600',
    primary: 'bg-primary-50 text-primary-600',
    warning: 'bg-warning-50 text-warning-700',
    danger: 'bg-danger-50 text-danger-600',
    success: 'bg-success-50 text-success-700',
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className={cn('flex size-10 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="size-5" />
        </div>
        {loading ? (
          <div className="h-7 w-14 animate-pulse rounded bg-slate-200" />
        ) : (
          <div className="font-mono text-2xl font-extrabold tracking-[-0.4px] text-ink">
            {value ?? '—'}
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{detail}</div>
      </div>
    </div>
  );
}

function AttentionCard({
  title,
  value,
  detail,
  to,
  icon: Icon,
  tone,
  loading,
  error,
}: {
  title: string;
  value: number;
  detail: string;
  to: string;
  icon: LucideIcon;
  tone: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  error?: boolean;
}) {
  const toneClasses = {
    danger: 'border-danger-100 bg-danger-50/55 text-danger-700 hover:border-danger-200',
    warning: 'border-warning-100 bg-warning-50/70 text-warning-700 hover:border-warning-200',
    primary: 'border-primary-100 bg-primary-50/70 text-primary-700 hover:border-primary-200',
  };

  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-28 flex-col rounded-lg border p-4 text-left transition-colors',
        toneClasses[tone],
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon className="size-5" />
        {loading ? (
          <div className="h-7 w-14 animate-pulse rounded bg-current/20" />
        ) : (
          <span className="font-mono text-2xl font-extrabold">{error ? '—' : value}</span>
        )}
      </div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5 opacity-80">{detail}</div>
    </Link>
  );
}

function QuickAction({
  label,
  description,
  to,
  icon: Icon,
}: {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-surface px-4 py-3 text-left shadow-card transition-colors hover:border-primary-200 hover:bg-primary-50/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900">{label}</span>
        <span className="block truncate text-xs text-slate-500">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-slate-300" />
    </Link>
  );
}

function TaskFocusList({ tasks, now }: { tasks: Task[]; now: number }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Ближайшие задачи</h2>
          <p className="mt-1 text-sm text-slate-500">Просроченные и дедлайны на 7 дней.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/tasks')}>
          Открыть
        </Button>
      </div>
      <div className="divide-y divide-slate-100">
        {tasks.length === 0 ? (
          <div className="px-5 py-8 text-sm text-slate-400">Нет срочных задач на ближайшую неделю.</div>
        ) : (
          tasks.map((task) => (
            <Link
              key={task.id}
              to="/tasks"
              className="flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{task.title}</span>
                <span
                  className={cn(
                    'mt-1 inline-flex items-center gap-1 text-xs',
                    isOverdue(task, now) ? 'font-semibold text-danger-600' : 'text-slate-500',
                  )}
                >
                  <Clock3 className="size-3.5" />
                  {task.dueDate ? formatRelativeDate(task.dueDate) : 'без срока'}
                </span>
              </span>
              <Badge variant={priorityVariants[task.priority]}>{priorityLabels[task.priority]}</Badge>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function TeamHealth({
  activeUsers,
  invitedUsers,
  usersWithoutPosition,
  vacantPositions,
  departmentsCount,
}: {
  activeUsers: number;
  invitedUsers: number;
  usersWithoutPosition: number;
  vacantPositions: number;
  departmentsCount: number;
}) {
  const rows = [
    { label: 'Активные сотрудники', value: activeUsers, tone: 'success' as const },
    { label: 'Ожидают активации', value: invitedUsers, tone: invitedUsers > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Без должности', value: usersWithoutPosition, tone: usersWithoutPosition > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Вакантные должности', value: vacantPositions, tone: vacantPositions > 0 ? ('warning' as const) : ('neutral' as const) },
    { label: 'Отделы', value: departmentsCount, tone: 'neutral' as const },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Состояние команды</h2>
        <p className="mt-1 text-sm text-slate-500">Структура, пользователи и незакрытые позиции.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm text-slate-600">{row.label}</span>
            <Badge variant={row.tone}>{row.value}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function OnboardingChecklist({
  steps,
  progress,
}: {
  steps: Array<{
    key: string;
    title: string;
    description: string;
    done: boolean;
    to: string;
    icon: LucideIcon;
  }>;
  progress: number;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-950">Настройка рабочего пространства</h2>
            <Badge variant={progress === 100 ? 'success' : 'primary'}>{progress}%</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">Минимальный маршрут для запуска TeamOS.</p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-success-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link
              key={step.key}
              to={step.to}
              className="bg-surface p-4 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg',
                    step.done ? 'bg-success-100' : 'bg-primary-50',
                  )}
                >
                  {step.done ? (
                    <Check className="size-4.5 text-success-700" />
                  ) : (
                    <Icon className="size-4.5 text-primary-600" />
                  )}
                </div>
                <Badge variant={step.done ? 'success' : 'neutral'}>
                  {step.done ? 'Готово' : 'Шаг'}
                </Badge>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const departments = useQuery({ queryKey: ['departments'], queryFn: orgApi.getDepartments });
  const positions = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getTasks() });
  const articles = useQuery({ queryKey: ['articles'], queryFn: () => kbApi.getArticles() });
  const courses = useQuery({ queryKey: ['courses'], queryFn: academyApi.getCourses });
  const courseProgress = useQuery({
    queryKey: ['courseProgress'],
    queryFn: () => academyApi.getProgress(),
  });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
  });

  const { openTasks, overdueTasks, dueSoonTasks, tasksWithoutAssignee, focusTasks, now } = useMemo(() => {
    const currentNow = Date.now();
    const allTasks = tasks.data ?? [];
    const open = allTasks.filter((task) => !task.completedAt);
    const overdue = open.filter((task) => isOverdue(task, currentNow));
    const dueSoon = open.filter((task) => isDueSoon(task, currentNow));
    const withoutAssignee = open.filter(
      (task) => task.assigneeIds.length === 0 && !task.assigneePositionId,
    );
    const focus = [...overdue, ...dueSoon]
      .filter((task, index, list) => list.findIndex((item) => item.id === task.id) === index)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 5);

    return {
      openTasks: open,
      overdueTasks: overdue,
      dueSoonTasks: dueSoon,
      tasksWithoutAssignee: withoutAssignee,
      focusTasks: focus,
      now: currentNow,
    };
  }, [tasks.data]);

  const allUsers = users.data ?? [];
  const activeUsers = allUsers.filter((user) => user.status === 'active').length;
  const invitedUsers = allUsers.filter((user) => user.status === 'invited').length;
  const usersWithoutPosition = allUsers.filter((user) => user.positionIds.length === 0).length;
  const occupiedPositionIds = new Set(allUsers.flatMap((user) => user.positionIds));
  const vacantPositions =
    positions.data?.filter((position) => !occupiedPositionIds.has(position.id)).length ?? 0;
  const publishedArticles = articles.data?.filter((article) => article.status === 'published').length ?? 0;
  const publishedCourses = courses.data?.filter((course) => course.status === 'published').length ?? 0;
  const inProgressCourses =
    courseProgress.data?.filter((progress) => progress.status === 'in_progress').length ?? 0;
  const unreadNotifications = notifications.data?.filter((notification) => !notification.read).length ?? 0;
  const articlesRequiringAck =
    articles.data?.filter(
      (article) => article.requiresAcknowledgement && article.status === 'published',
    ).length ?? 0;

  const hasError =
    users.isError ||
    departments.isError ||
    positions.isError ||
    tasks.isError ||
    articles.isError ||
    courses.isError ||
    courseProgress.isError ||
    notifications.isError;

  const onboardingSteps = useMemo(
    () => [
      {
        key: 'structure',
        title: 'Создать отдел',
        description: 'Оргструктура станет основой доступов, задач и обучения.',
        done: (departments.data?.length ?? 0) > 1,
        to: '/employees',
        icon: Building2,
      },
      {
        key: 'people',
        title: 'Добавить пользователей',
        description: 'Создайте локальных пользователей или синхронизируйте команду из CRM.',
        done: (users.data?.length ?? 0) > 1,
        to: '/employees',
        icon: UserPlus,
      },
      {
        key: 'article',
        title: 'Первая статья',
        description: 'Зафиксируйте регламент или инструкцию в базе знаний.',
        done: (articles.data?.length ?? 0) > 0,
        to: '/knowledge',
        icon: Library,
      },
      {
        key: 'course',
        title: 'Первый курс',
        description: 'Соберите обучение из уроков, тестов и статей БЗ.',
        done: (courses.data?.length ?? 0) > 0,
        to: '/academy',
        icon: GraduationCap,
      },
    ],
    [articles.data?.length, courses.data?.length, departments.data?.length, users.data?.length],
  );

  const onboardingProgress = Math.round(
    (onboardingSteps.filter((step) => step.done).length / onboardingSteps.length) * 100,
  );

  const isLoadingDashboard =
    tasks.isPending ||
    notifications.isPending ||
    users.isPending ||
    articles.isPending ||
    courses.isPending ||
    courseProgress.isPending;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title={currentUser ? `Добрый день, ${currentUser.firstName}!` : 'Добрый день!'}
        description="Операционная сводка: риски, задачи, команда и база знаний."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/tasks')}>
              <KanbanSquare className="size-4" />
              Задачи
            </Button>
            <Button onClick={() => navigate('/employees')}>
              <UserPlus className="size-4" />
              Сотрудники
            </Button>
          </>
        }
      />

      {hasError && (
        <div className="mt-6">
          <ErrorState
            title="Часть данных не загрузилась"
            description="Мок-API иногда имитирует сетевые сбои. Остальная сводка остаётся доступной."
            onRetry={() => {
              users.refetch();
              departments.refetch();
              positions.refetch();
              tasks.refetch();
              articles.refetch();
              courses.refetch();
              courseProgress.refetch();
              notifications.refetch();
            }}
          />
        </div>
      )}

      <div className="mt-6">
        {isLoadingDashboard && (
          <p className="mb-3 text-xs text-slate-400">Обновляем данные…</p>
        )}
        <div className="grid gap-4 lg:grid-cols-3">
          <AttentionCard
            title="Просроченные задачи"
            value={overdueTasks.length}
            detail="Нужно вернуть в срок или пересогласовать дедлайн."
            to="/tasks"
            icon={ShieldAlert}
            tone={overdueTasks.length > 0 ? 'danger' : 'primary'}
            loading={tasks.isPending}
            error={tasks.isError}
          />
          <AttentionCard
            title="Без исполнителя"
            value={tasksWithoutAssignee.length}
            detail="Открытые задачи, которые не закреплены за человеком или должностью."
            to="/tasks"
            icon={AlertTriangle}
            tone={tasksWithoutAssignee.length > 0 ? 'warning' : 'primary'}
            loading={tasks.isPending}
            error={tasks.isError}
          />
          <AttentionCard
            title="Новые уведомления"
            value={unreadNotifications}
            detail="Комментарии, дедлайны и события, которые ждут реакции."
            to="/notifications"
            icon={BookOpenCheck}
            tone={unreadNotifications > 0 ? 'warning' : 'primary'}
            loading={notifications.isPending}
            error={notifications.isError}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Активные сотрудники"
          value={activeUsers}
          detail={`${invitedUsers} ${plural(invitedUsers, ['пользователь', 'пользователя', 'пользователей'])} ожидает активации`}
          icon={Users}
          tone="primary"
          loading={users.isPending}
        />
        <MetricCard
          title="Открытые задачи"
          value={openTasks.length}
          detail={`${dueSoonTasks.length} ${plural(dueSoonTasks.length, ['дедлайн', 'дедлайна', 'дедлайнов'])} на 7 дней`}
          icon={KanbanSquare}
          tone={overdueTasks.length > 0 ? 'danger' : 'neutral'}
          loading={tasks.isPending}
        />
        <MetricCard
          title="Знания"
          value={publishedArticles}
          detail={`${articlesRequiringAck} ${plural(articlesRequiringAck, ['статья требует', 'статьи требуют', 'статей требуют'])} ознакомления`}
          icon={Library}
          tone="neutral"
          loading={articles.isPending}
        />
        <MetricCard
          title="Обучение"
          value={publishedCourses}
          detail={`${inProgressCourses} ${plural(inProgressCourses, ['сотрудник учится', 'сотрудника учатся', 'сотрудников учатся'])}`}
          icon={GraduationCap}
          tone="neutral"
          loading={courses.isPending || courseProgress.isPending}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <TaskFocusList tasks={focusTasks} now={now} />
        <TeamHealth
          activeUsers={activeUsers}
          invitedUsers={invitedUsers}
          usersWithoutPosition={usersWithoutPosition}
          vacantPositions={vacantPositions}
          departmentsCount={departments.data?.length ?? 0}
        />
      </div>

      <section className="mt-4">
        <h2 className="mb-3 text-base font-semibold text-slate-950">Быстрые действия</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            label="Добавить пользователя"
            description="Открыть список людей"
            to="/employees"
            icon={UserPlus}
          />
          <QuickAction
            label="Проверить график"
            description="Смены и отсутствия"
            to="/schedule"
            icon={Clock3}
          />
          <QuickAction
            label="Создать задачу"
            description="Канбан и дедлайны"
            to="/tasks"
            icon={Plus}
          />
          <QuickAction
            label="Открыть БЗ"
            description="Регламенты и статьи"
            to="/knowledge"
            icon={Library}
          />
        </div>
      </section>

      {onboardingProgress < 100 && (
        <div className="mt-6">
          <OnboardingChecklist steps={onboardingSteps} progress={onboardingProgress} />
        </div>
      )}
    </div>
  );
}
