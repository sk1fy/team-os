import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { academyCoursesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Drawer, Input, Select, Switch, Textarea } from '@/components/ui';
import { toast } from '@/stores/toast';
import type { AcademyCourseDetail } from '@/types/academy';

export function CourseSettingsDrawer({
  course,
  open,
  onClose,
}: {
  course: AcademyCourseDetail;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: course.title,
    description: course.description ?? '',
    visibility: course.visibility,
    sequential: course.sequential,
    deadlineDays: course.deadlineDays != null ? String(course.deadlineDays) : '',
  });

  useEffect(() => {
    setForm({
      title: course.title,
      description: course.description ?? '',
      visibility: course.visibility,
      sequential: course.sequential,
      deadlineDays: course.deadlineDays != null ? String(course.deadlineDays) : '',
    });
  }, [course]);

  const save = useMutation({
    mutationFn: () =>
      academyCoursesApi.update(course.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        sequential: form.sequential,
        deadlineDays: form.deadlineDays ? Number(form.deadlineDays) : undefined,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.courses() });
      toast.success('Настройки сохранены');
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить'),
  });

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} title="Настройки курса" size="md">
      <div className="space-y-4">
        <Input
          label="Название"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Описание курса"
        />
        <Select
          label="Видимость"
          value={form.visibility}
          onValueChange={(value) =>
            setForm({ ...form, visibility: value as AcademyCourseDetail['visibility'] })
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
          onChange={(e) => setForm({ ...form, deadlineDays: e.target.value })}
          hint="Пусто — без дедлайна. Только для внутренних назначений."
        />
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Последовательное прохождение</p>
            <p className="text-xs text-slate-500">Следующий урок открывается после предыдущего</p>
          </div>
          <Switch
            checked={form.sequential}
            onCheckedChange={(sequential) => setForm({ ...form, sequential })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button
            loading={save.isPending}
            disabled={!form.title.trim()}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
