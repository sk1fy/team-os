import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/api';
import { queryKeys } from '@/api/queryKeys';
import { taskControlApi as api, type TaskControlConnection } from '@/api/taskControl';
import { useSectionTab } from '@/components/layout/chromeSlots';
import { useSectionTabCount } from '@/components/layout/tabCounts';
import { readReferences } from './model';
import type { TaskControlState } from './shared';
import { TaskConnectionTab } from './TaskConnectionTab';
import { TaskRulesTab } from './TaskRulesTab';
import { useRulesDraft } from './useRulesDraft';

export function TaskControlPage() {
  const tab = useSectionTab(['rules', 'connection'] as const, 'rules');
  const company = useQuery({ queryKey: queryKeys.company, queryFn: authApi.getCompany });
  const account = company.data?.amoAccountId?.trim() ?? '';
  const status = useQuery({
    queryKey: ['task-control', company.data?.id, 'installation', account],
    queryFn: () => api.getTaskControlInstallation(account),
    enabled: !!account,
    retry: false,
  });
  const connections = useQuery({
    queryKey: ['task-control', company.data?.id, 'connections', account],
    queryFn: () => api.getTaskControlConnections(),
    enabled: !!account,
    retry: false,
  });
  const connection = connections.data?.find(
    (c) => c.scope.accountId === account && c.state === 'active',
  );
  const state: TaskControlState = {
    company,
    account,
    status,
    connections,
    connection,
    installed: status.data?.state === 'installed',
  };
  return (
    <div className="max-w-[1360px] px-4 pt-5 pb-14 sm:px-6">
      <Workspace
        key={connection?.scope.bindingId ?? 'none'}
        tab={tab}
        state={state}
        connection={
          connection && { ...connection, installation: status.data ?? connection.installation }
        }
      />
    </div>
  );
}

/**
 * Черновик правил живёт выше вкладок: переход на «Подключение» и обратно не теряет
 * несохранённые правки. Новое подключение (другой bindingId) начинает с чистого состояния.
 */
function Workspace({
  tab,
  state,
  connection,
}: {
  tab: 'rules' | 'connection';
  state: TaskControlState;
  connection: TaskControlConnection | undefined;
}) {
  const editor = useRulesDraft(connection);
  useSectionTabCount('rules', editor.draft ? editor.rules.length : undefined);
  const bindingId = connection?.scope.bindingId ?? '';
  const references = useQuery({
    queryKey: ['task-control', state.company.data?.id, 'references', bindingId],
    queryFn: ({ signal }) => api.getTaskControlReferences(bindingId, signal),
    select: readReferences,
    enabled: !!bindingId,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return tab === 'connection' ? (
    <TaskConnectionTab state={state} />
  ) : (
    <TaskRulesTab
      state={state}
      editor={editor}
      references={{ data: references.data, loading: references.isPending && !!bindingId }}
    />
  );
}
