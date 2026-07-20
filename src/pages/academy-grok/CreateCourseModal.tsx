import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { httpAcademyApi } from '@/api/http';
import { queryKeys } from '@/api/queryKeys';
import type { Course, CourseVisibility } from '@/types';
import { Button, Input, Modal, Select, Textarea } from '@/components/ui';
import { toast } from '@/stores/toast';
import { showApiError } from './utils';

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

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setVisibility('restricted');
    setSequential(true);
    setDeadlineDays('');
  }, [open]);

  const createCourse = useMutation({
    mutationFn: httpAcademyApi.createCourse,
    onSuccess: (course) => {
      queryClient.setQueryData<Course[]>(queryKeys.academyGrok.courses, (current = []) => [
        ...current.filter((item) => item.id !== course.id),
        course,
      ]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyGrok.all });
      toast.success('Курс создан');
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
      description="Создайте каркас курса. Разделы и уроки можно доработать в классической Академии — здесь фокус на UX обучения."
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
                title: title.trim(),
                description: description.trim() || undefined,
                visibility,
                sequential,
                deadlineDays: Number(deadlineDays) || undefined,
              })
            }
          >
            Создать
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
          rows={3}
          placeholder="Кому и зачем нужен этот курс"
        />
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Дедлайн, дней"
            type="number"
            min={1}
            value={deadlineDays}
            onChange={(event) => setDeadlineDays(event.target.value)}
            hint="Срок с момента назначения"
          />
          <label className="flex items-center gap-2 self-start pt-7 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sequential}
              onChange={(event) => setSequential(event.target.checked)}
            />
            Последовательное прохождение
          </label>
        </div>
      </div>
    </Modal>
  );
}
