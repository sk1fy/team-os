import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orgApi } from '@/api';
import { academyCoursesApi, type CoursePartnerAudienceKind } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { Button, Drawer, Input, MultiSelect, Select, Switch, Textarea } from '@/components/ui';
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
  const [partnerAudience, setPartnerAudience] = useState<CoursePartnerAudienceKind>('none');
  const [partnerUserIds, setPartnerUserIds] = useState<string[]>([]);
  const managesPartnerAudience = course.ownerType === 'company';

  const partnerAudienceQuery = useQuery({
    queryKey: queryKeys.academyV2.partnerAudience(course.id),
    queryFn: ({ signal }) => academyCoursesApi.getPartnerAudience(course.id, { signal }),
    enabled: open && managesPartnerAudience,
  });
  const usersQuery = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: orgApi.getUsers,
    enabled: open && managesPartnerAudience,
  });
  const partnerOptions = (usersQuery.data ?? [])
    .filter((user) => user.role === 'partner' && user.status !== 'deactivated')
    .map((user) => ({
      value: user.id,
      label: `${user.firstName} ${user.lastName}`.trim() || user.email,
    }));

  useEffect(() => {
    setForm({
      title: course.title,
      description: course.description ?? '',
      visibility: course.visibility,
      sequential: course.sequential,
      deadlineDays: course.deadlineDays != null ? String(course.deadlineDays) : '',
    });
  }, [course]);

  useEffect(() => {
    if (!partnerAudienceQuery.data) return;
    setPartnerAudience(partnerAudienceQuery.data.audience);
    setPartnerUserIds(partnerAudienceQuery.data.partnerUserIds);
  }, [partnerAudienceQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      const updated = await academyCoursesApi.update(course.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        visibility: form.visibility,
        sequential: form.sequential,
        deadlineDays: form.deadlineDays ? Number(form.deadlineDays) : undefined,
      });
      if (managesPartnerAudience) {
        await academyCoursesApi.setPartnerAudience(course.id, {
          audience: partnerAudience,
          partnerUserIds,
        });
      }
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.catalogRoot });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.academyV2.partnerAudience(course.id),
      });
      toast.success('Настройки сохранены');
      onClose();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить'),
  });

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Настройки курса"
      size="md"
    >
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
        {managesPartnerAudience ? (
          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <Select
              label="Доступ партнёров"
              value={partnerAudience}
              disabled={partnerAudienceQuery.isLoading || partnerAudienceQuery.isError}
              onValueChange={(value) => setPartnerAudience(value as CoursePartnerAudienceKind)}
              options={[
                { value: 'none', label: 'Партнёрам недоступен' },
                { value: 'all_partners', label: 'Доступен всем партнёрам' },
                { value: 'selected_partners', label: 'Доступен выбранным партнёрам' },
              ]}
            />
            {partnerAudienceQuery.isError ? (
              <p className="text-xs text-red-600">
                Не удалось загрузить доступ партнёров. Сохранение временно недоступно.
              </p>
            ) : null}
            {partnerAudience === 'selected_partners' ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">Выбранные партнёры</p>
                <MultiSelect
                  options={partnerOptions}
                  values={partnerUserIds}
                  onValuesChange={setPartnerUserIds}
                  placeholder={usersQuery.isLoading ? 'Загружаем партнёров…' : 'Выберите партнёров'}
                  formatCount={(count) => `Выбрано: ${count}`}
                />
                {!usersQuery.isLoading && partnerOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">В компании пока нет активных партнёров.</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
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
            disabled={
              !form.title.trim() ||
              (managesPartnerAudience &&
                (partnerAudienceQuery.isLoading ||
                  partnerAudienceQuery.isError ||
                  (partnerAudience === 'selected_partners' && partnerUserIds.length === 0)))
            }
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
