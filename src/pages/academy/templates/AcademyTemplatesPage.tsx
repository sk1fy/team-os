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
          title="Шаблонов нет"
          description="Системные шаблоны появятся после seed на backend."
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
                        <Button size="sm" variant="secondary">Открыть</Button>
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
            </section>
          ))}
        </div>
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
