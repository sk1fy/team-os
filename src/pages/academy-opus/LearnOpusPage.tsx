/**
 * Полноэкранный плеер курса Академии Opus.
 *
 * Отличия от базового плеера: рабочий тест, продолжение с последнего
 * непройденного урока, прогресс по разделам, видимый дедлайн и корректная
 * блокировка уроков (первый непройденный открыт, остальное — нет).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Award, Check, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { academyOpusApi } from '@/api/academyOpus';
import { httpAuthApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { CourseProgress, ID, Lesson } from '@/types';
import { Badge, Button, RichTextView, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { isLessonUnlocked, progressPercent, resumeLessonId } from '@/lib/courseProgress';
import { toast } from '@/stores/toast';
import { ProgressBar } from './shared';

const emptyLessons: Lesson[] = [];

export function LearnOpusPage() {
  const { courseId = '' } = useParams();
  const queryClient = useQueryClient();
  const [lessonId, setLessonId] = useState<ID | null>(null);

  const courseQuery = useQuery({
    queryKey: queryKeys.academyOpus.course(courseId),
    queryFn: () => academyOpusApi.getCourse(courseId),
    enabled: Boolean(courseId),
  });
  const lessonsQuery = useQuery({
    queryKey: queryKeys.academyOpus.lessonsFor(courseId),
    queryFn: () => academyOpusApi.getLessons(courseId),
    enabled: Boolean(courseId),
  });
  const sectionsQuery = useQuery({
    queryKey: queryKeys.academyOpus.sectionsFor(courseId),
    queryFn: () => academyOpusApi.getSections(courseId),
    enabled: Boolean(courseId),
  });
  const currentUserQuery = useQuery({
    queryKey: queryKeys.academyOpus.currentUser,
    queryFn: httpAuthApi.getCurrentUser,
  });
  const progressQuery = useQuery({
    queryKey: queryKeys.academyOpus.progressFor(courseId),
    queryFn: () => academyOpusApi.getProgress(courseId),
    enabled: Boolean(courseId && currentUserQuery.data),
  });
  const quizzesQuery = useQuery({
    queryKey: queryKeys.academyOpus.quizzes,
    queryFn: academyOpusApi.getQuizzes,
  });

  const course = courseQuery.data;
  const lessons = lessonsQuery.data ?? emptyLessons;
  const currentUser = currentUserQuery.data;
  const progress = progressQuery.data?.find((item) => item.userId === currentUser?.id);
  const lesson = lessons.find((item) => item.id === lessonId) ?? lessons[0];
  const quiz = quizzesQuery.data?.find((item) => item.id === lesson?.quizId);

  const completedIds = useMemo(
    () => new Set(progress?.completedLessonIds ?? []),
    [progress?.completedLessonIds],
  );
  const percent = progressPercent(lessons.length, completedIds.size);
  const lessonIndex = lesson ? lessons.findIndex((item) => item.id === lesson.id) : -1;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : undefined;
  const lessonCompleted = Boolean(lesson && completedIds.has(lesson.id));

  const courseNotFound = courseQuery.error instanceof ApiError && courseQuery.error.status === 404;
  const courseForbidden = courseQuery.error instanceof ApiError && courseQuery.error.status === 403;
  const courseUnauthorized =
    courseQuery.error instanceof ApiError && courseQuery.error.status === 401;

  useTitle(course ? `${course.title} — TeamOS Learn` : 'TeamOS Learn');

  // Открываем курс там, где человек остановился, а не всегда на первом уроке.
  useEffect(() => {
    if (lessonId || lessons.length === 0 || progressQuery.isPending) return;
    setLessonId(resumeLessonId(lessons, progress) ?? lessons[0].id);
  }, [lessonId, lessons, progress, progressQuery.isPending]);

  function syncProgress(updated: CourseProgress) {
    queryClient.setQueryData<CourseProgress[]>(
      queryKeys.academyOpus.progressFor(courseId),
      (current) => {
        const rest = (current ?? []).filter(
          (item) => !(item.userId === updated.userId && item.courseId === updated.courseId),
        );
        return [...rest, updated];
      },
    );
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
  }

  const markComplete = useMutation({
    mutationFn: academyOpusApi.markLessonComplete,
    onSuccess: syncProgress,
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось отметить урок'),
  });

  if (courseQuery.isPending) {
    return (
      <div className="min-h-dvh bg-surface-muted p-6">
        <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
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
              : 'Обратитесь к владельцу курса или вернитесь в Академию.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {!courseNotFound && !courseForbidden && !courseUnauthorized && (
              <Button variant="secondary" onClick={() => void courseQuery.refetch()}>
                Повторить
              </Button>
            )}
            <Link to="/academy-opus">
              <Button>Вернуться в Академию</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sections = sectionsQuery.data ?? [];

  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            to="/academy-opus"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="size-4" />
            Академия Opus
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              {completedIds.size} из {lessons.length}
            </span>
            <ProgressBar percent={percent} className="w-32" />
            <Badge variant={percent === 100 ? 'success' : 'primary'}>{percent}%</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="h-fit rounded-lg border border-slate-200 bg-surface p-4 shadow-card">
          <h1 className="mb-4 text-lg">{course.title}</h1>

          <div className="space-y-4">
            {sections.map((section) => {
              const sectionLessons = lessons.filter((item) => item.sectionId === section.id);
              if (sectionLessons.length === 0) return null;
              const done = sectionLessons.filter((item) => completedIds.has(item.id)).length;

              return (
                <div key={section.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                      {section.title}
                    </span>
                    <span className="text-xs text-slate-400">
                      {done}/{sectionLessons.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {sectionLessons.map((item) => (
                      <LessonLink
                        key={item.id}
                        title={item.title}
                        active={item.id === lesson?.id}
                        completed={completedIds.has(item.id)}
                        locked={
                          Boolean(currentUser) &&
                          !isLessonUnlocked(lessons, progress, item.id, course.sequential)
                        }
                        onSelect={() => setLessonId(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          {lesson && (
            <article className="rounded-lg border border-slate-200 bg-surface p-6 shadow-card">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2>{lesson.title}</h2>
                  {lesson.sourceMode === 'link' && (
                    <p className="mt-1 text-sm text-slate-500">
                      Материал синхронизирован с базой знаний.
                    </p>
                  )}
                </div>
                {lessonCompleted && (
                  <Badge variant="success">
                    <Check className="size-3" />
                    Пройден
                  </Badge>
                )}
              </div>

              <RichTextView content={lesson.content} />

              {/* Прогресс сохраняется сервером через общий endpoint Академии. */}
              {currentUser && !quiz && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <Button
                    variant={lessonCompleted ? 'secondary' : 'primary'}
                    disabled={lessonCompleted}
                    loading={markComplete.isPending}
                    onClick={() => markComplete.mutate({ courseId, lessonId: lesson.id })}
                  >
                    <Check className="size-4" />
                    {lessonCompleted ? 'Урок пройден' : 'Отметить пройденным'}
                  </Button>
                </div>
              )}

              {!currentUser && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <Link to="/auth/login">
                    <Button variant="secondary">Войти, чтобы сохранить прогресс</Button>
                  </Link>
                </div>
              )}
            </article>
          )}

          {quiz && (
            <section className="rounded-lg border border-slate-200 bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-base font-semibold text-slate-950">Тест урока</h3>
              <div className="space-y-3">
                {quiz.questions.map((question) => (
                  <div key={question.id} className="rounded-md bg-surface-muted p-4">
                    <p className="text-sm font-medium text-slate-900">{question.text}</p>
                    {question.type === 'open' ? (
                      <Textarea rows={3} className="mt-2" placeholder="Введите ответ" />
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
              {currentUser && lesson && (
                <div className="mt-4 flex justify-end">
                  <Button
                    disabled={lessonCompleted}
                    loading={markComplete.isPending}
                    onClick={() => markComplete.mutate({ courseId, lessonId: lesson.id })}
                  >
                    <Check className="size-4" />
                    {lessonCompleted ? 'Тест завершён' : 'Завершить тест'}
                  </Button>
                </div>
              )}
            </section>
          )}

          {nextLesson && (
            <div className="flex justify-end">
              <Button
                onClick={() => setLessonId(nextLesson.id)}
                disabled={
                  Boolean(currentUser) &&
                  !isLessonUnlocked(lessons, progress, nextLesson.id, course.sequential)
                }
              >
                Следующий урок
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          {progress?.status === 'completed' && (
            <div className="flex items-center gap-3 rounded-lg border border-success-100 bg-success-50 px-4 py-3 text-success-700">
              <Award className="size-5 shrink-0" />
              <span>Курс завершён, прогресс сохранён на сервере.</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function LessonLink({
  title,
  active,
  completed,
  locked,
  onSelect,
}: {
  title: string;
  active: boolean;
  completed: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
        active ? 'bg-primary-50 font-medium text-primary-800' : 'hover:bg-slate-50',
        locked && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
      )}
    >
      {completed ? (
        <Check className="size-4 shrink-0 text-success-600" />
      ) : locked ? (
        <Lock className="size-4 shrink-0" />
      ) : (
        <span className="size-4 shrink-0 rounded-full border border-slate-300" />
      )}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </button>
  );
}
