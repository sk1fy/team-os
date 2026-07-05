import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Pencil } from 'lucide-react';
import { academyApi, orgApi, tasksApi } from '@/api';
import type { ID } from '@/types';
import { fullName } from '@/lib/labels';
import { Button, Drawer } from '@/components/ui';
import { EmployeeEditModal } from './EmployeeEditModal';
import { EmployeeLearningWidget } from './EmployeeLearningWidget';
import { EmployeeProfileHeader } from './EmployeeProfileHeader';
import { EmployeeTasksWidget } from './EmployeeTasksWidget';

export function EmployeeDrawer({
  userId,
  onClose,
}: {
  userId: ID | null;
  onClose: () => void;
}) {
  const open = Boolean(userId);
  const [editOpen, setEditOpen] = useState(false);

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
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getTasks(),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['courses'],
    queryFn: academyApi.getCourses,
  });
  const { data: progress = [] } = useQuery({
    queryKey: ['courseProgress'],
    queryFn: () => academyApi.getProgress(),
  });

  const user = userQuery.data;

  const userPositions = useMemo(
    () => positions.filter((position) => user?.positionIds.includes(position.id)),
    [positions, user],
  );

  const userTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !task.completedAt &&
          userId &&
          (task.assigneeIds.includes(userId) ||
            (task.assigneePositionId && user?.positionIds.includes(task.assigneePositionId))),
      ),
    [tasks, userId, user],
  );

  const userProgress = useMemo(
    () => progress.filter((entry) => entry.userId === userId),
    [progress, userId],
  );

  const notStartedCourseIds = useMemo(() => {
    const started = new Set(userProgress.map((entry) => entry.courseId));
    const required = new Set(userPositions.flatMap((position) => position.requiredCourseIds));
    return [...required].filter((courseId) => !started.has(courseId));
  }, [userPositions, userProgress]);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(next) => !next && onClose()}
        title={user ? fullName(user) : 'Сотрудник'}
        description={user ? user.email : undefined}
        size="xl"
        footer={
          user && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Редактировать
              </Button>
              <Link
                to={`/employees/${user.id}`}
                onClick={onClose}
                className="inline-flex h-9.5 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-200 bg-surface px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-primary-200 hover:text-primary-600"
              >
                <ExternalLink className="size-4" />
                Открыть профиль
              </Link>
              <Button variant="ghost" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          )
        }
      >
        {userQuery.isPending && (
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-lg bg-slate-200/60" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />
              <div className="h-48 animate-pulse rounded-lg bg-slate-200/60" />
            </div>
          </div>
        )}

        {(userQuery.isError || (!userQuery.isPending && !user)) && (
          <p className="py-10 text-center text-sm text-slate-500">
            Сотрудник не найден или произошла ошибка.
          </p>
        )}

        {user && (
          <div className="space-y-4">
            <EmployeeProfileHeader
              user={user}
              positions={positions}
              departments={departments}
              headingLevel="h2"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <EmployeeTasksWidget tasks={userTasks} />
              <EmployeeLearningWidget
                progress={userProgress}
                notStartedCourseIds={notStartedCourseIds}
                courses={courses}
              />
            </div>
          </div>
        )}
      </Drawer>

      <EmployeeEditModal user={user ?? null} open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}