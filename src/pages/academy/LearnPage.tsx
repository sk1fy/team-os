import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Award, Check, ChevronLeft, Lock } from 'lucide-react';
import { academyApi, authApi } from '@/api';
import { ApiError } from '@/api/client';
import type { CourseProgress, ID, Lesson } from '@/types';
import { RichTextView, Button, Badge, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { upsertCourseProgress } from './progressCache';

const emptyLessons: Lesson[] = [];

export function LearnPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const [lessonId, setLessonId] = useState<ID | null>(null);

  const courseQuery = useQuery({
    queryKey: ['academy', 'course', courseId],
    queryFn: () => academyApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const lessonsQuery = useQuery({
    queryKey: ['academy', 'learn', 'lessons', courseId],
    queryFn: () => academyApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });
  const currentUserQuery = useQuery({
    queryKey: ['currentUser'],
    queryFn: authApi.getCurrentUser,
  });
  const progressQuery = useQuery({
    queryKey: ['academy', 'learn', 'progress', courseId],
    queryFn: () => academyApi.getProgress(courseId),
    enabled: Boolean(courseId && currentUserQuery.data),
  });
  const quizzesQuery = useQuery({
    queryKey: ['academy', 'quizzes'],
    queryFn: () => academyApi.getQuizzes(),
  });

  const course = courseQuery.data;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const progress = progressQuery.data?.find((item) => item.userId === currentUserQuery.data?.id);
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const quiz = quizzesQuery.data?.find((item) => item.id === lesson?.quizId);
  const courseNotFound = courseQuery.error instanceof ApiError && courseQuery.error.status === 404;
  const courseUnauthorized = courseQuery.error instanceof ApiError && courseQuery.error.status === 401;
  const courseForbidden = courseQuery.error instanceof ApiError && courseQuery.error.status === 403;

  useTitle(
    course
      ? `${course.title} — TeamOS Learn`
      : courseNotFound
        ? 'Курс не найден — TeamOS Learn'
        : 'TeamOS Learn',
  );

  useEffect(() => {
    if (lessons[0] && !lessonId) setLessonId(lessons[0].id);
  }, [lessonId, lessons]);

  const markComplete = useMutation({
    mutationFn: academyApi.markLessonComplete,
    onSuccess: (updatedProgress) => {
      queryClient.setQueryData<CourseProgress[]>(
        ['academy', 'learn', 'progress', courseId],
        (current) => upsertCourseProgress(current, updatedProgress),
      );
      queryClient.setQueryData<CourseProgress[]>(['academy', 'progress'], (current) =>
        upsertCourseProgress(current, updatedProgress),
      );
      void queryClient.invalidateQueries({
        queryKey: ['academy', 'learn', 'progress', courseId],
      });
    },
    onError: () => undefined,
  });

  if (courseQuery.isPending) {
    return (
      <div className="min-h-dvh bg-surface-muted p-6">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="h-80 animate-pulse rounded-lg bg-slate-200/60" />
          <div className="h-96 animate-pulse rounded-lg bg-slate-200/60" />
        </div>
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-muted p-4 text-center">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-surface p-8 shadow-card">
          <h1 className="text-xl">
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
                  ? 'Обратитесь к владельцу или администратору компании.'
              : 'Проверьте подключение и попробуйте ещё раз.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!courseNotFound && !courseUnauthorized && !courseForbidden && (
              <Button variant="secondary" onClick={() => courseQuery.refetch()}>
                Повторить
              </Button>
            )}
            <Link to="/academy">
              <Button>Вернуться в Академию</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/academy"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
          >
            <ChevronLeft className="size-4" />
            TeamOS Learn
          </Link>
          {course && (
            <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
              {course.status}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
          <h1 className="mb-4 text-lg">{course?.title ?? 'Курс'}</h1>
          <div className="space-y-2">
            {lessons.map((item, index) => {
              const completed = progress?.completedLessonIds.includes(item.id);
              const previousComplete =
                index === 0 || progress?.completedLessonIds.includes(lessons[index - 1]?.id);
              const locked = Boolean(
                currentUserQuery.data && course?.sequential && !previousComplete,
              );
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setLessonId(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm',
                    item.id === lesson?.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-slate-50',
                    locked && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
                  )}
                >
                  {completed ? (
                    <Check className="size-4 text-success-600" />
                  ) : locked ? (
                    <Lock className="size-4" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <article className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
          {lesson && (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2>{lesson.title}</h2>
                  {lesson.sourceMode === 'link' && (
                    <p className="mt-1 text-sm text-slate-500">
                      Материал синхронизирован с базой знаний.
                    </p>
                  )}
                </div>
                {currentUserQuery.data ? (
                  <Button
                    size="sm"
                    variant={
                      progress?.completedLessonIds.includes(lesson.id) ? 'secondary' : 'primary'
                    }
                    disabled={progress?.completedLessonIds.includes(lesson.id)}
                    loading={markComplete.isPending}
                    onClick={() => markComplete.mutate({ courseId, lessonId: lesson.id })}
                  >
                    <Check className="size-4" />
                    {progress?.completedLessonIds.includes(lesson.id)
                      ? 'Урок завершён'
                      : 'Готово'}
                  </Button>
                ) : currentUserQuery.isError && course.visibility === 'public' ? (
                  <Link to="/auth/login">
                    <Button size="sm" variant="secondary">
                      Войти для сохранения прогресса
                    </Button>
                  </Link>
                ) : null}
              </div>
              <RichTextView content={lesson.content} />
              {quiz && (
                <section className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-base font-semibold text-slate-950">Тест</h3>
                  <div className="space-y-3">
                    {quiz.questions.map((question) => (
                      <div key={question.id} className="rounded-md bg-white p-3">
                        <p className="text-sm font-medium text-slate-900">{question.text}</p>
                        {question.type === 'open' ? (
                          <Textarea
                            rows={3}
                            className="mt-2"
                            placeholder="Ответ отправится на ручную проверку"
                          />
                        ) : (
                          <div className="mt-2 space-y-2">
                            {question.options.map((option) => (
                              <label key={option.id} className="flex items-center gap-2 text-sm">
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
            </>
          )}
          {progress?.status === 'completed' && (
            <div className="mt-6 flex items-center gap-2 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-success-700">
              <Award className="size-5" />
              Курс завершён. Сертификат доступен в основном кабинете.
            </div>
          )}
        </article>
      </main>
    </div>
  );
}
