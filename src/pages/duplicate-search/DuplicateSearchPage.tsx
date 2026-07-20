import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { duplicatesApi, type DuplicateSettings } from '@/api/rakurs/duplicates';
import type { RakursContext } from '@/api/rakurs/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { ErrorState } from '@/components/layout/ErrorState';
import { Tabs } from '@/components/ui';
import { toast } from '@/stores/toast';
import { MassSearchTab } from './MassSearchTab';
import { RulesTab } from './RulesTab';
import { BackgroundTab } from './BackgroundTab';

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось сохранить настройки';

function DuplicateSearchContent({ context }: { context: RakursContext }) {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<DuplicateSettings | null>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.duplicates.settings(context.accountId),
    queryFn: ({ signal }) => duplicatesApi.getSettings(context, signal),
  });
  const resourcesQuery = useQuery({
    queryKey: queryKeys.duplicates.resources(context.accountId),
    queryFn: ({ signal }) => duplicatesApi.getResources(context, signal),
  });
  const paidQuery = useQuery({
    queryKey: queryKeys.duplicates.paidStatus(context.accountId),
    queryFn: ({ signal }) => duplicatesApi.getPaidStatus(context, signal),
  });

  useEffect(() => {
    if (settingsQuery.data) setSettings(structuredClone(settingsQuery.data));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (value: DuplicateSettings) => duplicatesApi.updateSettings(context, value),
    onSuccess: (value) => {
      queryClient.setQueryData(queryKeys.duplicates.settings(context.accountId), value);
      toast.success('Настройки сохранены');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (settingsQuery.isPending || resourcesQuery.isPending) {
    return (
      <div className="mt-6 space-y-4">
        <div className="h-10 w-96 max-w-full animate-pulse rounded-md bg-slate-200/60" />
        <div className="h-80 animate-pulse rounded-lg bg-slate-200/60" />
      </div>
    );
  }

  if (settingsQuery.isError || resourcesQuery.isError) {
    return (
      <div className="mt-6">
        <ErrorState
          title="Не удалось загрузить настройки автопоиска"
          description="Проверьте подключение к сервису Rakurs и повторите попытку."
          onRetry={() => {
            settingsQuery.refetch();
            resourcesQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!settings || !resourcesQuery.data) return null;

  const save = () => {
    if (!saveMutation.isPending) saveMutation.mutate(settings);
  };

  return (
    <Tabs
      className="mt-6"
      defaultValue="mass"
      items={[
        {
          value: 'mass',
          label: 'Массовый поиск',
          content: (
            <MassSearchTab
              context={context}
              settings={settings}
              resources={resourcesQuery.data}
              onSettingsChange={setSettings}
              onSave={save}
              saving={saveMutation.isPending}
            />
          ),
        },
        {
          value: 'rules',
          label: 'Правила',
          content: <RulesTab context={context} resources={resourcesQuery.data} />,
        },
        {
          value: 'background',
          label: 'Фоновый режим',
          content: (
            <BackgroundTab
              settings={settings}
              resources={resourcesQuery.data}
              paidStatus={paidQuery.data}
              onSettingsChange={setSettings}
              onSave={save}
              saving={saveMutation.isPending}
            />
          ),
        },
      ]}
    />
  );
}

export function DuplicateSearchPage() {
  useTitle('Автопоиск дубликатов — TeamOS');
  const companyQuery = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  const accountId = companyQuery.data?.amoAccountId?.trim();
  const context = useMemo<RakursContext | null>(
    () => (accountId ? { accountId, appName: 'rkrs_duplicates_v2' } : null),
    [accountId],
  );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <PageHeader
        title="Автопоиск дубликатов"
        description="Ищите и объединяйте повторяющиеся контакты, компании и сделки в amoCRM."
      />

      {companyQuery.isPending && (
        <div className="mt-6 h-56 animate-pulse rounded-lg bg-slate-200/60" />
      )}
      {companyQuery.isError && (
        <div className="mt-6">
          <ErrorState
            title="Не удалось загрузить данные компании"
            onRetry={() => companyQuery.refetch()}
          />
        </div>
      )}
      {!companyQuery.isPending && !companyQuery.isError && !context && (
        <div className="mt-6">
          <EmptyState
            icon={SearchX}
            title="Не указан amoCRM Account ID"
            description="Добавьте идентификатор аккаунта amoCRM в настройках компании, чтобы подключить автопоиск дубликатов."
            action={
              <Link
                to="/settings"
                className="inline-flex h-9.5 items-center justify-center rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Перейти в настройки
              </Link>
            }
          />
        </div>
      )}
      {context && <DuplicateSearchContent context={context} />}
    </div>
  );
}
