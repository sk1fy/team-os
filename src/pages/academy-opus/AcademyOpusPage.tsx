/**
 * Академия Opus — параллельная реализация раздела Академии.
 *
 * Работает с теми же курсами и уроками, что и базовая Академия, но иначе
 * расставляет акценты: сверху «Моё обучение» (что делать сотруднику),
 * затем каталог, отчёт по всем назначенным и очередь ручной проверки.
 *
 * Страница остаётся тонкой сборкой: каждая вкладка — свой файл.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { GraduationCap, Plus } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { httpAuthApi, httpOrgApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { ID } from '@/types';
import { Badge, Button, Tabs } from '@/components/ui';
import { ErrorState } from '@/components/layout/ErrorState';
import { canManageContent } from '@/lib/permissions';
import { toast } from '@/stores/toast';
import { CatalogTab } from './CatalogTab';
import { CreateCourseModal } from './CreateCourseModal';
import { MyLearningTab } from './MyLearningTab';
import { ReportsTab } from './ReportsTab';
import { AssignDrawer, CourseSettingsDrawer } from './drawers';

export function AcademyOpusPage() {
  useTitle('Академия Opus — TeamOS');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [tab, setTab] = useState('learning');
  const [settingsCourseId, setSettingsCourseId] = useState<ID | null>(null);
  const [assignCourseId, setAssignCourseId] = useState<ID | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const currentUserQuery = useQuery({
    queryKey: queryKeys.academyOpus.currentUser,
    queryFn: httpAuthApi.getCurrentUser,
  });
  const currentUser = currentUserQuery.data;
  const canEdit = canManageContent(currentUser?.role);

  const coursesQuery = useQuery({
    queryKey: queryKeys.academyOpus.courses,
    queryFn: academyOpusApi.getCourses,
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academyOpus.lessons,
    queryFn: () => academyOpusApi.getLessons(),
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academyOpus.progress,
    queryFn: () => academyOpusApi.getProgress(),
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.academyOpus.users,
    queryFn: httpOrgApi.getUsers,
  });
  const positionsQuery = useQuery({
    queryKey: queryKeys.academyOpus.positions,
    queryFn: httpOrgApi.getPositions,
  });
  const departmentsQuery = useQuery({
    queryKey: queryKeys.academyOpus.departments,
    queryFn: httpOrgApi.getDepartments,
  });

  // Строки отчёта нужны и каталогу — для сводки по каждому курсу.
  const learnerRowsQuery = useQuery({
    queryKey: queryKeys.academyOpus.learnerRows,
    queryFn: academyOpusApi.getLearnerRows,
    enabled: canEdit,
  });
  const syncRequired = useMutation({
    mutationFn: academyOpusApi.syncRequiredAssignments,
    onSuccess: (created) => {
      toast.success(
        created === 0 ? 'Все обязательные курсы уже назначены' : `Создано назначений: ${created}`,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось досоздать назначения'),
  });

  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data]);
  const progress = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const learnerRows = useMemo(() => learnerRowsQuery.data ?? [], [learnerRowsQuery.data]);
  const items = [
    {
      value: 'learning',
      label: 'Моё обучение',
      content: (
        <MyLearningTab
          courses={courses}
          lessons={lessons}
          progress={progress}
          currentUser={currentUser}
        />
      ),
    },
    {
      value: 'catalog',
      label: 'Каталог',
      content: (
        <CatalogTab
          courses={courses}
          lessons={lessons}
          learnerRows={learnerRows}
          currentUser={currentUser}
          canEdit={canEdit}
          onSettings={setSettingsCourseId}
          onAssign={setAssignCourseId}
          onCreate={() => setCreateOpen(true)}
        />
      ),
    },
    {
      value: 'reports',
      label: 'Отчёты',
      hideTrigger: !canEdit,
      content: (
        <ReportsTab
          courses={courses}
          users={usersQuery.data ?? []}
          positions={positionsQuery.data ?? []}
          departments={departmentsQuery.data ?? []}
          onSyncRequired={() => syncRequired.mutate()}
          syncing={syncRequired.isPending}
        />
      ),
    },
  ];

  if (coursesQuery.isError) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <ErrorState onRetry={() => void coursesQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <GraduationCap className="size-7 text-primary-500" />
            Академия Opus
            <Badge variant="primary">эксперимент</Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Альтернативная реализация раздела на серверных данных: фокус на назначениях, прохождении
            и подробной отчётности.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => {
              setTab('catalog');
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            Новый курс
          </Button>
        )}
      </header>

      <Tabs items={items} value={tab} onValueChange={setTab} />

      <CourseSettingsDrawer
        course={courses.find((course) => course.id === settingsCourseId)}
        open={settingsCourseId !== null}
        onClose={() => setSettingsCourseId(null)}
      />
      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(course) => {
          setCreateOpen(false);
          navigate(`/academy-opus/${course.id}/builder`);
        }}
      />
      <AssignDrawer
        course={courses.find((course) => course.id === assignCourseId)}
        users={usersQuery.data ?? []}
        positions={positionsQuery.data ?? []}
        departments={departmentsQuery.data ?? []}
        open={assignCourseId !== null}
        onClose={() => setAssignCourseId(null)}
      />
    </div>
  );
}
