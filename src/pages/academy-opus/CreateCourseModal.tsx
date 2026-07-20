/**
 * Создание курса в Академии Opus.
 *
 * Отличие от базовой Академии: структура задаётся текстовым планом прямо
 * при создании, поэтому курс сразу открывается в конструкторе с готовыми
 * разделами и уроками — остаётся только наполнить их содержимым.
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { academyOpusApi } from '@/api/academyOpus';
import { queryKeys } from '@/api/queryKeys';
import { ApiError } from '@/api/client';
import type { Course } from '@/types';
import { Button, Checkbox, Input, Modal, Select, Textarea } from '@/components/ui';
import { outlineStats, parseCourseOutline } from '@/lib/courseOutline';
import { plural } from '@/lib/format';
import { toast } from '@/stores/toast';

const outlinePlaceholder = `# Введение
Что такое TeamOS
Роли и права доступа

# Работа с задачами
Доска и колонки
Жизненный цикл задачи`;

const emptyForm = {
  title: '',
  description: '',
  visibility: 'restricted' as Course['visibility'],
  deadlineDays: '',
  sequential: true,
  outline: '',
};

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
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) setForm(emptyForm);
  }, [open]);

  const outline = useMemo(() => parseCourseOutline(form.outline), [form.outline]);
  const stats = outlineStats(outline);

  const create = useMutation({
    mutationFn: academyOpusApi.createCourseWithOutline,
    onSuccess: (course) => {
      toast.success('Курс создан');
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyOpus.all });
      onCreated(course);
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать курс'),
  });

  const title = form.title.trim();

  const submit = () => {
    if (!title || create.isPending) return;
    create.mutate({
      course: {
        title,
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        sequential: form.sequential,
        deadlineDays: Number(form.deadlineDays) || undefined,
      },
      outline,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Новый курс"
      description="Опишите курс и, если план уже есть, вставьте его текстом — структура соберётся сама."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={create.isPending} disabled={!title} onClick={submit}>
            {stats.lessons > 0
              ? `Создать курс · ${stats.lessons} ${plural(stats.lessons, ['урок', 'урока', 'уроков'])}`
              : 'Создать курс'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название"
          placeholder="Например: Онбординг менеджера"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <Textarea
          label="Описание"
          rows={2}
          placeholder="Для кого курс и чему он учит"
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Видимость"
            value={form.visibility}
            onValueChange={(value) =>
              setForm({ ...form, visibility: value as Course['visibility'] })
            }
            options={[
              { value: 'restricted', label: 'По назначению' },
              { value: 'company', label: 'Вся компания' },
              { value: 'public', label: 'Публичный' },
            ]}
          />
          <Input
            label="Дедлайн, дней с момента назначения"
            type="number"
            min={0}
            value={form.deadlineDays}
            onChange={(event) => setForm({ ...form, deadlineDays: event.target.value })}
            hint="Пусто — без дедлайна."
          />
        </div>

        <Checkbox
          checked={form.sequential}
          onCheckedChange={(checked) => setForm({ ...form, sequential: checked })}
          label="Последовательное прохождение"
        />

        <div>
          <Textarea
            label="План курса (необязательно)"
            rows={8}
            placeholder={outlinePlaceholder}
            value={form.outline}
            onChange={(event) => setForm({ ...form, outline: event.target.value })}
          />
          <p className="mt-1 text-xs text-slate-500">
            Строка с # — раздел, остальные строки — уроки. Без плана курс создастся пустым.
          </p>
          {stats.sections > 0 && (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">
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
