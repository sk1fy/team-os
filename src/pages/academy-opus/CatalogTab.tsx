/**
 * Каталог курсов Академии Opus.
 *
 * На карточке видно то, что нужно администратору для решения: готовность к
 * публикации, сколько людей назначено и сколько из них дошло до конца.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, PlayCircle, Search, Settings2, UserPlus } from 'lucide-react';
import type { Course, Lesson, User } from '@/types';
import type { LearnerRow } from '@/types/academyOpus';
import { Badge, Button, Input, Select } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { plural } from '@/lib/format';
import { ProgressBar } from './shared';

const statusOptions = [
  { value: 'all', label: 'Все статусы' },
  { value: 'published', label: 'Опубликован' },
  { value: 'draft', label: 'Черновик' },
];

export function CatalogTab({
  courses,
  lessons,
  learnerRows,
  currentUser,
  canEdit,
  onSettings,
  onAssign,
}: {
  courses: Course[];
  lessons: Lesson[];
  learnerRows: LearnerRow[];
  currentUser: User | undefined;
  canEdit: boolean;
  onSettings: (courseId: string) => void;
  onAssign: (courseId: string) => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const stats = useMemo(() => {
    const map = new Map<string, { assigned: number; completed: number; overdue: number }>();
    for (const row of learnerRows) {
      const entry = map.get(row.courseId) ?? { assigned: 0, completed: 0, overdue: 0 };
      entry.assigned += 1;
      if (row.status === 'completed') entry.completed += 1;
      if (row.status === 'overdue') entry.overdue += 1;
      map.set(row.courseId, entry);
    }
    return map;
  }, [learnerRows]);

  const lessonCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const lesson of lessons) map.set(lesson.courseId, (map.get(lesson.courseId) ?? 0) + 1);
    return map;
  }, [lessons]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      if (status !== 'all' && course.status !== status) return false;
      if (!query) return true;
      return `${course.title} ${course.description ?? ''}`.toLowerCase().includes(query);
    });
  }, [courses, search, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Поиск"
          placeholder="Название или описание"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-60 flex-1"
        />
        <Select
          label="Статус"
          className="min-w-44"
          value={status}
          onValueChange={setStatus}
          options={statusOptions}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Курсы не найдены"
          description="Попробуйте изменить поиск или фильтр статуса."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => {
            const total = lessonCount.get(course.id) ?? 0;
            const entry = stats.get(course.id);
            const completionRate =
              entry && entry.assigned > 0 ? Math.round((entry.completed / entry.assigned) * 100) : 0;
            const myProgress = learnerRows.find(
              (row) => row.courseId === course.id && row.userId === currentUser?.id,
            );

            return (
              <article
                key={course.id}
                className="flex flex-col rounded-lg border border-slate-200 bg-surface p-4 shadow-card"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={course.status === 'published' ? 'success' : 'warning'}>
                    {course.status === 'published' ? 'Опубликован' : 'Черновик'}
                  </Badge>
                  {course.sequential && <Badge variant="neutral">Последовательно</Badge>}
                  {total === 0 && (
                    <Badge variant="danger">
                      <AlertTriangle className="size-3" />
                      Без уроков
                    </Badge>
                  )}
                </div>

                <h3 className="text-base font-semibold text-slate-950">{course.title}</h3>
                {course.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{course.description}</p>
                )}

                <p className="mt-2 text-sm text-slate-500">
                  {total} {plural(total, ['урок', 'урока', 'уроков'])}
                  {course.deadlineDays ? ` · дедлайн ${course.deadlineDays} дн.` : ''}
                </p>

                {canEdit && entry && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Прошли {entry.completed} из {entry.assigned}
                      </span>
                      {entry.overdue > 0 && (
                        <span className="font-medium text-danger-600">
                          просрочено {entry.overdue}
                        </span>
                      )}
                    </div>
                    <ProgressBar percent={completionRate} className="mt-1" />
                  </div>
                )}

                {!canEdit && myProgress && (
                  <div className="mt-3">
                    <ProgressBar percent={myProgress.percent} />
                    <p className="mt-1 text-xs text-slate-500">{myProgress.percent}% пройдено</p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/learn-opus/${course.id}`)}
                    disabled={total === 0}
                  >
                    <PlayCircle className="size-4" />
                    Пройти
                  </Button>
                  {canEdit && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onSettings(course.id)}>
                        <Settings2 className="size-4" />
                        Настройки
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onAssign(course.id)}>
                        <UserPlus className="size-4" />
                        Назначить
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {courses.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Курсов пока нет"
          description="Курсы создаются в базовой Академии — Opus работает с теми же данными."
        />
      )}
    </div>
  );
}
