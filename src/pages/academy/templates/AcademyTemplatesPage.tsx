import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useTitle } from '@reactuses/core';
import { FileStack } from 'lucide-react';
import { academyTemplatesApi } from '@/api/academy';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Button, Input } from '@/components/ui';
import { academyRoutes } from '@/lib/academy';
import { toast } from '@/stores/toast';
import { useDebouncedValue } from '@/lib/useDebouncedValue';

const SYSTEM_TEMPLATE_TITLES = [
  'Онбординг нового сотрудника',
  'Онбординг менеджера по продажам',
  'Адаптация руководителя',
  'Знакомство с компанией и продуктом',
  'Информационная безопасность',
  'Стандарты обслуживания',
  'Основы CRM',
  'Проверка знаний по регламентам',
  'Подготовка стажёра',
  'Курс для внешнего партнёра',
];

export function AcademyTemplatesPage() {
  useTitle('Шаблоны — Академия — TeamOS');
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const debouncedQ = useDebouncedValue(q);
  const requestedPage = Number(searchParams.get('page') ?? '1');
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const queryClient = useQueryClient();

  const filters = useMemo(
    () => ({ q: debouncedQ || undefined, page, pageSize: 50 }),
    [debouncedQ, page],
  );
  const templatesQuery = useQuery({
    queryKey: queryKeys.academyV2.templates(filters),
    queryFn: ({ signal }) => academyTemplatesApi.list(filters, { signal }),
  });

  const instantiate = useMutation({
    mutationFn: (templateVersionId: string) =>
      academyTemplatesApi.instantiate(
        templateVersionId,
        {},
        { idempotencyKey: crypto.randomUUID() },
      ),
    onSuccess: (course) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.academyV2.coursesRoot });
      toast.success('Курс создан из шаблона');
      window.location.assign(academyRoutes.builder(course.id));
    },
    onError: (e) =>
      toast.error(e instanceof ApiError ? e.message : 'Не удалось создать курс из шаблона'),
  });

  const items = templatesQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Шаблоны"
        description="Системные и корпоративные шаблоны. Instantiation создаёт независимый draft."
      />
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
        <div className="space-y-4">
          <ErrorState
            title="Каталог шаблонов недоступен"
            description="Пока backend не отдаёт /academy/templates, показан список системных шаблонов (локальный fallback)."
            onRetry={() => void templatesQuery.refetch()}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {SYSTEM_TEMPLATE_TITLES.map((title) => (
              <li
                key={title}
                className="rounded-xl border border-dashed border-slate-200 bg-surface p-4 text-sm"
              >
                <p className="font-medium text-slate-900">{title}</p>
                <p className="mt-1 text-xs text-slate-500">Системный шаблон · ожидает backend seed</p>
              </li>
            ))}
          </ul>
        </div>
      ) : templatesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Шаблонов нет"
          description="Системные шаблоны появятся после seed на backend."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{tpl.title}</h3>
                <span className="text-xs text-slate-500">
                  {tpl.ownerType === 'system' ? 'Системный' : 'Компания'}
                </span>
              </div>
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
                    onClick={() => instantiate.mutate(tpl.latestVersionId!)}
                  >
                    Создать курс
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {templatesQuery.data && templatesQuery.data.totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Страницы шаблонов">
          <span className="text-sm text-slate-500">Страница {templatesQuery.data.page} из {templatesQuery.data.totalPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); if (page <= 2) next.delete('page'); else next.set('page', String(page - 1)); return next; })}>Назад</Button>
            <Button size="sm" variant="secondary" disabled={page >= templatesQuery.data.totalPages} onClick={() => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('page', String(page + 1)); return next; })}>Далее</Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
