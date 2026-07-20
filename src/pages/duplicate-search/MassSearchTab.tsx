import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Search,
  Square,
} from 'lucide-react';
import { queryKeys } from '@/api/queryKeys';
import {
  duplicatesApi,
  type DuplicateEntity,
  type DuplicateResultDetail,
  type DuplicateResultItem,
  type DuplicateResources,
  type DuplicateSettings,
} from '@/api/rakurs/duplicates';
import type { RakursContext } from '@/api/rakurs/client';
import { Button, Modal, Select } from '@/components/ui';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { toast } from '@/stores/toast';
import { CheckField, FieldClausesEditor, SectionCard } from './controls';

const entityLabels: Record<DuplicateResultItem['entityType'], string> = {
  contacts: 'Контакт',
  companies: 'Компания',
  leads: 'Сделка',
  customers: 'Покупатель',
};

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function directLink(item: DuplicateResultItem | DuplicateResultDetail) {
  return item.link;
}

export function MassSearchTab({
  context,
  settings,
  resources,
  onSettingsChange,
  onSave,
  saving,
}: {
  context: RakursContext;
  settings: DuplicateSettings;
  resources: DuplicateResources;
  onSettingsChange: (settings: DuplicateSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const queryClient = useQueryClient();
  const [resultsOpen, setResultsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<'old' | 'new'>('new');
  const [details, setDetails] = useState<DuplicateResultItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const statusQuery = useQuery({
    queryKey: queryKeys.duplicates.massStatus(context.accountId),
    queryFn: ({ signal }) => duplicatesApi.getMassStatus(context, signal),
    refetchInterval: (query) => (query.state.data?.status === 1 ? 3000 : false),
  });
  const resultsQuery = useQuery({
    queryKey: queryKeys.duplicates.massResults(context.accountId, page),
    queryFn: ({ signal }) => duplicatesApi.getMassResults(context, page, signal),
    enabled: resultsOpen,
  });

  const refreshStatus = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.duplicates.massStatus(context.accountId) });
  const runMutation = useMutation({
    mutationFn: async () => {
      const savedSettings = structuredClone(settings);
      await duplicatesApi.updateSettings(context, savedSettings);
      queryClient.setQueryData(queryKeys.duplicates.settings(context.accountId), savedSettings);
      await duplicatesApi.runMassSearch(context);
    },
    onSuccess: () => {
      toast.success('Массовый поиск запущен');
      refreshStatus();
    },
    onError: (error) => toast.error(errorText(error, 'Не удалось запустить поиск')),
  });
  const stopMutation = useMutation({
    mutationFn: () => duplicatesApi.stopMassSearch(context),
    onSuccess: () => {
      toast.success('Поиск остановлен');
      refreshStatus();
    },
    onError: (error) => toast.error(errorText(error, 'Не удалось остановить поиск')),
  });
  const unionMutation = useMutation({
    mutationFn: () => duplicatesApi.unionMassResults(context, selected, target),
    onSuccess: (message) => {
      toast.success(message);
      setSelected([]);
      setDetails(null);
      setConfirmOpen(false);
      setPage(1);
      queryClient.invalidateQueries({
        queryKey: queryKeys.duplicates.massResults(context.accountId, 1),
      });
      refreshStatus();
    },
    onError: (error) => toast.error(errorText(error, 'Не удалось объединить карточки')),
  });

  const canRun = Object.values(settings.massSearch).some((clause) => clause.fields.length > 0);
  const result = resultsQuery.data;
  const pages = Math.max(1, Math.ceil((result?.totalCount ?? 0) / (result?.limit ?? 100)));
  const eligibleIds = useMemo(
    () =>
      (result?.items ?? [])
        .filter((item) => item.count <= 5 && item.entityType !== 'customers')
        .map((item) => item.id),
    [result],
  );

  const updateMassClause = (entity: DuplicateEntity, clauses: DuplicateSettings['fields']) => {
    const clause = clauses[0];
    if (!clause) return;
    onSettingsChange({
      ...settings,
      massSearch: {
        ...settings.massSearch,
        [entity]: { ...settings.massSearch[entity], ...clause },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        <p>
          amoCRM позволяет объединить не более пяти карточек за один раз. Для больших групп
          запустите объединение несколько раз.
        </p>
      </div>

      <SectionCard
        title="Условия массового поиска"
        description="Дублями считаются карточки с одинаковыми значениями выбранных полей."
        actions={
          <a
            href="https://ssd.rkrs.ru/page/app/rkrs_duplicates_v2?section=1"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            Инструкция <ExternalLink className="size-3.5" />
          </a>
        }
      >
        <div className="space-y-5">
          {(['contacts', 'leads', 'companies'] as const).map((entity) => (
            <div key={entity}>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                {entity === 'contacts' ? 'Контакты' : entity === 'leads' ? 'Сделки' : 'Компании'}
              </h3>
              <FieldClausesEditor
                clauses={[settings.massSearch[entity]]}
                options={resources.fields}
                onChange={(clauses) => updateMassClause(entity, clauses)}
                allowAdd={false}
                optionFilter={(option) => option.entity === entity}
              />
            </div>
          ))}
          <div className="flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4">
            <Button variant="secondary" loading={saving} onClick={onSave}>
              Сохранить условия
            </Button>
            {statusQuery.data?.status === 1 ? (
              <Button
                variant="danger"
                loading={stopMutation.isPending}
                onClick={() => stopMutation.mutate()}
              >
                <Square className="size-4" /> Остановить поиск
              </Button>
            ) : (
              <Button
                disabled={!canRun || saving}
                loading={runMutation.isPending}
                onClick={() => runMutation.mutate()}
              >
                <Search className="size-4" /> Запустить массовый поиск
              </Button>
            )}
          </div>
        </div>
      </SectionCard>

      {statusQuery.isPending && <div className="h-28 animate-pulse rounded-lg bg-slate-200/60" />}
      {statusQuery.isError && (
        <ErrorState
          title="Не удалось получить статус поиска"
          onRetry={() => statusQuery.refetch()}
        />
      )}
      {statusQuery.data && (
        <SectionCard title="Состояние поиска">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {statusQuery.data.status === 1
                  ? 'Поиск выполняется'
                  : statusQuery.data.status === 2
                    ? 'Поиск завершён'
                    : 'Поиск ещё не запускался'}
              </p>
              {statusQuery.data.status === 1 && (
                <p className="mt-1 text-sm text-slate-500">
                  Проверено объектов: {statusQuery.data.countObjects.toLocaleString('ru-RU')}
                </p>
              )}
              {statusQuery.data.resultDate && (
                <p className="mt-1 text-sm text-slate-500">
                  Последняя проверка: {statusQuery.data.resultDate}
                </p>
              )}
            </div>
            {statusQuery.data.status === 2 && (
              <Button
                variant="secondary"
                onClick={() => {
                  setPage(1);
                  setResultsOpen(true);
                }}
              >
                <Eye className="size-4" /> Результаты ({statusQuery.data.resultCount})
              </Button>
            )}
          </div>
        </SectionCard>
      )}

      <Modal
        open={resultsOpen}
        onOpenChange={(open) => {
          setResultsOpen(open);
          if (!open) {
            setSelected([]);
            setDetails(null);
          }
        }}
        title={details ? 'Карточки в группе дублей' : 'Результаты массового поиска'}
        description={details ? `Найдено карточек: ${details.data.length}` : undefined}
        size="xl"
        footer={
          <>
            <Select
              className="mr-auto w-56"
              value={target}
              onValueChange={(value) => setTarget(value as 'old' | 'new')}
              options={[
                { value: 'new', label: 'В новую карточку' },
                { value: 'old', label: 'В старую карточку' },
              ]}
            />
            {details && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDetails(null);
                  setSelected([]);
                }}
              >
                Назад
              </Button>
            )}
            <Button disabled={selected.length === 0} onClick={() => setConfirmOpen(true)}>
              Объединить ({selected.length})
            </Button>
          </>
        }
      >
        {resultsQuery.isPending && <div className="h-72 animate-pulse rounded-lg bg-slate-100" />}
        {resultsQuery.isError && (
          <ErrorState
            title="Не удалось загрузить результаты"
            onRetry={() => resultsQuery.refetch()}
          />
        )}
        {!resultsQuery.isPending &&
          !resultsQuery.isError &&
          !details &&
          result?.items.length === 0 && (
            <EmptyState
              icon={Search}
              title="Дубли не найдены"
              description="В результатах поиска пока пусто."
            />
          )}
        {!resultsQuery.isPending &&
          !resultsQuery.isError &&
          !details &&
          result &&
          result.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left text-sm">
                <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-2 py-3">
                      <CheckField
                        label=""
                        checked={
                          eligibleIds.length > 0 && eligibleIds.every((id) => selected.includes(id))
                        }
                        onCheckedChange={(checked) => setSelected(checked ? eligibleIds : [])}
                      />
                    </th>
                    <th className="px-2 py-3">Сущность</th>
                    <th className="px-2 py-3">Поле</th>
                    <th className="px-2 py-3">Значение</th>
                    <th className="px-2 py-3">Количество</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.items.map((item) => {
                    const eligible = item.count <= 5 && item.entityType !== 'customers';
                    return (
                      <tr key={item.id} className="text-slate-700">
                        <td className="px-2 py-3">
                          <CheckField
                            label=""
                            disabled={!eligible}
                            checked={selected.includes(item.id)}
                            onCheckedChange={(checked) =>
                              setSelected((current) =>
                                checked
                                  ? [...new Set([...current, item.id])]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-3">{entityLabels[item.entityType]}</td>
                        <td className="px-2 py-3">{item.fieldName || '—'}</td>
                        <td className="max-w-64 truncate px-2 py-3" title={item.oldValue}>
                          {item.oldValue || '—'}
                        </td>
                        <td className="px-2 py-3">
                          {item.count}
                          {!eligible && (
                            <span className="ml-1 text-xs text-danger-600">(нельзя склеить)</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDetails(item);
                              setSelected(item.count <= 5 ? [item.id] : []);
                            }}
                          >
                            Подробнее
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <span className="text-sm text-slate-500">
                    Страница {page} из {pages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= pages}
                    onClick={() => setPage((current) => Math.min(pages, current + 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        {details && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-150 text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-2 py-3">ID</th>
                  <th className="px-2 py-3">Сущность</th>
                  <th className="px-2 py-3">Поле</th>
                  <th className="px-2 py-3">Значение</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {details.data.map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-3">{item.id}</td>
                    <td className="px-2 py-3">{entityLabels[item.entityType]}</td>
                    <td className="px-2 py-3">{item.fieldName || '—'}</td>
                    <td className="px-2 py-3">{item.oldValue || '—'}</td>
                    <td className="px-2 py-3 text-right">
                      {directLink(item) && (
                        <a
                          href={directLink(item)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary-700 hover:text-primary-800"
                        >
                          Открыть
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Объединить выбранные дубли?"
        description="Действие невозможно отменить, часть данных может быть потеряна."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Отмена
            </Button>
            <Button loading={unionMutation.isPending} onClick={() => unionMutation.mutate()}>
              Я всё понимаю, объединить
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Будут обработаны выбранные группы: {selected.length}. Рекомендуем ещё раз проверить
          условия поиска.
        </p>
      </Modal>
    </div>
  );
}
