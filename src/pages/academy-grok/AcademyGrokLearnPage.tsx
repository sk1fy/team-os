import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { academyApi, authApi } from '@/api';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import type { CourseProgress, ID, Lesson } from '@/types';
import { Badge, Button, RichTextView, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { plural } from '@/lib/format';
import { toast } from '@/stores/toast';
import { upsertCourseProgress } from '@/pages/academy/progressCache';
import { ProgressBar } from './components/ProgressBar';
import {
  isLessonLocked,
  orderLessons,
  progressPercent,
  showApiError,
  userProgressFor,
} from './utils';

const emptyLessons: Lesson[] = [];
const emptySections: never[] = [];

/**
 * Полноэкранный course player (Thinkific/Teachable style):
 * curriculum sidebar + progress + complete & continue.
 */
export function AcademyGrokLearnPage() {
  const { courseId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const lessonFromUrl = searchParams.get('lesson');
  const [lessonId, setLessonId] = useState<ID | null>(lessonFromUrl);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
    queryKey: queryKeys.academy.learnLessons(courseId),
    queryFn: () => academyApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });
  const currentUserQuery = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.getCurrentUser,
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academy.learnProgress(courseId),
    queryFn: () => academyApi.getProgress(courseId),
    enabled: Boolean(courseId && currentUserQuery.data),
  });
  const quizzesQuery = useQuery({
    queryKey: queryKeys.academy.quizzes,
    queryFn: () => academyApi.getQuizzes(),
  });

  const course = courseQuery.data;
  const sections = sectionsQuery.data ?? emptySections;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const ordered = useMemo(() => orderLessons(lessons, sections), [lessons, sections]);
  const progress = userProgressFor(
    progressQuery.data ?? [],
    currentUserQuery.data?.id,
    courseId,
  );
  const lesson =
    ordered.find((item) => item.id === lessonId) ??
    ordered.find((item) => item.id === lessonFromUrl) ??
    ordered[0];
  const quiz = quizzesQuery.data?.find((item) => item.id === lesson?.quizId);
  const lessonIndex = lesson ? ordered.findIndex((item) => item.id === lesson.id) : -1;
  const prevLesson = lessonIndex > 0 ? ordered[lessonIndex - 1] : undefined;
  const nextLesson = lessonIndex >= 0 ? ordered[lessonIndex + 1] : undefined;
  const lessonCompleted = Boolean(lesson && progress?.completedLessonIds.includes(lesson.id));
  const percent = progressPercent(ordered, progress);
  const courseNotFound = courseQuery.error instanceof ApiError && courseQuery.error.status === 404;
  const courseUnauthorized =
    courseQuery.error instanceof ApiError && courseQuery.error.status === 401;
  const courseForbidden = courseQuery.error instanceof ApiError && courseQuery.error.status === 403;

  useTitle(course ? `${course.title} — TeamOS Learn Grok` : 'TeamOS Learn Grok');

  useEffect(() => {
    if (!lesson) return;
    if (lessonId !== lesson.id) setLessonId(lesson.id);
    if (searchParams.get('lesson') !== lesson.id) {
      setSearchParams({ lesson: lesson.id }, { replace: true });
    }
  }, [lesson, lessonId, searchParams, setSearchParams]);

  const selectLesson = (id: ID) => {
    setLessonId(id);
    setSearchParams({ lesson: id }, { replace: true });
  };

  const markComplete = useMutation({
    mutationFn: academyApi.markLessonComplete,
    onSuccess: (updatedProgress) => {
      queryClient.setQueryData<CourseProgress[]>(
        queryKeys.academy.learnProgress(courseId),
        (current) => upsertCourseProgress(current, updatedProgress),
      );
      queryClient.setQueryData<CourseProgress[]>(queryKeys.academy.progress, (current) =>
        upsertCourseProgress(current, updatedProgress),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.academy.learnProgress(courseId) });
      toast.success(
        updatedProgress.status === 'completed' ? 'Курс завершён! 🎉' : 'Урок отмечен как пройденный',
      );
      if (updatedProgress.status !== 'completed' && nextLesson) {
        selectLesson(nextLesson.id);
      }
    },
    onError: (error) => toast.error(showApiError(error)),
  });

  if (courseQuery.isPending) {
    return (
      <div className="min-h-dvh bg-slate-950/5 p-6">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="h-96 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-[28rem] animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-4 text-center">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-surface p-8 shadow-card">
          <h1 className="text-xl font-semibold">
            {courseNotFound
              ? 'Курс не найден'
              : courseUnauthorized
                ? 'Войдите, чтобы открыть курс'
                : courseForbidden
                  ? 'Курс вам не назначен'
                  : 'Не удалось загрузить курс'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {courseNotFound
              ? 'Возможно, курс удалён или ссылка устарела.'
              : courseUnauthorized
                ? 'Этот курс доступен только зарегистрированным сотрудникам.'
                : courseForbidden
                  ? 'Обратитесь к администратору компании.'
                  : 'Проверьте подключение и попробуйте ещё раз.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to="/academy-grok">
              <Button>В Академию Grok</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f8]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label="Программа курса"
          >
            <List className="size-5" />
          </button>
          <button
            type="button"
            className="hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:inline-flex"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Скрыть программу' : 'Показать программу'}
          >
            {sidebarOpen ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
          </button>

          <Link
            to={`/academy-grok/courses/${course.id}`}
            className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800 hover:text-primary-700"
          >
            {course.title}
          </Link>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-xs font-medium text-slate-500">{percent}%</span>
            <ProgressBar value={percent} className="w-28" size="sm" />
          </div>

          <Link
            to="/academy-grok"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Закрыть плеер"
          >
            <X className="size-5" />
          </Link>
        </div>
        <div className="px-4 pb-2 sm:hidden">
          <ProgressBar value={percent} size="sm" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0 lg:gap-4 lg:px-4 lg:py-4">
        {/* Curriculum sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 w-72 overflow-y-auto border-r border-slate-200 bg-surface pt-14 shadow-lg transition-transform lg:static lg:z-0 lg:w-72 lg:shrink-0 lg:rounded-xl lg:border lg:pt-0 lg:shadow-card',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden',
          )}
        >
          <div className="border-b border-slate-100 p-4">
            <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Программа
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {ordered.length} {plural(ordered.length, ['урок', 'урока', 'уроков'])}
            </p>
          </div>
          <div className="space-y-4 p-3">
            {(sections.length > 0
              ? sections
              : [{ id: '_', title: 'Уроки', order: 0, courseId }]
            ).map((section) => {
              const sectionLessons =
                section.id === '_'
                  ? ordered
                  : ordered.filter((item) => item.sectionId === section.id);
              if (sectionLessons.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {sectionLessons.map((item) => {
                      const completed = progress?.completedLessonIds.includes(item.id);
                      const locked = isLessonLocked(item, ordered, course.sequential, progress);
                      const active = item.id === lesson?.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={locked}
                          onClick={() => {
                            selectLesson(item.id);
                            if (window.matchMedia('(max-width: 1023px)').matches) {
                              setSidebarOpen(false);
                            }
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                            active && 'bg-primary-50 font-semibold text-primary-800',
                            !active && !locked && 'text-slate-700 hover:bg-slate-50',
                            locked && 'cursor-not-allowed text-slate-300',
                          )}
                        >
                          {completed ? (
                            <Check className="size-4 shrink-0 text-success-600" />
                          ) : locked ? (
                            <Lock className="size-4 shrink-0" />
                          ) : (
                            <span className="size-4 shrink-0 rounded-full border border-slate-300" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-slate-950/30 lg:hidden"
            aria-label="Закрыть меню"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Lesson content */}
        <main className="min-w-0 flex-1 px-4 py-4 lg:px-0 lg:py-0">
          <article className="rounded-xl border border-slate-200 bg-surface p-5 shadow-card sm:p-8">
            {lesson ? (
              <>
                <div className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Урок {lessonIndex + 1} из {ordered.length}
                  {quiz ? ' · с тестом' : ''}
                </div>
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                      {lesson.title}
                    </h1>
                    {lesson.sourceMode === 'link' && (
                      <p className="mt-1 text-sm text-slate-500">
                        Материал синхронизирован с базой знаний.
                      </p>
                    )}
                  </div>
                  {lessonCompleted && (
                    <Badge variant="success">
                      <Check className="size-3.5" />
                      Пройден
                    </Badge>
                  )}
                </div>

                <RichTextView content={lesson.content} />

                {quiz && (
                  <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-base font-semibold text-slate-950">Контрольный тест</h2>
                      <p className="text-xs text-slate-500">
                        Проходной балл {quiz.passingScore}%
                        {quiz.maxAttempts ? ` · до ${quiz.maxAttempts} попыток` : ''}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {quiz.questions.map((question, qIndex) => (
                        <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
                          <p className="text-sm font-medium text-slate-900">
                            {qIndex + 1}. {question.text}
                          </p>
                          {question.type === 'open' ? (
                            <Textarea
                              rows={3}
                              className="mt-3"
                              placeholder="Ответ отправится на ручную проверку"
                            />
                          ) : (
                            <div className="mt-3 space-y-2">
                              {question.options.map((option) => (
                                <label
                                  key={option.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                                >
                                  <input
                                    type={question.type === 'single' ? 'radio' : 'checkbox'}
                                    name={question.id}
                                  />
                                  {option.text}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Complete & continue footer — Thinkific pattern */}
                <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <Button
                    variant="ghost"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && selectLesson(prevLesson.id)}
                  >
                    <ChevronLeft className="size-4" />
                    Назад
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentUserQuery.data && (
                      <Button
                        variant={lessonCompleted ? 'secondary' : 'primary'}
                        disabled={lessonCompleted}
                        loading={markComplete.isPending}
                        onClick={() =>
                          markComplete.mutate({ courseId, lessonId: lesson.id })
                        }
                      >
                        <Check className="size-4" />
                        {lessonCompleted
                          ? 'Урок завершён'
                          : quiz
                            ? 'Завершить тест'
                            : 'Завершить и далее'}
                      </Button>
                    )}
                    {currentUserQuery.isError && course.visibility === 'public' && (
                      <Link to="/auth/login">
                        <Button variant="secondary">Войти для сохранения прогресса</Button>
                      </Link>
                    )}
                    {nextLesson && lessonCompleted && (
                      <Button onClick={() => selectLesson(nextLesson.id)}>
                        Далее
                        <ChevronRight className="size-4" />
                      </Button>
                    )}
                    {!nextLesson && progress?.status === 'completed' && (
                      <Link to={`/academy-grok/courses/${course.id}`}>
                        <Button variant="secondary">
                          <Award className="size-4" />
                          К карточке курса
                        </Button>
                      </Link>
                    )}
                  </div>
                </footer>

                {progress?.status === 'completed' && (
                  <div className="mt-6 flex items-center gap-2 rounded-xl border border-success-100 bg-success-50 px-4 py-3 text-success-800">
                    <Award className="size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Курс завершён</p>
                      <p className="text-sm text-success-700">
                        Отличная работа — можно вернуться к материалам в любой момент.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-slate-500">В курсе пока нет уроков.</div>
            )}
          </article>

          <p className="mt-3 text-center text-xs text-slate-400">
            <Link to="/academy-grok" className="hover:text-primary-600">
              Академия Grok
            </Link>
            {' · '}
            альтернативный плеер для сравнения UX
          </p>
        </main>
      </div>
    </div>
  );
}
