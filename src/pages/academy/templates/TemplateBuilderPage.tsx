import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { academyTemplatesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Textarea } from '@/components/ui';
import { FileStack } from 'lucide-react';
import { academyRoutes } from '@/lib/academy';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';

/** Corporate template metadata builder. Content remains versioned by the backend template draft. */
export function TemplateBuilderPage() {
  const { templateId = '' } = useParams();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dirty, setDirty] = useState(false);
  useTitle('Редактор шаблона — Академия — TeamOS');

  const query = useQuery({
    queryKey: queryKeys.academyV2.template(templateId),
    queryFn: ({ signal }) => academyTemplatesApi.get(templateId, { signal }),
    enabled: Boolean(templateId),
  });
  useEffect(() => {
    if (!query.data) return;
    setTitle(query.data.title);
    setDescription(query.data.description ?? '');
    setDirty(false);
  }, [query.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.template(templateId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.templatesRoot });
  };
  const ensureDraft = useMutation({
    mutationFn: () => academyTemplatesApi.createDraft(templateId, { idempotencyKey: createId() }),
    onSuccess: () => {
      invalidate();
      toast.success('Черновик шаблона создан');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать черновик'),
  });
  const save = useMutation({
    mutationFn: () =>
      academyTemplatesApi.updateDraft(templateId, {
        title: title.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      setDirty(false);
      invalidate();
      toast.success('Шаблон сохранён');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось сохранить шаблон'),
  });
  const publish = useMutation({
    mutationFn: () => academyTemplatesApi.publish(templateId, { idempotencyKey: createId() }),
    onSuccess: () => {
      invalidate();
      toast.success('Новая версия шаблона опубликована');
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось опубликовать шаблон'),
  });

  if (query.isError)
    return (
      <div className="p-6">
        <ErrorState onRetry={() => void query.refetch()} />
      </div>
    );
  if (!query.data)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Загружаем шаблон…
      </div>
    );
  if (!query.data.capabilities.canEdit) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <EmptyState
          icon={FileStack}
          title="Редактирование недоступно"
          description="Системные шаблоны доступны только для просмотра и создания курса."
          action={
            <Link to={academyRoutes.template(templateId)}>
              <Button variant="secondary">К шаблону</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-surface px-4 py-3">
        <div>
          <Link
            className="text-sm text-slate-500 hover:text-primary-700"
            to={academyRoutes.template(templateId)}
          >
            ← К шаблону
          </Link>
          <h1 className="text-lg font-semibold text-slate-950">Редактор корпоративного шаблона</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={Boolean(query.data.draftVersionId)}
            loading={ensureDraft.isPending}
            onClick={() => ensureDraft.mutate()}
          >
            Новый черновик
          </Button>
          <Button
            variant="secondary"
            disabled={!query.data.draftVersionId || !dirty || !title.trim()}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
          <Button
            disabled={!query.data.draftVersionId || dirty}
            loading={publish.isPending}
            onClick={() => publish.mutate()}
          >
            Опубликовать
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        <Input
          label="Название"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setDirty(true);
          }}
        />
        <Textarea
          label="Описание"
          value={description}
          rows={5}
          onChange={(event) => {
            setDescription(event.target.value);
            setDirty(true);
          }}
        />
        <p className="rounded-lg border border-slate-200 bg-surface p-4 text-sm text-slate-600">
          Структура и контент шаблона хранятся в неизменяемых template versions. После создания
          draft backend возвращает редактируемую версию; публикация создаёт следующую неизменяемую
          версию.
        </p>
      </main>
    </div>
  );
}
