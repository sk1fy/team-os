import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { FileStack, Plus } from 'lucide-react';
import { academyCoursesApi, academyTemplatesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input, Modal, Textarea } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { createId } from '@/lib/id';
import { toast } from '@/stores/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { waitForInstantiatedDraft } from './templateInstantiation';

export function AcademyTemplatesPage() {
  useTitle('Шаблоны — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  const filters = useMemo(
    () => ({ q: debouncedQ || undefined, page, pageSize: 50 }),
    [debouncedQ, page],
  );
  const templatesQuery = useQuery({
    queryKey: queryKeys.academyV2.templates(filters),
    queryFn: ({ signal }) => academyTemplatesApi.list(filters, { signal }),
  });

  const instantiate = useMutation({
    mutationFn: async (input: { templateVersionId: string; expectedLessonCount?: number }) => {
      const result = await academyTemplatesApi.instantiateDetailed(
        input.templateVersionId,
        {},
        { idempotencyKey: createId() },
      );
      return {
        ...result,
        draft: await waitForInstantiatedDraft({
          initialDraft: result.draft,
          expectedLessonCount: input.expectedLessonCount,
          loadDraft: () => academyCoursesApi.getDraft(result.course.id),
        }),
      };
    },
    onSuccess: ({ course, draft }) => {
      queryClient.setQueryData(queryKeys.academyV2.course(course.id), course);
      queryClient.setQueryData(queryKeys.academyV2.draft(course.id), draft);
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан из шаблона');
      navigate(academyRoutes.builder(course.id));
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : 'Не удалось создать курс из шаблона'),
  });
  const createTemplate = useMutation({
    mutationFn: () =>
      academyTemplatesApi.create(
        {
          title: createTitle.trim(),
          description: createDescription.trim() || undefined,
          sequential: true,
          content: { sections: [] },
        },
        { idempotencyKey: createId() },
      ),
    onSuccess: ({ summary }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.templatesRoot });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      toast.success('Корпоративный шаблон создан');
      navigate(academyRoutes.templateBuilder(summary.id));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : 'Не удалось создать шаблон'),
  });

  const items = useMemo(() => {
    const serverItems = templatesQuery.data?.items ?? [];
    const normalizedQuery = debouncedQ.trim().toLocaleLowerCase('ru');
    if (!normalizedQuery) return serverItems;
    return serverItems.filter((template) =>
      `${template.title} ${template.description ?? ''}`
        .toLocaleLowerCase('ru')
        .includes(normalizedQuery),
    );
  }, [debouncedQ, templatesQuery.data?.items]);
  const groups = [
    {
      key: 'system',
      title: 'Системные шаблоны',
      items: items.filter((template) => template.ownerType === 'system'),
    },
    {
      key: 'company',
      title: 'Шаблоны компании',
      items: items.filter((template) => template.ownerType === 'company'),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны"
        description="Системные и корпоративные шаблоны. Instantiation создаёт независимый draft."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Создать шаблон
          </Button>
        }
      />
      <Modal
        open={createOpen}
        onOpenChange={(next) => {
          if (!createTemplate.isPending) setCreateOpen(next);
        }}
        title="Новый корпоративный шаблон"
        description="После создания откроется общий редактор структуры, уроков и тестов."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={createTemplate.isPending}
              onClick={() => setCreateOpen(false)}
            >
              Отмена
            </Button>
            <Button
              loading={createTemplate.isPending}
              disabled={!createTitle.trim()}
              onClick={() => createTemplate.mutate()}
            >
              Создать и открыть
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Название"
            value={createTitle}
            onChange={(event) => setCreateTitle(event.target.value)}
            autoFocus
          />
          <Textarea
            label="Описание"
            rows={3}
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value)}
          />
        </div>
      </Modal>
      <Input
        value={q}
        onChange={(e) => {
          const next = e.target.value;
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            if (next) params.set('q', next);
            else params.delete('q');
            params.delete('page');
            return params;
          });
        }}
        placeholder="Поиск шаблона…"
        className="max-w-md"
      />

      {templatesQuery.isError ? (
        <ErrorState
          title="Каталог шаблонов недоступен"
          description="Не удалось получить server-driven список шаблонов."
          onRetry={() => void templatesQuery.refetch()}
        />
      ) : templatesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title={q ? 'Шаблоны не найдены' : 'Шаблонов нет'}
          description={
            q
              ? 'Измените поисковый запрос или очистите поле.'
              : 'Системные шаблоны появятся после seed на backend.'
          }
          action={
            q ? (
              <Button
                variant="secondary"
                onClick={() =>
                  setSearchParams((prev) => {
                    const next = new URLSearchParams(prev);
                    next.delete('q');
                    next.delete('page');
                    return next;
                  })
                }
              >
                Сбросить поиск
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">{group.title}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {group.items.map((tpl) => (
                  <li
                    key={tpl.id}
                    className="flex flex-col rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
                  >
                    <h3 className="font-semibold text-slate-900">{tpl.title}</h3>
                    {tpl.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{tpl.description}</p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <Link to={academyRoutes.template(tpl.id)}>
                        <Button size="sm" variant="secondary">
                          Открыть
                        </Button>
                      </Link>
                      {tpl.capabilities.canInstantiate && tpl.latestVersionId ? (
                        <Button
                          size="sm"
                          loading={instantiate.isPending}
                          disabled={instantiate.isPending}
                          onClick={() =>
                            instantiate.mutate({
                              templateVersionId: tpl.latestVersionId!,
                              expectedLessonCount: tpl.lessonCount,
                            })
                          }
                        >
                          Создать курс
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {templatesQuery.data && templatesQuery.data.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Страницы шаблонов">
          <span className="text-sm text-slate-500">
            Страница {templatesQuery.data.page} из {templatesQuery.data.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (page <= 2) next.delete('page');
                  else next.set('page', String(page - 1));
                  return next;
                })
              }
            >
              Назад
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= templatesQuery.data.totalPages}
              onClick={() =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('page', String(page + 1));
                  return next;
                })
              }
            >
              Далее
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
