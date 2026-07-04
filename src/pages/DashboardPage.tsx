import { useQuery } from '@tanstack/react-query';
import { GraduationCap, KanbanSquare, Library, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { academyApi, authApi, kbApi, orgApi, tasksApi } from '@/api';
import { PageHeader } from '@/components/layout/PageHeader';

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
    <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-50">
        <Icon className="size-5 text-primary-600" />
      </div>
      <div>
        {loading ? (
          <div className="h-7 w-12 animate-pulse rounded bg-slate-200" />
        ) : (
          <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
        )}
        <p className="text-sm text-slate-500">{title}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });
  const users = useQuery({ queryKey: ['users'], queryFn: orgApi.getUsers });
  const tasks = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getTasks() });
  const articles = useQuery({ queryKey: ['articles'], queryFn: () => kbApi.getArticles() });
  const courses = useQuery({ queryKey: ['courses'], queryFn: academyApi.getCourses });

  const openTasks = tasks.data?.filter((t) => !t.completedAt).length;

  return (
    <div className="p-6">
      <PageHeader
        title={currentUser ? `Добрый день, ${currentUser.firstName}!` : 'Добрый день!'}
        description="Обзор компании: люди, задачи, знания и обучение."
      />
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
    </div>
  );
}
