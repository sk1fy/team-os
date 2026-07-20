/**
 * Создание курса в Академии Grok.
 *
 * Можно сразу задать план текстом (# раздел + строки-уроки) — структура
 * соберётся при создании, и курс откроется в конструкторе с готовым каркасом.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpAcademyApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import type { Course, CourseVisibility } from '@/types';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui';
import { outlineStats, parseCourseOutline, type OutlineSection } from '@/lib/courseOutline';
import { plural } from '@/lib/format';
import { toast } from '@/stores/toast';
import { showApiError } from './utils';

const outlinePlaceholder = `# Введение
Что такое TeamOS
Роли и права доступа

# Практика
Первые шаги в системе
Частые ошибки`;

async function createCourseWithOutline(input: {
  course: {
    title: string;
    description?: string;
    visibility: CourseVisibility;
    sequential: boolean;
    deadlineDays?: number;
  };
  outline: OutlineSection[];
}): Promise<Course> {
  const course = await httpAcademyApi.createCourse(input.course);
  for (const section of input.outline) {
    const created = await httpAcademyApi.createCourseSection({
      courseId: course.id,
      title: section.title,
    });
    for (const lessonTitle of section.lessons) {
      await httpAcademyApi.createLesson({
        courseId: course.id,
        sectionId: created.id,
        title: lessonTitle,
      });
    }
  }
  return course;
}

export function CreateCourseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (course: Course) => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CourseVisibility>('restricted');
  const [sequential, setSequential] = useState(true);
  const [deadlineDays, setDeadlineDays] = useState('');
  const [outlineText, setOutlineText] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setVisibility('restricted');
    setSequential(true);
    setDeadlineDays('');
    setOutlineText('');
  }, [open]);

  const outline = useMemo(() => parseCourseOutline(outlineText), [outlineText]);
  const stats = outlineStats(outline);

  const createCourse = useMutation({
    mutationFn: createCourseWithOutline,
    onSuccess: (course) => {
      queryClient.setQueryData<Course[]>(queryKeys.academyGrok.courses, (current = []) => [
        ...current.filter((item) => item.id !== course.id),
        course,
      ]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyGrok.all });
      toast.success(
        stats.lessons > 0
          ? `Курс создан · ${stats.lessons} ${plural(stats.lessons, ['урок', 'урока', 'уроков'])}`
          : 'Курс создан',
      );
      onCreated(course);
    },
    onError: (error) => toast.error(showApiError(error)),
  });

  const canSubmit = Boolean(title.trim()) && !createCourse.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Новый курс"
      description="Создайте каркас курса. План можно вставить текстом — разделы и уроки соберутся сами, содержимое доработаете в конструкторе."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={createCourse.isPending}
            disabled={!canSubmit}
            onClick={() =>
              title.trim() &&
              createCourse.mutate({
                course: {
                  title: title.trim(),
                  description: description.trim() || undefined,
                  visibility,
                  sequential,
                  deadlineDays: Number(deadlineDays) || undefined,
                },
                outline,
              })
            }
          >
            {stats.lessons > 0
              ? `Создать · ${stats.lessons} ${plural(stats.lessons, ['урок', 'урока', 'уроков'])}`
              : 'Создать курс'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Например: Онбординг новичка"
          autoFocus
        />
        <Textarea
          label="Описание"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          placeholder="Кому и зачем нужен этот курс"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Видимость"
            value={visibility}
            onValueChange={(value) => setVisibility(value as CourseVisibility)}
            options={[
              { value: 'restricted', label: 'Только по назначению' },
              { value: 'company', label: 'Вся компания' },
              { value: 'public', label: 'Публичный по ссылке' },
            ]}
          />
          <Input
            label="Дедлайн, дней"
            type="number"
            min={1}
            value={deadlineDays}
            onChange={(event) => setDeadlineDays(event.target.value)}
            hint="Срок с момента назначения"
          />
        </div>
        <Checkbox
          checked={sequential}
          onCheckedChange={setSequential}
          label="Последовательное прохождение"
        />

        <div>
          <Textarea
            label="План курса (необязательно)"
            rows={7}
            placeholder={outlinePlaceholder}
            value={outlineText}
            onChange={(event) => setOutlineText(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Строка с # — раздел, остальные строки — уроки. Без плана курс создастся пустым.
          </p>
          {stats.sections > 0 && (
            <div className="mt-3 rounded-lg border border-primary-100 bg-primary-50/60 p-3">
              <p className="mb-2 text-xs font-semibold text-primary-800">
                {stats.sections} {plural(stats.sections, ['раздел', 'раздела', 'разделов'])} ·{' '}
                {stats.lessons} {plural(stats.lessons, ['урок', 'урока', 'уроков'])}
              </p>
              <ul className="space-y-1.5">
                {outline.map((section, index) => (
                  <li key={index}>
                    <p className="text-sm font-medium text-slate-900">{section.title}</p>
                    {section.lessons.length > 0 && (
                      <p className="text-xs text-slate-500">{section.lessons.join(' · ')}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
