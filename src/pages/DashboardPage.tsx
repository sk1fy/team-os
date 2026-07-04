import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  GraduationCap,
  KanbanSquare,
  Library,
  Send,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { academyApi, authApi, kbApi, orgApi, tasksApi } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Badge } from '@/components/ui';
import { ErrorState } from '@/components/layout/ErrorState';
import { cn } from '@/lib/cn';

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | undefined;
  icon: LucideIcon;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
      <div className="flex size-13 shrink-0 items-center justify-center rounded-[14px] bg-primary-50">
        <Icon className="size-5.5 text-primary-600" />
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-12 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="text-3xl font-extrabold tracking-[-1px] text-ink">{value ?? '—'}</p>
        )}
        <p className="text-[13px] text-slate-500">{title}</p>
      </div>
    </div>
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
  const navigate = useNavigate();

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">Запуск рабочего пространства</h2>
            <Badge variant={progress === 100 ? 'success' : 'primary'}>{progress}%</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Базовый маршрут: структура, люди, первая статья и первый курс.
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-success-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => navigate(step.to)}
              className="bg-surface p-5 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg',
                    step.done ? 'bg-success-100' : 'bg-primary-50',
                  )}
                >
                  {step.done ? (
                    <Check className="size-5 text-success-700" />
                  ) : (
                    <Icon className="size-5 text-primary-600" />
                  )}
                </div>
                <Badge variant={step.done ? 'success' : 'neutral'}>
                  {step.done ? 'Готово' : 'Шаг'}
                </Badge>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-950">{step.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{step.description}</p>
            </button>
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
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getTasks() });
  const articles = useQuery({ queryKey: ['articles'], queryFn: () => kbApi.getArticles() });
  const courses = useQuery({ queryKey: ['courses'], queryFn: academyApi.getCourses });

  const openTasks = tasks.data?.filter((t) => !t.completedAt).length;
  const hasError =
    users.isError || departments.isError || tasks.isError || articles.isError || courses.isError;

  const onboardingSteps = useMemo(
    () => [
      {
        key: 'structure',
        title: 'Создать отдел',
        description: 'Оргструктура станет основой доступов, задач и обучения.',
        done: (departments.data?.length ?? 0) > 1,
        to: '/structure',
        icon: Building2,
      },
      {
        key: 'people',
        title: 'Пригласить людей',
        description: 'Добавьте команду или отправьте приглашение по ссылке.',
        done: (users.data?.length ?? 0) > 1,
        to: '/employees',
        icon: Send,
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

  return (
    <div className="p-6">
      <PageHeader
        title={currentUser ? `Добрый день, ${currentUser.firstName}!` : 'Добрый день!'}
        description="Обзор компании: люди, задачи, знания и обучение."
        actions={
          <Button variant="secondary" onClick={() => navigate('/knowledge')}>
            <Library className="size-4" />
            Открыть БЗ
          </Button>
        }
      />
      {hasError && (
        <div className="mt-6">
          <ErrorState
            title="Часть данных не загрузилась"
            description="Мок-API иногда имитирует сетевые сбои. Запросы можно повторить."
            onRetry={() => {
              users.refetch();
              departments.refetch();
              tasks.refetch();
              articles.refetch();
              courses.refetch();
            }}
          />
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Сотрудников"
          value={users.data?.length}
          icon={Users}
          loading={users.isPending}
        />
        <StatCard title="Открытых задач" value={openTasks} icon={KanbanSquare} loading={tasks.isPending} />
        <StatCard
          title="Статей в базе знаний"
          value={articles.data?.length}
          icon={Library}
          loading={articles.isPending}
        />
        <StatCard
          title="Курсов в академии"
          value={courses.data?.length}
          icon={GraduationCap}
          loading={courses.isPending}
        />
      </div>
      <OnboardingChecklist steps={onboardingSteps} progress={onboardingProgress} />
    </div>
  );
}
