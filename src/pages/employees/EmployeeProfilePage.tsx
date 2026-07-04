import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ArrowLeft, Briefcase, CalendarDays, GraduationCap, KanbanSquare, Mail, Phone } from 'lucide-react';
import { academyApi, orgApi, tasksApi } from '@/api';
import type { CourseProgressStatus } from '@/types';
import { formatDate, formatRelativeDate } from '@/lib/format';
import {
  fullName,
  priorityLabels,
  priorityVariants,
  roleLabels,
  roleVariants,
  userStatusLabels,
  userStatusVariants,
} from '@/lib/labels';
import { Avatar, Badge, Button } from '@/components/ui';

const progressStatusLabels: Record<CourseProgressStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В процессе',
  completed: 'Завершён',
  overdue: 'Просрочен',
};

const progressStatusVariants: Record<CourseProgressStatus, 'neutral' | 'primary' | 'success' | 'danger'> = {
  not_started: 'neutral',
  in_progress: 'primary',
  completed: 'success',
  overdue: 'danger',
};

function WidgetCard({
  title,
  icon: Icon,
  footnote,
  children,
}: {
  title: string;
  icon: typeof KanbanSquare;
  footnote: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-surface shadow-card">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Icon className="size-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="flex-1 p-4">{children}</div>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">{footnote}</p>
    </div>
  );
}

export function EmployeeProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();

  const userQuery = useQuery({ queryKey: ['users', id], queryFn: () => orgApi.getUser(id) });
  const { data: positions } = useQuery({ queryKey: ['positions'], queryFn: orgApi.getPositions });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: orgApi.getDepartments,
  });
  const { data: tasks } = useQuery({ queryKey: ['tasks'], queryFn: () => tasksApi.getTasks() });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: academyApi.getCourses });
  const { data: progress } = useQuery({
    queryKey: ['courseProgress'],
    queryFn: () => academyApi.getProgress(),
  });

  const user = userQuery.data;
  useTitle(user ? `${fullName(user)} — TeamOS` : 'Сотрудник — TeamOS');

  const userPositions = useMemo(
    () => (positions ?? []).filter((p) => user?.positionIds.includes(p.id)),
    [positions, user],
  );

  const userTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (t) =>
          !t.completedAt &&
          (t.assigneeIds.includes(id) ||
            (t.assigneePositionId && user?.positionIds.includes(t.assigneePositionId))),
      ),
    [tasks, id, user],
  );

  const userProgress = useMemo(() => (progress ?? []).filter((p) => p.userId === id), [progress, id]);

  // Обязательные курсы должностей, к которым сотрудник ещё не приступал.
  const notStartedCourseIds = useMemo(() => {
    const started = new Set(userProgress.map((p) => p.courseId));
    const required = new Set(userPositions.flatMap((p) => p.requiredCourseIds));
    return [...required].filter((courseId) => !started.has(courseId));
  }, [userPositions, userProgress]);

  const courseTitle = (courseId: string) =>
    courses?.find((c) => c.id === courseId)?.title ?? 'Курс';

  if (userQuery.isPending) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <div className="h-32 animate-pulse rounded-lg bg-slate-200/60" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />
          <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />
        </div>
      </div>
    );
  }

  if (userQuery.isError || !user) {
    return (
      <div className="p-6 text-center">
        <p className="mt-10 text-sm text-slate-500">Сотрудник не найден или произошла ошибка.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/employees')}>
          К списку сотрудников
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <button
        onClick={() => navigate('/employees')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="size-4" />
        Все сотрудники
      </button>

      {/* Шапка профиля */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar name={fullName(user)} src={user.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1>{fullName(user)}</h1>
              <Badge variant={roleVariants[user.role]}>{roleLabels[user.role]}</Badge>
              <Badge variant={userStatusVariants[user.status]}>
                {userStatusLabels[user.status]}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-slate-600">
              <span className="flex items-center gap-1.5">
                <Mail className="size-4 text-slate-400" />
                {user.email}
              </span>
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-4 text-slate-400" />
                  {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4 text-slate-400" />В компании с{' '}
                {formatDate(user.createdAt)}
              </span>
            </div>
            {userPositions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {userPositions.map((position) => {
                  const department = departments?.find((d) => d.id === position.departmentId);
                  return (
                    <span
                      key={position.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-surface-muted px-2.5 py-1 text-sm text-slate-700"
                    >
                      <Briefcase className="size-3.5 text-slate-400" />
                      {position.name}
                      {department && <span className="text-slate-400">· {department.name}</span>}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Виджеты: наполнятся функциональностью в этапах 3–4 */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <WidgetCard title="Задачи" icon={KanbanSquare} footnote="Полный таск-трекер — этап 3">
          {userTasks.length === 0 ? (
            <p className="text-sm text-slate-400">Нет открытых задач.</p>
          ) : (
            <div className="space-y-2">
              {userTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{task.title}</p>
                    {task.dueDate && (
                      <p className="text-xs text-slate-400">
                        до {formatRelativeDate(task.dueDate)}
                      </p>
                    )}
                  </div>
                  <Badge variant={priorityVariants[task.priority]}>
                    {priorityLabels[task.priority]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="Обучение" icon={GraduationCap} footnote="Академия — этап 4">
          {userProgress.length === 0 && notStartedCourseIds.length === 0 ? (
            <p className="text-sm text-slate-400">Курсы пока не назначены.</p>
          ) : (
            <div className="space-y-2">
              {userProgress.map((entry) => (
                <div
                  key={entry.courseId}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{courseTitle(entry.courseId)}</p>
                    <p className="text-xs text-slate-400">
                      Пройдено уроков: {entry.completedLessonIds.length}
                    </p>
                  </div>
                  <Badge variant={progressStatusVariants[entry.status]}>
                    {progressStatusLabels[entry.status]}
                  </Badge>
                </div>
              ))}
              {notStartedCourseIds.map((courseId) => (
                <div
                  key={courseId}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{courseTitle(courseId)}</p>
                    <p className="text-xs text-slate-400">Обязательный для должности</p>
                  </div>
                  <Badge variant={progressStatusVariants.not_started}>
                    {progressStatusLabels.not_started}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
