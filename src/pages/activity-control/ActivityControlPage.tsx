import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTitle } from '@reactuses/core';
import { Plus } from 'lucide-react';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import {
  activityControlApi as api,
  type ActivityPanel,
  type ActivityScope,
} from '@/api/activityControl';
import { useSectionTab } from '@/components/layout/chromeSlots';
import { useSectionTabCount } from '@/components/layout/tabCounts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Modal } from '@/components/ui';
import { toast } from '@/stores/toast';
import { ConnectionTab, LegacyLink, NotConnected } from './ConnectionTab';
import { DashboardDrawer } from './DashboardDrawer';
import { DashboardsTab } from './DashboardsTab';
import { TaskPanelEditor } from './TaskPanelTab';
import { Failure, Loading } from './shared';
import { ACTIVITY_TABS, isAccessError, type ActivityTab } from './model';

const TITLES: Record<ActivityTab, string> = {
  dashboards: 'Дашборды',
  'task-panel': 'Панель задач',
  connection: 'Подключение',
};
const DESCRIPTION = 'Дашборды активности сотрудников и доступ к панели задач в amoCRM.';

function Header({ tab, actions }: { tab: ActivityTab; actions?: ReactNode }) {
  return <PageHeader title={TITLES[tab]} description={DESCRIPTION} actions={actions} />;
}

type ConnectionView = (employees?: number) => ReactNode;

