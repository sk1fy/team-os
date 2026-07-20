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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { GraduationCap } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { authApi, orgApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { ID } from '@/types';
import { Badge, Tabs } from '@/components/ui';
import { ErrorState } from '@/components/layout/ErrorState';
import { canManageContent } from '@/lib/permissions';
import { toast } from '@/stores/toast';
import { CatalogTab } from './CatalogTab';
import { MyLearningTab } from './MyLearningTab';
import { ReportsTab } from './ReportsTab';
import { ReviewTab } from './ReviewTab';
import { AssignDrawer, CertificateDrawer, CourseSettingsDrawer } from './drawers';

export function AcademyOpusPage() {
  useTitle('Академия Opus — TeamOS');
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('learning');
  const [settingsCourseId, setSettingsCourseId] = useState<ID | null>(null);
  const [assignCourseId, setAssignCourseId] = useState<ID | null>(null);
  const [certificateCourseId, setCertificateCourseId] = useState<ID | null>(null);

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
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
  const quizzesQuery = useQuery({
    queryKey: queryKeys.academyOpus.quizzes,
    queryFn: academyOpusApi.getQuizzes,
  });
  const usersQuery = useQuery({ queryKey: queryKeys.users.all, queryFn: orgApi.getUsers });
  const positionsQuery = useQuery({ queryKey: queryKeys.positions, queryFn: orgApi.getPositions });
  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments,
    queryFn: orgApi.getDepartments,
  });

  // Строки отчёта нужны и каталогу — для сводки по каждому курсу.
  const learnerRowsQuery = useQuery({
    queryKey: queryKeys.academyOpus.learnerRows,
    queryFn: academyOpusApi.getLearnerRows,
    enabled: canEdit,
  });
  const reviewQueueQuery = useQuery({
    queryKey: queryKeys.academyOpus.reviewQueue,
    queryFn: academyOpusApi.getReviewQueue,
    enabled: canEdit,
  });

  const syncRequired = useMutation({
    mutationFn: academyOpusApi.syncRequiredAssignments,
    onSuccess: (created) => {
      toast.success(
        created === 0
          ? 'Все обязательные курсы уже назначены'
          : `Создано назначений: ${created}`,
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
  const pendingReviews = reviewQueueQuery.data?.length ?? 0;

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
          onOpenCertificate={setCertificateCourseId}
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
    {
      value: 'review',
      label: pendingReviews > 0 ? `Проверка · ${pendingReviews}` : 'Проверка',
      hideTrigger: !canEdit,
      content: <ReviewTab users={usersQuery.data ?? []} quizzes={quizzesQuery.data ?? []} />,
    },
  ];

  if (coursesQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState onRetry={() => void coursesQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <GraduationCap className="size-7 text-primary-500" />
            Академия Opus
            <Badge variant="primary">эксперимент</Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Альтернативная реализация раздела на тех же курсах: рабочие тесты, отчёт по всем
            назначенным и очередь ручной проверки.
          </p>
        </div>
      </header>

      <Tabs items={items} value={tab} onValueChange={setTab} />

      <CourseSettingsDrawer
        course={courses.find((course) => course.id === settingsCourseId)}
        open={settingsCourseId !== null}
        onClose={() => setSettingsCourseId(null)}
      />
      <AssignDrawer
        course={courses.find((course) => course.id === assignCourseId)}
        users={usersQuery.data ?? []}
        positions={positionsQuery.data ?? []}
        departments={departmentsQuery.data ?? []}
        open={assignCourseId !== null}
        onClose={() => setAssignCourseId(null)}
      />
      <CertificateDrawer
        courseId={certificateCourseId}
        courses={courses}
        user={currentUser}
        open={certificateCourseId !== null}
        onClose={() => setCertificateCourseId(null)}
      />
    </div>
  );
}
