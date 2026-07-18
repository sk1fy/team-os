import { queryKeys } from '@/api/queryKeys';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { ArrowLeft, Pencil } from 'lucide-react';
import { academyApi, orgApi, tasksApi } from '@/api';
import { fullName } from '@/lib/labels';
import { Button } from '@/components/ui';
import { EmployeeEditModal } from './EmployeeEditModal';
import { EmployeeLearningWidget } from './EmployeeLearningWidget';
import { EmployeeProfileHeader } from './EmployeeProfileHeader';
import { EmployeeTasksWidget } from './EmployeeTasksWidget';

export function EmployeeProfilePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const userQuery = useQuery({
    queryKey: queryKeys.users.byId(id),
    queryFn: () => orgApi.getUser(id),
  });
  const { data: positions = [] } = useQuery({
    queryKey: queryKeys.positions,
    queryFn: orgApi.getPositions,
  });
  const { data: departments = [] } = useQuery({
    queryKey: queryKeys.departments,
    queryFn: orgApi.getDepartments,
  });
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasks.all,
    queryFn: () => tasksApi.getTasks(),
  });
  const { data: courses = [] } = useQuery({
    queryKey: queryKeys.academy.courses,
    queryFn: academyApi.getCourses,
  });
  const { data: progress = [] } = useQuery({
    queryKey: queryKeys.academy.progress,
    queryFn: () => academyApi.getProgress(),
  });

  const user = userQuery.data;
  useTitle(user ? `${fullName(user)} — TeamOS` : 'Сотрудник — TeamOS');

  const userPositions = useMemo(
    () => positions.filter((p) => user?.positionIds.includes(p.id)),
    [positions, user],
  );

  const userTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.completedAt &&
          (t.assigneeIds.includes(id) ||
            (t.assigneePositionId && user?.positionIds.includes(t.assigneePositionId))),
      ),
    [tasks, id, user],
  );

  const userProgress = useMemo(() => progress.filter((p) => p.userId === id), [progress, id]);

  const notStartedCourseIds = useMemo(() => {
    const started = new Set(userProgress.map((p) => p.courseId));
    const required = new Set(userPositions.flatMap((p) => p.requiredCourseIds));
    return [...required].filter((courseId) => !started.has(courseId));
  }, [userPositions, userProgress]);

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

      <div className="mt-4">
        <EmployeeProfileHeader
          user={user}
          positions={positions}
          departments={departments}
          actions={
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Редактировать
            </Button>
          }
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <EmployeeTasksWidget tasks={userTasks} footnote="Полный таск-трекер — этап 3" />
        <EmployeeLearningWidget
          progress={userProgress}
          notStartedCourseIds={notStartedCourseIds}
          courses={courses}
          footnote="Академия — этап 4"
        />
      </div>

      <EmployeeEditModal user={user} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  );
}
