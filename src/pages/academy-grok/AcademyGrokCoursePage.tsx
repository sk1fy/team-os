import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Lock,
  Play,
  Send,
  UsersRound,
} from 'lucide-react';
import { academyApi, authApi, orgApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { Badge, Button, Modal, Select } from '@/components/ui';
import { canManageContent } from '@/lib/permissions';
import { formatDate, formatRelativeDate, plural } from '@/lib/format';
import { fullName } from '@/lib/labels';
import { toast } from '@/stores/toast';
import { AcademyGrokNav } from './components/AcademyGrokNav';
import { ProgressBar } from './components/ProgressBar';
import {
  courseCoverClass,
  firstIncompleteLesson,
  isLessonLocked,
  orderLessons,
  progressPercent,
  progressStatusLabels,
  progressStatusVariants,
  showApiError,
  statusLabels,
  userProgressFor,
  visibilityLabels,
} from './utils';
import type { AssigneeType, Lesson } from '@/types';

const emptyLessons: Lesson[] = [];
const emptySections: never[] = [];
const emptyProgress: never[] = [];
const emptyAssignments: never[] = [];

export function AcademyGrokCoursePage() {
  const { courseId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('user');
  const [assigneeId, setAssigneeId] = useState('');

  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const courseQuery = useQuery({
    queryKey: queryKeys.academy.course(courseId),
    queryFn: () => academyApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const sectionsQuery = useQuery({
    queryKey: queryKeys.academy.sectionsFor(courseId),
    queryFn: () => academyApi.getCourseSections(courseId),
    enabled: Boolean(courseId),
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academy.lessonsFor(courseId),
    queryFn: () => academyApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academy.progress,
    queryFn: () => academyApi.getProgress(),
  });
  const assignmentsQuery = useQuery({
    queryKey: queryKeys.academy.assignments,
    queryFn: academyApi.getAssignments,
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: orgApi.getUsers,
    enabled: canManageContent(currentUserQuery.data?.role),
  });
  const positionsQuery = useQuery({
    queryKey: queryKeys.positions,
    queryFn: orgApi.getPositions,
    enabled: canManageContent(currentUserQuery.data?.role),
  });
  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments,
    queryFn: orgApi.getDepartments,
    enabled: canManageContent(currentUserQuery.data?.role),
  });

  const course = courseQuery.data;
  const currentUser = currentUserQuery.data;
  const canManage = canManageContent(currentUser?.role);
  const lessons = lessonsQuery.data ?? emptyLessons;
  const sections = sectionsQuery.data ?? emptySections;
  const progressList = progressQuery.data ?? emptyProgress;
  const assignments = (assignmentsQuery.data ?? emptyAssignments).filter(
    (item) => item.courseId === courseId,
  );
  const myProgress = userProgressFor(progressList, currentUser?.id, courseId);
  const ordered = useMemo(() => orderLessons(lessons, sections), [lessons, sections]);
  const percent = progressPercent(ordered, myProgress);
  const resumeLesson = firstIncompleteLesson(ordered, myProgress);

  useTitle(course ? `${course.title} — Академия Grok` : 'Курс — Академия Grok');

  const updateStatus = useMutation({
    mutationFn: academyApi.updateCourse,
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.academy.course(courseId), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy.courses });
      toast.success(
        updated.status === 'published' ? 'Курс опубликован' : 'Курс переведён в черновики',
      );
    },
    onError: (error) => toast.error(showApiError(error)),
  });

  const assign = useMutation({
    mutationFn: academyApi.assignCourse,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy.assignments });
      setAssignOpen(false);
      toast.success('Курс назначен');
    },
    onError: (error) => toast.error(showApiError(error)),
  });

  if (courseQuery.isPending) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <div className="h-10 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-56 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          icon={BookOpen}
          title="Курс не найден"
          description="Возможно, курс удалён или у вас нет доступа."
          action={
            <Link to="/academy-grok">
              <Button>К моему обучению</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const assigneeOptions =
    assigneeType === 'user'
      ? (usersQuery.data ?? []).map((user) => ({
          value: user.id,
          label: fullName(user),
        }))
      : assigneeType === 'position'
        ? (positionsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }))
        : (departmentsQuery.data ?? []).map((item) => ({ value: item.id, label: item.name }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <PageHeader
        title={course.title}
        description="Программа курса, прогресс и запуск обучения."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/academy-grok/catalog')}>
              <ArrowLeft className="size-4" />
              Каталог
            </Button>
            {ordered.length > 0 && course.status === 'published' && (
              <Link to={`/learn-grok/${course.id}${resumeLesson ? `?lesson=${resumeLesson.id}` : ''}`}>
                <Button>
                  <Play className="size-4" />
                  {percent > 0 && percent < 100 ? 'Продолжить' : percent >= 100 ? 'Повторить' : 'Начать'}
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <AcademyGrokNav canManage={canManage} />

      {/* Hero */}
      <section
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br p-6 text-white sm:p-8 ${courseCoverClass(course.id)}`}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge
                variant={course.status === 'published' ? 'success' : 'warning'}
                className="bg-white/90"
              >
                {statusLabels[course.status]}
              </Badge>
              <Badge variant="neutral" className="bg-white/90">
                {visibilityLabels[course.visibility]}
              </Badge>
              {course.sequential && (
                <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs font-medium">
                  По шагам
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h2>
            {course.description && (
              <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{course.description}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
              <span>
                {ordered.length} {plural(ordered.length, ['урок', 'урока', 'уроков'])}
              </span>
              <span>
                {sections.length} {plural(sections.length, ['раздел', 'раздела', 'разделов'])}
              </span>
              {course.deadlineDays ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-4" />
                  {course.deadlineDays} дн. на прохождение
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/20 bg-white/15 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-white/80">Ваш прогресс</p>
            <p className="mt-1 text-3xl font-bold">{percent}%</p>
            <ProgressBar
              value={percent}
              className="mt-3 bg-white/25"
              barClassName="bg-white"
              size="lg"
            />
            {myProgress && (
              <Badge className="mt-3 bg-white/90" variant={progressStatusVariants[myProgress.status]}>
                {progressStatusLabels[myProgress.status]}
              </Badge>
            )}
            {myProgress?.status === 'completed' && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-white">
                <Award className="size-4" />
                Курс завершён
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Curriculum — Moodle/Thinkific style outline */}
        <section className="rounded-xl border border-slate-200 bg-surface shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-950">Программа курса</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Разделы и уроки в порядке прохождения
            </p>
          </div>
          {ordered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={BookOpen}
                title="Уроков пока нет"
                description={
                  canManage
                    ? 'Добавьте разделы и уроки в классической Академии — контент общий.'
                    : 'Автор ещё наполняет курс.'
                }
                action={
                  canManage ? (
                    <Link to={`/academy/${course.id}`}>
                      <Button variant="secondary" size="sm">
                        Открыть конструктор
                        <ExternalLink className="size-4" />
                      </Button>
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(sections.length > 0 ? sections : [{ id: '_', title: 'Уроки', order: 0, courseId }]).map(
                (section) => {
                  const sectionLessons =
                    section.id === '_'
                      ? ordered
                      : ordered.filter((lesson) => lesson.sectionId === section.id);
                  if (sectionLessons.length === 0) return null;
                  return (
                    <div key={section.id} className="px-5 py-4">
                      <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                        {section.title}
                      </h4>
                      <ul className="space-y-1">
                        {sectionLessons.map((lesson, index) => {
                          const completed = myProgress?.completedLessonIds.includes(lesson.id);
                          const locked = isLessonLocked(
                            lesson,
                            ordered,
                            course.sequential,
                            myProgress,
                          );
                          const globalIndex = ordered.findIndex((item) => item.id === lesson.id) + 1;
                          return (
                            <li key={lesson.id}>
                              {locked ? (
                                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300">
                                  <Lock className="size-4 shrink-0" />
                                  <span className="min-w-0 flex-1 truncate text-sm">
                                    {globalIndex || index + 1}. {lesson.title}
                                  </span>
                                </div>
                              ) : (
                                <Link
                                  to={`/learn-grok/${course.id}?lesson=${lesson.id}`}
                                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-800 transition-colors hover:bg-primary-50 hover:text-primary-800"
                                >
                                  {completed ? (
                                    <Check className="size-4 shrink-0 text-success-600" />
                                  ) : (
                                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                                      {globalIndex || index + 1}
                                    </span>
                                  )}
                                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                                    {lesson.title}
                                  </span>
                                  {lesson.sourceArticleId && (
                                    <BookOpen className="size-3.5 shrink-0 text-slate-400" />
                                  )}
                                  <ChevronRight className="size-4 shrink-0 text-slate-300" />
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </section>

        {/* Side panels */}
        <aside className="space-y-4">
          {canManage && (
            <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-card">
              <h3 className="text-sm font-semibold text-slate-950">Управление</h3>
              <p className="mt-1 text-xs text-slate-500">
                Контент редактируется в общей Академии; здесь — публикация и назначения.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={updateStatus.isPending}
                  onClick={() =>
                    updateStatus.mutate({
                      id: course.id,
                      status: course.status === 'published' ? 'draft' : 'published',
                    })
                  }
                >
                  {course.status === 'published' ? 'В черновик' : 'Опубликовать'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={course.status !== 'published'}
                  onClick={() => setAssignOpen(true)}
                >
                  <Send className="size-4" />
                  Назначить
                </Button>
                <Link to={`/academy/${course.id}`}>
                  <Button size="sm" variant="ghost" className="w-full">
                    Конструктор (классика)
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <UsersRound className="size-4 text-slate-400" />
              Назначения
            </div>
            {assignments.length === 0 ? (
              <p className="text-sm text-slate-400">Курс пока никому не назначен.</p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="rounded-md border border-slate-100 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-slate-800">
                      {assignment.assigneeType === 'external'
                        ? 'Внешний партнёр'
                        : assignment.assigneeType === 'user'
                          ? (usersQuery.data?.find((u) => u.id === assignment.assigneeId)
                            ? fullName(
                                usersQuery.data.find((u) => u.id === assignment.assigneeId)!,
                              )
                            : 'Сотрудник')
                          : assignment.assigneeType === 'position'
                            ? (positionsQuery.data?.find((p) => p.id === assignment.assigneeId)
                                ?.name ?? 'Должность')
                            : (departmentsQuery.data?.find((d) => d.id === assignment.assigneeId)
                                ?.name ?? 'Отдел')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRelativeDate(assignment.createdAt)}
                      {assignment.dueDate ? ` · до ${formatDate(assignment.dueDate)}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {canManage && (
        <Modal
          open={assignOpen}
          onOpenChange={(next) => !next && setAssignOpen(false)}
          title="Назначить курс"
          description="Выберите, кому открыть доступ к курсу."
          footer={
            <>
              <Button variant="secondary" onClick={() => setAssignOpen(false)}>
                Отмена
              </Button>
              <Button
                loading={assign.isPending}
                disabled={!assigneeId}
                onClick={() =>
                  assign.mutate({
                    courseId: course.id,
                    assigneeType,
                    assigneeId,
                  })
                }
              >
                Назначить
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Select
              label="Кому"
              value={assigneeType}
              onValueChange={(value) => {
                setAssigneeType(value as AssigneeType);
                setAssigneeId('');
              }}
              options={[
                { value: 'user', label: 'Сотрудник' },
                { value: 'position', label: 'Должность' },
                { value: 'department', label: 'Отдел' },
              ]}
            />
            <Select
              label="Выбор"
              value={assigneeId}
              onValueChange={setAssigneeId}
              options={assigneeOptions}
              placeholder="Выберите…"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