function ConnectedActivity({
  scope,
  bindingId,
  tab,
  connectionView,
}: {
  scope: ActivityScope;
  bindingId: string;
  tab: ActivityTab;
  connectionView: ConnectionView;
}) {
  const bound = useMemo(() => api.forBinding(bindingId), [bindingId]);
  const cache = useQueryClient();
  const key = useMemo(
    () => [
      'activity-control',
      scope.companyId,
      scope.installationId,
      scope.integrationId,
      scope.accountId,
    ],
    [scope],
  );
  const directory = useQuery({
    queryKey: [...key, 'employees'],
    queryFn: ({ signal }) => bound.employees(signal),
    retry: false,
  });
  const panels = useQuery({
    queryKey: [...key, 'panels'],
    queryFn: ({ signal }) => bound.panels(signal),
    retry: false,
    enabled: tab === 'dashboards',
  });
  useSectionTabCount('dashboards', panels.data?.panels.length);
  const tasks = useQuery({
    queryKey: [...key, 'task-panel'],
    queryFn: ({ signal }) => bound.taskPanel(signal),
    retry: false,
    enabled: tab === 'task-panel',
  });
  const [editor, setEditor] = useState<
    { kind: 'create' } | { kind: 'edit'; panel: ActivityPanel } | null
  >(null);
  const [share, setShare] = useState<{ panel: ActivityPanel; commandId: string } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<unknown>(null);
  // Ссылка доступа приходит только в ответе на создание или замену — держим её до ухода со страницы.
  const [issued, setIssued] = useState<Record<string, string>>({});

  function remember(panel: ActivityPanel) {
    const url = panel.shareUrl;
    if (url) setIssued((prev) => ({ ...prev, [panel.id]: url }));
    void cache.invalidateQueries({ queryKey: [...key, 'panels'] });
  }
  async function rotate() {
    if (!share) return;
    setShareBusy(true);
    setShareError(null);
    try {
      remember(await bound.rotate(share.panel.id, share.commandId));
      setShare(null);
    } catch (e) {
      setShareError(e);
    } finally {
      setShareBusy(false);
    }
  }

  const denied = (
    tab === 'dashboards'
      ? [panels.error, directory.error]
      : tab === 'task-panel'
        ? [tasks.error, directory.error]
        : []
  ).find(isAccessError);

  let content: ReactNode;
  if (tab === 'connection') content = connectionView(directory.data?.users.length);
  else if (denied) content = <Failure error={denied} />;
  else if (tab === 'dashboards')
    content = (
      <DashboardsTab
        panels={panels}
        directory={directory}
        issued={issued}
        onCreate={() => setEditor({ kind: 'create' })}
        onEdit={(panel) => setEditor({ kind: 'edit', panel })}
        onShare={(panel) => {
          setShare({ panel, commandId: crypto.randomUUID() });
          setShareError(null);
        }}
      />
    );
  else
    content = (
      <div className="flex flex-col gap-4">
        {(tasks.error || directory.error) && (
          <Failure
            error={tasks.error || directory.error}
            reload={() => {
              void tasks.refetch();
              void directory.refetch();
            }}
          />
        )}
        {tasks.data && directory.data ? (
          <TaskPanelEditor
            bindingId={bindingId}
            key={scope.installationId}
            initial={tasks.data}
            directory={directory.data}
            saved={(value) => cache.setQueryData([...key, 'task-panel'], value)}
          />
        ) : !tasks.error && !directory.error ? (
          <Loading>Загрузка настроек…</Loading>
        ) : null}
      </div>
    );

  const replacing = share?.panel.shareUrlIssued ?? true;
  return (
    <>
      <Header
        tab={tab}
        actions={
          tab === 'dashboards' && !denied ? (
            <Button onClick={() => setEditor({ kind: 'create' })} disabled={!directory.data}>
              <Plus className="size-4" />
              Новый дашборд
            </Button>
          ) : undefined
        }
      />
      {content}
      {editor && directory.data && tab === 'dashboards' && (
        <DashboardDrawer
          key={editor.kind === 'edit' ? editor.panel.id : 'create'}
          panel={editor.kind === 'edit' ? editor.panel : undefined}
          directory={directory.data}
          close={() => setEditor(null)}
          save={async (input, commandId) => {
            const result =
              editor.kind === 'edit'
                ? await bound.update(editor.panel.id, { ...input, revision: editor.panel.revision })
                : await bound.create(input, commandId);
            remember(result);
            toast.success(editor.kind === 'edit' ? 'Дашборд сохранён' : 'Дашборд создан');
          }}
        />
      )}
      {share && (
        <Modal
          open
          title={replacing ? 'Заменить ссылку доступа?' : 'Выдать ссылку доступа?'}
          onOpenChange={(open) => {
            if (!open && !shareBusy) setShare(null);
          }}
          footer={
            <>
              <Button variant="secondary" disabled={shareBusy} onClick={() => setShare(null)}>
                Отмена
              </Button>
              <Button disabled={shareBusy} onClick={() => void rotate()}>
                {replacing ? 'Заменить ссылку' : 'Выдать ссылку'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              {replacing
                ? `Старая ссылка дашборда «${share.panel.name}» перестанет работать. Новая будет показана один раз.`
                : `Ссылка на дашборд «${share.panel.name}» будет показана один раз.`}{' '}
              После ошибки повтор сохраняет ту же операцию.
            </p>
            {shareError != null && <Failure error={shareError} title="Не удалось выдать ссылку" />}
          </div>
        </Modal>
      )}
    </>
  );
}

function CompanyActivity({ companyId, tab }: { companyId: string; tab: ActivityTab }) {
  const connection = useQuery({
    queryKey: ['activity-control', companyId, 'connection'],
    queryFn: ({ signal }) => api.connection(signal),
    retry: false,
    staleTime: 0,
  });
  const recheck = () => void connection.refetch();
  // Повторная проверка с ошибкой не сбрасывает открытые черновики — кроме потери доступа.
  if (!connection.data || isAccessError(connection.error))
    return (
      <>
        <Header tab={tab} />
        {connection.error ? (
          <Failure error={connection.error} reload={recheck} />
        ) : (
          <Loading>Проверка подключения Activity…</Loading>
        )}
      </>
    );
  const data = connection.data;
  const connectionView: ConnectionView = (employees) => (
    <ConnectionTab
      connection={data}
      checkedAt={connection.dataUpdatedAt}
      checking={connection.isFetching}
      error={connection.error ?? undefined}
      onCheck={recheck}
      employees={employees}
    />
  );
  if (data.state !== 'configured')
    return (
      <>
        <Header tab={tab} />
        {tab === 'connection' ? (
          connectionView()
        ) : (
          <NotConnected message={data.message} checking={connection.isFetching} onCheck={recheck} />
        )}
      </>
    );
  return (
    <ConnectedActivity
      key={`${companyId}:${data.bindingId}`}
      scope={data.scope}
      bindingId={data.bindingId}
      tab={tab}
      connectionView={connectionView}
    />
  );
}

export function ActivityControlPage() {
  useTitle('Контроль активности | TeamOS');
  const tab = useSectionTab(ACTIVITY_TABS, 'dashboards');
  const company = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  return (
    <div className="flex max-w-[1360px] flex-col gap-5 px-4 pt-5 pb-14 sm:px-6">
      {company.data ? (
        <CompanyActivity key={company.data.id} companyId={company.data.id} tab={tab} />
      ) : (
        <>
          <Header tab={tab} />
          {company.error ? (
            <Failure error={company.error} />
          ) : (
            <Loading>Загрузка компании…</Loading>
          )}
        </>
      )}
      {tab === 'connection' && <LegacyLink />}
    </div>
  );
}
